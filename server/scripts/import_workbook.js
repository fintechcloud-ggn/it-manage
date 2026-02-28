const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query } = require('../db');
const bcrypt = require('bcryptjs');

function excelDateToIso(n) {
  const serial = Number(n);
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const ms = serial * 24 * 60 * 60 * 1000;
  const d = new Date(epoch.getTime() + ms);
  return d.toISOString();
}

function normalize(v) {
  if (v == null) return '';
  return String(v).trim();
}

async function ensureBrand(name) {
  const n = normalize(name) || 'Generic';
  await query('INSERT IGNORE INTO brands (name) VALUES (?)', [n]);
  const rows = await query('SELECT id, name FROM brands WHERE name = ? LIMIT 1', [n]);
  return rows[0];
}

async function ensureModel(brandId, modelName, category) {
  const name = normalize(modelName) || 'Generic Asset';
  const cat = normalize(category) || 'Laptop';
  await query('INSERT IGNORE INTO asset_models (brand_id, name, category) VALUES (?, ?, ?)', [brandId, name, cat]);
  const rows = await query('SELECT id, name, category FROM asset_models WHERE brand_id = ? AND name = ? LIMIT 1', [brandId, name]);
  return rows[0];
}

async function upsertUserByEmployee(row) {
  const employeeCode = normalize(row['Employee Code']);
  const name = normalize(row['Employee Name']);
  const company = normalize(row['Company']);
  const department = normalize(row['Department']);
  const designation = normalize(row['Designation']);
  const location = normalize(row['Location']);
  const employmentType = normalize(row['Employment Type']);
  const employmentStatus = normalize(row['Status']);

  if (!name) return null;

  let existing = null;
  if (employeeCode) {
    const byCode = await query('SELECT id FROM users WHERE employee_code = ? LIMIT 1', [employeeCode]);
    if (byCode[0]) existing = byCode[0];
  }

  if (!existing) {
    const byName = await query('SELECT id FROM users WHERE name = ? AND role = ? LIMIT 1', [name, 'user']);
    if (byName[0]) existing = byName[0];
  }

  const safeCode = employeeCode || `EMP-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
  const email = `${safeCode.toLowerCase()}@import.local`;

  if (existing) {
    await query(
      `UPDATE users
       SET name = ?, company = ?, department = ?, designation = ?, location = ?, employment_type = ?, employment_status = ?, employee_code = COALESCE(NULLIF(?, ''), employee_code)
       WHERE id = ?`,
      [name, company || null, department || null, designation || null, location || null, employmentType || null, employmentStatus || null, employeeCode || null, existing.id],
    );
    const rows = await query('SELECT id, name, employee_code FROM users WHERE id = ? LIMIT 1', [existing.id]);
    return rows[0];
  }

  const pass = bcrypt.hashSync('password', 8);
  const result = await query(
    `INSERT INTO users (name, email, role, password, employee_code, company, department, designation, location, employment_type, employment_status)
     VALUES (?, ?, 'user', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, email, pass, employeeCode || null, company || null, department || null, designation || null, location || null, employmentType || null, employmentStatus || null],
  );
  const rows = await query('SELECT id, name, employee_code FROM users WHERE id = ? LIMIT 1', [result.insertId]);
  return rows[0];
}

async function findUser(employeeCode, employeeName) {
  const code = normalize(employeeCode);
  const name = normalize(employeeName);
  if (code) {
    const byCode = await query('SELECT id, name FROM users WHERE employee_code = ? LIMIT 1', [code]);
    if (byCode[0]) return byCode[0];
  }
  if (name) {
    const byName = await query('SELECT id, name FROM users WHERE name = ? LIMIT 1', [name]);
    if (byName[0]) return byName[0];
  }
  return null;
}

async function upsertAssetAndAssign({ type, modelText, serial, employeeCode, employeeName, notes, provider }) {
  const model = normalize(modelText) || `${type} Asset`;
  const serialNo = normalize(serial) || `${type.slice(0, 3).toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const brandGuess = provider ? normalize(provider) : (model.split(' ')[0] || 'Generic');
  const brand = await ensureBrand(brandGuess);
  const modelRow = await ensureModel(brand.id, model, type);

  let asset = (await query('SELECT id, status FROM assets WHERE serial = ? LIMIT 1', [serialNo]))[0];
  if (!asset) {
    const result = await query(
      `INSERT INTO assets (name, type, brand_id, model_id, serial, status, notes)
       VALUES (?, ?, ?, ?, ?, 'available', ?)`,
      [model, type, brand.id, modelRow.id, serialNo, normalize(notes) || null],
    );
    asset = { id: result.insertId, status: 'available' };
  }

  const user = await findUser(employeeCode, employeeName);
  if (!user) return { imported: true, assigned: false };

  const active = await query('SELECT id FROM allocations WHERE asset_id = ? AND returned_at IS NULL LIMIT 1', [asset.id]);
  if (!active[0]) {
    await query('INSERT INTO allocations (asset_id, user_id, allocated_at, notes) VALUES (?, ?, NOW(), ?)', [asset.id, user.id, normalize(notes) || null]);
    await query("UPDATE assets SET status = 'allocated' WHERE id = ?", [asset.id]);
    return { imported: true, assigned: true };
  }
  return { imported: true, assigned: false };
}

function loadWorkbookRows(filePath) {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries().reduce((acc, e) => (acc[e.entryName] = e.getData().toString('utf8'), acc), {});

  const parser = require('fast-xml-parser');
  const options = { ignoreAttributes: false, attributeNamePrefix: '', trimValues: false };
  const xmlParser = new parser.XMLParser(options);

  const workbook = xmlParser.parse(entries['xl/workbook.xml']);
  const rels = xmlParser.parse(entries['xl/_rels/workbook.xml.rels']);

  const relList = Array.isArray(rels.Relationships.Relationship)
    ? rels.Relationships.Relationship
    : [rels.Relationships.Relationship];
  const relMap = Object.fromEntries(relList.map((r) => [r.Id, r.Target]));

  let sharedStrings = [];
  if (entries['xl/sharedStrings.xml']) {
    const sst = xmlParser.parse(entries['xl/sharedStrings.xml']);
    const si = sst.sst?.si || [];
    const arr = Array.isArray(si) ? si : [si];
    sharedStrings = arr.map((x) => {
      if (typeof x.t === 'string') return x.t;
      if (Array.isArray(x.r)) return x.r.map((r) => r.t || '').join('');
      if (x.r?.t) return x.r.t;
      return '';
    });
  }

  const sheets = workbook.workbook.sheets.sheet;
  const sheetArr = Array.isArray(sheets) ? sheets : [sheets];

  const out = {};
  for (const s of sheetArr) {
    const rid = s['r:id'];
    const target = relMap[rid];
    if (!target || !target.startsWith('worksheets/')) continue;
    const xml = entries[`xl/${target}`];
    if (!xml) continue;
    const ws = xmlParser.parse(xml);
    const rows = ws.worksheet?.sheetData?.row || [];
    const rowArr = Array.isArray(rows) ? rows : [rows];
    const table = rowArr.map((row) => {
      const cells = row.c ? (Array.isArray(row.c) ? row.c : [row.c]) : [];
      const vals = {};
      for (const c of cells) {
        const ref = c.r || '';
        const col = ref.replace(/[0-9]/g, '');
        let v = c.v ?? '';
        if (c.t === 's') {
          const idx = Number(v);
          v = Number.isFinite(idx) ? (sharedStrings[idx] || '') : '';
        }
        vals[col] = String(v ?? '');
      }
      return vals;
    });
    out[s.name] = table;
  }
  return out;
}

function toRecords(rows) {
  if (!rows || rows.length === 0) return [];
  const headerRow = rows[0];
  const keys = Object.keys(headerRow).sort();
  const headers = keys.map((k) => normalize(headerRow[k]));
  const records = [];
  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i];
    const obj = {};
    let nonEmpty = 0;
    keys.forEach((k, idx) => {
      const h = headers[idx] || `col_${idx}`;
      const v = normalize(r[k] || '');
      obj[h] = v;
      if (v) nonEmpty += 1;
    });
    if (nonEmpty > 1) records.push(obj);
  }
  return records;
}

async function run(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const workbook = loadWorkbookRows(filePath);

  const bio = toRecords(workbook['Biometric'] || []);
  const laptops = toRecords(workbook['Laptop'] || []);
  const mobiles = toRecords(workbook['Mobile'] || []);
  const sims = toRecords(workbook['SIM'] || []);

  let employeesImported = 0;
  let assetsImported = 0;
  let assignmentsCreated = 0;

  for (const row of bio) {
    const code = normalize(row['Employee Code']);
    const name = normalize(row['Employee Name']);
    if (!name) continue;
    const user = await upsertUserByEmployee(row);
    if (user) employeesImported += 1;
  }

  for (const row of laptops) {
    const status = normalize(row['Status']).toLowerCase();
    if (!normalize(row['Laptop Brand']) && !normalize(row['Serial Number'])) continue;
    const result = await upsertAssetAndAssign({
      type: 'Laptop',
      modelText: normalize(row['Laptop Brand']),
      serial: normalize(row['Serial Number']) || normalize(row['Product No.']),
      employeeCode: normalize(row['Employee Code']),
      employeeName: normalize(row['Emloyee Name']) || normalize(row['Employee Name']),
      notes: normalize(row['Remark']) || normalize(row['Laptop Vendors']),
    });
    if (result.imported) assetsImported += 1;
    if (status === 'active' && result.assigned) assignmentsCreated += 1;
  }

  for (const row of mobiles) {
    const status = normalize(row['Status']).toLowerCase();
    const imei1 = normalize(row['IMEI NO. 1']);
    const imei2 = normalize(row['IMEI NO. 2']);
    if (!normalize(row['Mobile']) && !imei1) continue;
    const result = await upsertAssetAndAssign({
      type: 'Mobile',
      modelText: normalize(row['Mobile']),
      serial: imei1 || imei2,
      employeeCode: normalize(row['Employee Code']),
      employeeName: normalize(row['Emloyee Name']) || normalize(row['Employee Name']),
      notes: normalize(row['Remark']) || (imei2 ? `IMEI2: ${imei2}` : ''),
    });
    if (result.imported) assetsImported += 1;
    if (status === 'active' && result.assigned) assignmentsCreated += 1;
  }

  for (const row of sims) {
    const simNumber = normalize(row['SIM Number']);
    const provider = normalize(row['Service Provider']);
    if (!simNumber || !provider) continue;

    const status = normalize(row['STATUS']).toLowerCase();
    const currentStatus = normalize(row['Crunt STATUS']) || normalize(row['Current SIM Status']);
    const result = await upsertAssetAndAssign({
      type: 'Sim Card',
      modelText: `${provider} SIM`,
      serial: simNumber,
      employeeCode: normalize(row['Employee Code']),
      employeeName: normalize(row['Emloyee Name']) || normalize(row['Employee Name']),
      notes: `${currentStatus ? `Current Status: ${currentStatus}. ` : ''}${normalize(row['Remark'])}`.trim(),
      provider,
    });
    if (result.imported) assetsImported += 1;
    if (status === 'active' && result.assigned) assignmentsCreated += 1;
  }

  console.log(JSON.stringify({ employeesImported, assetsImported, assignmentsCreated }, null, 2));
}

const filePath = process.argv[2] || '';
if (!filePath) {
  console.error('Usage: node scripts/import_workbook.js "/absolute/path/to/file.xlsx"');
  process.exit(1);
}

run(path.resolve(filePath)).catch((err) => {
  console.error(err.message);
  process.exit(1);
});

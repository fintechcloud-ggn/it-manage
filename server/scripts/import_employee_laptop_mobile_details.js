const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool, query } = require('../db');
const { loadWorkbookRows } = require('./import_employee_device_inventory');

function normalize(value) {
  const text = String(value ?? '').trim();
  if (!text || ['na', 'n/a', '#n/a', 'nil', 'none', '-'].includes(text.toLowerCase())) return '';
  return text;
}

function normalizeDomain(value) {
  return normalize(value).toLowerCase();
}

function slug(value) {
  return normalize(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function excelDateToIso(value) {
  const serial = Number(value);
  if (!Number.isFinite(serial) || serial <= 0) return normalize(value) || null;
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const date = new Date(epoch.getTime() + serial * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function inferBrand(modelText, fallback = 'Generic') {
  const text = normalize(modelText);
  const lower = text.toLowerCase();
  const knownBrands = [
    ['Lenovo', ['lenovo', 'thinkbook', 'thinkpad']],
    ['HP', ['hp', 'elitebook', 'probook', 'zbook']],
    ['Dell', ['dell', 'latitude', 'xps', 'precision']],
    ['Asus', ['asus']],
    ['Acer', ['acer']],
    ['Apple', ['apple', 'macbook', 'mac book', 'mac']],
    ['Lava', ['lava']],
    ['Samsung', ['samsung', 'samsug']],
    ['Redmi', ['redmi']],
    ['Vivo', ['vivo']],
    ['Oppo', ['oppo']],
    ['Realme', ['realme']],
    ['OnePlus', ['oneplus', 'one plus']],
  ];
  const matched = knownBrands.find(([, aliases]) => aliases.some((alias) => lower.includes(alias)));
  if (matched) return matched[0];
  return normalize(fallback) || text.split(/\s+/)[0] || 'Generic';
}

async function ensureBrand(name) {
  const brandName = normalize(name) || 'Generic';
  await query('INSERT IGNORE INTO brands (name) VALUES (?)', [brandName]);
  const rows = await query('SELECT id, name FROM brands WHERE name = ? LIMIT 1', [brandName]);
  return rows[0];
}

async function ensureModel(brandId, name, category) {
  const modelName = normalize(name) || `${category} Asset`;
  await query('INSERT IGNORE INTO asset_models (brand_id, name, category) VALUES (?, ?, ?)', [brandId, modelName, category]);
  const rows = await query('SELECT id, name, category FROM asset_models WHERE brand_id = ? AND name = ? AND category = ? LIMIT 1', [brandId, modelName, category]);
  return rows[0];
}

async function upsertEmployee(employee) {
  const code = normalize(employee.code);
  const name = normalize(employee.name);
  if (!code && !name) return null;

  let existing = null;
  if (code) {
    const rows = await query('SELECT id FROM users WHERE employee_code = ? LIMIT 1', [code]);
    existing = rows[0] || null;
  }
  if (!existing && name) {
    const rows = await query("SELECT id FROM users WHERE name = ? AND LOWER(role) = 'user' LIMIT 1", [name]);
    existing = rows[0] || null;
  }

  const safeCode = code || `EMP-${slug(name)}`;
  const email = `${safeCode.toLowerCase()}@import.local`;
  const domain = normalizeDomain(employee.domain) || null;

  if (existing) {
    await query(
      `UPDATE users
       SET name = ?,
           employee_code = COALESCE(NULLIF(?, ''), employee_code),
           domain_name = COALESCE(NULLIF(?, ''), domain_name),
           date_of_joining = COALESCE(NULLIF(?, ''), date_of_joining),
           personal_mobile_no = COALESCE(NULLIF(?, ''), personal_mobile_no),
           employment_status = COALESCE(NULLIF(?, ''), employment_status)
       WHERE id = ?`,
      [
        name || safeCode,
        code,
        domain,
        excelDateToIso(employee.doj) || '',
        normalize(employee.mobile),
        normalize(employee.status) || 'active',
        existing.id,
      ],
    );
    return { id: existing.id };
  }

  const password = bcrypt.hashSync('password', 8);
  const result = await query(
    `INSERT INTO users (
      name, email, role, domain_name, password, employee_code,
      date_of_joining, personal_mobile_no, employment_status
    ) VALUES (?, ?, 'user', ?, ?, ?, ?, ?, ?)`,
    [
      name || safeCode,
      email,
      domain,
      password,
      code || safeCode,
      excelDateToIso(employee.doj),
      normalize(employee.mobile) || null,
      normalize(employee.status) || 'active',
    ],
  );
  return { id: result.insertId };
}

async function upsertAssetAndAssign({ type, modelText, productNo, serial, employee, notes }) {
  const model = normalize(modelText);
  if (!model) return { imported: false, assigned: false, skipped: false };

  const assetSerial = normalize(serial) || normalize(productNo) || `${type.toUpperCase()}-${employee.code || slug(employee.name)}-${slug(model)}`;
  if (!assetSerial) return { imported: false, assigned: false, skipped: true };

  const brand = await ensureBrand(inferBrand(model));
  const modelRow = await ensureModel(brand.id, model, type);
  const user = await upsertEmployee(employee);

  let asset = (await query('SELECT id, status FROM assets WHERE serial = ? LIMIT 1', [assetSerial]))[0];
  if (!asset) {
    const result = await query(
      `INSERT INTO assets (name, type, domain_name, brand_id, model_id, serial, status, vendor, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?)`,
      [
        model,
        type,
        normalizeDomain(employee.domain) || null,
        brand.id,
        modelRow.id,
        assetSerial,
        brand.name,
        normalize(notes) || null,
      ],
    );
    asset = { id: result.insertId, status: 'available' };
  } else {
    await query(
      `UPDATE assets
       SET name = ?, type = ?, domain_name = COALESCE(NULLIF(?, ''), domain_name),
           brand_id = ?, model_id = ?, vendor = COALESCE(NULLIF(?, ''), vendor),
           notes = COALESCE(NULLIF(?, ''), notes)
       WHERE id = ?`,
      [model, type, normalizeDomain(employee.domain), brand.id, modelRow.id, brand.name, normalize(notes), asset.id],
    );
  }

  if (!user?.id) return { imported: true, assigned: false, skipped: true };

  const active = await query('SELECT id, user_id FROM allocations WHERE asset_id = ? AND returned_at IS NULL LIMIT 1', [asset.id]);
  if (active[0]) {
    if (Number(active[0].user_id) === Number(user.id)) {
      await query("UPDATE assets SET status = 'allocated' WHERE id = ?", [asset.id]);
      return { imported: true, assigned: false, skipped: false };
    }
    return { imported: true, assigned: false, skipped: true };
  }

  await query(
    `INSERT INTO allocations (asset_id, user_id, allocated_at, allocated_at_ms, assigned_by_name, assigned_by_role, notes)
     VALUES (?, ?, NOW(), ?, 'Workbook Import', 'system', ?)`,
    [asset.id, user.id, Date.now(), normalize(notes) || null],
  );
  await query("UPDATE assets SET status = 'allocated' WHERE id = ?", [asset.id]);
  return { imported: true, assigned: true, skipped: false };
}

function parseRows(workbook) {
  const rows = [];
  for (const [sheetName, sheetRows] of Object.entries(workbook)) {
    for (let index = 3; index < sheetRows.length; index += 1) {
      const row = sheetRows[index] || {};
      const employee = {
        domain: sheetName,
        code: normalize(row.A),
        name: normalize(row.B),
        doj: normalize(row.C),
        mobile: normalize(row.D),
        status: normalize(row.I).toLowerCase().includes('resign') ? 'inactive' : 'active',
      };
      const laptop = {
        modelText: normalize(row.E),
        productNo: normalize(row.F),
        serial: normalize(row.G),
      };
      const mobileDevice = {
        modelText: normalize(row.H),
        serial: '',
        productNo: '',
      };
      if (!employee.code && !employee.name && !laptop.modelText && !laptop.serial && !mobileDevice.modelText) continue;
      rows.push({
        sourceSheet: sheetName,
        sourceRowNumber: index + 1,
        employee,
        laptop,
        mobileDevice,
        remarks: normalize(row.I),
      });
    }
  }
  return rows;
}

async function importEmployeeLaptopMobileDetails(filePath) {
  const workbook = loadWorkbookRows(path.resolve(filePath));
  const records = parseRows(workbook);

  let employeesImported = 0;
  let assetsImported = 0;
  let assignmentsCreated = 0;
  let skippedAssignments = 0;

  for (const record of records) {
    const user = await upsertEmployee(record.employee);
    if (user) employeesImported += 1;

    const laptop = await upsertAssetAndAssign({
      type: 'Laptop',
      modelText: record.laptop.modelText,
      productNo: record.laptop.productNo,
      serial: record.laptop.serial,
      employee: record.employee,
      notes: [record.sourceSheet, record.remarks].filter(Boolean).join(' | '),
    });
    if (laptop.imported) assetsImported += 1;
    if (laptop.assigned) assignmentsCreated += 1;
    if (laptop.skipped) skippedAssignments += 1;

    const mobile = await upsertAssetAndAssign({
      type: 'Mobile',
      modelText: record.mobileDevice.modelText,
      productNo: record.mobileDevice.productNo,
      serial: record.mobileDevice.serial,
      employee: record.employee,
      notes: [record.sourceSheet, record.remarks].filter(Boolean).join(' | '),
    });
    if (mobile.imported) assetsImported += 1;
    if (mobile.assigned) assignmentsCreated += 1;
    if (mobile.skipped) skippedAssignments += 1;
  }

  return {
    sheets: Object.keys(workbook).length,
    rowsRead: records.length,
    employeesImported,
    assetsImported,
    assignmentsCreated,
    skippedAssignments,
  };
}

async function runCli() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error('Usage: node server/scripts/import_employee_laptop_mobile_details.js <xlsx-file>');
  try {
    const result = await importEmployeeLaptopMobileDetails(filePath);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exit(1);
  });
}

module.exports = { importEmployeeLaptopMobileDetails, parseRows };

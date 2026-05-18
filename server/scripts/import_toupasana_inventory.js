const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool, query } = require('../db');
const { init } = require('../models');
const { loadWorkbookRows } = require('./import_employee_device_inventory');

function normalize(value) {
  const text = String(value ?? '').trim();
  if (!text || ['na', 'n/a', 'nil', 'none', '-'].includes(text.toLowerCase())) return '';
  return text;
}

function normalizeDomain(value) {
  return normalize(value).toLowerCase();
}

function excelDateToIso(value) {
  const serial = Number(value);
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const date = new Date(epoch.getTime() + serial * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function rowsToRecords(rows) {
  if (!rows?.length) return [];
  const headerRow = rows[0] || {};
  const columns = Object.keys(headerRow).sort();
  const headers = columns.map((column) => normalize(headerRow[column]));

  return rows.slice(1).map((row) => {
    const record = {};
    let filled = 0;
    columns.forEach((column, index) => {
      const value = normalize(row[column]);
      record[headers[index] || column] = value;
      if (value) filled += 1;
    });
    return filled ? record : null;
  }).filter(Boolean);
}

function pick(record, candidates) {
  const entries = Object.entries(record);
  for (const candidate of candidates) {
    const match = entries.find(([key]) => key.trim().toLowerCase() === candidate.toLowerCase());
    if (match) return normalize(match[1]);
  }
  return '';
}

function slug(value) {
  return normalize(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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
    ['Samsung', ['samsung']],
    ['Redmi', ['redmi']],
    ['Itel', ['itel']],
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
  const rows = await query('SELECT id, name, category FROM asset_models WHERE brand_id = ? AND name = ? LIMIT 1', [brandId, modelName]);
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
  const email = normalize(employee.email) || `${safeCode.toLowerCase()}@import.local`;
  const domain = normalizeDomain(employee.domain) || null;
  const status = normalize(employee.status) || 'active';

  if (existing) {
    await query(
      `UPDATE users
       SET name = ?,
           email = COALESCE(NULLIF(?, ''), email),
           domain_name = COALESCE(NULLIF(?, ''), domain_name),
           employee_code = COALESCE(NULLIF(?, ''), employee_code),
           department = COALESCE(NULLIF(?, ''), department),
           designation = COALESCE(NULLIF(?, ''), designation),
           location = COALESCE(NULLIF(?, ''), location),
           employment_status = COALESCE(NULLIF(?, ''), employment_status),
           date_of_joining = COALESCE(NULLIF(?, ''), date_of_joining),
           personal_mobile_no = COALESCE(NULLIF(?, ''), personal_mobile_no),
           pan_aadhaar = COALESCE(NULLIF(?, ''), pan_aadhaar),
           biometric_code = COALESCE(NULLIF(?, ''), biometric_code),
           gender = COALESCE(NULLIF(?, ''), gender)
       WHERE id = ?`,
      [
        name || safeCode,
        email,
        domain,
        code,
        normalize(employee.department),
        normalize(employee.designation),
        normalize(employee.location),
        status,
        normalize(employee.doj),
        normalize(employee.mobile),
        normalize(employee.panAadhaar),
        normalize(employee.biometricCode),
        normalize(employee.gender),
        existing.id,
      ],
    );
    const rows = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [existing.id]);
    return rows[0];
  }

  const password = bcrypt.hashSync('password', 8);
  const result = await query(
    `INSERT INTO users (
      name, email, role, domain_name, password, employee_code,
      department, designation, location, employment_status,
      date_of_joining, personal_mobile_no, pan_aadhaar, biometric_code, gender
    ) VALUES (?, ?, 'user', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name || safeCode,
      email,
      domain,
      password,
      code || safeCode,
      normalize(employee.department) || null,
      normalize(employee.designation) || null,
      normalize(employee.location) || null,
      status,
      normalize(employee.doj) || null,
      normalize(employee.mobile) || null,
      normalize(employee.panAadhaar) || null,
      normalize(employee.biometricCode) || null,
      normalize(employee.gender) || null,
    ],
  );
  return { id: result.insertId };
}

async function upsertAssetAndAssign({ type, modelText, serial, productNo, employee, notes }) {
  const model = normalize(modelText);
  if (!model) return { imported: false, assigned: false };

  const assetSerial = normalize(serial) || normalize(productNo) || `${type.toUpperCase()}-${employee.code || slug(employee.name)}-${slug(model)}`;
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

  if (!user?.id) return { imported: true, assigned: false };

  const active = await query('SELECT id, user_id FROM allocations WHERE asset_id = ? AND returned_at IS NULL LIMIT 1', [asset.id]);
  if (active[0]) {
    if (Number(active[0].user_id) !== Number(user.id)) {
      await query(
        'UPDATE allocations SET returned_at = NOW(), returned_at_ms = ? WHERE id = ?',
        [Date.now(), active[0].id],
      );
    } else {
      await query("UPDATE assets SET status = 'allocated' WHERE id = ?", [asset.id]);
      return { imported: true, assigned: false };
    }
  }

  await query(
    `INSERT INTO allocations (asset_id, user_id, allocated_at, allocated_at_ms, assigned_by_name, assigned_by_role, notes)
     VALUES (?, ?, NOW(), ?, 'Workbook Import', 'system', ?)`,
    [asset.id, user.id, Date.now(), normalize(notes) || null],
  );
  await query("UPDATE assets SET status = 'allocated' WHERE id = ?", [asset.id]);
  return { imported: true, assigned: true };
}

function employeeFromSheet1(record) {
  return {
    name: pick(record, ['EMPLOYEE Name', 'Employee Name']),
    code: pick(record, ['EMPLOYEE CODE', 'Employee Code', 'Code']),
    domain: pick(record, ['Domain']),
    email: pick(record, ['E-mail ID', 'Email', 'Email ID']),
    location: pick(record, ['Location']),
    department: pick(record, ['DEPARTMENT', 'Department']),
    designation: pick(record, ['DESIGNATION', 'Designation']),
    status: pick(record, ['Status']),
    mobile: pick(record, ['Mobile No.', 'Personal Mobile No.']),
    panAadhaar: pick(record, ['PAN/Addhar', 'PAN/Aadhaar', 'PAN/Aadhar']),
    biometricCode: pick(record, ['BlOMATRIX CODE', 'BIOMATRIX CODE', 'Biometric Code']),
    gender: pick(record, ['Gender']),
    doj: excelDateToIso(pick(record, ['Date of Joining', 'DOJ'])),
  };
}

function employeeFromSheet2(record, employeeByCode) {
  const code = pick(record, ['Code', 'Employee Code']);
  const existing = employeeByCode.get(code.toLowerCase()) || {};
  return {
    ...existing,
    code,
    name: pick(record, ['Employee Name']) || existing.name,
    email: existing.email,
    domain: existing.domain,
    status: existing.status,
    mobile: pick(record, ['Personal Mobile No.']) || existing.mobile,
    doj: excelDateToIso(pick(record, ['DOJ'])) || existing.doj,
  };
}

async function importToUpasana(filePath) {
  await init();

  const workbook = loadWorkbookRows(path.resolve(filePath));
  const sheet1 = rowsToRecords(workbook.Sheet1 || []);
  const sheet2 = rowsToRecords(workbook.Sheet2 || []);

  const employeeByCode = new Map();
  let employeesImported = 0;
  let assetsImported = 0;
  let assignmentsCreated = 0;

  for (const record of sheet1) {
    const employee = employeeFromSheet1(record);
    if (!employee.name && !employee.code) continue;
    const user = await upsertEmployee(employee);
    if (user) employeesImported += 1;
    if (employee.code) employeeByCode.set(employee.code.toLowerCase(), employee);

    const laptop = await upsertAssetAndAssign({
      type: 'Laptop',
      modelText: pick(record, ['Laptop -Brand']),
      productNo: pick(record, ["Laptop's Prod No"]),
      serial: pick(record, ["Laptop's Serial No"]),
      employee,
      notes: employee.doj ? `DOJ: ${employee.doj}` : '',
    });
    if (laptop.imported) assetsImported += 1;
    if (laptop.assigned) assignmentsCreated += 1;

    const mobile = await upsertAssetAndAssign({
      type: 'Mobile',
      modelText: pick(record, ['Mobile Assigned']),
      serial: '',
      productNo: '',
      employee,
      notes: 'Imported mobile assignment',
    });
    if (mobile.imported) assetsImported += 1;
    if (mobile.assigned) assignmentsCreated += 1;
  }

  for (const record of sheet2) {
    const employee = employeeFromSheet2(record, employeeByCode);
    if (!employee.name && !employee.code) continue;
    const user = await upsertEmployee(employee);
    if (user) employeesImported += 1;

    const laptop = await upsertAssetAndAssign({
      type: 'Laptop',
      modelText: pick(record, ['Laptop -Brand']),
      productNo: pick(record, ["Laptop's Prod No"]),
      serial: pick(record, ["Laptop's Serial No"]),
      employee,
      notes: employee.doj ? `DOJ: ${employee.doj}` : '',
    });
    if (laptop.imported) assetsImported += 1;
    if (laptop.assigned) assignmentsCreated += 1;

    const mobile = await upsertAssetAndAssign({
      type: 'Mobile',
      modelText: pick(record, ['Mobile Assigned']),
      serial: '',
      productNo: '',
      employee,
      notes: 'Imported mobile assignment',
    });
    if (mobile.imported) assetsImported += 1;
    if (mobile.assigned) assignmentsCreated += 1;
  }

  return { employeesImported, assetsImported, assignmentsCreated };
}

async function runCli() {
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error('Usage: node server/scripts/import_toupasana_inventory.js <xlsx-file>');
  }
  try {
    const result = await importToUpasana(filePath);
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

module.exports = { importToUpasana };

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool, query } = require('../db');
const { init } = require('../models');
const { loadWorkbookRows } = require('./import_employee_device_inventory');

function normalize(value) {
  const text = String(value ?? '').trim();
  if (!text || ['na', 'n/a', 'nil', 'none', '-'].includes(text.toLowerCase())) return '';
  return text;
}

function excelDateToIso(value) {
  const serial = Number(value);
  if (!Number.isFinite(serial) || serial <= 0) return normalize(value);
  const epoch = new Date(Date.UTC(1899, 11, 30));
  return new Date(epoch.getTime() + serial * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function rowsToRecords(rows) {
  if (!rows?.length) return [];
  const columns = Object.keys(rows[0] || {}).sort();
  const headers = columns.map((column) => normalize(rows[0][column]));
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

async function updateProfiles(filePath) {
  await init();
  const workbook = loadWorkbookRows(path.resolve(filePath));
  const records = [
    ...rowsToRecords(workbook.Sheet1 || []),
    ...rowsToRecords(workbook.Sheet2 || []),
  ];

  let updated = 0;
  for (const record of records) {
    const code = pick(record, ['EMPLOYEE CODE', 'Employee Code', 'Code']);
    const name = pick(record, ['EMPLOYEE Name', 'Employee Name']);
    if (!code && !name) continue;

    const params = [
      name,
      pick(record, ['Domain']).toLowerCase(),
      pick(record, ['DEPARTMENT', 'Department']),
      pick(record, ['DESIGNATION', 'Designation']),
      pick(record, ['Location']),
      pick(record, ['Status']) || 'active',
      excelDateToIso(pick(record, ['Date of Joining', 'DOJ'])),
      pick(record, ['Mobile No.', 'Personal Mobile No.']),
      pick(record, ['PAN/Addhar', 'PAN/Aadhaar', 'PAN/Aadhar']),
      pick(record, ['BlOMATRIX CODE', 'BIOMATRIX CODE', 'Biometric Code']),
      pick(record, ['Gender']),
      code,
      code,
      name,
    ];

    const result = await query(
      `UPDATE users
       SET name = COALESCE(NULLIF(?, ''), name),
           domain_name = COALESCE(NULLIF(?, ''), domain_name),
           department = COALESCE(NULLIF(?, ''), department),
           designation = COALESCE(NULLIF(?, ''), designation),
           location = COALESCE(NULLIF(?, ''), location),
           employment_status = COALESCE(NULLIF(?, ''), employment_status),
           date_of_joining = COALESCE(NULLIF(?, ''), date_of_joining),
           personal_mobile_no = COALESCE(NULLIF(?, ''), personal_mobile_no),
           pan_aadhaar = COALESCE(NULLIF(?, ''), pan_aadhaar),
           biometric_code = COALESCE(NULLIF(?, ''), biometric_code),
           gender = COALESCE(NULLIF(?, ''), gender)
       WHERE (employee_code = ? AND ? <> '') OR (name = ? AND LOWER(role) = 'user')`,
      params,
    );
    updated += result.affectedRows || 0;
  }

  return { updated };
}

async function runCli() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error('Usage: node server/scripts/update_toupasana_employee_profiles.js <xlsx-file>');
  try {
    console.log(JSON.stringify(await updateProfiles(filePath), null, 2));
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

module.exports = { updateProfiles };

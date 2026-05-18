const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool, query } = require('../db');
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

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS uploaded_employee_asset_rows (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source_sheet VARCHAR(120) NOT NULL,
      source_row_number INT NOT NULL,
      employee_name VARCHAR(255) NULL,
      employee_code VARCHAR(100) NULL,
      domain_name VARCHAR(160) NULL,
      date_of_joining VARCHAR(40) NULL,
      location VARCHAR(160) NULL,
      department VARCHAR(160) NULL,
      designation VARCHAR(180) NULL,
      pan_aadhaar VARCHAR(120) NULL,
      biometric_code VARCHAR(120) NULL,
      mobile_no VARCHAR(40) NULL,
      email VARCHAR(180) NULL,
      employee_photo VARCHAR(255) NULL,
      gender VARCHAR(40) NULL,
      employment_status VARCHAR(100) NULL,
      laptop_brand VARCHAR(180) NULL,
      laptop_product_no VARCHAR(180) NULL,
      laptop_serial_no VARCHAR(180) NULL,
      mobile_assigned VARCHAR(180) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_uploaded_employee_asset_row (source_sheet, source_row_number),
      INDEX idx_uploaded_employee_asset_code (employee_code)
    ) ENGINE=InnoDB
  `);
}

function sheet1Record(row, rowNumber) {
  return {
    source_sheet: 'Sheet1',
    source_row_number: rowNumber,
    employee_name: normalize(row.A),
    employee_code: normalize(row.B),
    domain_name: normalize(row.C).toLowerCase(),
    date_of_joining: excelDateToIso(row.D),
    location: normalize(row.E),
    department: normalize(row.F),
    designation: normalize(row.G),
    pan_aadhaar: normalize(row.H),
    biometric_code: normalize(row.I),
    mobile_no: normalize(row.J),
    email: normalize(row.K),
    employee_photo: normalize(row.L),
    gender: normalize(row.M),
    employment_status: normalize(row.N),
    laptop_brand: normalize(row.O),
    laptop_product_no: normalize(row.P),
    laptop_serial_no: normalize(row.Q),
    mobile_assigned: normalize(row.R),
  };
}

function sheet2Record(row, rowNumber) {
  return {
    source_sheet: 'Sheet2',
    source_row_number: rowNumber,
    employee_name: normalize(row.B),
    employee_code: normalize(row.A),
    domain_name: '',
    date_of_joining: excelDateToIso(row.C),
    location: '',
    department: '',
    designation: '',
    pan_aadhaar: '',
    biometric_code: '',
    mobile_no: normalize(row.D),
    email: '',
    employee_photo: '',
    gender: '',
    employment_status: '',
    laptop_brand: normalize(row.E),
    laptop_product_no: normalize(row.F),
    laptop_serial_no: normalize(row.G),
    mobile_assigned: normalize(row.H),
  };
}

async function upsertRecord(record) {
  await query(
    `INSERT INTO uploaded_employee_asset_rows (
      source_sheet, source_row_number, employee_name, employee_code, domain_name,
      date_of_joining, location, department, designation, pan_aadhaar,
      biometric_code, mobile_no, email, employee_photo, gender,
      employment_status, laptop_brand, laptop_product_no, laptop_serial_no,
      mobile_assigned
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      employee_name = VALUES(employee_name),
      employee_code = VALUES(employee_code),
      domain_name = VALUES(domain_name),
      date_of_joining = VALUES(date_of_joining),
      location = VALUES(location),
      department = VALUES(department),
      designation = VALUES(designation),
      pan_aadhaar = VALUES(pan_aadhaar),
      biometric_code = VALUES(biometric_code),
      mobile_no = VALUES(mobile_no),
      email = VALUES(email),
      employee_photo = VALUES(employee_photo),
      gender = VALUES(gender),
      employment_status = VALUES(employment_status),
      laptop_brand = VALUES(laptop_brand),
      laptop_product_no = VALUES(laptop_product_no),
      laptop_serial_no = VALUES(laptop_serial_no),
      mobile_assigned = VALUES(mobile_assigned)`,
    [
      record.source_sheet,
      record.source_row_number,
      record.employee_name || null,
      record.employee_code || null,
      record.domain_name || null,
      record.date_of_joining || null,
      record.location || null,
      record.department || null,
      record.designation || null,
      record.pan_aadhaar || null,
      record.biometric_code || null,
      record.mobile_no || null,
      record.email || null,
      record.employee_photo || null,
      record.gender || null,
      record.employment_status || null,
      record.laptop_brand || null,
      record.laptop_product_no || null,
      record.laptop_serial_no || null,
      record.mobile_assigned || null,
    ],
  );
}

async function importRawRows(filePath) {
  await ensureSchema();
  const workbook = loadWorkbookRows(path.resolve(filePath));
  const records = [];

  (workbook.Sheet1 || []).slice(1).forEach((row, index) => {
    const record = sheet1Record(row, index + 2);
    if (record.employee_name || record.employee_code || record.laptop_serial_no || record.mobile_assigned) records.push(record);
  });
  (workbook.Sheet2 || []).slice(1).forEach((row, index) => {
    const record = sheet2Record(row, index + 2);
    if (record.employee_name || record.employee_code || record.laptop_serial_no || record.mobile_assigned) records.push(record);
  });

  for (const record of records) {
    await upsertRecord(record);
  }

  return { importedRawRows: records.length };
}

async function runCli() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error('Usage: node server/scripts/import_toupasana_raw_rows.js <xlsx-file>');
  try {
    console.log(JSON.stringify(await importRawRows(filePath), null, 2));
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

module.exports = { ensureSchema, importRawRows };

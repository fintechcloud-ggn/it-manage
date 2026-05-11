const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { XMLParser } = require('fast-xml-parser');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query } = require('../db');

function normalize(value) {
  if (value == null) return '';
  return String(value).trim();
}

function loadWorkbookRows(filePath) {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries().reduce((acc, entry) => {
    acc[entry.entryName] = entry.getData().toString('utf8');
    return acc;
  }, {});

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', trimValues: false });
  const workbook = parser.parse(entries['xl/workbook.xml']);
  const rels = parser.parse(entries['xl/_rels/workbook.xml.rels']);
  const relList = Array.isArray(rels.Relationships.Relationship)
    ? rels.Relationships.Relationship
    : [rels.Relationships.Relationship];
  const relMap = Object.fromEntries(relList.map((row) => [row.Id, row.Target]));

  let sharedStrings = [];
  if (entries['xl/sharedStrings.xml']) {
    const sst = parser.parse(entries['xl/sharedStrings.xml']);
    const si = sst.sst?.si || [];
    const list = Array.isArray(si) ? si : [si];
    sharedStrings = list.map((item) => {
      if (typeof item.t === 'string') return item.t;
      if (Array.isArray(item.r)) return item.r.map((part) => part.t || '').join('');
      if (item.r?.t) return item.r.t;
      return '';
    });
  }

  const sheetList = Array.isArray(workbook.workbook.sheets.sheet)
    ? workbook.workbook.sheets.sheet
    : [workbook.workbook.sheets.sheet];

  const data = {};
  for (const sheet of sheetList) {
    const target = relMap[sheet['r:id']];
    if (!target) continue;
    const xml = entries[`xl/${target}`];
    if (!xml) continue;
    const parsed = parser.parse(xml);
    const rows = parsed.worksheet?.sheetData?.row || [];
    const rowList = Array.isArray(rows) ? rows : [rows];
    data[sheet.name] = rowList.map((row) => {
      const cells = row.c ? (Array.isArray(row.c) ? row.c : [row.c]) : [];
      const values = {};
      for (const cell of cells) {
        const ref = cell.r || '';
        const col = ref.replace(/[0-9]/g, '');
        let value = cell.v ?? '';
        if (cell.t === 's') {
          const idx = Number(value);
          value = Number.isFinite(idx) ? (sharedStrings[idx] || '') : '';
        }
        values[col] = normalize(value);
      }
      return values;
    });
  }
  return data;
}

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS employee_device_inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id INT NULL,
      source_sheet VARCHAR(120) NOT NULL,
      employee_code VARCHAR(100) NOT NULL,
      employee_name VARCHAR(255) NOT NULL,
      doj_raw VARCHAR(40) NULL,
      personal_mobile_no VARCHAR(30) NULL,
      laptop_make VARCHAR(160) NULL,
      laptop_product_no VARCHAR(160) NULL,
      laptop_serial_no VARCHAR(180) NULL,
      mobile_handset VARCHAR(160) NULL,
      remarks VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_employee_device_row (source_sheet, employee_code, employee_name, laptop_serial_no),
      INDEX idx_employee_device_code (employee_code),
      INDEX idx_employee_device_employee_id (employee_id),
      CONSTRAINT fk_employee_device_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);

  await query(`
    CREATE OR REPLACE VIEW employee_device_directory AS
    SELECT
      d.id,
      d.employee_id,
      d.source_sheet,
      d.employee_code,
      d.employee_name,
      d.doj_raw,
      d.personal_mobile_no,
      d.laptop_make,
      d.laptop_product_no,
      d.laptop_serial_no,
      d.mobile_handset,
      d.remarks,
      d.created_at,
      d.updated_at,
      e.employee_name AS master_employee_name,
      e.company AS employee_company
    FROM employee_device_inventory d
    LEFT JOIN employees e
      ON e.id = d.employee_id
  `);
}

async function findEmployeeId(employeeCode, employeeName) {
  const code = normalize(employeeCode);
  const name = normalize(employeeName);

  if (code) {
    const byCode = await query('SELECT id FROM employees WHERE employee_code = ? LIMIT 1', [code]);
    if (byCode[0]) return byCode[0].id;
  }

  if (name) {
    const byName = await query('SELECT id FROM employees WHERE employee_name = ? LIMIT 1', [name]);
    if (byName[0]) return byName[0].id;
  }

  return null;
}

function parseWorkbookRecords(workbook) {
  const records = [];

  for (const [sheetName, rows] of Object.entries(workbook)) {
    for (let index = 3; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const employeeCode = normalize(row.A);
      const employeeName = normalize(row.B);
      const laptopSerialNo = normalize(row.G);

      if (!employeeCode && !employeeName && !laptopSerialNo) continue;

      records.push({
        source_sheet: sheetName,
        employee_code: employeeCode,
        employee_name: employeeName,
        doj_raw: normalize(row.C) || null,
        personal_mobile_no: normalize(row.D) || null,
        laptop_make: normalize(row.E) || null,
        laptop_product_no: normalize(row.F) || null,
        laptop_serial_no: laptopSerialNo || null,
        mobile_handset: normalize(row.H) || null,
        remarks: normalize(row.I) || null,
      });
    }
  }

  return records;
}

async function importRows(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  await ensureSchema();
  const workbook = loadWorkbookRows(filePath);
  const records = parseWorkbookRecords(workbook);

  let imported = 0;
  let linked = 0;
  for (const record of records) {
    const employeeId = await findEmployeeId(record.employee_code, record.employee_name);
    if (employeeId) linked += 1;

    await query(
      `INSERT INTO employee_device_inventory (
        employee_id, source_sheet, employee_code, employee_name, doj_raw,
        personal_mobile_no, laptop_make, laptop_product_no, laptop_serial_no,
        mobile_handset, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        employee_id = VALUES(employee_id),
        doj_raw = VALUES(doj_raw),
        personal_mobile_no = VALUES(personal_mobile_no),
        laptop_make = VALUES(laptop_make),
        laptop_product_no = VALUES(laptop_product_no),
        laptop_serial_no = VALUES(laptop_serial_no),
        mobile_handset = VALUES(mobile_handset),
        remarks = VALUES(remarks)`,
      [
        employeeId,
        record.source_sheet,
        record.employee_code,
        record.employee_name,
        record.doj_raw,
        record.personal_mobile_no,
        record.laptop_make,
        record.laptop_product_no,
        record.laptop_serial_no,
        record.mobile_handset,
        record.remarks,
      ]
    );
    imported += 1;
  }

  return { imported, linked };
}

async function runCli() {
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error('Usage: node server/scripts/import_employee_device_inventory.js <xlsx-file>');
  }

  const result = await importRows(path.resolve(filePath));
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exit(1);
  });
}

module.exports = { ensureSchema, importRows, parseWorkbookRecords, loadWorkbookRows };

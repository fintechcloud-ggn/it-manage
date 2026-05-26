const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool, query } = require('../db');
const { init } = require('../models');
const { loadWorkbookRows } = require('./import_employee_device_inventory');

function normalize(value) {
  const text = String(value ?? '').trim();
  if (!text || ['na', 'n/a', '#n/a', 'nil', 'none', '-'].includes(text.toLowerCase())) return '';
  return text;
}

function normalizeDomain(value) {
  return normalize(value).toLowerCase();
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

function simFromRecord(record, sourceSheet, rowIndex) {
  const connectionNumber = pick(record, ['Mobile No.', 'Personal Mobile No.']);
  if (!connectionNumber) return null;

  const employeeName = pick(record, ['EMPLOYEE Name', 'Employee Name']);
  const employeeCode = pick(record, ['EMPLOYEE CODE', 'Employee Code', 'Code']);
  const domain = normalizeDomain(pick(record, ['Domain'])) || 'global';
  const connectionType = domain && domain !== 'global' ? domain : 'ToUpasana';

  return {
    serial: connectionNumber,
    name: employeeName || employeeCode || connectionNumber,
    domain,
    vendor: connectionType,
    notes: JSON.stringify({
      source: 'ToUpasana.xlsx',
      source_sheet: sourceSheet,
      s_no: String(rowIndex),
      connection_number: connectionNumber,
      connection_type: connectionType,
      sim_status: 'Active',
      sim_number: '',
      assigned_name: employeeName || '',
      employee_code: employeeCode || ''
    })
  };
}

async function importToUpasanaSims(filePath) {
  await init();

  const workbook = loadWorkbookRows(path.resolve(filePath));
  const sheetEntries = [
    ['Sheet1', rowsToRecords(workbook.Sheet1 || [])],
    ['Sheet2', rowsToRecords(workbook.Sheet2 || [])],
  ];

  const existingRows = await query('SELECT serial FROM assets WHERE type = ?', ['SIM']);
  const existingSerials = new Set(existingRows.map((row) => normalize(row.serial)));
  const seenInWorkbook = new Set();

  let scanned = 0;
  let inserted = 0;
  let skippedExisting = 0;
  let skippedWorkbookDuplicate = 0;
  let skippedMissingNumber = 0;

  for (const [sheetName, records] of sheetEntries) {
    for (const [index, record] of records.entries()) {
      const sim = simFromRecord(record, sheetName, index + 1);
      if (!sim) {
        skippedMissingNumber += 1;
        continue;
      }
      scanned += 1;

      if (existingSerials.has(sim.serial)) {
        skippedExisting += 1;
        continue;
      }
      if (seenInWorkbook.has(sim.serial)) {
        skippedWorkbookDuplicate += 1;
        continue;
      }
      seenInWorkbook.add(sim.serial);

      await query('INSERT IGNORE INTO domains (name) VALUES (?)', [sim.domain]);
      await query(
        `INSERT INTO assets (name, type, domain_name, serial, status, vendor, notes)
         VALUES (?, 'SIM', ?, ?, 'available', ?, ?)`,
        [sim.name, sim.domain, sim.serial, sim.vendor, sim.notes],
      );
      existingSerials.add(sim.serial);
      inserted += 1;
    }
  }

  return { scanned, inserted, skippedExisting, skippedWorkbookDuplicate, skippedMissingNumber };
}

async function runCli() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error('Usage: node server/scripts/import_toupasana_sim_assets.js <xlsx-file>');
  try {
    const result = await importToUpasanaSims(filePath);
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

module.exports = { importToUpasanaSims };

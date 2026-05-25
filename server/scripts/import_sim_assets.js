const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool, query } = require('../db');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ''));
  return rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    return record;
  });
}

async function main() {
  const csvPath = process.argv[2];
  const domain = String(process.argv[3] || 'global').trim().toLowerCase();

  if (!csvPath) {
    throw new Error('Usage: node server/scripts/import_sim_assets.js <csv-path> [domain]');
  }

  const resolvedPath = path.resolve(csvPath);
  const rows = parseCsv(fs.readFileSync(resolvedPath, 'utf8'));
  let imported = 0;
  let skipped = 0;
  let duplicateConnectionRows = 0;
  const seenConnectionNumbers = new Set();

  await query('INSERT IGNORE INTO domains (name) VALUES (?)', [domain]);

  for (const row of rows) {
    const connectionNumber = row.connectionnumber;
    const connectionType = row.connectiontype;
    const simStatus = row.status;
    const simNumber = row.simnumber;
    const assignedName = row.name;
    const sNo = row.sno;

    if (!simNumber && !connectionNumber) {
      skipped += 1;
      continue;
    }
    if (connectionNumber && seenConnectionNumbers.has(connectionNumber)) {
      duplicateConnectionRows += 1;
      continue;
    }
    if (connectionNumber) seenConnectionNumbers.add(connectionNumber);

    const serial = connectionNumber || simNumber;
    const notes = JSON.stringify({
      source: path.basename(resolvedPath),
      s_no: sNo || '',
      connection_number: connectionNumber || '',
      connection_type: connectionType || '',
      sim_status: simStatus || '',
      sim_number: simNumber || '',
      assigned_name: assignedName || ''
    });

    await query(
      `INSERT INTO assets (name, type, domain_name, serial, status, vendor, notes)
       VALUES (?, 'SIM', ?, ?, 'available', ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         type = 'SIM',
         domain_name = VALUES(domain_name),
         status = 'available',
         vendor = VALUES(vendor),
         notes = VALUES(notes)`,
      [assignedName || connectionNumber || 'SIM', domain, serial, connectionType || '', notes]
    );
    imported += 1;
  }

  console.log(`SIM import complete: ${imported} imported/updated, ${skipped} skipped, ${duplicateConnectionRows} duplicate connection rows ignored, domain=${domain}`);
}

main()
  .then(() => {
    pool.end().catch(() => {});
    process.exit(0);
  })
  .catch((error) => {
    console.error(error.message);
    pool.end().catch(() => {});
    process.exit(1);
  });

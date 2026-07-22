require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query } = require('./db');

async function checkUsers() {
  try {
    let rows = await query(`SELECT * FROM users WHERE name LIKE '%Anant%' OR role = 'admin'`);
    console.log('Users:', rows);
  } catch (e) {
    console.error('Query error:', e.message);
  }
  process.exit(0);
}

checkUsers();

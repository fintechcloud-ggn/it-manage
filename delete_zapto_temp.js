require('dotenv').config({ path: require('path').join(__dirname, 'server', '.env') });
const { query } = require('./server/db');

(async () => {
  const beforeRows = await query(
    "SELECT id, name, email, role, domain_name, employee_code_prefix FROM users WHERE LOWER(name) LIKE '%zapto%' OR LOWER(email) LIKE '%zapto%' OR LOWER(domain_name) LIKE '%zapto%' ORDER BY id"
  );
  await query('DELETE FROM users WHERE id = ?', [1014]);
  const afterRows = await query(
    "SELECT id, name, email, role, domain_name, employee_code_prefix FROM users WHERE LOWER(name) LIKE '%zapto%' OR LOWER(email) LIKE '%zapto%' OR LOWER(domain_name) LIKE '%zapto%' ORDER BY id"
  );
  console.log(JSON.stringify({ before: beforeRows, after: afterRows }, null, 2));
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

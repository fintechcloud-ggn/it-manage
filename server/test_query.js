require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query } = require('./db');

async function testQuery() {
  try {
    let rows = await query(`
      SELECT
        al.id,
        al.asset_id,
        al.user_id,
        al.allocated_at,
        al.allocated_at_ms,
        al.returned_at,
        al.returned_at_ms,
        al.notes,
        a.domain_name,
        COALESCE(al.assigned_by_user_id, (
          SELECT log.actor_user_id
          FROM audit_logs log
          WHERE log.entity_type = 'allocation'
            AND log.entity_id = al.id
            AND log.action IN ('ALLOCATE_ASSET', 'REPLACE_ASSET')
          ORDER BY log.id ASC
          LIMIT 1
        )) AS assigned_by_user_id,
        COALESCE(NULLIF(al.assigned_by_name, ''), (
          SELECT log.actor_name
          FROM audit_logs log
          WHERE log.entity_type = 'allocation'
            AND log.entity_id = al.id
            AND log.action IN ('ALLOCATE_ASSET', 'REPLACE_ASSET')
          ORDER BY log.id ASC
          LIMIT 1
        )) AS assigned_by_name,
        COALESCE(NULLIF(al.assigned_by_role, ''), (
          SELECT log.actor_role
          FROM audit_logs log
          WHERE log.entity_type = 'allocation'
            AND log.entity_id = al.id
            AND log.action IN ('ALLOCATE_ASSET', 'REPLACE_ASSET')
          ORDER BY log.id ASC
          LIMIT 1
        )) AS assigned_by_role,
        assigned_user.employee_code AS employee_code,
        assigned_user.domain_name AS user_domain_name
      FROM allocations al
      INNER JOIN assets a ON a.id = al.asset_id
      LEFT JOIN users assigned_user ON assigned_user.id = al.user_id
      ORDER BY al.id DESC
    `);
    console.log('Query success:', rows.length, 'rows');
  } catch (e) {
    console.error('Query error:', e.message);
  }
  process.exit(0);
}

testQuery();

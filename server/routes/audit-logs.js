const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth, hasPermission } = require('../middleware/auth');

async function hasColumn(tableName, columnName) {
  const rows = await query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
  return rows.length > 0;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    if ((req.user?.role || '').toLowerCase() === 'admin' && !hasPermission(req.user, 'activity.view')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const limitRaw = Number(req.query.limit || 120);
    const limit = Number.isFinite(limitRaw) ? Math.max(20, Math.min(limitRaw, 300)) : 120;
    const [
      actorUserIdExists,
      actorNameExists,
      actorRoleExists,
      entityIdExists,
      detailsExists,
      eventAtMsExists,
    ] = await Promise.all([
      hasColumn('audit_logs', 'actor_user_id'),
      hasColumn('audit_logs', 'actor_name'),
      hasColumn('audit_logs', 'actor_role'),
      hasColumn('audit_logs', 'entity_id'),
      hasColumn('audit_logs', 'details'),
      hasColumn('audit_logs', 'event_at_ms'),
    ]);
    const rows = await query(
      `SELECT
         id,
         ${actorUserIdExists ? 'actor_user_id' : 'NULL AS actor_user_id'},
         ${actorNameExists ? 'actor_name' : 'NULL AS actor_name'},
         ${actorRoleExists ? 'actor_role' : 'NULL AS actor_role'},
         action,
         entity_type,
         ${entityIdExists ? 'entity_id' : 'NULL AS entity_id'},
         ${detailsExists ? 'details' : 'NULL AS details'},
         event_at,
         ${eventAtMsExists ? 'event_at_ms' : 'NULL AS event_at_ms'}
       FROM audit_logs
       ORDER BY id DESC
       LIMIT ?`,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    // Keep the dashboard usable even if audit_logs schema/data is behind.
    // eslint-disable-next-line no-console
    console.error('Audit logs read failed:', err.message);
    res.json([]);
  }
});

module.exports = router;

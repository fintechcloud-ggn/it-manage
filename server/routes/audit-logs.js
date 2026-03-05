const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth, hasPermission } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    if ((req.user?.role || '').toLowerCase() === 'admin' && !hasPermission(req.user, 'activity.view')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const limitRaw = Number(req.query.limit || 120);
    const limit = Number.isFinite(limitRaw) ? Math.max(20, Math.min(limitRaw, 300)) : 120;
    const rows = await query(
      `SELECT id, actor_user_id, actor_name, actor_role, action, entity_type, entity_id, details, event_at, event_at_ms
       FROM audit_logs
       ORDER BY id DESC
       LIMIT ?`,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

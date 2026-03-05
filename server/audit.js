const { query } = require('./db');

async function writeAuditLog({
  user = null,
  action,
  entityType,
  entityId = null,
  details = null
}) {
  if (!action || !entityType) return;

  const actorUserId = user?.id ? Number(user.id) : null;
  const actorName = user?.name || null;
  const actorRole = user?.role || null;
  const eventAtMs = Date.now();

  try {
    await query(
      `INSERT INTO audit_logs
       (actor_user_id, actor_name, actor_role, action, entity_type, entity_id, details, event_at, event_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [actorUserId, actorName, actorRole, action, entityType, entityId, details, eventAtMs]
    );
  } catch (err) {
    // Keep primary operation successful even if logging fails.
    // eslint-disable-next-line no-console
    console.error('Audit log write failed:', err.message);
  }
}

module.exports = { writeAuditLog };

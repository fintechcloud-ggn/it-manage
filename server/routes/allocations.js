const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { requireAuth, hasPermission, isSuperAdmin, normalizeDomain, getUserDomain, canAccessDomainRecord } = require('../middleware/auth');
const { writeAuditLog } = require('../audit');

async function ensureAssignmentUser({ user_id, employee_code, employee_name, employee_email, domain_name }) {
  if (Number(user_id)) {
    const rows = await query('SELECT id, domain_name, employee_code FROM users WHERE id = ? LIMIT 1', [Number(user_id)]);
    return rows[0] || null;
  }

  const normalizedCode = String(employee_code || '').trim();
  const normalizedName = String(employee_name || '').trim();
  const normalizedEmail = String(employee_email || '').trim();
  if (!normalizedCode && !normalizedName) return null;

  let existing = null;
  if (normalizedCode) {
    const byCode = await query(
      'SELECT id, domain_name, employee_code FROM users WHERE employee_code = ? LIMIT 1',
      [normalizedCode]
    );
    existing = byCode[0] || null;
  }
  if (!existing && normalizedName) {
    const byName = await query(
      "SELECT id, domain_name, employee_code FROM users WHERE name = ? AND LOWER(role) = 'user' LIMIT 1",
      [normalizedName]
    );
    existing = byName[0] || null;
  }
  if (existing) return existing;

  const safeCode = normalizedCode || `EMP-${normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const email = normalizedEmail || `${safeCode.toLowerCase()}@import.local`;
  const password = bcrypt.hashSync('password', 8);
  const result = await query(
    `INSERT INTO users (name, email, role, domain_name, password, employee_code)
     VALUES (?, ?, 'user', ?, ?, ?)`,
    [normalizedName || safeCode, email, normalizeDomain(domain_name) || null, password, normalizedCode || safeCode]
  );
  const createdRows = await query(
    'SELECT id, domain_name, employee_code FROM users WHERE id = ? LIMIT 1',
    [result.insertId]
  );
  return createdRows[0] || null;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    if ((req.user?.role || '').toLowerCase() !== 'user' && !hasPermission(req.user, 'assignments.view')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
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
        )) AS assigned_by_role
      FROM allocations al
      INNER JOIN assets a ON a.id = al.asset_id
      ORDER BY al.id DESC
    `);
    if (!isSuperAdmin(req.user)) {
      const currentDomain = getUserDomain(req.user);
      rows = rows.filter((row) => normalizeDomain(row.domain_name) === currentDomain);
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { asset_id, user_id, notes, employee_code, employee_name, employee_email } = req.body;
    const allocatedAtMs = Date.now();
    const assetRows = await query('SELECT id, status, domain_name FROM assets WHERE id = ? LIMIT 1', [Number(asset_id)]);
    const asset = assetRows[0];
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    if (asset.status === 'allocated') return res.status(400).json({ error: 'Asset already allocated' });
    if (!isSuperAdmin(req.user) && normalizeDomain(asset.domain_name) !== getUserDomain(req.user)) {
      return res.status(403).json({ error: 'Asset domain access denied' });
    }

    const allocator = req.user;
    if ((allocator.role || '').toLowerCase() !== 'user' && !hasPermission(allocator, 'assignments.manage')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const managedUser = hasPermission(allocator, 'assignments.manage')
      ? await ensureAssignmentUser({
        user_id,
        employee_code,
        employee_name,
        employee_email,
        domain_name: asset.domain_name || getUserDomain(req.user)
      })
      : allocator;
    const targetUser = managedUser;
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (!isSuperAdmin(req.user) && !canAccessDomainRecord(req.user, targetUser)) {
      return res.status(403).json({ error: 'User domain access denied' });
    }
    const targetUserId = Number(targetUser.id);

    const result = await query(
      `INSERT INTO allocations
       (asset_id, user_id, allocated_at, allocated_at_ms, assigned_by_user_id, assigned_by_name, assigned_by_role, returned_at, returned_at_ms, notes)
       VALUES (?, ?, NOW(), ?, ?, ?, ?, NULL, NULL, ?)`,
      [
        Number(asset_id),
        Number(targetUserId),
        allocatedAtMs,
        allocator.id ? Number(allocator.id) : null,
        allocator.name || null,
        allocator.role || null,
        notes || null
      ],
    );
    await query("UPDATE assets SET status = 'allocated' WHERE id = ?", [Number(asset_id)]);
    await writeAuditLog({
      user: allocator,
      action: 'ALLOCATE_ASSET',
      entityType: 'allocation',
      entityId: result.insertId,
      details: `asset_id=${Number(asset_id)}, user_id=${Number(targetUserId)}${notes ? `, notes=${notes}` : ''}`
    });

    const created = await query('SELECT id, asset_id, user_id, allocated_at, allocated_at_ms, assigned_by_user_id, assigned_by_name, assigned_by_role, returned_at, returned_at_ms, notes FROM allocations WHERE id = ? LIMIT 1', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/return', requireAuth, async (req, res) => {
  try {
    if ((req.user?.role || '').toLowerCase() !== 'user' && !hasPermission(req.user, 'assignments.manage')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const id = Number(req.params.id);
    const { reason, reason_detail } = req.body || {};
    const returnedAtMs = Date.now();
    const rows = await query(`
      SELECT al.id, al.asset_id, al.returned_at, a.domain_name
      FROM allocations al
      INNER JOIN assets a ON a.id = al.asset_id
      WHERE al.id = ? LIMIT 1
    `, [id]);
    const alloc = rows[0];
    if (!alloc) return res.status(404).json({ error: 'Allocation not found' });
    if (alloc.returned_at) return res.status(400).json({ error: 'Already returned' });
    if (!isSuperAdmin(req.user) && normalizeDomain(alloc.domain_name) !== getUserDomain(req.user)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (reason || reason_detail) {
      const reasonNote = [reason, reason_detail].filter(Boolean).join(' - ');
      await query('UPDATE allocations SET returned_at = NOW(), returned_at_ms = ?, notes = CONCAT(COALESCE(notes, \'\'), CASE WHEN COALESCE(notes, \'\') = \'\' THEN \'\' ELSE \' | \' END, ?) WHERE id = ?', [returnedAtMs, `Return Reason: ${reasonNote}`, id]);
    } else {
      await query('UPDATE allocations SET returned_at = NOW(), returned_at_ms = ? WHERE id = ?', [returnedAtMs, id]);
    }
    await query("UPDATE assets SET status = 'available' WHERE id = ?", [Number(alloc.asset_id)]);
    await writeAuditLog({
      user: req.user,
      action: 'RETURN_ASSET',
      entityType: 'allocation',
      entityId: id,
      details: `asset_id=${Number(alloc.asset_id)}${reason ? `, reason=${reason}` : ''}${reason_detail ? `, reason_detail=${reason_detail}` : ''}`
    });

    const updated = await query('SELECT id, asset_id, user_id, allocated_at, allocated_at_ms, assigned_by_user_id, assigned_by_name, assigned_by_role, returned_at, returned_at_ms, notes FROM allocations WHERE id = ? LIMIT 1', [id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/replace', requireAuth, async (req, res) => {
  try {
    const allocator = req.user;
    if (!hasPermission(allocator, 'assignments.manage')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const id = Number(req.params.id);
    const { new_asset_id, reason, reason_detail } = req.body || {};
    if (!new_asset_id) return res.status(400).json({ error: 'new_asset_id is required' });
    if (!reason) return res.status(400).json({ error: 'reason is required' });
    if (reason === 'Other' && !String(reason_detail || '').trim()) {
      return res.status(400).json({ error: 'reason_detail is required for Other reason' });
    }

    const rows = await query(`
      SELECT al.id, al.asset_id, al.user_id, al.returned_at, al.notes, a.domain_name
      FROM allocations al
      INNER JOIN assets a ON a.id = al.asset_id
      WHERE al.id = ? LIMIT 1
    `, [id]);
    const currentAlloc = rows[0];
    if (!currentAlloc) return res.status(404).json({ error: 'Allocation not found' });
    if (currentAlloc.returned_at) return res.status(400).json({ error: 'Current allocation already returned' });
    if (!isSuperAdmin(req.user) && normalizeDomain(currentAlloc.domain_name) !== getUserDomain(req.user)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (Number(currentAlloc.asset_id) === Number(new_asset_id)) {
      return res.status(400).json({ error: 'Replacement asset must be different from current asset' });
    }

    const newAssetRows = await query('SELECT id, status, domain_name FROM assets WHERE id = ? LIMIT 1', [Number(new_asset_id)]);
    const newAsset = newAssetRows[0];
    if (!newAsset) return res.status(404).json({ error: 'Replacement asset not found' });
    if (newAsset.status === 'allocated') return res.status(400).json({ error: 'Replacement asset is already allocated' });
    if (normalizeDomain(newAsset.domain_name) !== normalizeDomain(currentAlloc.domain_name)) {
      return res.status(400).json({ error: 'Replacement asset must belong to the same domain' });
    }

    const fullReason = [reason, reason_detail].filter(Boolean).join(' - ');
    const returnedAtMs = Date.now();
    const replacementAllocatedAtMs = Date.now();

    await query(
      'UPDATE allocations SET returned_at = NOW(), returned_at_ms = ?, notes = CONCAT(COALESCE(notes, \'\'), CASE WHEN COALESCE(notes, \'\') = \'\' THEN \'\' ELSE \' | \' END, ?) WHERE id = ?',
      [returnedAtMs, `Return Reason: ${fullReason}`, id]
    );
    await query("UPDATE assets SET status = 'available' WHERE id = ?", [Number(currentAlloc.asset_id)]);
    await writeAuditLog({
      user: allocator,
      action: 'RETURN_FOR_REPLACEMENT',
      entityType: 'allocation',
      entityId: id,
      details: `old_asset_id=${Number(currentAlloc.asset_id)}, reason=${fullReason}`
    });

    const replacementNote = `Replacement for allocation #${id}. Reason: ${fullReason}`;
    const created = await query(
      `INSERT INTO allocations
       (asset_id, user_id, allocated_at, allocated_at_ms, assigned_by_user_id, assigned_by_name, assigned_by_role, returned_at, returned_at_ms, notes)
       VALUES (?, ?, NOW(), ?, ?, ?, ?, NULL, NULL, ?)`,
      [
        Number(new_asset_id),
        Number(currentAlloc.user_id),
        replacementAllocatedAtMs,
        allocator.id ? Number(allocator.id) : null,
        allocator.name || null,
        allocator.role || null,
        replacementNote
      ]
    );
    await query("UPDATE assets SET status = 'allocated' WHERE id = ?", [Number(new_asset_id)]);
    await writeAuditLog({
      user: allocator,
      action: 'REPLACE_ASSET',
      entityType: 'allocation',
      entityId: created.insertId,
      details: `user_id=${Number(currentAlloc.user_id)}, from_asset_id=${Number(currentAlloc.asset_id)}, to_asset_id=${Number(new_asset_id)}, reason=${fullReason}`
    });

    const returnedAlloc = await query(
      'SELECT id, asset_id, user_id, allocated_at, allocated_at_ms, assigned_by_user_id, assigned_by_name, assigned_by_role, returned_at, returned_at_ms, notes FROM allocations WHERE id = ? LIMIT 1',
      [id]
    );
    const newAlloc = await query(
      'SELECT id, asset_id, user_id, allocated_at, allocated_at_ms, assigned_by_user_id, assigned_by_name, assigned_by_role, returned_at, returned_at_ms, notes FROM allocations WHERE id = ? LIMIT 1',
      [created.insertId]
    );

    res.status(201).json({
      returned: returnedAlloc[0],
      replacement: newAlloc[0]
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

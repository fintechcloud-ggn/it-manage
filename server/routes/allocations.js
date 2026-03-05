const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth, hasPermission } = require('../middleware/auth');
const { writeAuditLog } = require('../audit');

router.get('/', async (req, res) => {
  try {
    if ((req.user?.role || '').toLowerCase() === 'admin' && !hasPermission(req.user, 'assignments.view')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const rows = await query('SELECT id, asset_id, user_id, allocated_at, allocated_at_ms, returned_at, returned_at_ms, notes FROM allocations ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { asset_id, user_id, notes } = req.body;
    const allocatedAtMs = Date.now();
    const assetRows = await query('SELECT id, status FROM assets WHERE id = ? LIMIT 1', [Number(asset_id)]);
    const asset = assetRows[0];
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    if (asset.status === 'allocated') return res.status(400).json({ error: 'Asset already allocated' });

    const allocator = req.user;
    if ((allocator.role || '').toLowerCase() === 'admin' && !hasPermission(allocator, 'assignments.manage')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const targetUserId = (allocator.role === 'admin' && user_id) ? Number(user_id) : allocator.id;

    const result = await query(
      'INSERT INTO allocations (asset_id, user_id, allocated_at, allocated_at_ms, returned_at, returned_at_ms, notes) VALUES (?, ?, NOW(), ?, NULL, NULL, ?)',
      [Number(asset_id), Number(targetUserId), allocatedAtMs, notes || null],
    );
    await query("UPDATE assets SET status = 'allocated' WHERE id = ?", [Number(asset_id)]);
    await writeAuditLog({
      user: allocator,
      action: 'ALLOCATE_ASSET',
      entityType: 'allocation',
      entityId: result.insertId,
      details: `asset_id=${Number(asset_id)}, user_id=${Number(targetUserId)}${notes ? `, notes=${notes}` : ''}`
    });

    const created = await query('SELECT id, asset_id, user_id, allocated_at, allocated_at_ms, returned_at, returned_at_ms, notes FROM allocations WHERE id = ? LIMIT 1', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/return', requireAuth, async (req, res) => {
  try {
    if ((req.user?.role || '').toLowerCase() === 'admin' && !hasPermission(req.user, 'assignments.manage')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const id = Number(req.params.id);
    const { reason, reason_detail } = req.body || {};
    const returnedAtMs = Date.now();
    const rows = await query('SELECT id, asset_id, returned_at FROM allocations WHERE id = ? LIMIT 1', [id]);
    const alloc = rows[0];
    if (!alloc) return res.status(404).json({ error: 'Allocation not found' });
    if (alloc.returned_at) return res.status(400).json({ error: 'Already returned' });

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

    const updated = await query('SELECT id, asset_id, user_id, allocated_at, allocated_at_ms, returned_at, returned_at_ms, notes FROM allocations WHERE id = ? LIMIT 1', [id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/replace', requireAuth, async (req, res) => {
  try {
    const allocator = req.user;
    if (!allocator || allocator.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can replace assets' });
    }
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

    const rows = await query('SELECT id, asset_id, user_id, returned_at, notes FROM allocations WHERE id = ? LIMIT 1', [id]);
    const currentAlloc = rows[0];
    if (!currentAlloc) return res.status(404).json({ error: 'Allocation not found' });
    if (currentAlloc.returned_at) return res.status(400).json({ error: 'Current allocation already returned' });
    if (Number(currentAlloc.asset_id) === Number(new_asset_id)) {
      return res.status(400).json({ error: 'Replacement asset must be different from current asset' });
    }

    const newAssetRows = await query('SELECT id, status FROM assets WHERE id = ? LIMIT 1', [Number(new_asset_id)]);
    const newAsset = newAssetRows[0];
    if (!newAsset) return res.status(404).json({ error: 'Replacement asset not found' });
    if (newAsset.status === 'allocated') return res.status(400).json({ error: 'Replacement asset is already allocated' });

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
      'INSERT INTO allocations (asset_id, user_id, allocated_at, allocated_at_ms, returned_at, returned_at_ms, notes) VALUES (?, ?, NOW(), ?, NULL, NULL, ?)',
      [Number(new_asset_id), Number(currentAlloc.user_id), replacementAllocatedAtMs, replacementNote]
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
      'SELECT id, asset_id, user_id, allocated_at, allocated_at_ms, returned_at, returned_at_ms, notes FROM allocations WHERE id = ? LIMIT 1',
      [id]
    );
    const newAlloc = await query(
      'SELECT id, asset_id, user_id, allocated_at, allocated_at_ms, returned_at, returned_at_ms, notes FROM allocations WHERE id = ? LIMIT 1',
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

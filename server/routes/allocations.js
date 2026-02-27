const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT id, asset_id, user_id, allocated_at, returned_at, notes FROM allocations ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { asset_id, user_id, notes } = req.body;
    const assetRows = await query('SELECT id, status FROM assets WHERE id = ? LIMIT 1', [Number(asset_id)]);
    const asset = assetRows[0];
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    if (asset.status === 'allocated') return res.status(400).json({ error: 'Asset already allocated' });

    const allocator = req.user;
    const targetUserId = (allocator.role === 'admin' && user_id) ? Number(user_id) : allocator.id;

    const result = await query(
      'INSERT INTO allocations (asset_id, user_id, allocated_at, returned_at, notes) VALUES (?, ?, NOW(), NULL, ?)',
      [Number(asset_id), Number(targetUserId), notes || null],
    );
    await query("UPDATE assets SET status = 'allocated' WHERE id = ?", [Number(asset_id)]);

    const created = await query('SELECT id, asset_id, user_id, allocated_at, returned_at, notes FROM allocations WHERE id = ? LIMIT 1', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/return', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await query('SELECT id, asset_id, returned_at FROM allocations WHERE id = ? LIMIT 1', [id]);
    const alloc = rows[0];
    if (!alloc) return res.status(404).json({ error: 'Allocation not found' });
    if (alloc.returned_at) return res.status(400).json({ error: 'Already returned' });

    await query('UPDATE allocations SET returned_at = NOW() WHERE id = ?', [id]);
    await query("UPDATE assets SET status = 'available' WHERE id = ?", [Number(alloc.asset_id)]);

    const updated = await query('SELECT id, asset_id, user_id, allocated_at, returned_at, notes FROM allocations WHERE id = ? LIMIT 1', [id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

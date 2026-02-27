const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

function nextId() {
  const items = db.get('allocations').value();
  if (!items || items.length === 0) return 1;
  return Math.max(...items.map(i => i.id || 0)) + 1;
}

router.get('/', (req, res) => {
  const rows = db.get('allocations').value();
  res.json(rows);
});

router.post('/', requireAuth, (req, res) => {
  const { asset_id, user_id, notes } = req.body;
  const asset = db.get('assets').find({ id: Number(asset_id) }).value();
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  if (asset.status === 'allocated') return res.status(400).json({ error: 'Asset already allocated' });

  // If non-admin, force allocation to authenticated user
  const allocator = req.user;
  const targetUserId = (allocator.role === 'admin' && user_id) ? Number(user_id) : allocator.id;

  const id = nextId();
  const allocation = { id, asset_id: Number(asset_id), user_id: Number(targetUserId), allocated_at: new Date().toISOString(), returned_at: null, notes: notes || null };
  db.get('allocations').push(allocation).write();
  db.get('assets').find({ id: Number(asset_id) }).assign({ status: 'allocated' }).write();
  res.status(201).json(allocation);
});

router.put('/:id/return', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const alloc = db.get('allocations').find({ id }).value();
  if (!alloc) return res.status(404).json({ error: 'Allocation not found' });
  if (alloc.returned_at) return res.status(400).json({ error: 'Already returned' });
  const returned_at = new Date().toISOString();
  db.get('allocations').find({ id }).assign({ returned_at }).write();
  db.get('assets').find({ id: Number(alloc.asset_id) }).assign({ status: 'available' }).write();
  res.json(db.get('allocations').find({ id }).value());
});

module.exports = router;

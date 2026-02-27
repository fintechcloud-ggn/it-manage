const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireRole } = require('../middleware/auth');

router.get('/', (req, res) => {
  const rows = db.get('assets').value();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.get('assets').find({ id }).value();
  if (!row) return res.status(404).json({ error: 'Asset not found' });
  res.json(row);
});

function nextId() {
  const items = db.get('assets').value();
  if (!items || items.length === 0) return 1;
  return Math.max(...items.map(i => i.id || 0)) + 1;
}

router.post('/', requireRole('admin'), (req, res) => {
  const { name, type, serial, store_id, notes } = req.body;
  try {
    const id = nextId();
    const asset = { id, name, type, serial, status: 'available', store_id: store_id || null, notes: notes || null };
    db.get('assets').push(asset).write();
    res.status(201).json(asset);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const { name, type, serial, status, store_id, notes } = req.body;
  try {
    const updated = db.get('assets').find({ id }).assign({ name, type, serial, status, store_id: store_id || null, notes: notes || null }).write();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  // admin only
  db.get('assets').remove({ id }).write();
  res.status(204).end();
});

module.exports = router;

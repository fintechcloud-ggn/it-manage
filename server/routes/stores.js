const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireRole } = require('../middleware/auth');

router.get('/', (req, res) => {
  const rows = db.get('stores').value();
  res.json(rows);
});

function nextId() {
  const items = db.get('stores').value();
  if (!items || items.length === 0) return 1;
  return Math.max(...items.map(i => i.id || 0)) + 1;
}

router.post('/', requireRole('admin'), (req, res) => {
  const { name, location } = req.body;
  try {
    const id = nextId();
    const store = { id, name, location };
    db.get('stores').push(store).write();
    res.status(201).json(store);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

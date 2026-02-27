const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireRole } = require('../middleware/auth');

router.get('/', (req, res) => {
  const rows = db.get('users').value();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.get('users').find({ id }).value();
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json(row);
});

function nextId() {
  const items = db.get('users').value();
  if (!items || items.length === 0) return 1;
  return Math.max(...items.map(i => i.id || 0)) + 1;
}

router.post('/', requireRole('admin'), (req, res) => {
  const { name, email, role, password } = req.body;
  try {
    const bcrypt = require('bcryptjs');
    const id = nextId();
    const hashed = bcrypt.hashSync(password || 'password', 8);
    const user = { id, name, email, role: role || 'user', password: hashed };
    db.get('users').push(user).write();
    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT id, name, email, role FROM users ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await query('SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name, email, role, password } = req.body;
    const hashed = bcrypt.hashSync(password || 'password', 8);
    const result = await query('INSERT INTO users (name, email, role, password) VALUES (?, ?, ?, ?)', [name, email, role || 'user', hashed]);
    const created = await query('SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

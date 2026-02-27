const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT id, name, location FROM stores ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name, location } = req.body;
    const result = await query('INSERT INTO stores (name, location) VALUES (?, ?)', [name, location || null]);
    const created = await query('SELECT id, name, location FROM stores WHERE id = ? LIMIT 1', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const brands = await query('SELECT id, name FROM brands ORDER BY name ASC');
    const models = await query('SELECT id, brand_id, name, category FROM asset_models ORDER BY name ASC');

    const modelsByBrand = models.reduce((acc, model) => {
      if (!acc[model.brand_id]) acc[model.brand_id] = [];
      acc[model.brand_id].push(model);
      return acc;
    }, {});

    res.json(brands.map((b) => ({ ...b, models: modelsByBrand[b.id] || [] })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/models', async (req, res) => {
  try {
    const brandId = Number(req.query.brand_id || 0);
    if (!brandId) {
      const rows = await query('SELECT id, brand_id, name, category FROM asset_models ORDER BY name ASC');
      return res.json(rows);
    }
    const rows = await query('SELECT id, brand_id, name, category FROM asset_models WHERE brand_id = ? ORDER BY name ASC', [brandId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name } = req.body;
    const result = await query('INSERT INTO brands (name) VALUES (?)', [name]);
    const created = await query('SELECT id, name FROM brands WHERE id = ? LIMIT 1', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/models', requireRole('admin'), async (req, res) => {
  try {
    const { brand_id, name, category } = req.body;
    const result = await query('INSERT INTO asset_models (brand_id, name, category) VALUES (?, ?, ?)', [Number(brand_id), name, category || 'Laptop']);
    const created = await query('SELECT id, brand_id, name, category FROM asset_models WHERE id = ? LIMIT 1', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

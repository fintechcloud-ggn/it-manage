const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requirePermission } = require('../middleware/auth');

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

router.post('/', requirePermission('inventory.manage'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Brand name is required' });
    await query('INSERT IGNORE INTO brands (name) VALUES (?)', [name]);
    const created = await query('SELECT id, name FROM brands WHERE name = ? LIMIT 1', [name]);
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/models', requirePermission('inventory.manage'), async (req, res) => {
  try {
    const brandId = Number(req.body.brand_id || 0);
    const name = String(req.body.name || '').trim();
    const category = String(req.body.category || 'Laptop').trim() || 'Laptop';
    if (!brandId) return res.status(400).json({ error: 'Brand is required' });
    if (!name) return res.status(400).json({ error: 'Model name is required' });
    await query('INSERT IGNORE INTO asset_models (brand_id, name, category) VALUES (?, ?, ?)', [brandId, name, category]);
    const created = await query(
      'SELECT id, brand_id, name, category FROM asset_models WHERE brand_id = ? AND name = ? LIMIT 1',
      [brandId, name]
    );
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

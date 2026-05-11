const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth, requirePermission, isSuperAdmin, normalizeDomain, getUserDomain, canAccessDomain } = require('../middleware/auth');
const { writeAuditLog } = require('../audit');

router.get('/', requireAuth, async (req, res) => {
  try {
    let rows = await query(`
      SELECT a.id, a.name, a.type, a.domain_name, a.serial, a.status, a.store_id, a.vendor, a.notes, a.brand_id, a.model_id,
             b.name AS brand_name, m.name AS model_name
      FROM assets a
      LEFT JOIN brands b ON b.id = a.brand_id
      LEFT JOIN asset_models m ON m.id = a.model_id
      ORDER BY a.id DESC
    `);
    if (!isSuperAdmin(req.user)) {
      const currentDomain = getUserDomain(req.user);
      rows = rows.filter((row) => normalizeDomain(row.domain_name) === currentDomain);
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await query(`
      SELECT a.id, a.name, a.type, a.domain_name, a.serial, a.status, a.store_id, a.vendor, a.notes, a.brand_id, a.model_id,
             b.name AS brand_name, m.name AS model_name
      FROM assets a
      LEFT JOIN brands b ON b.id = a.brand_id
      LEFT JOIN asset_models m ON m.id = a.model_id
      WHERE a.id = ? LIMIT 1
    `, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Asset not found' });
    if (!canAccessDomain(req.user, rows[0].domain_name)) return res.status(403).json({ error: 'Forbidden' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requirePermission('inventory.manage'), async (req, res) => {
  try {
    const { name, type, serial, store_id, vendor, notes, brand_id, model_id, domain_name } = req.body;
    const requestedDomain = isSuperAdmin(req.user)
      ? normalizeDomain(domain_name)
      : getUserDomain(req.user);
    if (!requestedDomain) return res.status(400).json({ error: 'Domain is required' });
    const result = await query(
      `INSERT INTO assets (name, type, domain_name, serial, status, store_id, vendor, notes, brand_id, model_id)
       VALUES (?, ?, ?, ?, 'available', ?, ?, ?, ?, ?)`,
      [name, type, requestedDomain, serial, store_id || null, vendor || null, notes || null, brand_id || null, model_id || null],
    );
    const created = await query('SELECT * FROM assets WHERE id = ? LIMIT 1', [result.insertId]);
    await writeAuditLog({
      user: req.user,
      action: 'CREATE_ASSET',
      entityType: 'asset',
      entityId: result.insertId,
      details: `name=${name}, type=${type}, serial=${serial}, domain=${requestedDomain}`
    });
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', requirePermission('inventory.manage'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, type, serial, status, store_id, vendor, notes, brand_id, model_id, domain_name } = req.body;
    const existingRows = await query('SELECT id, domain_name FROM assets WHERE id = ? LIMIT 1', [id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Asset not found' });
    if (!canAccessDomain(req.user, existing.domain_name)) return res.status(403).json({ error: 'Forbidden' });
    const requestedDomain = isSuperAdmin(req.user)
      ? (normalizeDomain(domain_name) || normalizeDomain(existing.domain_name))
      : getUserDomain(req.user);
    await query(
      `UPDATE assets
       SET name = ?, type = ?, domain_name = ?, serial = ?, status = ?, store_id = ?, vendor = ?, notes = ?, brand_id = ?, model_id = ?
       WHERE id = ?`,
      [name, type, requestedDomain, serial, status, store_id || null, vendor || null, notes || null, brand_id || null, model_id || null, id],
    );
    const updated = await query('SELECT * FROM assets WHERE id = ? LIMIT 1', [id]);
    await writeAuditLog({
      user: req.user,
      action: 'UPDATE_ASSET',
      entityType: 'asset',
      entityId: id,
      details: `name=${name}, type=${type}, serial=${serial}, status=${status}, domain=${requestedDomain}`
    });
    res.json(updated[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requirePermission('inventory.manage'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await query('SELECT id, name, serial, domain_name FROM assets WHERE id = ? LIMIT 1', [id]);
    const existing = rows[0];
    if (!existing) return res.status(404).json({ error: 'Asset not found' });
    if (!canAccessDomain(req.user, existing.domain_name)) return res.status(403).json({ error: 'Forbidden' });
    await query('DELETE FROM assets WHERE id = ?', [id]);
    await writeAuditLog({
      user: req.user,
      action: 'DELETE_ASSET',
      entityType: 'asset',
      entityId: id,
      details: `name=${existing.name}, serial=${existing.serial}, domain=${existing.domain_name || ''}`
    });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth, isSuperAdmin, normalizeDomain, getUserDomain } = require('../middleware/auth');
const { writeAuditLog } = require('../audit');

router.get('/', requireAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      const domain = getUserDomain(req.user);
      return res.json(domain ? [{ name: domain }] : []);
    }

    const rows = await query('SELECT id, name, created_at FROM domains ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) return res.status(403).json({ error: 'Only super admin can create domains' });

    const name = normalizeDomain(req.body?.name);
    if (!name) return res.status(400).json({ error: 'Domain name is required' });

    await query('INSERT IGNORE INTO domains (name) VALUES (?)', [name]);
    const rows = await query('SELECT id, name, created_at FROM domains WHERE name = ? LIMIT 1', [name]);
    await writeAuditLog({
      user: req.user,
      action: 'CREATE_DOMAIN',
      entityType: 'domain',
      entityId: rows[0]?.id || null,
      details: `domain=${name}`
    });
    res.status(201).json(rows[0] || { name });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:name', requireAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) return res.status(403).json({ error: 'Only super admin can delete domains' });

    const name = normalizeDomain(req.params.name);
    if (!name) return res.status(400).json({ error: 'Domain name is required' });
    if (name === 'global') return res.status(400).json({ error: 'Global domain cannot be deleted' });

    const rows = await query('SELECT id, name FROM domains WHERE name = ? LIMIT 1', [name]);
    if (!rows.length) return res.status(404).json({ error: 'Domain not found' });

    await query('UPDATE users SET domain_name = NULL WHERE LOWER(TRIM(domain_name)) = ?', [name]);
    await query('UPDATE assets SET domain_name = NULL WHERE LOWER(TRIM(domain_name)) = ?', [name]);
    await query('DELETE FROM domains WHERE name = ?', [name]);
    await writeAuditLog({
      user: req.user,
      action: 'DELETE_DOMAIN',
      entityType: 'domain',
      entityId: rows[0].id,
      details: `domain=${name}`
    });
    res.json({ ok: true, deleted: name });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

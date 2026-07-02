const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth, isSuperAdmin, normalizeDomain, getUserDomain } = require('../middleware/auth');
const { writeAuditLog } = require('../audit');

router.get('/', requireAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      const domain = getUserDomain(req.user);
      if (!domain) return res.json([]);
      const rows = await query(
        `SELECT d.*, primary_admin.name AS primary_admin_name, backup_admin.name AS backup_admin_name
         FROM domains d
         LEFT JOIN users primary_admin ON primary_admin.id = d.primary_admin_id
         LEFT JOIN users backup_admin ON backup_admin.id = d.backup_admin_id
         WHERE d.name = ?
         LIMIT 1`,
        [domain]
      );
      return res.json(rows.length ? rows : [{ name: domain, status: 'active' }]);
    }

    const rows = await query(
      `SELECT d.*, primary_admin.name AS primary_admin_name, backup_admin.name AS backup_admin_name
       FROM domains d
       LEFT JOIN users primary_admin ON primary_admin.id = d.primary_admin_id
       LEFT JOIN users backup_admin ON backup_admin.id = d.backup_admin_id
       ORDER BY d.name ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) return res.status(403).json({ error: 'Only super admin can create domains' });

    const name = normalizeDomain(req.body?.name);
    const code = String(req.body?.code || '').trim().toUpperCase();
    const branchType = String(req.body?.branch_type || '').trim();
    const country = String(req.body?.country || '').trim();
    const state = String(req.body?.state || '').trim();
    const city = String(req.body?.city || '').trim();
    const address = String(req.body?.address || '').trim();
    const pincode = String(req.body?.pincode || '').trim();
    const latitude = String(req.body?.latitude || '').trim();
    const longitude = String(req.body?.longitude || '').trim();
    const status = ['inactive', 'maintenance'].includes(String(req.body?.status || '').trim().toLowerCase())
      ? String(req.body.status).trim().toLowerCase()
      : 'active';
    const primaryAdminId = Number(req.body?.primary_admin_id || 0) || null;
    const backupAdminId = Number(req.body?.backup_admin_id || 0) || null;
    const employeeCodePrefix = String(req.body?.employee_code_prefix || '').trim().toLowerCase();
    if (!name) return res.status(400).json({ error: 'Domain name is required' });

    await query(
      `INSERT INTO domains (
        name, code, branch_type, country, state, city, address, pincode, latitude, longitude,
        status, primary_admin_id, backup_admin_id, employee_code_prefix
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        code = VALUES(code),
        branch_type = VALUES(branch_type),
        country = VALUES(country),
        state = VALUES(state),
        city = VALUES(city),
        address = VALUES(address),
        pincode = VALUES(pincode),
        latitude = VALUES(latitude),
        longitude = VALUES(longitude),
        status = VALUES(status),
        primary_admin_id = VALUES(primary_admin_id),
        backup_admin_id = VALUES(backup_admin_id),
        employee_code_prefix = VALUES(employee_code_prefix)`,
      [
        name,
        code || null,
        branchType || null,
        country || null,
        state || null,
        city || null,
        address || null,
        pincode || null,
        latitude || null,
        longitude || null,
        status,
        primaryAdminId,
        backupAdminId,
        employeeCodePrefix || null
      ]
    );
    const rows = await query(
      `SELECT d.*, primary_admin.name AS primary_admin_name, backup_admin.name AS backup_admin_name
       FROM domains d
       LEFT JOIN users primary_admin ON primary_admin.id = d.primary_admin_id
       LEFT JOIN users backup_admin ON backup_admin.id = d.backup_admin_id
       WHERE d.name = ?
       LIMIT 1`,
      [name]
    );
    await writeAuditLog({
      user: req.user,
      action: 'CREATE_DOMAIN',
      entityType: 'domain',
      entityId: rows[0]?.id || null,
      details: `domain=${name}; code=${code || '-'}; city=${city || '-'}; status=${status}`
    });
    res.status(201).json(rows[0] || { name });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:name', requireAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) return res.status(403).json({ error: 'Only super admin can update domains' });

    const currentName = normalizeDomain(req.params.name);
    if (!currentName) return res.status(400).json({ error: 'Domain name is required' });

    const existingRows = await query('SELECT id, name FROM domains WHERE LOWER(TRIM(name)) = ? LIMIT 1', [currentName]);
    const nextName = normalizeDomain(req.body?.name) || currentName;
    const code = String(req.body?.code || '').trim().toUpperCase();
    const country = String(req.body?.country || '').trim();
    const state = String(req.body?.state || '').trim();
    const city = String(req.body?.city || '').trim();
    const address = String(req.body?.address || '').trim();
    const pincode = String(req.body?.pincode || '').trim();
    const status = ['inactive', 'maintenance'].includes(String(req.body?.status || '').trim().toLowerCase())
      ? String(req.body.status).trim().toLowerCase()
      : 'active';
    const employeeCodePrefix = String(req.body?.employee_code_prefix || '').trim().toLowerCase();

    if (!nextName) return res.status(400).json({ error: 'Domain name is required' });

    let entityId = existingRows[0]?.id || null;
    if (existingRows.length) {
      await query(
        `UPDATE domains
         SET name = ?, code = ?, country = ?, state = ?, city = ?, address = ?, pincode = ?, status = ?, employee_code_prefix = ?
         WHERE id = ?`,
        [
          nextName,
          code || null,
          country || null,
          state || null,
          city || null,
          address || null,
          pincode || null,
          status,
          employeeCodePrefix || null,
          entityId
        ]
      );
    } else {
      const insertResult = await query(
        `INSERT INTO domains (
          name, code, country, state, city, address, pincode, status, employee_code_prefix
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nextName,
          code || null,
          country || null,
          state || null,
          city || null,
          address || null,
          pincode || null,
          status,
          employeeCodePrefix || null
        ]
      );
      entityId = insertResult?.insertId || null;
    }

    if (currentName !== nextName) {
      await query('UPDATE users SET domain_name = ? WHERE LOWER(TRIM(domain_name)) = ?', [nextName, currentName]);
      await query('UPDATE assets SET domain_name = ? WHERE LOWER(TRIM(domain_name)) = ?', [nextName, currentName]);
    }

    const rows = await query(
      `SELECT d.*, primary_admin.name AS primary_admin_name, backup_admin.name AS backup_admin_name
       FROM domains d
       LEFT JOIN users primary_admin ON primary_admin.id = d.primary_admin_id
       LEFT JOIN users backup_admin ON backup_admin.id = d.backup_admin_id
       WHERE d.id = ?
       LIMIT 1`,
      [entityId]
    );

    await writeAuditLog({
      user: req.user,
      action: 'UPDATE_DOMAIN',
      entityType: 'domain',
      entityId,
      details: `domain=${currentName} -> ${nextName}; code=${code || '-'}; city=${city || '-'}; status=${status}`
    });

    res.json(rows[0] || { name: nextName });
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

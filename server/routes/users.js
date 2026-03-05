const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { requireAuth, requireRole, parsePermissions, isSuperAdmin } = require('../middleware/auth');
const { writeAuditLog } = require('../audit');

function normalizeUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    profile_image_url: row.profile_image_url || null,
    permissions: parsePermissions(row.permissions_json),
    is_super_admin: isSuperAdmin(row),
  };
}

function serializePermissions(value) {
  const list = Array.isArray(value)
    ? value
    : parsePermissions(value);
  const next = new Set(list.map(String));
  if (next.has('inventory.manage')) next.add('inventory.view');
  if (next.has('assignments.manage')) next.add('assignments.view');
  return next.size ? JSON.stringify(Array.from(next)) : null;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, name, email, role, profile_image_url, permissions_json FROM users ORDER BY id DESC'
    );
    res.json(rows.map(normalizeUserRow));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await query(
      'SELECT id, name, email, role, profile_image_url, permissions_json FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(normalizeUserRow(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name, email, role, password, profile_image_url, permissions } = req.body;
    const requestedRole = role || 'user';
    if (requestedRole === 'admin' && !isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Only super admin can create admin accounts' });
    }
    const hashed = bcrypt.hashSync(password || 'password', 8);
    const permissionsJson = requestedRole === 'admin' ? serializePermissions(permissions) : null;
    const result = await query(
      'INSERT INTO users (name, email, role, profile_image_url, permissions_json, password) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, requestedRole, profile_image_url || null, permissionsJson, hashed]
    );
    const createdRows = await query(
      'SELECT id, name, email, role, profile_image_url, permissions_json FROM users WHERE id = ? LIMIT 1',
      [result.insertId]
    );
    await writeAuditLog({
      user: req.user,
      action: 'CREATE_USER',
      entityType: 'user',
      entityId: result.insertId,
      details: `name=${name}, email=${email}, role=${requestedRole}`
    });
    res.status(201).json(normalizeUserRow(createdRows[0]));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/admin', requireRole('admin'), async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Only super admin can create admin accounts' });
    }
    const { name, email, password, profile_image_url, permissions } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
    const hashed = bcrypt.hashSync(password || 'password', 8);
    const permissionsJson = serializePermissions(permissions);

    const result = await query(
      'INSERT INTO users (name, email, role, profile_image_url, permissions_json, password) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, 'admin', profile_image_url || null, permissionsJson, hashed]
    );
    const createdRows = await query(
      'SELECT id, name, email, role, profile_image_url, permissions_json FROM users WHERE id = ? LIMIT 1',
      [result.insertId]
    );
    await writeAuditLog({
      user: req.user,
      action: 'CREATE_ADMIN_ACCOUNT',
      entityType: 'user',
      entityId: result.insertId,
      details: `name=${name}, email=${email}, permissions_count=${parsePermissions(permissionsJson).length}`
    });
    res.status(201).json(normalizeUserRow(createdRows[0]));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, email, role, profile_image_url } = req.body;
    const existingRows = await query(
      'SELECT id, name, email, role, permissions_json FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'User not found' });
    if (isSuperAdmin(existing) && !isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Super admin account is restricted' });
    }

    const requestedRole = role || existing.role || 'user';
    if (requestedRole === 'admin' && !isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Only super admin can promote to admin' });
    }

    const nextPermissions = requestedRole === 'admin' ? existing.permissions_json : null;
    await query(
      'UPDATE users SET name = ?, email = ?, role = ?, profile_image_url = ?, permissions_json = ? WHERE id = ?',
      [name, email, requestedRole, profile_image_url || null, nextPermissions, id]
    );
    const updatedRows = await query(
      'SELECT id, name, email, role, profile_image_url, permissions_json FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    await writeAuditLog({
      user: req.user,
      action: 'UPDATE_USER',
      entityType: 'user',
      entityId: id,
      details: `name=${name}, email=${email}, role=${requestedRole}`
    });
    res.json(normalizeUserRow(updatedRows[0]));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/permissions', requireRole('admin'), async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Only super admin can update admin permissions' });
    }
    const id = Number(req.params.id);
    const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : [];
    const existingRows = await query('SELECT id, email, role FROM users WHERE id = ? LIMIT 1', [id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'User not found' });
    if (isSuperAdmin(existing)) {
      return res.status(400).json({ error: 'Super admin permissions cannot be modified here' });
    }
    if ((existing.role || '').toLowerCase() !== 'admin') {
      return res.status(400).json({ error: 'Permissions can be set only for admin accounts' });
    }

    const permissionsJson = serializePermissions(permissions);
    await query('UPDATE users SET permissions_json = ? WHERE id = ?', [permissionsJson, id]);
    const updatedRows = await query(
      'SELECT id, name, email, role, profile_image_url, permissions_json FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    await writeAuditLog({
      user: req.user,
      action: 'UPDATE_ADMIN_PERMISSIONS',
      entityType: 'user',
      entityId: id,
      details: `permissions_count=${permissions.length}`
    });
    res.json(normalizeUserRow(updatedRows[0]));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

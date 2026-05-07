const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { requireAuth, requireRole, parsePermissions, isSuperAdmin } = require('../middleware/auth');
const { writeAuditLog } = require('../audit');

const PRIMARY_DB_NAME = process.env.DB_NAME || 'IT_admin';
const EMPLOYEE_DB_NAME = process.env.EMPLOYEE_DB_NAME || 'employee_db';

async function getColumnNames(schemaName, tableName) {
  const rows = await query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [schemaName, tableName]
  );
  return rows.map((row) => row.COLUMN_NAME);
}

function pickFirst(columns, candidates) {
  return candidates.find((candidate) => columns.includes(candidate)) || null;
}

async function getAssignmentOptionRows() {
  const [localUserColumns, employeeColumns] = await Promise.all([
    getColumnNames(PRIMARY_DB_NAME, 'users'),
    getColumnNames(EMPLOYEE_DB_NAME, 'employees'),
  ]);

  const localUsers = await query(
    `SELECT id, name, email, role, ${localUserColumns.includes('employee_code') ? 'employee_code' : 'NULL AS employee_code'}
     FROM users
     WHERE LOWER(role) = 'user'
     ORDER BY name ASC`
  );

  if (!employeeColumns.length) {
    return localUsers.map((userRow) => ({
      id: userRow.id,
      local_user_id: userRow.id,
      name: userRow.name,
      employee_code: userRow.employee_code || null,
      label: userRow.employee_code ? `${userRow.name} (${userRow.employee_code})` : userRow.name,
      is_assignable: true,
      source: 'local_users',
    }));
  }

  const employeeNameColumn = pickFirst(employeeColumns, ['employee_name', 'name', 'full_name']);
  const employeeCodeColumn = pickFirst(employeeColumns, ['employee_code', 'emp_code', 'employee_id', 'code']);

  if (!employeeNameColumn) {
    return localUsers.map((userRow) => ({
      id: userRow.id,
      local_user_id: userRow.id,
      name: userRow.name,
      employee_code: userRow.employee_code || null,
      label: userRow.employee_code ? `${userRow.name} (${userRow.employee_code})` : userRow.name,
      is_assignable: true,
      source: 'local_users',
    }));
  }

  const employeeIdColumn = pickFirst(employeeColumns, ['id', 'employee_id', 'emp_id']);

  const employeeRows = await query(
    `SELECT
        ${employeeIdColumn ? `\`${employeeIdColumn}\`` : 'NULL'} AS employee_row_id,
        \`${employeeNameColumn}\` AS employee_name,
        ${employeeCodeColumn ? `\`${employeeCodeColumn}\`` : 'NULL'} AS employee_code
     FROM \`${EMPLOYEE_DB_NAME}\`.\`employees\`
     WHERE TRIM(COALESCE(\`${employeeNameColumn}\`, '')) <> ''
     ORDER BY \`${employeeNameColumn}\` ASC`
  );

  const byCode = new Map();
  const byName = new Map();
  localUsers.forEach((userRow) => {
    const codeKey = String(userRow.employee_code || '').trim().toLowerCase();
    const nameKey = String(userRow.name || '').trim().toLowerCase();
    if (codeKey && !byCode.has(codeKey)) byCode.set(codeKey, userRow);
    if (nameKey && !byName.has(nameKey)) byName.set(nameKey, userRow);
  });

  return employeeRows.map((employeeRow, index) => {
    const codeKey = String(employeeRow.employee_code || '').trim().toLowerCase();
    const nameKey = String(employeeRow.employee_name || '').trim().toLowerCase();
    const matchedUser = (codeKey && byCode.get(codeKey)) || byName.get(nameKey) || null;
    const labelBase = employeeRow.employee_code
      ? `${employeeRow.employee_name} (${employeeRow.employee_code})`
      : employeeRow.employee_name;

    return {
      id: matchedUser?.id || '',
      local_user_id: matchedUser?.id || null,
      external_employee_id: employeeRow.employee_row_id || index + 1,
      name: employeeRow.employee_name || matchedUser.name,
      employee_code: employeeRow.employee_code || matchedUser.employee_code || null,
      label: matchedUser ? labelBase : `${labelBase} (not synced)`,
      is_assignable: !!matchedUser,
      source: 'employee_db',
    };
  });
}

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
    if (String(req.query.assignment_options || '') === '1') {
      const rows = await getAssignmentOptionRows();
      return res.json(rows);
    }

    const rows = await query(
      'SELECT id, name, email, role, profile_image_url, permissions_json FROM users ORDER BY id DESC'
    );
    res.json(rows.map(normalizeUserRow));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/assignment-options', requireAuth, async (req, res) => {
  try {
    const rows = await getAssignmentOptionRows();
    res.json(rows);
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

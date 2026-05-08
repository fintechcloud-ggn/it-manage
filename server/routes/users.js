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

function normalizeValue(value) {
  if (value == null) return '';
  return String(value).trim();
}

function buildEmployeeLabel(name, employeeCode) {
  return employeeCode ? `${name} (${employeeCode})` : name;
}

async function syncEmployeesFromDb() {
  const [localUserColumns, employeeColumns] = await Promise.all([
    getColumnNames(PRIMARY_DB_NAME, 'users'),
    getColumnNames(EMPLOYEE_DB_NAME, 'employees'),
  ]);

  const selectEmployeeCode = localUserColumns.includes('employee_code') ? 'employee_code' : 'NULL AS employee_code';
  const localUsers = await query(
    `SELECT id, name, email, role, ${selectEmployeeCode}
     FROM users
     WHERE LOWER(role) = 'user'
     ORDER BY name ASC`
  );

  if (!employeeColumns.length) {
    return { localUsers, localUserColumns, employeeRows: [] };
  }

  const employeeNameColumn = pickFirst(employeeColumns, ['employee_name', 'name', 'full_name']);
  if (!employeeNameColumn) {
    return { localUsers, localUserColumns, employeeRows: [] };
  }

  const employeeIdColumn = pickFirst(employeeColumns, ['id', 'employee_id', 'emp_id']);
  const employeeCodeColumn = pickFirst(employeeColumns, ['employee_code', 'emp_code', 'employee_id', 'code']);
  const employeeEmailColumn = pickFirst(employeeColumns, ['email', 'email_id', 'official_email', 'work_email']);
  const companyColumn = pickFirst(employeeColumns, ['company', 'company_name']);
  const departmentColumn = pickFirst(employeeColumns, ['department', 'dept']);
  const designationColumn = pickFirst(employeeColumns, ['designation', 'title', 'job_title']);
  const locationColumn = pickFirst(employeeColumns, ['location', 'office_location', 'branch']);
  const employmentTypeColumn = pickFirst(employeeColumns, ['employment_type', 'employee_type', 'type']);
  const employmentStatusColumn = pickFirst(employeeColumns, ['employment_status', 'status']);

  const employeeRows = await query(
    `SELECT
        ${employeeIdColumn ? `\`${employeeIdColumn}\`` : 'NULL'} AS employee_row_id,
        \`${employeeNameColumn}\` AS employee_name,
        ${employeeCodeColumn ? `\`${employeeCodeColumn}\`` : 'NULL'} AS employee_code,
        ${employeeEmailColumn ? `\`${employeeEmailColumn}\`` : 'NULL'} AS employee_email,
        ${companyColumn ? `\`${companyColumn}\`` : 'NULL'} AS company,
        ${departmentColumn ? `\`${departmentColumn}\`` : 'NULL'} AS department,
        ${designationColumn ? `\`${designationColumn}\`` : 'NULL'} AS designation,
        ${locationColumn ? `\`${locationColumn}\`` : 'NULL'} AS location,
        ${employmentTypeColumn ? `\`${employmentTypeColumn}\`` : 'NULL'} AS employment_type,
        ${employmentStatusColumn ? `\`${employmentStatusColumn}\`` : 'NULL'} AS employment_status
     FROM \`${EMPLOYEE_DB_NAME}\`.\`employees\`
     WHERE TRIM(COALESCE(\`${employeeNameColumn}\`, '')) <> ''
     ORDER BY \`${employeeNameColumn}\` ASC`
  );

  const usersByCode = new Map();
  const usersByName = new Map();
  const usersByEmail = new Map();
  localUsers.forEach((userRow) => {
    const codeKey = normalizeValue(userRow.employee_code).toLowerCase();
    const nameKey = normalizeValue(userRow.name).toLowerCase();
    const emailKey = normalizeValue(userRow.email).toLowerCase();
    if (codeKey && !usersByCode.has(codeKey)) usersByCode.set(codeKey, userRow);
    if (nameKey && !usersByName.has(nameKey)) usersByName.set(nameKey, userRow);
    if (emailKey && !usersByEmail.has(emailKey)) usersByEmail.set(emailKey, userRow);
  });

  const insertPasswordHash = bcrypt.hashSync('password', 8);
  const syncedUsers = [...localUsers];

  for (const employeeRow of employeeRows) {
    const employeeName = normalizeValue(employeeRow.employee_name);
    if (!employeeName) continue;

    const employeeCode = normalizeValue(employeeRow.employee_code);
    const employeeEmail = normalizeValue(employeeRow.employee_email);
    const codeKey = employeeCode.toLowerCase();
    const nameKey = employeeName.toLowerCase();
    const emailKey = employeeEmail.toLowerCase();

    let matchedUser =
      (codeKey && usersByCode.get(codeKey)) ||
      (emailKey && usersByEmail.get(emailKey)) ||
      usersByName.get(nameKey) ||
      null;

    const nextEmail = employeeEmail || `${(employeeCode || `employee-${employeeRow.employee_row_id || employeeName}`).toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/(^\.|\.$)/g, '')}@employee-db.local`;

    if (matchedUser) {
      const updates = [];
      const params = [];

      updates.push('name = ?');
      params.push(employeeName);

      if (localUserColumns.includes('employee_code')) {
        updates.push('employee_code = ?');
        params.push(employeeCode || null);
      }
      if (localUserColumns.includes('company')) {
        updates.push('company = ?');
        params.push(normalizeValue(employeeRow.company) || null);
      }
      if (localUserColumns.includes('department')) {
        updates.push('department = ?');
        params.push(normalizeValue(employeeRow.department) || null);
      }
      if (localUserColumns.includes('designation')) {
        updates.push('designation = ?');
        params.push(normalizeValue(employeeRow.designation) || null);
      }
      if (localUserColumns.includes('location')) {
        updates.push('location = ?');
        params.push(normalizeValue(employeeRow.location) || null);
      }
      if (localUserColumns.includes('employment_type')) {
        updates.push('employment_type = ?');
        params.push(normalizeValue(employeeRow.employment_type) || null);
      }
      if (localUserColumns.includes('employment_status')) {
        updates.push('employment_status = ?');
        params.push(normalizeValue(employeeRow.employment_status) || null);
      }

      if (employeeEmail && normalizeValue(matchedUser.email) !== employeeEmail) {
        const conflictingEmailUser = usersByEmail.get(emailKey);
        if (!conflictingEmailUser || conflictingEmailUser.id === matchedUser.id) {
          updates.push('email = ?');
          params.push(employeeEmail);
        }
      }

      params.push(matchedUser.id);
      await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

      matchedUser = {
        ...matchedUser,
        name: employeeName,
        email: employeeEmail || matchedUser.email,
        employee_code: employeeCode || matchedUser.employee_code || null,
      };
    } else {
      const safeEmail = usersByEmail.has(nextEmail.toLowerCase())
        ? `employee.${employeeRow.employee_row_id || Date.now()}@employee-db.local`
        : nextEmail;

      const insertColumns = ['name', 'email', 'role', 'password'];
      const insertValues = [employeeName, safeEmail, 'user', insertPasswordHash];

      if (localUserColumns.includes('employee_code')) {
        insertColumns.push('employee_code');
        insertValues.push(employeeCode || null);
      }
      if (localUserColumns.includes('company')) {
        insertColumns.push('company');
        insertValues.push(normalizeValue(employeeRow.company) || null);
      }
      if (localUserColumns.includes('department')) {
        insertColumns.push('department');
        insertValues.push(normalizeValue(employeeRow.department) || null);
      }
      if (localUserColumns.includes('designation')) {
        insertColumns.push('designation');
        insertValues.push(normalizeValue(employeeRow.designation) || null);
      }
      if (localUserColumns.includes('location')) {
        insertColumns.push('location');
        insertValues.push(normalizeValue(employeeRow.location) || null);
      }
      if (localUserColumns.includes('employment_type')) {
        insertColumns.push('employment_type');
        insertValues.push(normalizeValue(employeeRow.employment_type) || null);
      }
      if (localUserColumns.includes('employment_status')) {
        insertColumns.push('employment_status');
        insertValues.push(normalizeValue(employeeRow.employment_status) || null);
      }

      const placeholders = insertColumns.map(() => '?').join(', ');
      const result = await query(
        `INSERT INTO users (${insertColumns.join(', ')}) VALUES (${placeholders})`,
        insertValues
      );

      matchedUser = {
        id: result.insertId,
        name: employeeName,
        email: safeEmail,
        role: 'user',
        employee_code: employeeCode || null,
      };
      syncedUsers.push(matchedUser);
    }

    const syncedCodeKey = normalizeValue(matchedUser.employee_code).toLowerCase();
    const syncedNameKey = normalizeValue(matchedUser.name).toLowerCase();
    const syncedEmailKey = normalizeValue(matchedUser.email).toLowerCase();
    if (syncedCodeKey) usersByCode.set(syncedCodeKey, matchedUser);
    if (syncedNameKey) usersByName.set(syncedNameKey, matchedUser);
    if (syncedEmailKey) usersByEmail.set(syncedEmailKey, matchedUser);
  }

  return { localUsers: syncedUsers, localUserColumns, employeeRows };
}

async function getAssignmentOptionRows() {
  const { localUsers, employeeRows } = await syncEmployeesFromDb();

  if (!employeeRows.length) {
    return [];
  }

  const byCode = new Map();
  const byName = new Map();
  localUsers.forEach((userRow) => {
    const codeKey = normalizeValue(userRow.employee_code).toLowerCase();
    const nameKey = normalizeValue(userRow.name).toLowerCase();
    if (codeKey && !byCode.has(codeKey)) byCode.set(codeKey, userRow);
    if (nameKey && !byName.has(nameKey)) byName.set(nameKey, userRow);
  });

  return employeeRows.map((employeeRow, index) => {
    const employeeName = normalizeValue(employeeRow.employee_name);
    const employeeCode = normalizeValue(employeeRow.employee_code);
    const codeKey = employeeCode.toLowerCase();
    const nameKey = employeeName.toLowerCase();
    const matchedUser = (codeKey && byCode.get(codeKey)) || byName.get(nameKey) || null;

    return {
      id: matchedUser?.id || '',
      local_user_id: matchedUser?.id || null,
      external_employee_id: employeeRow.employee_row_id || index + 1,
      name: employeeName || matchedUser?.name || '',
      employee_code: employeeCode || matchedUser?.employee_code || null,
      label: buildEmployeeLabel(employeeName || matchedUser?.name || '', employeeCode || matchedUser?.employee_code),
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

    await syncEmployeesFromDb();

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

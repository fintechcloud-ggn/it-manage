const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const {
  requireAuth,
  requirePermission,
  requireAnyPermission,
  parsePermissions,
  isSuperAdmin,
  normalizeDomain,
  getUserDomain,
  canAccessDomain,
  canAccessDomainRecord
} = require('../middleware/auth');
const { writeAuditLog } = require('../audit');

const PRIMARY_DB_NAME = process.env.DB_NAME || 'IT_admin';
const ASSIGNMENT_EMPLOYEE_DB_NAME = PRIMARY_DB_NAME;

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
  const normalizedColumns = new Map(
    columns.map((column) => [String(column).trim().toLowerCase(), column])
  );
  for (const candidate of candidates) {
    const matched = normalizedColumns.get(String(candidate).trim().toLowerCase());
    if (matched) return matched;
  }
  return null;
}

function normalizeValue(value) {
  if (value == null) return '';
  return String(value).trim();
}

function buildEmployeeLabel(name, employeeCode) {
  return employeeCode ? `${name} (${employeeCode})` : name;
}

async function getAssignmentEmployeeRows() {
  const [localUserColumns, employeeColumns] = await Promise.all([
    getColumnNames(PRIMARY_DB_NAME, 'users'),
    getColumnNames(ASSIGNMENT_EMPLOYEE_DB_NAME, 'employees'),
  ]);

  const selectEmployeeCode = localUserColumns.includes('employee_code') ? 'employee_code' : 'NULL AS employee_code';
  const localUsers = await query(
    `SELECT id, name, email, role, domain_name, employee_code_prefix, ${selectEmployeeCode}
     FROM users
     WHERE LOWER(role) = 'user'
     ORDER BY name ASC`
  );

  if (!employeeColumns.length) {
    return { localUsers, employeeRows: [] };
  }

  const employeeNameColumn = pickFirst(employeeColumns, ['employee_name', 'employee_name_', 'name', 'full_name', 'employee']);
  if (!employeeNameColumn) {
    return { localUsers, employeeRows: [] };
  }

  const employeeIdColumn = pickFirst(employeeColumns, ['id', 'employee_id', 'emp_id', 'employeeid']);
  const employeeCodeColumn = pickFirst(employeeColumns, ['employee_code', 'employeecode', 'emp_code', 'empcode', 'employee_id', 'code']);
  const employeeEmailColumn = pickFirst(employeeColumns, ['email', 'email_id', 'official_email', 'work_email', 'mail']);
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
     FROM \`${ASSIGNMENT_EMPLOYEE_DB_NAME}\`.\`employees\`
     WHERE TRIM(COALESCE(\`${employeeNameColumn}\`, '')) <> ''
     ORDER BY \`${employeeNameColumn}\` ASC`
  );
  return { localUsers, employeeRows };
}

async function getAssignmentOptionRows() {
  const { localUsers, employeeRows } = await getAssignmentEmployeeRows();

  const byCode = new Map();
  const byName = new Map();
  localUsers.forEach((userRow) => {
    const codeKey = normalizeValue(userRow.employee_code).toLowerCase();
    const nameKey = normalizeValue(userRow.name).toLowerCase();
    if (codeKey && !byCode.has(codeKey)) byCode.set(codeKey, userRow);
    if (nameKey && !byName.has(nameKey)) byName.set(nameKey, userRow);
  });

  const mappedRows = employeeRows.map((employeeRow, index) => {
    const employeeName = normalizeValue(employeeRow.employee_name);
    const employeeCode = normalizeValue(employeeRow.employee_code);
    const codeKey = employeeCode.toLowerCase();
    const nameKey = employeeName.toLowerCase();
    const matchedUser = (codeKey && byCode.get(codeKey)) || byName.get(nameKey) || null;

    return {
      id: matchedUser?.id || '',
      local_user_id: matchedUser?.id || null,
      domain_name: matchedUser?.domain_name || null,
      employee_code_prefix: matchedUser?.employee_code_prefix || null,
      external_employee_id: employeeRow.employee_row_id || index + 1,
      name: employeeName || matchedUser?.name || '',
      employee_code: employeeCode || matchedUser?.employee_code || null,
      employee_email: normalizeValue(employeeRow.employee_email) || matchedUser?.email || null,
      label: buildEmployeeLabel(employeeName || matchedUser?.name || '', employeeCode || matchedUser?.employee_code),
      is_assignable: !!matchedUser,
      source: 'it_admin.employees',
    };
  });

  const seenLocalUserIds = new Set(
    mappedRows
      .map((row) => row.local_user_id)
      .filter(Boolean)
      .map((value) => Number(value))
  );

  const fallbackLocalRows = localUsers
    .filter((userRow) => userRow.id && !seenLocalUserIds.has(Number(userRow.id)))
    .map((userRow) => ({
      id: userRow.id,
      local_user_id: userRow.id,
      domain_name: userRow.domain_name || null,
      employee_code_prefix: userRow.employee_code_prefix || null,
      external_employee_id: null,
      name: userRow.name || '',
      employee_code: userRow.employee_code || null,
      employee_email: userRow.email || null,
      label: buildEmployeeLabel(userRow.name || '', userRow.employee_code || null),
      is_assignable: true,
      source: 'users',
    }));

  return [...mappedRows, ...fallbackLocalRows];
}

function normalizeUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    employee_code: row.employee_code || null,
    domain_name: row.domain_name || null,
    employee_code_prefix: row.employee_code_prefix || null,
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
      let rows = await getAssignmentOptionRows();
      if (!isSuperAdmin(req.user)) {
        rows = rows.filter((row) => canAccessDomainRecord(req.user, row));
      }
      return res.json(rows);
    }

    let rows = await query(
      'SELECT id, name, email, role, employee_code, domain_name, employee_code_prefix, profile_image_url, permissions_json FROM users ORDER BY id DESC'
    );
    if (!isSuperAdmin(req.user)) {
      rows = rows.filter((row) => canAccessDomainRecord(req.user, row));
    }
    res.json(rows.map(normalizeUserRow));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/assignment-options', requireAuth, async (req, res) => {
  try {
    let rows = await getAssignmentOptionRows();
    if (!isSuperAdmin(req.user)) {
      rows = rows.filter((row) => canAccessDomainRecord(req.user, row));
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await query(
      'SELECT id, name, email, role, employee_code, domain_name, employee_code_prefix, profile_image_url, permissions_json FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    if (!canAccessDomainRecord(req.user, rows[0])) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(normalizeUserRow(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAnyPermission(['accounts.create', 'accounts.manage']), async (req, res) => {
  try {
    const { name, email, role, password, profile_image_url, permissions, domain_name, employee_code_prefix } = req.body;
    const requestedRole = role || 'user';
    const requestedDomain = isSuperAdmin(req.user)
      ? normalizeDomain(domain_name)
      : getUserDomain(req.user);
    if (!requestedDomain) {
      return res.status(400).json({ error: 'Domain is required' });
    }
    const normalizedPrefix = String(employee_code_prefix || '').trim().toLowerCase() || null;
    const hashed = bcrypt.hashSync(password || 'password', 8);
    const permissionsJson = requestedRole === 'user' ? null : serializePermissions(permissions);
    const result = await query(
      'INSERT INTO users (name, email, role, domain_name, employee_code_prefix, profile_image_url, permissions_json, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, requestedRole, requestedDomain, normalizedPrefix, profile_image_url || null, permissionsJson, hashed]
    );
    const createdRows = await query(
      'SELECT id, name, email, role, employee_code, domain_name, employee_code_prefix, profile_image_url, permissions_json FROM users WHERE id = ? LIMIT 1',
      [result.insertId]
    );
    await writeAuditLog({
      user: req.user,
      action: 'CREATE_USER',
      entityType: 'user',
      entityId: result.insertId,
      details: `name=${name}, email=${email}, role=${requestedRole}, domain=${requestedDomain}, code_prefix=${normalizedPrefix || ''}`
    });
    res.status(201).json(normalizeUserRow(createdRows[0]));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/admin', requireAnyPermission(['accounts.create', 'accounts.manage']), async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Only super admin can create admin accounts' });
    }
    const { name, email, password, profile_image_url, permissions, role, domain_name, employee_code_prefix } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
    const requestedRole = String(role || 'admin').trim() || 'admin';
    const requestedDomain = normalizeDomain(domain_name);
    if (!requestedDomain) return res.status(400).json({ error: 'domain is required' });
    const normalizedPrefix = String(employee_code_prefix || '').trim().toLowerCase() || null;
    const hashed = bcrypt.hashSync(password || 'password', 8);
    const permissionsJson = requestedRole === 'user' ? null : serializePermissions(permissions);

    const result = await query(
      'INSERT INTO users (name, email, role, domain_name, employee_code_prefix, profile_image_url, permissions_json, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, requestedRole, requestedDomain, normalizedPrefix, profile_image_url || null, permissionsJson, hashed]
    );
    const createdRows = await query(
      'SELECT id, name, email, role, employee_code, domain_name, employee_code_prefix, profile_image_url, permissions_json FROM users WHERE id = ? LIMIT 1',
      [result.insertId]
    );
    await writeAuditLog({
      user: req.user,
      action: 'CREATE_ADMIN_ACCOUNT',
      entityType: 'user',
      entityId: result.insertId,
      details: `name=${name}, email=${email}, role=${requestedRole}, domain=${requestedDomain}, code_prefix=${normalizedPrefix || ''}, permissions_count=${parsePermissions(permissionsJson).length}`
    });
    res.status(201).json(normalizeUserRow(createdRows[0]));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', requireAnyPermission(['accounts.edit', 'accounts.manage']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, email, role, profile_image_url, domain_name, employee_code_prefix } = req.body;
    const existingRows = await query(
      'SELECT id, name, email, role, domain_name, employee_code_prefix, permissions_json FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'User not found' });
    if (!canAccessDomain(req.user, existing.domain_name)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (isSuperAdmin(existing) && !isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Super admin account is restricted' });
    }

    const requestedRole = role || existing.role || 'user';
    const requestedDomain = isSuperAdmin(req.user)
      ? (normalizeDomain(domain_name) || normalizeDomain(existing.domain_name))
      : getUserDomain(req.user);
    const normalizedPrefix = String(employee_code_prefix || existing.employee_code_prefix || '').trim().toLowerCase() || null;

    const nextPermissions = requestedRole === 'user' ? null : existing.permissions_json;
    await query(
      'UPDATE users SET name = ?, email = ?, role = ?, domain_name = ?, employee_code_prefix = ?, profile_image_url = ?, permissions_json = ? WHERE id = ?',
      [name, email, requestedRole, requestedDomain, normalizedPrefix, profile_image_url || null, nextPermissions, id]
    );
    const updatedRows = await query(
      'SELECT id, name, email, role, employee_code, domain_name, employee_code_prefix, profile_image_url, permissions_json FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    await writeAuditLog({
      user: req.user,
      action: 'UPDATE_USER',
      entityType: 'user',
      entityId: id,
      details: `name=${name}, email=${email}, role=${requestedRole}, domain=${requestedDomain}, code_prefix=${normalizedPrefix || ''}`
    });
    res.json(normalizeUserRow(updatedRows[0]));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/permissions', requireAnyPermission(['accounts.edit', 'accounts.manage']), async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Only super admin can update admin permissions' });
    }
    const id = Number(req.params.id);
    const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : [];
    const existingRows = await query('SELECT id, email, role, domain_name FROM users WHERE id = ? LIMIT 1', [id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'User not found' });
    if (isSuperAdmin(existing)) {
      return res.status(400).json({ error: 'Super admin permissions cannot be modified here' });
    }
    if ((existing.role || '').toLowerCase() === 'user') {
      return res.status(400).json({ error: 'Permissions can be set only for non-user accounts' });
    }

    const permissionsJson = serializePermissions(permissions);
    await query('UPDATE users SET permissions_json = ? WHERE id = ?', [permissionsJson, id]);
    const updatedRows = await query(
      'SELECT id, name, email, role, employee_code, domain_name, employee_code_prefix, profile_image_url, permissions_json FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    await writeAuditLog({
      user: req.user,
      action: 'UPDATE_ADMIN_PERMISSIONS',
      entityType: 'user',
      entityId: id,
      details: `domain=${existing.domain_name || ''}, permissions_count=${permissions.length}`
    });
    res.json(normalizeUserRow(updatedRows[0]));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireAnyPermission(['accounts.delete', 'accounts.manage']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await query(
      'SELECT id, name, email, role, domain_name, employee_code_prefix FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    const existing = rows[0];
    if (!existing) return res.status(404).json({ error: 'User not found' });
    if (isSuperAdmin(existing)) return res.status(400).json({ error: 'Super admin account cannot be deleted' });
    if (!canAccessDomain(req.user, existing.domain_name)) return res.status(403).json({ error: 'Forbidden' });

    await query('DELETE FROM users WHERE id = ?', [id]);
    await writeAuditLog({
      user: req.user,
      action: 'DELETE_USER',
      entityType: 'user',
      entityId: id,
      details: `name=${existing.name}, email=${existing.email}, role=${existing.role}, domain=${existing.domain_name || ''}, code_prefix=${existing.employee_code_prefix || ''}`
    });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

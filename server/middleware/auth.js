const jwt = require('jsonwebtoken');
const { query } = require('../db');

const SECRET = process.env.JWT_SECRET || 'change_this_secret';

function normalizeDomain(value) {
  return String(value || '').trim().toLowerCase();
}

const DOMAIN_EMPLOYEE_CODE_RULES = {
  fintech: ['fch'],
  zapto: ['zpt']
};

function normalizeEmployeeCode(value) {
  return String(value || '').trim().toLowerCase();
}

function getDomainEmployeeCodeRules(domainName) {
  return DOMAIN_EMPLOYEE_CODE_RULES[normalizeDomain(domainName)] || [];
}

function domainMatchesEmployeeCode(domainName, employeeCode) {
  const normalizedCode = normalizeEmployeeCode(employeeCode);
  if (!normalizedCode) return false;
  return getDomainEmployeeCodeRules(domainName).some((token) => normalizedCode.includes(token));
}

function parsePermissions(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean).map(String);
  } catch (err) {
    return [];
  }
}

function isSuperAdmin(user) {
  return !!user && String(user.email || '').toLowerCase() === 'admin';
}

function getUserDomain(user) {
  if (!user) return '';
  return normalizeDomain(user.domain_name || user.domain || '');
}

function getUserEmployeeCodePrefix(user) {
  return String(user?.employee_code_prefix || '').trim().toLowerCase();
}

function hasPermission(user, permissionKey) {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const normalizedRole = String(user.role || '').toLowerCase();
  const permissions = Array.isArray(user.permissions)
    ? user.permissions
    : parsePermissions(user.permissions_json);
  if (!permissions.length) return normalizedRole === 'admin'; // Backward compatibility for existing admin accounts.
  return permissions.includes(permissionKey);
}

function canAccessDomain(user, domainName) {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const userDomain = getUserDomain(user);
  const targetDomain = normalizeDomain(domainName);
  if (!userDomain) return !targetDomain;
  return userDomain === targetDomain;
}

function canAccessDomainRecord(user, record = {}) {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const userDomain = getUserDomain(user);
  const userPrefix = getUserEmployeeCodePrefix(user);

  const recordDomain = normalizeDomain(record.domain_name || record.domain || '');
  const recordCode = normalizeEmployeeCode(
    record.employee_code ||
    record.assigned_to_employee_code ||
    record.user_employee_code ||
    record.employeeCode
  );
  if (userPrefix) {
    if (recordCode && recordCode.includes(userPrefix)) return true;
  }

  if (!userDomain) return false;
  if (recordDomain) return recordDomain === userDomain;

  return domainMatchesEmployeeCode(userDomain, recordCode);
}

function hasAnyPermission(user, permissionKeys = []) {
  return permissionKeys.some((permissionKey) => hasPermission(user, permissionKey));
}

async function attachUser(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, SECRET);
    const rows = await query(
      'SELECT id, name, email, role, profile_image_url, permissions_json, domain_name, employee_code_prefix FROM users WHERE id = ? LIMIT 1',
      [payload.id]
    );
    const user = rows[0] || null;
    if (user) {
      user.permissions = parsePermissions(user.permissions_json);
      user.is_super_admin = isSuperAdmin(user);
    }
    req.user = user;
  } catch (err) {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!hasPermission(req.user, permissionKey)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

function requireAnyPermission(permissionKeys = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!hasAnyPermission(req.user, permissionKeys)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

module.exports = {
  attachUser,
  requireAuth,
  requireRole,
  requirePermission,
  parsePermissions,
  hasPermission,
  hasAnyPermission,
  isSuperAdmin,
  normalizeDomain,
  normalizeEmployeeCode,
  domainMatchesEmployeeCode,
  getUserDomain,
  getUserEmployeeCodePrefix,
  canAccessDomain,
  canAccessDomainRecord,
  requireAnyPermission,
  SECRET
};

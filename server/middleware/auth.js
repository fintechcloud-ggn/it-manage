const jwt = require('jsonwebtoken');
const { query } = require('../db');

const SECRET = process.env.JWT_SECRET || 'change_this_secret';

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

function hasPermission(user, permissionKey) {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if ((user.role || '').toLowerCase() !== 'admin') return false;
  const permissions = Array.isArray(user.permissions)
    ? user.permissions
    : parsePermissions(user.permissions_json);
  if (!permissions.length) return true; // Backward compatibility for existing admin accounts.
  return permissions.includes(permissionKey);
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
      'SELECT id, name, email, role, profile_image_url, permissions_json FROM users WHERE id = ? LIMIT 1',
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

module.exports = {
  attachUser,
  requireAuth,
  requireRole,
  requirePermission,
  parsePermissions,
  hasPermission,
  isSuperAdmin,
  SECRET
};

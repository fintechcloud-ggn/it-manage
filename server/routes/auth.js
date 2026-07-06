const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { SECRET, parsePermissions, isSuperAdmin, requireAuth } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const loginValue = String(email || '').trim();
    const rows = await query(
      'SELECT id, name, email, role, profile_image_url, permissions_json, domain_name, employee_code_prefix, password FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(name) = LOWER(?) LIMIT 1',
      [loginValue, loginValue]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password || '', user.password || '');
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '8h' });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        domain_name: user.domain_name || null,
        employee_code_prefix: user.employee_code_prefix || null,
        profile_image_url: user.profile_image_url || null,
        permissions: parsePermissions(user.permissions_json),
        is_super_admin: isSuperAdmin(user)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/session', requireAuth, async (req, res) => {
  const user = req.user;
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      domain_name: user.domain_name || null,
      employee_code_prefix: user.employee_code_prefix || null,
      profile_image_url: user.profile_image_url || null,
      permissions: parsePermissions(user.permissions_json),
      is_super_admin: isSuperAdmin(user)
    }
  });
});

module.exports = router;

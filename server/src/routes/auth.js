const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const config = require('../config');
const { signToken, requireAuth } = require('../middleware/auth');
const { audit } = require('../lib/audit');

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const [u] = await query('SELECT * FROM users WHERE email=? AND active=1', [String(email || '').toLowerCase().trim()]);
  if (!u || !u.password_hash || !(await bcrypt.compare(String(password || ''), u.password_hash))) {
    await audit({ ip: req.ip, user: { email } }, 'login_failed');
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  await query('UPDATE users SET last_login_at=NOW() WHERE id=?', [u.id]);
  req.user = u;
  await audit(req, 'login');
  res.json({ token: signToken(u), user: publicUser(u) });
});

// Single sign-on from the host ERP. The ERP signs a short-lived HS256 token with ERP_SSO_SECRET
// containing { email, name, role }. Users are provisioned on first launch.
router.post('/sso', async (req, res) => {
  if (!config.erpSsoSecret) return res.status(503).json({ error: 'ERP SSO is not configured' });
  let claims;
  try {
    claims = jwt.verify(String(req.body?.token || ''), config.erpSsoSecret, { algorithms: ['HS256'], maxAge: '5m' });
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired ERP launch token' });
  }
  const email = String(claims.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Token has no email' });
  const role = ['admin', 'preparer', 'reviewer', 'approver', 'viewer'].includes(claims.role) ? claims.role : 'viewer';
  let [u] = await query('SELECT * FROM users WHERE email=?', [email]);
  if (!u) {
    const r = await query('INSERT INTO users (name, email, role) VALUES (?,?,?)', [claims.name || email, email, role]);
    [u] = await query('SELECT * FROM users WHERE id=?', [r.insertId]);
  }
  if (!u.active) return res.status(403).json({ error: 'User is disabled in the returns add-on' });
  await query('UPDATE users SET last_login_at=NOW() WHERE id=?', [u.id]);
  req.user = u;
  await audit(req, 'login_sso');
  res.json({ token: signToken(u), user: publicUser(u) });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const [u] = await query('SELECT * FROM users WHERE id=?', [req.user.id]);
  if (u.password_hash && !(await bcrypt.compare(String(currentPassword || ''), u.password_hash))) return res.status(400).json({ error: 'Current password is incorrect' });
  await query('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(newPassword, 10), u.id]);
  await audit(req, 'password_changed', 'user', u.id);
  res.json({ ok: true });
});

module.exports = router;

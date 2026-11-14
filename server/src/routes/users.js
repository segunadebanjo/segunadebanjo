const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { audit } = require('../lib/audit');

const ROLES = ['admin', 'preparer', 'reviewer', 'approver', 'viewer'];
router.use(requireRole('admin'));

router.get('/', async (req, res) => res.json(await query('SELECT id, name, email, role, active, last_login_at, created_at FROM users ORDER BY name')));

router.post('/', async (req, res) => {
  const { name, email, role, password } = req.body || {};
  if (!name || !email || !ROLES.includes(role)) return res.status(400).json({ error: 'name, email and a valid role are required' });
  if (password && password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const r = await query('INSERT INTO users (name, email, role, password_hash) VALUES (?,?,?,?)',
    [name, email.toLowerCase().trim(), role, password ? await bcrypt.hash(password, 10) : null]);
  await audit(req, 'user_created', 'user', r.insertId, { email, role });
  res.status(201).json({ id: r.insertId });
});

router.put('/:id', async (req, res) => {
  const { name, role, active, password } = req.body || {};
  if (role && !ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (Number(req.params.id) === req.user.id && (active === false || (role && role !== 'admin'))) return res.status(400).json({ error: 'You cannot demote or disable yourself' });
  const sets = [], p = [];
  if (name) { sets.push('name=?'); p.push(name); }
  if (role) { sets.push('role=?'); p.push(role); }
  if (active !== undefined) { sets.push('active=?'); p.push(active ? 1 : 0); }
  if (password) {
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    sets.push('password_hash=?'); p.push(await bcrypt.hash(password, 10));
  }
  if (!sets.length) return res.json({ ok: true });
  await query(`UPDATE users SET ${sets.join(',')} WHERE id=?`, [...p, req.params.id]);
  await audit(req, 'user_updated', 'user', req.params.id, { name, role, active, passwordReset: !!password });
  res.json({ ok: true });
});

module.exports = router;

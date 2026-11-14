const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');

router.get('/', requireRole('reviewer'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const where = [], p = [];
  if (req.query.action) { where.push('action=?'); p.push(req.query.action); }
  if (req.query.user) { where.push('user_email LIKE ?'); p.push(`%${req.query.user}%`); }
  res.json(await query(`SELECT * FROM audit_logs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ${limit}`, p));
});

module.exports = router;

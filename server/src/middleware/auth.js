const jwt = require('jsonwebtoken');
const config = require('../config');

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, config.jwtSecret, { expiresIn: '10h' });
}

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : req.query.access_token; // query token for file downloads
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please sign in again' });
  }
}

// Role hierarchy used for the maker-checker workflow.
const ROLE_RANK = { viewer: 0, preparer: 1, reviewer: 2, approver: 3, admin: 4 };
const requireRole = (minRole) => (req, res, next) =>
  (ROLE_RANK[req.user?.role] ?? -1) >= ROLE_RANK[minRole]
    ? next()
    : res.status(403).json({ error: `Requires ${minRole} role or higher` });

function requireApiKey(req, res, next) {
  if (!config.ingestApiKey) return res.status(503).json({ error: 'Ingest API disabled (INGEST_API_KEY not set)' });
  const crypto = require('crypto');
  const given = Buffer.from(String(req.headers['x-api-key'] || ''));
  const expected = Buffer.from(config.ingestApiKey);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  req.user = { id: null, email: 'erp-api', role: 'preparer' };
  next();
}

module.exports = { signToken, requireAuth, requireRole, requireApiKey, ROLE_RANK };

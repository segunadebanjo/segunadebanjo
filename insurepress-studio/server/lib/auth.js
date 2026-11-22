// Authentication: bcrypt password hashes + a signed JWT in an httpOnly cookie.
// Each token carries the user's token_version; bumping it (password change, "sign out
// everywhere", admin reset) invalidates every existing session for that user.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { one } from '../db/pool.js';
import { HttpError } from './http.js';

export const COOKIE = 'ip_session';
const SECRET = config.auth.jwtSecret || crypto.randomBytes(32).toString('hex');
if (!config.auth.jwtSecret) {
  console.warn('⚠ JWT_SECRET is not set: using a random secret, so everyone is signed out when the server restarts.');
}

export const USER_FIELDS = 'id, full_name, email, brokerage_name, naicom_license_no, role, last_login_at, created_at';

export const hashPassword = (pw) => bcrypt.hash(pw, 12);
export const dummyHash = () => bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 12);
export const checkPassword = (pw, hash) => (hash ? bcrypt.compare(pw, hash) : Promise.resolve(false));

export function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 10) throw new HttpError(400, 'Password must be at least 10 characters');
  if (pw.length > 200) throw new HttpError(400, 'Password is too long');
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) throw new HttpError(400, 'Password must contain letters and numbers');
}

export function normaliseEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 190) throw new HttpError(400, 'Enter a valid email address');
  return e;
}

export function setSessionCookie(req, res, user) {
  const token = jwt.sign({ sub: user.id, v: user.token_version || 0 }, SECRET, { expiresIn: `${config.auth.sessionDays}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: config.auth.sessionDays * 864e5,
    path: '/',
  });
}

export const clearSessionCookie = (res) => res.clearCookie(COOKIE, { path: '/' });

/** Resolves the signed-in user from the cookie, or null. */
export async function userFromRequest(req) {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  let payload;
  try { payload = jwt.verify(token, SECRET); } catch { return null; }
  const user = await one(`SELECT ${USER_FIELDS}, token_version FROM users WHERE id=?`, [payload.sub]);
  if (!user || user.token_version !== payload.v) return null;
  return user;
}

export async function requireAuth(req, res, next) {
  try {
    const user = await userFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Please sign in' });
    req.user = user;
    next();
  } catch (e) { next(e); }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'Only admins can do that'));
  next();
}

// Small in-memory limiter for login/registration attempts (per IP + email).
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
export function checkRateLimit(key, max = MAX_ATTEMPTS) {
  const now = Date.now();
  const a = attempts.get(key);
  if (a && now - a.first < WINDOW_MS && a.count >= max) {
    const mins = Math.ceil((WINDOW_MS - (now - a.first)) / 60000);
    throw new HttpError(429, `Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
  }
}
export function recordFailure(key) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.first >= WINDOW_MS) attempts.set(key, { first: now, count: 1 });
  else a.count++;
  if (attempts.size > 5000) for (const [k, v] of attempts) if (now - v.first >= WINDOW_MS) attempts.delete(k);
}
export const clearFailures = (key) => attempts.delete(key);

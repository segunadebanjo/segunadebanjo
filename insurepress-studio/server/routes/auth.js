import { Router } from 'express';
import { query, one } from '../db/pool.js';
import { ah, HttpError } from '../lib/http.js';
import { config } from '../config.js';
import {
  USER_FIELDS, checkPassword, hashPassword, validatePassword, normaliseEmail, setSessionCookie, clearSessionCookie,
  userFromRequest, requireAuth, checkRateLimit, recordFailure, clearFailures, dummyHash,
} from '../lib/auth.js';
import { createUser, ensureBrandKit } from '../lib/users.js';

const r = Router();
// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = dummyHash();

const publicUser = (u) => (u ? Object.fromEntries(Object.entries(u).filter(([k]) => k !== 'token_version' && k !== 'password_hash')) : null);
const needsSetup = async () => !(await one('SELECT id FROM users WHERE password_hash IS NOT NULL LIMIT 1'));

r.get('/auth/status', ah(async (req, res) => {
  const user = await userFromRequest(req);
  res.json({ user: publicUser(user), needsSetup: await needsSetup(), allowRegistration: config.auth.allowRegistration });
}));

// First run: create the admin account. If the database already holds a passwordless user
// (e.g. from `npm run seed` or the earlier single-user version), that user is claimed so
// their books are kept.
r.post('/auth/setup', ah(async (req, res) => {
  if (!(await needsSetup())) throw new HttpError(409, 'Setup is already complete. Please sign in.');
  const b = req.body || {};
  const email = normaliseEmail(b.email);
  validatePassword(b.password);
  if (!String(b.full_name || '').trim()) throw new HttpError(400, 'Full name is required');
  const existing = await one('SELECT id FROM users ORDER BY id LIMIT 1');
  let user;
  if (existing) {
    const clash = await one('SELECT id FROM users WHERE email=? AND id<>?', [email, existing.id]);
    if (clash) throw new HttpError(409, 'That email belongs to another account');
    await query('UPDATE users SET full_name=?, email=?, password_hash=?, brokerage_name=COALESCE(?, brokerage_name), naicom_license_no=COALESCE(?, naicom_license_no), role=\'admin\', token_version=token_version+1, last_login_at=NOW() WHERE id=?',
      [b.full_name.trim(), email, await hashPassword(b.password), b.brokerage_name || null, b.naicom_license_no || null, existing.id]);
    await ensureBrandKit(existing.id);
    user = await one(`SELECT ${USER_FIELDS}, token_version FROM users WHERE id=?`, [existing.id]);
  } else {
    user = await createUser({ ...b, email, role: 'admin' });
  }
  setSessionCookie(req, res, user);
  res.status(201).json({ user: publicUser(user) });
}));

r.post('/auth/login', ah(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const key = `${req.ip}|${email}`;
  checkRateLimit(key);
  const row = email ? await one(`SELECT ${USER_FIELDS}, token_version, password_hash FROM users WHERE email=?`, [email]) : null;
  const ok = await checkPassword(password, row?.password_hash || DUMMY_HASH);
  if (!row || !row.password_hash || !ok) {
    recordFailure(key);
    throw new HttpError(401, 'Email or password is incorrect');
  }
  clearFailures(key);
  await query('UPDATE users SET last_login_at=NOW() WHERE id=?', [row.id]);
  setSessionCookie(req, res, row);
  res.json({ user: publicUser(row) });
}));

r.post('/auth/register', ah(async (req, res) => {
  if (!config.auth.allowRegistration) throw new HttpError(403, 'Sign-up is closed. Ask an admin to create your account.');
  if (await needsSetup()) throw new HttpError(409, 'Finish the first-run setup first');
  const b = req.body || {};
  const key = `${req.ip}|register`;
  checkRateLimit(key);
  recordFailure(key); // counts every sign-up attempt from this IP
  const email = normaliseEmail(b.email);
  validatePassword(b.password);
  const user = await createUser({ ...b, email, role: 'author' });
  setSessionCookie(req, res, user);
  res.status(201).json({ user: publicUser(user) });
}));

r.post('/auth/logout', (req, res) => { clearSessionCookie(res); res.json({ ok: true }); });

r.put('/auth/password', requireAuth, ah(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const row = await one('SELECT password_hash FROM users WHERE id=?', [req.user.id]);
  const key = `${req.ip}|pw|${req.user.id}`;
  checkRateLimit(key);
  if (!(await checkPassword(String(currentPassword || ''), row.password_hash))) { recordFailure(key); throw new HttpError(400, 'Current password is incorrect'); }
  validatePassword(newPassword);
  await query('UPDATE users SET password_hash=?, token_version=token_version+1 WHERE id=?', [await hashPassword(newPassword), req.user.id]);
  const user = await one(`SELECT ${USER_FIELDS}, token_version FROM users WHERE id=?`, [req.user.id]);
  setSessionCookie(req, res, user); // keep this browser signed in; all others are signed out
  res.json({ ok: true });
}));

r.post('/auth/logout-all', requireAuth, ah(async (req, res) => {
  await query('UPDATE users SET token_version=token_version+1 WHERE id=?', [req.user.id]);
  clearSessionCookie(res);
  res.json({ ok: true });
}));

export default r;

import crypto from 'node:crypto';
import { Router } from 'express';
import { query, one } from '../db/pool.js';
import { ah, HttpError } from '../lib/http.js';
import { config } from '../config.js';
import {
  USER_FIELDS, checkPassword, hashPassword, validatePassword, normaliseEmail, setSessionCookie, clearSessionCookie,
  userFromRequest, requireAuth, checkRateLimit, recordFailure, clearFailures, dummyHash,
} from '../lib/auth.js';
import { createUser, ensureBrandKit, notifyPasswordChanged } from '../lib/users.js';
import { mailEnabled, sendMail, resetEmail } from '../services/mailService.js';

const r = Router();
// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = dummyHash();

const publicUser = (u) => (u ? Object.fromEntries(Object.entries(u).filter(([k]) => k !== 'token_version' && k !== 'password_hash')) : null);
const needsSetup = async () => !(await one('SELECT id FROM users WHERE password_hash IS NOT NULL LIMIT 1'));

r.get('/auth/status', ah(async (req, res) => {
  const user = await userFromRequest(req);
  res.json({ user: publicUser(user), needsSetup: await needsSetup(), allowRegistration: config.auth.allowRegistration, emailEnabled: mailEnabled() });
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
  await query('DELETE FROM password_resets WHERE user_id=?', [req.user.id]);
  const user = await one(`SELECT ${USER_FIELDS}, token_version FROM users WHERE id=?`, [req.user.id]);
  setSessionCookie(req, res, user); // keep this browser signed in; all others are signed out
  notifyPasswordChanged(user, 'from your account settings');
  res.json({ ok: true });
}));

r.post('/auth/logout-all', requireAuth, ah(async (req, res) => {
  await query('UPDATE users SET token_version=token_version+1 WHERE id=?', [req.user.id]);
  clearSessionCookie(res);
  res.json({ ok: true });
}));

// ---- Forgot password ------------------------------------------------------------------------

const sha256 = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const resetLink = (token) => `${config.publicBaseUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
const GENERIC = 'If an account exists for that email, we’ve sent a link to reset the password. Check your inbox (and spam folder).';

r.post('/auth/forgot', ah(async (req, res) => {
  if (!mailEnabled()) throw new HttpError(503, 'Password reset by email isn’t set up. Ask your admin to reset your password.');
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address');
  // Limits apply whether or not the account exists, so they reveal nothing.
  checkRateLimit(`${req.ip}|forgot`, 10);
  checkRateLimit(`forgot|${email}`, 3);
  recordFailure(`${req.ip}|forgot`);
  recordFailure(`forgot|${email}`);
  // Answer straight away and do the work afterwards, so response time doesn't reveal whether the email exists.
  res.json({ ok: true, message: GENERIC });
  setImmediate(async () => {
    try {
      const user = await one('SELECT id, full_name, email FROM users WHERE email=? AND password_hash IS NOT NULL', [email]);
      if (!user) return;
      const token = crypto.randomBytes(32).toString('base64url');
      await query('DELETE FROM password_resets WHERE user_id=? AND used_at IS NULL', [user.id]); // only the newest link works
      await query('INSERT INTO password_resets (user_id, token_hash, expires_at, requested_ip) VALUES (?,?,DATE_ADD(NOW(), INTERVAL ? MINUTE),?)',
        [user.id, sha256(token), config.resetLinkMinutes, String(req.ip || '').slice(0, 64)]);
      await sendMail({ to: user.email, ...resetEmail({ name: user.full_name, link: resetLink(token), minutes: config.resetLinkMinutes }) });
    } catch (e) {
      console.error(`Password reset email failed: ${e.message}`);
    }
  });
}));

async function findReset(token) {
  if (!token || String(token).length > 200) return null;
  return one(`SELECT pr.id, pr.user_id, u.full_name FROM password_resets pr JOIN users u ON u.id=pr.user_id
               WHERE pr.token_hash=? AND pr.used_at IS NULL AND pr.expires_at > NOW()`, [sha256(token)]);
}

r.get('/auth/reset/check', ah(async (req, res) => {
  checkRateLimit(`${req.ip}|reset-check`, 30);
  const row = await findReset(req.query.token);
  if (!row) { recordFailure(`${req.ip}|reset-check`); return res.json({ valid: false }); }
  res.json({ valid: true, firstName: (row.full_name || '').split(' ')[0] });
}));

r.post('/auth/reset', ah(async (req, res) => {
  const key = `${req.ip}|reset`;
  checkRateLimit(key, 10);
  const row = await findReset(req.body?.token);
  if (!row) { recordFailure(key); throw new HttpError(400, 'This reset link is invalid or has expired. Request a new one.'); }
  validatePassword(req.body?.password);
  // Mark the link used first so it can't be replayed in a race.
  const used = await query('UPDATE password_resets SET used_at=NOW() WHERE id=? AND used_at IS NULL', [row.id]);
  if (!used.affectedRows) throw new HttpError(400, 'This reset link has already been used. Request a new one.');
  await query('UPDATE users SET password_hash=?, token_version=token_version+1, last_login_at=NOW() WHERE id=?', [await hashPassword(req.body.password), row.user_id]);
  await query('DELETE FROM password_resets WHERE user_id=? AND id<>?', [row.user_id, row.id]);
  const user = await one(`SELECT ${USER_FIELDS}, token_version FROM users WHERE id=?`, [row.user_id]);
  setSessionCookie(req, res, user); // sign in on this browser; every other session is signed out
  notifyPasswordChanged(user, 'using a reset link');
  res.json({ user: publicUser(user) });
}));

export default r;

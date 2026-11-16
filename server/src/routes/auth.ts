import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError, parseBody } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { dummyHash, hashPassword, passwordProblems, verifyPassword } from '../services/auth/password.js';
import { completePasswordReset, isResetTokenValid, requestPasswordReset } from '../services/auth/passwordReset.js';
import { SESSION_COOKIE, cookieOptions, signSession } from '../services/auth/session.js';

export const authRouter = Router();

const tooMany = { error: 'Too many sign-in attempts. Try again in 15 minutes.' };
/** 10 attempts per account per IP, so one office behind a shared IP can't lock everyone out... */
const perAccountLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}|${String(req.body?.email ?? req.user?.email ?? '').trim().toLowerCase()}`,
  message: tooMany,
});
/** ...plus a looser cap per IP against password spraying across many accounts. */
const perIpLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false, message: tooMany });
const loginLimiter = [perIpLimiter, perAccountLimiter];

const toPublic = (u: { id: number; email: string; name: string; role: string; mustChangePassword: boolean }) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  mustChangePassword: u.mustChangePassword,
});

authRouter.post(
  '/login',
  ...loginLimiter,
  ah(async (req, res) => {
    const { email, password } = parseBody(z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) }), req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    // Always run a hash comparison so response time doesn't reveal whether the email exists.
    const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
    if (!user || !ok || !user.isActive) throw new HttpError(401, 'Incorrect email or password');
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    res.cookie(SESSION_COOKIE, signSession(user.id, user.tokenVersion), cookieOptions());
    res.json({ user: toPublic(user) });
  }),
);

authRouter.post('/logout', (_req, res) => {
  const { maxAge: _maxAge, ...opts } = cookieOptions();
  res.clearCookie(SESSION_COOKIE, opts);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: toPublic(req.user!) });
});

authRouter.post(
  '/change-password',
  requireAuth,
  ...loginLimiter,
  ah(async (req, res) => {
    const { currentPassword, newPassword } = parseBody(z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().max(200) }), req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await verifyPassword(currentPassword, user.passwordHash))) throw new HttpError(400, 'Current password is incorrect');
    const problem = passwordProblems(newPassword);
    if (problem) throw new HttpError(400, problem);
    if (newPassword === currentPassword) throw new HttpError(400, 'Choose a password different from the current one');
    // Bumping tokenVersion signs out every other session; this one gets a fresh cookie.
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false, tokenVersion: { increment: 1 } },
    });
    res.cookie(SESSION_COOKIE, signSession(updated.id, updated.tokenVersion), cookieOptions());
    res.json({ user: toPublic(updated) });
  }),
);

// ---------------------------------------------------------------------------
// Forgot password (email link)
// ---------------------------------------------------------------------------

const resetRequestLimiter = [
  rateLimit({ windowMs: 60 * 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: tooMany }),
  rateLimit({
    windowMs: 60 * 60_000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}|${String(req.body?.email ?? '').trim().toLowerCase()}`,
    message: { error: 'Too many reset requests for this email. Try again in an hour.' },
  }),
];
const resetSubmitLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: tooMany });

export const FORGOT_PASSWORD_MESSAGE = 'If an account exists for that email, we have sent a link to reset the password. It expires soon, so use it right away.';

authRouter.post(
  '/forgot-password',
  ...resetRequestLimiter,
  ah(async (req, res) => {
    const { email } = parseBody(z.object({ email: z.string().trim().toLowerCase().email().max(191) }), req.body);
    // Same response, returned immediately, whether or not the account exists: the lookup and the
    // email happen in the background so neither the body nor the timing reveals who has an account.
    void requestPasswordReset(email, req.ip).catch((err) => console.error('[auth] password reset email failed:', err instanceof Error ? err.message : err));
    res.json({ message: FORGOT_PASSWORD_MESSAGE });
  }),
);

// POST (not GET) so the token never appears in URLs or access logs.
authRouter.post(
  '/reset-password/validate',
  resetSubmitLimiter,
  ah(async (req, res) => {
    const { token } = parseBody(z.object({ token: z.string().min(20).max(200) }), req.body);
    res.json({ valid: await isResetTokenValid(token) });
  }),
);

authRouter.post(
  '/reset-password',
  resetSubmitLimiter,
  ah(async (req, res) => {
    const { token, newPassword } = parseBody(z.object({ token: z.string().min(20).max(200), newPassword: z.string().max(200) }), req.body);
    await completePasswordReset(token, newPassword);
    res.json({ message: 'Your password has been changed. Sign in with your new password.' });
  }),
);

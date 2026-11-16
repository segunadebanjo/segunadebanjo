import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError, parseBody } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { dummyHash, hashPassword, passwordProblems, verifyPassword } from '../services/auth/password.js';
import { completePasswordReset, isResetTokenValid, requestPasswordReset } from '../services/auth/passwordReset.js';
import { MFA_COOKIE, SESSION_COOKIE, cookieOptions, mfaCookieOptions, signMfaPending, signSession, verifyMfaPending } from '../services/auth/session.js';
import * as twoFactor from '../services/auth/twoFactor.js';
import type { User } from '@prisma/client';

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

const toPublic = (u: User) => {
  const enabled = twoFactor.twoFactorEnabled(u);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    mustChangePassword: u.mustChangePassword,
    twoFactorEnabled: enabled,
    mustSetUpTwoFactor: !enabled && twoFactor.twoFactorRequiredForRole(u.role),
  };
};

const { maxAge: _m1, ...clearSessionOpts } = cookieOptions();
const { maxAge: _m2, ...clearMfaOpts } = mfaCookieOptions();

/** Finish sign-in: full session cookie, drop any pending-2FA cookie. */
async function startSession(res: import('express').Response, user: User) {
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  res.clearCookie(MFA_COOKIE, clearMfaOpts);
  res.cookie(SESSION_COOKIE, signSession(user.id, user.tokenVersion), cookieOptions());
}

authRouter.post(
  '/login',
  ...loginLimiter,
  ah(async (req, res) => {
    const { email, password } = parseBody(z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) }), req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    // Always run a hash comparison so response time doesn't reveal whether the email exists.
    const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
    if (!user || !ok || !user.isActive) throw new HttpError(401, 'Incorrect email or password');
    if (twoFactor.twoFactorEnabled(user)) {
      // Password is right; no session until the authenticator code is checked too.
      res.clearCookie(SESSION_COOKIE, clearSessionOpts);
      res.cookie(MFA_COOKIE, signMfaPending(user.id, user.tokenVersion), mfaCookieOptions());
      res.json({ twoFactorRequired: true });
      return;
    }
    await startSession(res, user);
    res.json({ user: toPublic(user) });
  }),
);

const twoFactorLoginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}|mfa|${verifyMfaPending(String(req.cookies?.[MFA_COOKIE] ?? ''))?.userId ?? 'none'}`,
  message: { error: 'Too many incorrect codes. Sign in again in 15 minutes.' },
});

const FactorInput = z.object({ code: z.string().trim().max(12).optional(), recoveryCode: z.string().trim().max(40).optional() }).refine((v) => Boolean(v.code) !== Boolean(v.recoveryCode), {
  message: 'Enter either an authentication code or a recovery code',
});

/** Second sign-in step for accounts with two-factor authentication. */
authRouter.post(
  '/login/2fa',
  twoFactorLoginLimiter,
  ah(async (req, res) => {
    const factor = parseBody(FactorInput, req.body);
    const pending = verifyMfaPending(String(req.cookies?.[MFA_COOKIE] ?? ''));
    if (!pending) throw new HttpError(401, 'Your sign-in expired. Enter your email and password again.');
    const user = await prisma.user.findUnique({ where: { id: pending.userId } });
    if (!user || !user.isActive || user.tokenVersion !== pending.tokenVersion) throw new HttpError(401, 'Your sign-in expired. Enter your email and password again.');
    const method = await twoFactor.verifySecondFactor(user, factor);
    if (!method) throw new HttpError(401, factor.recoveryCode ? 'That recovery code is not valid or was already used' : 'Incorrect authentication code');
    await startSession(res, user);
    const recoveryCodesRemaining = method === 'recovery' ? await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id, usedAt: null } }) : undefined;
    res.json({ user: toPublic(user), recoveryCodesRemaining });
  }),
);

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, clearSessionOpts);
  res.clearCookie(MFA_COOKIE, clearMfaOpts);
  res.status(204).end();
});

authRouter.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    res.json({ user: toPublic(await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } })) });
  }),
);

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

// ---------------------------------------------------------------------------
// Two-factor authentication management (signed-in user)
// ---------------------------------------------------------------------------

const twoFactorManageLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}|2fa-manage|${req.user?.id ?? 'anon'}`,
  message: tooMany,
});

authRouter.get('/2fa', requireAuth, ah(async (req, res) => res.json(await twoFactor.twoFactorStatus(req.user!.id))));

authRouter.post('/2fa/setup', requireAuth, twoFactorManageLimiter, ah(async (req, res) => res.json(await twoFactor.beginSetup(req.user!.id))));

authRouter.post(
  '/2fa/enable',
  requireAuth,
  twoFactorManageLimiter,
  ah(async (req, res) => {
    const { code } = parseBody(z.object({ code: z.string().trim().max(12) }), req.body);
    res.json(await twoFactor.confirmSetup(req.user!.id, code));
  }),
);

authRouter.post(
  '/2fa/disable',
  requireAuth,
  twoFactorManageLimiter,
  ah(async (req, res) => {
    const input = parseBody(z.object({ password: z.string().min(1).max(200), code: z.string().trim().max(12).optional(), recoveryCode: z.string().trim().max(40).optional() }), req.body);
    await twoFactor.disable(req.user!.id, input.password, { code: input.code, recoveryCode: input.recoveryCode });
    res.json(await twoFactor.twoFactorStatus(req.user!.id));
  }),
);

authRouter.post(
  '/2fa/recovery-codes',
  requireAuth,
  twoFactorManageLimiter,
  ah(async (req, res) => {
    const { code } = parseBody(z.object({ code: z.string().trim().max(12) }), req.body);
    res.json(await twoFactor.regenerateRecoveryCodes(req.user!.id, code));
  }),
);

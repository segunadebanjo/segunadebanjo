import type { RequestHandler } from 'express';
import type { UserRole } from '@prisma/client';
import { prisma } from '../db.js';
import { SESSION_COOKIE, verifySession, type AuthUser } from '../services/auth/session.js';
import { twoFactorEnabled, twoFactorRequiredForRole } from '../services/auth/twoFactor.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

/**
 * Requires a valid session cookie. The user is re-loaded on every request, so deactivation, role
 * changes and password changes (tokenVersion bump) take effect immediately.
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    const session = token ? verifySession(token) : null;
    if (!session) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || !user.isActive || user.tokenVersion !== session.tokenVersion) {
      res.status(401).json({ error: 'Session expired. Please sign in again.' });
      return;
    }
    const has2fa = twoFactorEnabled(user);
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      twoFactorEnabled: has2fa,
      mustSetUpTwoFactor: !has2fa && twoFactorRequiredForRole(user.role),
    };
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: `This action requires the ${roles.join(' or ')} role` });
      return;
    }
    next();
  };

/**
 * Until the account is ready, users can only reach /api/auth: first a forced password change, then
 * two-factor setup when their role requires it.
 */
export const blockUntilAccountReady: RequestHandler = (req, res, next) => {
  if (req.user?.mustChangePassword) {
    res.status(403).json({ error: 'You must change your password before continuing', code: 'PASSWORD_CHANGE_REQUIRED' });
    return;
  }
  if (req.user?.mustSetUpTwoFactor) {
    res.status(403).json({ error: `Two-factor authentication is required for the ${req.user.role} role. Set it up to continue.`, code: 'TWO_FACTOR_SETUP_REQUIRED' });
    return;
  }
  next();
};

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Default policy for the admin API: every role can read, only ADMIN and MARKETER can change things. */
export const writeRequiresMarketer: RequestHandler = (req, res, next) => {
  if (READ_METHODS.has(req.method)) return next();
  return requireRole('ADMIN', 'MARKETER')(req, res, next);
};

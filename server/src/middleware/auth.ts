import type { RequestHandler } from 'express';
import type { UserRole } from '@prisma/client';
import { prisma } from '../db.js';
import { SESSION_COOKIE, verifySession, type AuthUser } from '../services/auth/session.js';

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
    req.user = { id: user.id, email: user.email, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword };
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

/** Users who must change their password can only reach the auth endpoints until they do. */
export const blockUntilPasswordChanged: RequestHandler = (req, res, next) => {
  if (req.user?.mustChangePassword) {
    res.status(403).json({ error: 'You must change your password before continuing', code: 'PASSWORD_CHANGE_REQUIRED' });
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

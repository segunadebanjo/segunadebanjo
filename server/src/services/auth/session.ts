import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { config } from '../../config.js';

export const SESSION_COOKIE = 'iam_session';

interface SessionClaims {
  sub: string; // user id
  ver: number; // tokenVersion at issue time
}

export function signSession(userId: number, tokenVersion: number): string {
  return jwt.sign({ ver: tokenVersion } satisfies Omit<SessionClaims, 'sub'>, config.AUTH_SECRET, {
    subject: String(userId),
    expiresIn: `${config.AUTH_SESSION_HOURS}h`,
    algorithm: 'HS256',
    issuer: 'insurance-ad-manager',
  });
}

export function verifySession(token: string): { userId: number; tokenVersion: number } | null {
  try {
    const c = jwt.verify(token, config.AUTH_SECRET, { algorithms: ['HS256'], issuer: 'insurance-ad-manager' }) as SessionClaims;
    const userId = Number(c.sub);
    if (!Number.isInteger(userId) || typeof c.ver !== 'number') return null;
    return { userId, tokenVersion: c.ver };
  } catch {
    return null;
  }
}

export const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.AUTH_COOKIE_SECURE,
  path: '/',
  maxAge: config.AUTH_SESSION_HOURS * 3600 * 1000,
});

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  mustChangePassword: boolean;
}

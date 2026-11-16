import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { hashPassword, passwordProblems, verifyPassword } from '../src/services/auth/password.js';
import { signSession, verifySession } from '../src/services/auth/session.js';
import { config } from '../src/config.js';

describe('password hashing', () => {
  it('hashes with a random salt and verifies only the right password', async () => {
    const a = await hashPassword('correct-horse-42');
    const b = await hashPassword('correct-horse-42');
    expect(a).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword('correct-horse-42', a)).toBe(true);
    expect(await verifyPassword('correct-horse-43', a)).toBe(false);
  });

  it('rejects malformed hashes without throwing', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$1$2$3$4$5')).toBe(false);
  });

  it('enforces the password policy', () => {
    expect(passwordProblems('short1')).toMatch(/at least 10/);
    expect(passwordProblems('onlyletterslong')).toMatch(/letters and numbers/);
    expect(passwordProblems('1234567890123')).toMatch(/letters and numbers/);
    expect(passwordProblems('good-password-1')).toBeNull();
  });
});

describe('session tokens', () => {
  it('round-trips user id and token version', () => {
    expect(verifySession(signSession(42, 3))).toEqual({ userId: 42, tokenVersion: 3 });
  });
  it('rejects tampered, foreign-key and expired tokens', () => {
    const t = signSession(42, 0);
    expect(verifySession(t.slice(0, -2) + (t.endsWith('A') ? 'BB' : 'AA'))).toBeNull();
    expect(verifySession(jwt.sign({ ver: 0 }, 'some-other-secret', { subject: '42', issuer: 'insurance-ad-manager' }))).toBeNull();
    expect(verifySession(jwt.sign({ ver: 0 }, config.AUTH_SECRET, { subject: '42', issuer: 'insurance-ad-manager', expiresIn: -10 }))).toBeNull();
    expect(verifySession(jwt.sign({ ver: 0 }, config.AUTH_SECRET, { subject: '42', issuer: 'insurance-ad-manager', algorithm: 'HS512' }))).toBeNull();
  });
});

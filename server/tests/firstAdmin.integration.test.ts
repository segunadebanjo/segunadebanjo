/**
 * INITIAL_ADMIN_RESET against a real MySQL database. Run with: DB_TESTS=1 npm test
 */
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { ensureFirstAdmin } from '../src/services/auth/firstAdmin.js';
import { hashPassword } from '../src/services/auth/password.js';

describe.runIf(process.env.DB_TESTS === '1')('INITIAL_ADMIN_RESET (MySQL)', () => {
  const app = createApp();
  const email = `firstadmin-${Date.now()}@example.com`;
  const env = { INITIAL_ADMIN_EMAIL: email.toUpperCase(), INITIAL_ADMIN_PASSWORD: 'Reset-pass-2026' };
  const login = (password: string) => request(app).post('/api/auth/login').send({ email, password });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('ignores INITIAL_ADMIN_* once users exist, unless the reset flag is on', async () => {
    await prisma.user.create({ data: { email: 'placeholder-' + email, name: 'x', passwordHash: await hashPassword('Other-pass-2026') } });
    await ensureFirstAdmin(env);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    await prisma.user.delete({ where: { email: 'placeholder-' + email } });
  });

  it('creates the admin when missing, and resets a deactivated one with the wrong password', async () => {
    await ensureFirstAdmin({ ...env, INITIAL_ADMIN_RESET: 'true' });
    expect((await login('Reset-pass-2026').expect(200)).body.user).toMatchObject({ role: 'ADMIN', mustChangePassword: true });

    await prisma.user.update({ where: { email }, data: { passwordHash: await hashPassword('Forgotten-pass-1'), isActive: false, role: 'VIEWER' } });
    await login('Reset-pass-2026').expect(401);
    await ensureFirstAdmin({ ...env, INITIAL_ADMIN_RESET: 'yes' });
    expect((await login('Reset-pass-2026').expect(200)).body.user).toMatchObject({ role: 'ADMIN', mustChangePassword: true });
  });

  it('does nothing on reset when the password is too weak', async () => {
    const before = (await prisma.user.findUniqueOrThrow({ where: { email } })).passwordHash;
    await ensureFirstAdmin({ ...env, INITIAL_ADMIN_PASSWORD: 'short', INITIAL_ADMIN_RESET: 'true' });
    expect((await prisma.user.findUniqueOrThrow({ where: { email } })).passwordHash).toBe(before);
  });
});

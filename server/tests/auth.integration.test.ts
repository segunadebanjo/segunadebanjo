/**
 * Sign-in and role checks against a real MySQL database. Run with: DB_TESTS=1 npm test
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { hashPassword } from '../src/services/auth/password.js';

const run = process.env.DB_TESTS === '1';
const PW = 'Test-password-123';

describe.runIf(run)('authentication & roles (MySQL)', () => {
  const app = createApp();
  const tag = `authtest-${Date.now()}`;
  const email = (r: string) => `${tag}-${r}@example.com`.toLowerCase();
  let productId: number;

  const login = async (role: string, password = PW) => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/login').send({ email: email(role), password });
    return { agent, res };
  };

  beforeAll(async () => {
    const hash = await hashPassword(PW);
    for (const role of ['ADMIN', 'MARKETER', 'VIEWER'] as const) await prisma.user.create({ data: { email: email(role), name: role, role, passwordHash: hash } });
    await prisma.user.create({ data: { email: email('newbie'), name: 'New', role: 'MARKETER', passwordHash: hash, mustChangePassword: true } });
    await prisma.user.create({ data: { email: email('disabled'), name: 'Off', role: 'ADMIN', passwordHash: hash, isActive: false } });
    productId = (await prisma.insuranceProduct.findFirstOrThrow()).id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
    await prisma.$disconnect();
  });

  it('blocks the admin API without a session but keeps health and the webhook reachable', async () => {
    await request(app).get('/api/products').expect(401);
    await request(app).get('/api/analytics/overview').expect(401);
    await request(app).get('/api/health').expect(200);
    const wh = await request(app).post('/api/webhooks/conversions').send({ eventType: 'QUOTE_STARTED' });
    expect(wh.status).toBe(401);
    expect(wh.body.error).toMatch(/API key/);
  });

  it('rejects wrong passwords, unknown emails and deactivated users with the same message', async () => {
    const wrong = await request(app).post('/api/auth/login').send({ email: email('ADMIN'), password: 'nope-nope-123' });
    const unknown = await request(app).post('/api/auth/login').send({ email: email('ghost'), password: PW });
    const disabled = await request(app).post('/api/auth/login').send({ email: email('disabled'), password: PW });
    for (const r of [wrong, unknown, disabled]) {
      expect(r.status).toBe(401);
      expect(r.body.error).toBe('Incorrect email or password');
      expect(r.headers['set-cookie']).toBeUndefined();
    }
  });

  it('signs in with an httpOnly cookie, case-insensitive email, and /me returns the user', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/login').send({ email: email('VIEWER').toUpperCase(), password: PW }).expect(200);
    expect(res.headers['set-cookie'][0]).toMatch(/iam_session=.*HttpOnly.*SameSite=Lax/i);
    expect(res.body.user).toMatchObject({ email: email('VIEWER'), role: 'VIEWER' });
    expect(res.body.user.passwordHash).toBeUndefined();
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.role).toBe('VIEWER');
  });

  it('VIEWER can read but not change anything', async () => {
    const { agent } = await login('VIEWER');
    await agent.get('/api/products').expect(200);
    await agent.get('/api/analytics/overview').expect(200);
    const r = await agent.put(`/api/products/${productId}`).send({ isActive: true }).expect(403);
    expect(r.body.error).toMatch(/ADMIN or MARKETER/);
    await agent.post('/api/optimization/run').expect(403);
    await agent.get('/api/users').expect(403);
  });

  it('MARKETER can change campaigns/products but not delete products or manage users', async () => {
    const { agent } = await login('MARKETER');
    await agent.put(`/api/products/${productId}`).send({ isActive: true }).expect(200);
    await agent.post('/api/optimization/run').expect(200);
    await agent.delete(`/api/products/${productId}`).expect(403);
    await agent.get('/api/users').expect(403);
  });

  it('ADMIN manages users; new users must change their temporary password', async () => {
    const { agent } = await login('ADMIN');
    expect((await agent.get('/api/users').expect(200)).body.some((u: { email: string }) => u.email === email('ADMIN'))).toBe(true);
    await agent.post('/api/users').send({ email: email('weak'), name: 'Weak', role: 'VIEWER', password: 'short' }).expect(400);
    const created = await agent.post('/api/users').send({ email: email('created'), name: 'Created', role: 'VIEWER', password: PW }).expect(201);
    expect(created.body).toMatchObject({ role: 'VIEWER', mustChangePassword: true });
    expect(created.body.passwordHash).toBeUndefined();
    await agent.post('/api/users').send({ email: email('created'), name: 'Dup', role: 'VIEWER', password: PW }).expect(409);
  });

  it("ADMIN can't lock themselves out", async () => {
    const { agent } = await login('ADMIN');
    const me = await prisma.user.findUniqueOrThrow({ where: { email: email('ADMIN') } });
    await agent.put(`/api/users/${me.id}`).send({ isActive: false }).expect(409);
    await agent.put(`/api/users/${me.id}`).send({ role: 'VIEWER' }).expect(409);
    await agent.delete(`/api/users/${me.id}`).expect(409);
  });

  it('a user who must change their password is limited to /auth until they do', async () => {
    const { agent, res } = await login('newbie');
    expect(res.body.user.mustChangePassword).toBe(true);
    const blocked = await agent.get('/api/products').expect(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    await agent.post('/api/auth/change-password').send({ currentPassword: 'wrong-pass-1', newPassword: 'Brand-new-pass-9' }).expect(400);
    await agent.post('/api/auth/change-password').send({ currentPassword: PW, newPassword: 'weak' }).expect(400);
    await agent.post('/api/auth/change-password').send({ currentPassword: PW, newPassword: 'Brand-new-pass-9' }).expect(200);
    await agent.get('/api/products').expect(200);
    // old password no longer works
    expect((await login('newbie')).res.status).toBe(401);
    expect((await login('newbie', 'Brand-new-pass-9')).res.status).toBe(200);
  });

  it('deactivating a user or resetting their password ends their existing sessions immediately', async () => {
    const { agent: admin } = await login('ADMIN');
    const { agent: marketer } = await login('MARKETER');
    await marketer.get('/api/products').expect(200);
    const m = await prisma.user.findUniqueOrThrow({ where: { email: email('MARKETER') } });
    await admin.post(`/api/users/${m.id}/reset-password`).send({ password: 'Temp-password-77' }).expect(200);
    await marketer.get('/api/products').expect(401);

    const { agent: viewer } = await login('VIEWER');
    const v = await prisma.user.findUniqueOrThrow({ where: { email: email('VIEWER') } });
    await admin.put(`/api/users/${v.id}`).send({ isActive: false }).expect(200);
    await viewer.get('/api/products').expect(401);
  });

  it('rate-limits repeated failed sign-ins per account without locking out other accounts', async () => {
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await request(app).post('/api/auth/login').send({ email: email('brute'), password: 'wrong-pass-123' })).status;
    expect(last).toBe(429);
    expect((await login('ADMIN')).res.status).toBe(200);
  });

  it('logout clears the cookie', async () => {
    const { agent } = await login('ADMIN');
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });
});

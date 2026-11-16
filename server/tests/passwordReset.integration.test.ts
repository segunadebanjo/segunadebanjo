/**
 * Forgot-password email flow against a real MySQL database. Run with: DB_TESTS=1 npm test
 * Emails go to the in-memory outbox (MAIL_TRANSPORT=memory in vitest.config.ts).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { hashPassword } from '../src/services/auth/password.js';
import { hashResetToken } from '../src/services/auth/passwordReset.js';
import { outbox, type MailMessage } from '../src/services/mail/mailer.js';

const run = process.env.DB_TESTS === '1';
const PW = 'Original-pass-123';

describe.runIf(run)('forgot password (MySQL)', () => {
  const app = createApp();
  const tag = `resettest-${Date.now()}`;
  const email = (n: string) => `${tag}-${n}@example.com`;

  /** The email is sent in the background after the response; wait for it to land. */
  const waitForMail = async (to: string, after = 0): Promise<MailMessage> => {
    for (let i = 0; i < 100; i++) {
      const m = outbox.slice(after).find((x) => x.to === to);
      if (m) return m;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`no email to ${to}`);
  };
  const tokenFrom = (m: MailMessage) => {
    const match = m.text.match(/reset-password\?token=([A-Za-z0-9_\-%]+)/);
    if (!match) throw new Error('no link in email');
    return decodeURIComponent(match[1]);
  };
  const forgot = (e: string) => request(app).post('/api/auth/forgot-password').send({ email: e });

  beforeAll(async () => {
    const hash = await hashPassword(PW);
    for (const n of ['a', 'b', 'c', 'd', 'e']) await prisma.user.create({ data: { email: email(n), name: `User ${n}`, role: 'MARKETER', passwordHash: hash } });
    await prisma.user.create({ data: { email: email('off'), name: 'Off', role: 'VIEWER', passwordHash: hash, isActive: false } });
  });
  beforeEach(() => {
    outbox.length = 0;
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
    await prisma.$disconnect();
  });

  it('answers identically for existing, unknown and deactivated accounts, and only emails the real one', async () => {
    const real = await forgot(email('a')).expect(200);
    const unknown = await forgot(email('nobody')).expect(200);
    const off = await forgot(email('off')).expect(200);
    expect(unknown.body).toEqual(real.body);
    expect(off.body).toEqual(real.body);
    const m = await waitForMail(email('a'));
    await new Promise((r) => setTimeout(r, 200));
    expect(outbox.map((x) => x.to)).toEqual([email('a')]);
    expect(m.subject).toMatch(/Reset your/);
    expect(m.text).toContain('https://ads.example.test/reset-password?token=');
    expect(m.html).toContain('href="https://ads.example.test/reset-password?token=');
  });

  it('stores only a hash of the token, with an expiry', async () => {
    await forgot(email('b')).expect(200);
    const token = tokenFrom(await waitForMail(email('b')));
    const row = await prisma.passwordResetToken.findFirstOrThrow({ where: { user: { email: email('b') } } });
    expect(row.tokenHash).toBe(hashResetToken(token));
    expect(row.tokenHash).not.toContain(token);
    const minutes = (row.expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(55);
    expect(minutes).toBeLessThanOrEqual(60);
  });

  it('resets the password once, signs out other sessions, and the old password stops working', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: email('c'), password: PW }).expect(200);
    await agent.get('/api/auth/me').expect(200);

    await forgot(email('c')).expect(200);
    const token = tokenFrom(await waitForMail(email('c')));
    expect((await request(app).post('/api/auth/reset-password/validate').send({ token }).expect(200)).body.valid).toBe(true);

    await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'weak' }).expect(400);
    await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'Fresh-password-456' }).expect(200);

    await agent.get('/api/auth/me').expect(401); // existing session revoked
    await request(app).post('/api/auth/login').send({ email: email('c'), password: PW }).expect(401);
    await request(app).post('/api/auth/login').send({ email: email('c'), password: 'Fresh-password-456' }).expect(200);

    // single use
    const again = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'Another-pass-789' }).expect(400);
    expect(again.body.error).toMatch(/invalid or has expired/);
    expect((await request(app).post('/api/auth/reset-password/validate').send({ token }).expect(200)).body.valid).toBe(false);
  });

  it('a newer request invalidates the earlier link', async () => {
    await forgot(email('d')).expect(200);
    const first = tokenFrom(await waitForMail(email('d')));
    const seen = outbox.length;
    await forgot(email('d')).expect(200);
    const second = tokenFrom(await waitForMail(email('d'), seen));
    expect(second).not.toBe(first);
    await request(app).post('/api/auth/reset-password').send({ token: first, newPassword: 'Fresh-password-456' }).expect(400);
    await request(app).post('/api/auth/reset-password').send({ token: second, newPassword: 'Fresh-password-456' }).expect(200);
  });

  it('rejects expired links, garbage tokens, and links for accounts deactivated after the request', async () => {
    await forgot(email('e')).expect(200);
    const token = tokenFrom(await waitForMail(email('e')));
    await prisma.passwordResetToken.updateMany({ where: { tokenHash: hashResetToken(token) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'Fresh-password-456' }).expect(400);
    await request(app).post('/api/auth/reset-password').send({ token: 'x'.repeat(43), newPassword: 'Fresh-password-456' }).expect(400);

    const seen = outbox.length;
    await forgot(email('e')).expect(200);
    const t2 = tokenFrom(await waitForMail(email('e'), seen));
    await prisma.user.update({ where: { email: email('e') }, data: { isActive: false } });
    await request(app).post('/api/auth/reset-password').send({ token: t2, newPassword: 'Fresh-password-456' }).expect(400);
  });

  it('clears a forced password change when the user resets by email', async () => {
    await prisma.user.update({ where: { email: email('a') }, data: { mustChangePassword: true } });
    await forgot(email('a')).expect(200);
    const token = tokenFrom(await waitForMail(email('a')));
    await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'Fresh-password-456' }).expect(200);
    const res = await request(app).post('/api/auth/login').send({ email: email('a'), password: 'Fresh-password-456' }).expect(200);
    expect(res.body.user.mustChangePassword).toBe(false);
  });

  it('limits repeated reset requests for one email', async () => {
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await forgot(email('limited'))).status);
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});

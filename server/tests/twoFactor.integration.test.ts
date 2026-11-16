/**
 * Two-factor authentication against a real MySQL database. Run with: DB_TESTS=1 npm test
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { prisma } from '../src/db.js';
import { hashPassword } from '../src/services/auth/password.js';
import { totp } from '../src/services/auth/totp.js';

const run = process.env.DB_TESTS === '1';
const PW = 'Two-factor-pass-1';

describe.runIf(run)('two-factor authentication (MySQL)', () => {
  const app = createApp();
  const tag = `tfatest-${Date.now()}`;
  const email = (n: string) => `${tag}-${n}@example.com`;

  const signIn = async (who: string, password = PW) => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/login').send({ email: email(who), password });
    return { agent, res };
  };

  /**
   * Current code for `who`. Replay protection rejects a code from a step that was already used, and
   * several sign-ins in one test happen within the same 30 s step, so tests that aren't about replay
   * clear the stored step first.
   */
  const freshCode = async (who: string, secret: string) => {
    await prisma.user.update({ where: { email: email(who) }, data: { totpLastStep: null } });
    return totp(secret);
  };

  /** Turn 2FA on through the API; returns a signed-in agent, the secret and the recovery codes. */
  const enroll = async (who: string) => {
    const { agent } = await signIn(who);
    const setup = await agent.post('/api/auth/2fa/setup').expect(200);
    const secret: string = setup.body.secret;
    const enabled = await agent.post('/api/auth/2fa/enable').send({ code: totp(secret) }).expect(200);
    return { agent, secret, recoveryCodes: enabled.body.recoveryCodes as string[] };
  };

  /** Full sign-in (password + code) for a user with 2FA. */
  const signInWith2fa = async (who: string, secret: string) => {
    const { agent, res } = await signIn(who);
    expect(res.body).toEqual({ twoFactorRequired: true });
    await agent.post('/api/auth/login/2fa').send({ code: await freshCode(who, secret) }).expect(200);
    return agent;
  };

  beforeAll(async () => {
    const hash = await hashPassword(PW);
    const users = [
      ['setup', 'MARKETER'],
      ['login', 'MARKETER'],
      ['pending', 'VIEWER'],
      ['recovery', 'MARKETER'],
      ['manage', 'MARKETER'],
      ['required', 'ADMIN'],
      ['lost', 'VIEWER'],
      ['admin', 'ADMIN'],
      ['emailreset', 'VIEWER'],
    ] as const;
    for (const [n, role] of users) await prisma.user.create({ data: { email: email(n), name: n, role, passwordHash: hash } });
  });
  afterEach(() => {
    config.REQUIRE_2FA_ROLES = [];
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
    await prisma.$disconnect();
  });

  it('setup needs a correct code, stores the secret encrypted, and returns 10 recovery codes', async () => {
    const { agent } = await signIn('setup');
    expect((await agent.get('/api/auth/2fa').expect(200)).body).toMatchObject({ enabled: false, required: false });
    const setup = await agent.post('/api/auth/2fa/setup').expect(200);
    expect(setup.body.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    await agent.post('/api/auth/2fa/enable').send({ code: '000000' }).expect(400);
    const pending = await prisma.user.findUniqueOrThrow({ where: { email: email('setup') } });
    expect(pending.twoFactorEnabledAt).toBeNull();
    expect(pending.totpPendingSecretEnc).not.toContain(setup.body.secret);

    const enabled = await agent.post('/api/auth/2fa/enable').send({ code: totp(setup.body.secret) }).expect(200);
    expect(enabled.body.recoveryCodes).toHaveLength(10);
    expect(enabled.body.recoveryCodes[0]).toMatch(/^[a-z0-9]{5}-[a-z0-9]{5}$/);
    const after = await prisma.user.findUniqueOrThrow({ where: { email: email('setup') } });
    expect(after.twoFactorEnabledAt).not.toBeNull();
    expect(after.totpSecretEnc).not.toContain(setup.body.secret);
    expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: after.id } })).toBe(10);
    expect((await agent.get('/api/auth/2fa').expect(200)).body).toMatchObject({ enabled: true, recoveryCodesRemaining: 10 });
    await agent.post('/api/auth/2fa/setup').expect(409);
  });

  it('password alone no longer signs in; the code completes it; wrong codes and replays fail', async () => {
    const { secret } = await enroll('login');
    const { agent, res } = await signIn('login');
    expect(res.body).toEqual({ twoFactorRequired: true });
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cookies.find((c) => c.startsWith('iam_mfa='))).toMatch(/HttpOnly.*SameSite=Strict/i);
    expect(cookies.some((c) => /^iam_session=[^;]{10,}/.test(c))).toBe(false);
    await agent.get('/api/products').expect(401);

    await agent.post('/api/auth/login/2fa').send({ code: '123456' }).expect(401);
    const code = await freshCode('login', secret);
    const ok = await agent.post('/api/auth/login/2fa').send({ code }).expect(200);
    expect(ok.body.user).toMatchObject({ email: email('login'), twoFactorEnabled: true });
    await agent.get('/api/products').expect(200);

    // Replay: the same code can't complete another sign-in.
    const second = await signIn('login');
    await second.agent.post('/api/auth/login/2fa').send({ code }).expect(401);
  });

  it('the code step only works after a correct password, from the same browser', async () => {
    const { secret } = await enroll('pending');
    await request(app).post('/api/auth/login/2fa').send({ code: await freshCode('pending', secret) }).expect(401);
    const wrong = await signIn('pending', 'wrong-password-9');
    expect(wrong.res.status).toBe(401);
    await wrong.agent.post('/api/auth/login/2fa').send({ code: await freshCode('pending', secret) }).expect(401);
  });

  it('recovery codes work once each', async () => {
    const { recoveryCodes } = await enroll('recovery');
    const first = await signIn('recovery');
    const ok = await first.agent.post('/api/auth/login/2fa').send({ recoveryCode: recoveryCodes[0].toUpperCase() }).expect(200);
    expect(ok.body.recoveryCodesRemaining).toBe(9);
    const again = await signIn('recovery');
    await again.agent.post('/api/auth/login/2fa').send({ recoveryCode: recoveryCodes[0] }).expect(401);
    await again.agent.post('/api/auth/login/2fa').send({ recoveryCode: recoveryCodes[1] }).expect(200);
  });

  it('new recovery codes replace the old ones; turning 2FA off needs the password and a code', async () => {
    const { secret, recoveryCodes: old } = await enroll('manage');
    const agent = await signInWith2fa('manage', secret);
    const regen = await agent.post('/api/auth/2fa/recovery-codes').send({ code: await freshCode('manage', secret) }).expect(200);
    expect(regen.body.recoveryCodes).toHaveLength(10);
    const tryOld = await signIn('manage');
    await tryOld.agent.post('/api/auth/login/2fa').send({ recoveryCode: old[0] }).expect(401);

    await agent.post('/api/auth/2fa/disable').send({ password: 'wrong-pass-1', code: await freshCode('manage', secret) }).expect(400);
    await agent.post('/api/auth/2fa/disable').send({ password: PW, code: '000000' }).expect(400);
    const off = await agent.post('/api/auth/2fa/disable').send({ password: PW, code: await freshCode('manage', secret) }).expect(200);
    expect(off.body.enabled).toBe(false);
    const u = await prisma.user.findUniqueOrThrow({ where: { email: email('manage') } });
    expect(u.totpSecretEnc).toBeNull();
    expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: u.id } })).toBe(0);
    expect((await signIn('manage')).res.body.user.email).toBe(email('manage')); // password-only again
  });

  it('a role that requires 2FA must set it up before using the app, and cannot turn it off', async () => {
    config.REQUIRE_2FA_ROLES = ['ADMIN'];
    const { agent, res } = await signIn('required');
    expect(res.body.user).toMatchObject({ role: 'ADMIN', mustSetUpTwoFactor: true });
    const blocked = await agent.get('/api/products').expect(403);
    expect(blocked.body.code).toBe('TWO_FACTOR_SETUP_REQUIRED');
    const setup = await agent.post('/api/auth/2fa/setup').expect(200);
    await agent.post('/api/auth/2fa/enable').send({ code: totp(setup.body.secret) }).expect(200);
    await agent.get('/api/products').expect(200);
    const off = await agent.post('/api/auth/2fa/disable').send({ password: PW, code: await freshCode('required', setup.body.secret) }).expect(409);
    expect(off.body.error).toMatch(/required for the ADMIN role/);
  });

  it("an admin can reset a user's 2FA (lost phone), which also signs that user out", async () => {
    const { secret } = await enroll('lost');
    const user = await signInWith2fa('lost', secret);
    await user.get('/api/products').expect(200);

    const admin = await signIn('admin');
    const target = await prisma.user.findUniqueOrThrow({ where: { email: email('lost') } });
    const reset = await admin.agent.post(`/api/users/${target.id}/reset-2fa`).expect(200);
    expect(reset.body.twoFactorEnabledAt).toBeNull();
    await user.get('/api/products').expect(401);
    expect((await signIn('lost')).res.body.user.twoFactorEnabled).toBe(false);
  });

  it('a password change (e.g. via the email reset link) does not bypass 2FA', async () => {
    await enroll('emailreset');
    await prisma.user.update({ where: { email: email('emailreset') }, data: { passwordHash: await hashPassword('Brand-new-pass-1') } });
    expect((await signIn('emailreset', 'Brand-new-pass-1')).res.body).toEqual({ twoFactorRequired: true });
  });
});

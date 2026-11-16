import { describe, expect, it } from 'vitest';
import { planFirstAdmin } from '../src/services/auth/firstAdmin.js';

describe('planFirstAdmin', () => {
  const env = { INITIAL_ADMIN_EMAIL: ' Owner@Broker.NG ', INITIAL_ADMIN_PASSWORD: 'Strong-pass-2026' };

  it('does nothing once any user exists, even with the env vars set', () => {
    expect(planFirstAdmin(1, env)).toEqual({ action: 'skip' });
  });

  it('creates an admin on an empty database, normalising the email', () => {
    expect(planFirstAdmin(0, env)).toEqual({ action: 'create', email: 'owner@broker.ng', name: 'owner', password: 'Strong-pass-2026' });
    expect(planFirstAdmin(0, { ...env, INITIAL_ADMIN_NAME: 'Ada Obi' })).toMatchObject({ name: 'Ada Obi' });
  });

  it('explains what to set when nothing is configured', () => {
    expect(planFirstAdmin(0, {})).toMatchObject({ action: 'warn', message: expect.stringContaining('INITIAL_ADMIN_EMAIL') });
  });

  it('refuses a bad email or weak password instead of creating a weak account', () => {
    expect(planFirstAdmin(0, { ...env, INITIAL_ADMIN_EMAIL: 'not-an-email' })).toMatchObject({ action: 'warn' });
    expect(planFirstAdmin(0, { ...env, INITIAL_ADMIN_PASSWORD: undefined })).toMatchObject({ action: 'warn' });
    expect(planFirstAdmin(0, { ...env, INITIAL_ADMIN_PASSWORD: 'short1' })).toMatchObject({ action: 'warn', message: expect.stringContaining('too weak') });
  });
});

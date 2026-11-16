import { describe, expect, it } from 'vitest';
import { parseRequire2faRoles } from '../src/config.js';
import { base32Decode, base32Encode, generateTotpSecret, hotp, otpauthUrl, totp, verifyTotp, timeStep } from '../src/services/auth/totp.js';
import { decryptSecret, encryptSecret } from '../src/services/auth/secretBox.js';
import { hashRecoveryCode } from '../src/services/auth/twoFactor.js';

// RFC 6238 Appendix B (SHA-1, 8 digits, secret "12345678901234567890")
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP (RFC 6238)', () => {
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])('T=%i → %s', (seconds, expected) => {
    expect(totp(RFC_SECRET, seconds * 1000, 8)).toBe(expected);
  });

  it('matches RFC 4226 HOTP test values', () => {
    const key = Buffer.from('12345678901234567890');
    expect([0, 1, 2, 9].map((c) => hotp(key, c))).toEqual(['755224', '287082', '359152', '520489']);
  });

  it('base32 round-trips and tolerates spaces/lower case', () => {
    const buf = Buffer.from('any carnal pleasure.');
    const enc = base32Encode(buf);
    expect(base32Decode(enc.toLowerCase().replace(/(.{4})/g, '$1 '))).toEqual(buf);
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it('accepts the current step ±1 and rejects anything else', () => {
    const secret = generateTotpSecret();
    const now = Date.UTC(2026, 10, 16, 12, 0, 15);
    const step = timeStep(now);
    expect(verifyTotp(secret, totp(secret, now), { nowMs: now })).toBe(step);
    expect(verifyTotp(secret, totp(secret, now - 30_000), { nowMs: now })).toBe(step - 1);
    expect(verifyTotp(secret, totp(secret, now + 30_000), { nowMs: now })).toBe(step + 1);
    expect(verifyTotp(secret, totp(secret, now - 90_000), { nowMs: now })).toBeNull();
    expect(verifyTotp(secret, '12345', { nowMs: now })).toBeNull();
    expect(verifyTotp(secret, 'abcdef', { nowMs: now })).toBeNull();
  });

  it('rejects a replayed code (step at or before the last used one)', () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const code = totp(secret, now);
    const step = verifyTotp(secret, code, { nowMs: now })!;
    expect(verifyTotp(secret, code, { nowMs: now, lastUsedStep: step })).toBeNull();
  });

  it('builds an otpauth URL authenticator apps understand', () => {
    const url = new URL(otpauthUrl('JBSWY3DPEHPK3PXP', 'ada@broker.ng'));
    expect(url.protocol).toBe('otpauth:');
    expect(url.href.startsWith('otpauth://totp/')).toBe(true);
    expect(decodeURIComponent(url.href.split('?')[0])).toBe('otpauth://totp/Insurance Ad Manager:ada@broker.ng');
    expect(url.searchParams.get('secret')).toBe('JBSWY3DPEHPK3PXP');
    expect(url.searchParams.get('issuer')).toBe('Insurance Ad Manager');
  });
});

describe('secret encryption & recovery code hashing', () => {
  it('encrypts with a random IV and detects tampering', () => {
    const a = encryptSecret('JBSWY3DPEHPK3PXP');
    expect(a).not.toBe(encryptSecret('JBSWY3DPEHPK3PXP'));
    expect(a).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decryptSecret(a)).toBe('JBSWY3DPEHPK3PXP');
    const parts = a.split(':');
    parts[3] = Buffer.from('tampered!').toString('base64');
    expect(() => decryptSecret(parts.join(':'))).toThrow();
  });
  it('normalises recovery codes before hashing', () => {
    expect(hashRecoveryCode('ABCDE-FGHJK')).toBe(hashRecoveryCode('abcde fghjk'));
  });
});

describe('REQUIRE_2FA_ROLES parsing', () => {
  it('defaults to ADMIN when unset', () => {
    expect(parseRequire2faRoles(undefined)).toEqual(['ADMIN']);
  });
  it('turns the requirement off with an empty value or "none"', () => {
    expect(parseRequire2faRoles('')).toEqual([]);
    expect(parseRequire2faRoles(' None ')).toEqual([]);
  });
  it('parses a list and ignores unknown roles', () => {
    expect(parseRequire2faRoles('admin, Marketer,bogus')).toEqual(['ADMIN', 'MARKETER']);
  });
});

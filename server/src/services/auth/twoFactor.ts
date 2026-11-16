import { createHash, randomInt } from 'node:crypto';
import type { User, UserRole } from '@prisma/client';
import QRCode from 'qrcode';
import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { HttpError } from '../../lib/http.js';
import { verifyPassword } from './password.js';
import { decryptSecret, encryptSecret } from './secretBox.js';
import { generateTotpSecret, otpauthUrl, verifyTotp } from './totp.js';

export const RECOVERY_CODE_COUNT = 10;
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no 0/o/1/l/i

export const twoFactorRequiredForRole = (role: UserRole) => config.REQUIRE_2FA_ROLES.includes(role);
export const twoFactorEnabled = (u: Pick<User, 'twoFactorEnabledAt' | 'totpSecretEnc'>) => Boolean(u.twoFactorEnabledAt && u.totpSecretEnc);

const normaliseRecoveryCode = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, '');
export const hashRecoveryCode = (c: string) => createHash('sha256').update(normaliseRecoveryCode(c)).digest('hex');

/** "xxxxx-xxxxx": 10 chars from a 31-symbol alphabet (~49 bits each). */
function newRecoveryCode() {
  let s = '';
  for (let i = 0; i < 10; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

async function replaceRecoveryCodes(userId: number): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);
  await prisma.$transaction([
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
    prisma.twoFactorRecoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })) }),
  ]);
  return codes;
}

export async function twoFactorStatus(userId: number) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const remaining = await prisma.twoFactorRecoveryCode.count({ where: { userId, usedAt: null } });
  return {
    enabled: twoFactorEnabled(user),
    enabledAt: user.twoFactorEnabledAt,
    required: twoFactorRequiredForRole(user.role),
    recoveryCodesRemaining: twoFactorEnabled(user) ? remaining : 0,
  };
}

/** Step 1 of setup: create a pending secret and return it as a QR code + text for manual entry. */
export async function beginSetup(userId: number) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (twoFactorEnabled(user)) throw new HttpError(409, 'Two-factor authentication is already on. Turn it off first to set up a new device.');
  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: userId }, data: { totpPendingSecretEnc: encryptSecret(secret) } });
  const url = otpauthUrl(secret, user.email);
  return { secret, otpauthUrl: url, qrCodeDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 220 }) };
}

/** Step 2 of setup: confirm a code from the app, switch 2FA on, and return fresh recovery codes (shown once). */
export async function confirmSetup(userId: number, code: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (twoFactorEnabled(user)) throw new HttpError(409, 'Two-factor authentication is already on');
  if (!user.totpPendingSecretEnc) throw new HttpError(400, 'Start the setup again');
  const secret = decryptSecret(user.totpPendingSecretEnc);
  const step = verifyTotp(secret, code);
  if (step === null) throw new HttpError(400, "That code didn't match. Check your phone's clock and enter the current 6-digit code.");
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecretEnc: user.totpPendingSecretEnc, totpPendingSecretEnc: null, twoFactorEnabledAt: new Date(), totpLastStep: step },
  });
  return { recoveryCodes: await replaceRecoveryCodes(userId) };
}

/**
 * Check a second factor at sign-in (or before a sensitive change): a 6-digit authenticator code or an
 * unused recovery code. Recovery codes are consumed; authenticator codes can't be replayed.
 */
export async function verifySecondFactor(user: User, input: { code?: string; recoveryCode?: string }): Promise<'totp' | 'recovery' | null> {
  if (!twoFactorEnabled(user)) return null;
  if (input.code) {
    const step = verifyTotp(decryptSecret(user.totpSecretEnc!), input.code, { lastUsedStep: user.totpLastStep });
    if (step === null) return null;
    // Conditional update so two simultaneous requests can't both use the same step.
    const updated = await prisma.user.updateMany({
      where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    return updated.count === 1 ? 'totp' : null;
  }
  if (input.recoveryCode) {
    const used = await prisma.twoFactorRecoveryCode.updateMany({
      where: { userId: user.id, codeHash: hashRecoveryCode(input.recoveryCode), usedAt: null },
      data: { usedAt: new Date() },
    });
    return used.count === 1 ? 'recovery' : null;
  }
  return null;
}

/** Turn 2FA off (needs the password and a current code). Not allowed when the user's role requires it. */
export async function disable(userId: number, password: string, factor: { code?: string; recoveryCode?: string }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!twoFactorEnabled(user)) throw new HttpError(409, 'Two-factor authentication is not on');
  if (twoFactorRequiredForRole(user.role)) throw new HttpError(409, `Two-factor authentication is required for the ${user.role} role and can't be turned off`);
  if (!(await verifyPassword(password, user.passwordHash))) throw new HttpError(400, 'Password is incorrect');
  if (!(await verifySecondFactor(user, factor))) throw new HttpError(400, 'Authentication code is incorrect');
  await clear(userId);
}

export async function regenerateRecoveryCodes(userId: number, code: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!twoFactorEnabled(user)) throw new HttpError(409, 'Two-factor authentication is not on');
  if ((await verifySecondFactor(user, { code })) !== 'totp') throw new HttpError(400, 'Authentication code is incorrect');
  return { recoveryCodes: await replaceRecoveryCodes(userId) };
}

/** Remove 2FA completely (user disabling it, or an admin resetting a lost device). */
export async function clear(userId: number, opts: { revokeSessions?: boolean } = {}) {
  await prisma.$transaction([
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        totpSecretEnc: null,
        totpPendingSecretEnc: null,
        twoFactorEnabledAt: null,
        totpLastStep: null,
        ...(opts.revokeSessions ? { tokenVersion: { increment: 1 } } : {}),
      },
    }),
  ]);
}

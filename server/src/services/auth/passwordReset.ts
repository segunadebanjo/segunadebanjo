import { createHash, randomBytes } from 'node:crypto';
import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { HttpError } from '../../lib/http.js';
import { escapeHtml, sendMail } from '../mail/mailer.js';
import { hashPassword, passwordProblems } from './password.js';

/** Only the SHA-256 of a reset token is stored, so a database leak doesn't expose usable links. */
export const hashResetToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const resetLink = (token: string) => `${config.APP_URL.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;

/**
 * Start a reset for this email. Silently does nothing for unknown or deactivated accounts so the
 * caller can always return the same response. Any earlier unused links for the user stop working.
 */
export async function requestPasswordReset(email: string, ip?: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.isActive) return;

  const token = randomBytes(32).toString('base64url');
  const ttl = config.PASSWORD_RESET_TTL_MINUTES;
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { OR: [{ userId: user.id, usedAt: null }, { expiresAt: { lt: new Date() } }] } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + ttl * 60_000), requestedIp: ip?.slice(0, 64) ?? null },
    }),
  ]);

  const link = resetLink(token);
  const name = user.name || 'there';
  await sendMail({
    to: user.email,
    subject: 'Reset your Insurance Ad Manager password',
    text: `Hi ${name},\n\nSomeone asked to reset the password for your Insurance Ad Manager account (${user.email}).\n\nTo choose a new password, open this link within ${ttl} minutes:\n${link}\n\nIf you didn't ask for this, you can ignore this email; your password stays the same.\n`,
    html: `<p>Hi ${escapeHtml(name)},</p>
<p>Someone asked to reset the password for your Insurance Ad Manager account (${escapeHtml(user.email)}).</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#0f766e;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Choose a new password</a></p>
<p>This link works once and expires in ${ttl} minutes.</p>
<p style="color:#64748b">If you didn't ask for this, you can ignore this email; your password stays the same.</p>`,
  });
}

async function findUsableToken(token: string) {
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(token) }, include: { user: true } });
  if (!row || row.usedAt || row.expiresAt < new Date() || !row.user.isActive) return null;
  return row;
}

export async function isResetTokenValid(token: string): Promise<boolean> {
  return Boolean(await findUsableToken(token));
}

/** Set a new password from a reset link. The link is consumed and every existing session ends. */
export async function completePasswordReset(token: string, newPassword: string): Promise<void> {
  const row = await findUsableToken(token);
  if (!row) throw new HttpError(400, 'This reset link is invalid or has expired. Request a new one.');
  const problem = passwordProblems(newPassword);
  if (problem) throw new HttpError(400, problem);
  const passwordHash = await hashPassword(newPassword);
  // Claim the token atomically so two simultaneous submissions can't both use it.
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw new HttpError(400, 'This reset link has already been used.');
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash, mustChangePassword: false, tokenVersion: { increment: 1 } } });
    await tx.passwordResetToken.deleteMany({ where: { userId: row.userId, usedAt: null } });
  });
}

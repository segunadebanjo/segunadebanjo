import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { config } from '../../config.js';

/** AES-256-GCM encryption for small secrets stored in the database (TOTP secrets). */
let key: Buffer | null = null;
const getKey = () =>
  (key ??= Buffer.from(hkdfSync('sha256', config.TWO_FACTOR_ENCRYPTION_KEY ?? config.AUTH_SECRET, 'insurance-ad-manager', 'totp-secret-v1', 32)));

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
}

export function decryptSecret(box: string): string {
  const [v, ivB64, tagB64, ctB64] = box.split(':');
  if (v !== 'v1' || !ivB64 || !tagB64 || !ctB64) throw new Error('Unrecognised secret format');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}

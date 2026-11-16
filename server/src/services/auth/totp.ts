import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Time-based one-time passwords (RFC 6238 / RFC 4226), as used by Google Authenticator,
 * Microsoft Authenticator, 1Password, Authy and others: HMAC-SHA1, 30-second steps, 6 digits.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const TOTP_PERIOD = 30;
export const TOTP_DIGITS = 6;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 160-bit secret, base32 encoded (what authenticator apps expect). */
export const generateTotpSecret = () => base32Encode(randomBytes(20));

export function hotp(key: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', key).update(msg).digest();
  const offset = mac[mac.length - 1] & 0xf;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export const timeStep = (nowMs = Date.now()) => Math.floor(nowMs / 1000 / TOTP_PERIOD);

export const totp = (secretB32: string, nowMs = Date.now(), digits = TOTP_DIGITS) => hotp(base32Decode(secretB32), timeStep(nowMs), digits);

/**
 * Check a code against the current step ±1 (allows ~30s of clock drift). Returns the matching step,
 * or null. Steps at or before `lastUsedStep` are rejected so a code can't be used twice.
 */
export function verifyTotp(secretB32: string, code: string, opts: { nowMs?: number; lastUsedStep?: number | null; window?: number } = {}): number | null {
  const clean = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return null;
  const key = base32Decode(secretB32);
  const now = timeStep(opts.nowMs);
  const window = opts.window ?? 1;
  for (let step = now - window; step <= now + window; step++) {
    if (opts.lastUsedStep != null && step <= opts.lastUsedStep) continue;
    const expected = hotp(key, step);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return step;
  }
  return null;
}

/** otpauth:// URI for QR codes. */
export function otpauthUrl(secretB32: string, accountEmail: string, issuer = 'Insurance Ad Manager') {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({ secret: secretB32, issuer, algorithm: 'SHA1', digits: String(TOTP_DIGITS), period: String(TOTP_PERIOD) });
  return `otpauth://totp/${label}?${params}`;
}

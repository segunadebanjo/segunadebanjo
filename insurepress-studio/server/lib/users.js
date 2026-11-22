import { query, one } from '../db/pool.js';
import { USER_FIELDS, hashPassword } from './auth.js';
import { HttpError } from './http.js';
import { DEFAULT_DISCLAIMER, REGULATORY_FRAMEWORK } from '../../shared/constants.js';

export async function ensureBrandKit(userId, name) {
  const kit = await one('SELECT id FROM brand_kits WHERE user_id=? LIMIT 1', [userId]);
  if (kit) return;
  await query(
    `INSERT INTO brand_kits (user_id, name, primary_color, secondary_color, accent_color, heading_font, body_font, regulatory_framework, default_currency, default_disclaimer)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [userId, name || 'My Brand Kit', '#0F2942', '#334155', '#D97706', 'Merriweather', 'Inter', REGULATORY_FRAMEWORK, 'NGN', DEFAULT_DISCLAIMER]);
}

export async function createUser({ full_name, email, password, brokerage_name, naicom_license_no, role = 'author' }) {
  if (!String(full_name || '').trim()) throw new HttpError(400, 'Full name is required');
  if (await one('SELECT id FROM users WHERE email=?', [email])) throw new HttpError(409, 'An account with that email already exists');
  const ins = await query(
    'INSERT INTO users (full_name, email, password_hash, brokerage_name, naicom_license_no, role) VALUES (?,?,?,?,?,?)',
    [full_name.trim(), email, await hashPassword(password), brokerage_name || null, naicom_license_no || null, role]);
  await ensureBrandKit(ins.insertId, brokerage_name ? `${brokerage_name} Press` : null);
  return one(`SELECT ${USER_FIELDS}, token_version FROM users WHERE id=?`, [ins.insertId]);
}

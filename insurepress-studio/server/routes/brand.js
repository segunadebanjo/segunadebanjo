import { Router } from 'express';
import { query, one } from '../db/pool.js';
import { ah, int, HttpError } from '../lib/http.js';
import { DEFAULT_DISCLAIMER, REGULATORY_FRAMEWORK } from '../../shared/constants.js';
import { USER_FIELDS } from '../lib/auth.js';

const r = Router();
const FIELDS = ['name', 'primary_color', 'secondary_color', 'accent_color', 'heading_font', 'body_font', 'logo_url', 'author_photo_url', 'regulatory_framework', 'default_currency', 'default_disclaimer'];
const HEX = /^#[0-9a-fA-F]{6}$/;

function validate(b) {
  for (const c of ['primary_color', 'secondary_color', 'accent_color']) if (b[c] && !HEX.test(b[c])) throw new HttpError(400, `${c} must be a #RRGGBB colour`);
  if (b.default_currency && !['NGN', 'USD'].includes(b.default_currency)) throw new HttpError(400, 'Currency must be NGN or USD');
}

r.get('/me', ah(async (req, res) => { const { token_version, ...u } = req.user; res.json(u); }));
r.put('/me', ah(async (req, res) => {
  const b = req.body || {};
  await query('UPDATE users SET full_name=COALESCE(?,full_name), brokerage_name=?, naicom_license_no=? WHERE id=?',
    [b.full_name || null, b.brokerage_name ?? req.user.brokerage_name, b.naicom_license_no ?? req.user.naicom_license_no, req.user.id]);
  res.json(await one(`SELECT ${USER_FIELDS} FROM users WHERE id=?`, [req.user.id]));
}));

r.get('/brand-kits', ah(async (req, res) => res.json(await query('SELECT * FROM brand_kits WHERE user_id=? ORDER BY id', [req.user.id]))));

r.post('/brand-kits', ah(async (req, res) => {
  const b = req.body || {};
  validate(b);
  const ins = await query(
    `INSERT INTO brand_kits (user_id, name, primary_color, secondary_color, accent_color, heading_font, body_font, logo_url, author_photo_url, regulatory_framework, default_currency, default_disclaimer)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [req.user.id, b.name || 'New Brand Kit', b.primary_color || '#0F2942', b.secondary_color || '#334155', b.accent_color || '#D97706', b.heading_font || 'Merriweather', b.body_font || 'Inter',
      b.logo_url || null, b.author_photo_url || null, b.regulatory_framework || REGULATORY_FRAMEWORK, b.default_currency || 'NGN', b.default_disclaimer || DEFAULT_DISCLAIMER]);
  res.status(201).json(await one('SELECT * FROM brand_kits WHERE id=?', [ins.insertId]));
}));

r.put('/brand-kits/:id', ah(async (req, res) => {
  const id = int(req.params.id);
  const b = req.body || {};
  validate(b);
  const kit = await one('SELECT id FROM brand_kits WHERE id=? AND user_id=?', [id, req.user.id]);
  if (!kit) throw new HttpError(404, 'Brand kit not found');
  const sets = FIELDS.filter((f) => f in b);
  if (sets.length) await query(`UPDATE brand_kits SET ${sets.map((f) => `${f}=?`).join(', ')} WHERE id=?`, [...sets.map((f) => b[f]), id]);
  res.json(await one('SELECT * FROM brand_kits WHERE id=?', [id]));
}));

r.delete('/brand-kits/:id', ah(async (req, res) => {
  const id = int(req.params.id);
  const n = await one('SELECT COUNT(*) AS n FROM brand_kits WHERE user_id=?', [req.user.id]);
  if (n.n <= 1) throw new HttpError(400, 'Keep at least one brand kit');
  await query('DELETE FROM brand_kits WHERE id=? AND user_id=?', [id, req.user.id]);
  res.json({ ok: true });
}));

export default r;

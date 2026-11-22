import { Router } from 'express';
import { query, one } from '../db/pool.js';
import { ah, int, HttpError } from '../lib/http.js';
import { getBook, getBrand } from '../lib/repo.js';
import { qrForCta, makeQr } from '../services/qrService.js';
import { CTA_TYPES, buildCtaUrl } from '../../shared/constants.js';

const r = Router();

async function ctaForUser(id, userId) {
  const c = await one('SELECT m.* FROM monetization_ctas m JOIN books b ON b.id=m.book_id WHERE m.id=? AND b.user_id=?', [id, userId]);
  if (!c) throw new HttpError(404, 'CTA not found');
  return c;
}

function validate(c) {
  if (!CTA_TYPES[c.cta_type]) throw new HttpError(400, 'Unknown CTA type');
  if (!String(c.label || '').trim()) throw new HttpError(400, 'Label is required');
  if (!String(c.destination_url || '').trim()) throw new HttpError(400, 'Destination URL (or WhatsApp number) is required');
}

const withTracking = (c) => ({ ...c, tracked_url: buildCtaUrl(c, { bookId: c.book_id, source: 'qr' }) });

r.get('/books/:id/ctas', ah(async (req, res) => {
  const bookId = int(req.params.id);
  await getBook(bookId, req.user.id);
  res.json((await query('SELECT * FROM monetization_ctas WHERE book_id=? ORDER BY id', [bookId])).map(withTracking));
}));

r.post('/books/:id/ctas', ah(async (req, res) => {
  const bookId = int(req.params.id);
  const book = await getBook(bookId, req.user.id);
  const brand = await getBrand(book.brand_kit_id, req.user.id);
  const c = { ...req.body, book_id: bookId };
  validate(c);
  const { qr } = await qrForCta(c, { bookId, dark: brand.primary_color });
  const ins = await query('INSERT INTO monetization_ctas (book_id, label, cta_type, destination_url, whatsapp_prefill_text, promo_code, qr_data_url) VALUES (?,?,?,?,?,?,?)',
    [bookId, c.label.trim(), c.cta_type, c.destination_url.trim(), c.whatsapp_prefill_text || null, c.promo_code || null, qr]);
  res.status(201).json(withTracking(await one('SELECT * FROM monetization_ctas WHERE id=?', [ins.insertId])));
}));

r.put('/ctas/:id', ah(async (req, res) => {
  const cur = await ctaForUser(int(req.params.id), req.user.id);
  const c = { ...cur, ...req.body };
  validate(c);
  const book = await getBook(cur.book_id, req.user.id);
  const brand = await getBrand(book.brand_kit_id, req.user.id);
  const { qr } = await qrForCta(c, { bookId: cur.book_id, dark: brand.primary_color });
  await query('UPDATE monetization_ctas SET label=?, cta_type=?, destination_url=?, whatsapp_prefill_text=?, promo_code=?, qr_data_url=? WHERE id=?',
    [c.label.trim(), c.cta_type, c.destination_url.trim(), c.whatsapp_prefill_text || null, c.promo_code || null, qr, cur.id]);
  res.json(withTracking(await one('SELECT * FROM monetization_ctas WHERE id=?', [cur.id])));
}));

r.delete('/ctas/:id', ah(async (req, res) => {
  const cur = await ctaForUser(int(req.params.id), req.user.id);
  await query('DELETE FROM monetization_ctas WHERE id=?', [cur.id]);
  res.json({ ok: true });
}));

// Ad-hoc QR for any text/URL (used by the cover studio).
r.post('/qr', ah(async (req, res) => {
  const text = String(req.body?.text || '').slice(0, 1000);
  if (!text) throw new HttpError(400, 'text is required');
  res.json({ dataUrl: await makeQr(text, { dark: req.body?.color || '#0F2942' }) });
}));

export default r;

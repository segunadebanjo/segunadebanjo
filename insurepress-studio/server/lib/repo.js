// Data-access helpers shared by routes and exporters.
import { query, one, parseJsonCols } from '../db/pool.js';
import { HttpError, notFound } from './http.js';
import { defaultCoverConfig } from '../../shared/cover.js';
import { DEFAULT_DISCLAIMER } from '../../shared/constants.js';

/**
 * Single-workspace mode: requests act as the first user (created on demand).
 * Swap this for real authentication (JWT/session) before multi-tenant deployment.
 */
export async function currentUser(req, _res, next) {
  try {
    let user = await one('SELECT id, full_name, email, brokerage_name, naicom_license_no, created_at FROM users ORDER BY id LIMIT 1');
    if (!user) {
      const r = await query('INSERT INTO users (full_name, email, brokerage_name) VALUES (?,?,?)', ['Studio Author', 'author@insurepress.local', 'My Brokerage']);
      user = await one('SELECT id, full_name, email, brokerage_name, naicom_license_no, created_at FROM users WHERE id=?', [r.insertId]);
    }
    req.user = user;
    next();
  } catch (e) { next(e); }
}

export async function getBook(bookId, userId) {
  const book = parseJsonCols(await one('SELECT * FROM books WHERE id=? AND user_id=?', [bookId, userId]), ['cover_config_json']);
  if (!book) throw notFound('Book');
  book.price_amount = Number(book.price_amount);
  return book;
}

export async function getBrand(id, userId) {
  if (id) {
    const b = await one('SELECT * FROM brand_kits WHERE id=? AND user_id=?', [id, userId]);
    if (b) return b;
  }
  return (await one('SELECT * FROM brand_kits WHERE user_id=? ORDER BY id LIMIT 1', [userId])) || {
    name: 'Default', primary_color: '#0F2942', secondary_color: '#334155', accent_color: '#D97706',
    heading_font: 'Merriweather', body_font: 'Inter', default_currency: 'NGN', default_disclaimer: DEFAULT_DISCLAIMER,
  };
}

export async function getChapters(bookId) {
  const rows = await query(`SELECT * FROM chapters WHERE book_id=? ORDER BY FIELD(section_type,'front_matter','body','workbook','back_matter'), sort_order, id`, [bookId]);
  return rows.map((r) => parseJsonCols(r, ['content_json']));
}

export async function getChapterForUser(chapterId, userId) {
  const ch = parseJsonCols(await one('SELECT c.* FROM chapters c JOIN books b ON b.id=c.book_id WHERE c.id=? AND b.user_id=?', [chapterId, userId]), ['content_json']);
  if (!ch) throw notFound('Chapter');
  return ch;
}

export async function getCtas(bookId) {
  return query('SELECT * FROM monetization_ctas WHERE book_id=? ORDER BY id', [bookId]);
}

export async function loadFullBook(bookId, userId) {
  const book = await getBook(bookId, userId);
  const [brand, chapters, ctas] = await Promise.all([getBrand(book.brand_kit_id, userId), getChapters(bookId), getCtas(bookId)]);
  const coverConfig = { ...defaultCoverConfig(book, brand), ...(book.cover_config_json || {}) };
  return { book, brand, chapters, ctas, coverConfig };
}

export function assert(cond, status, msg) { if (!cond) throw new HttpError(status, msg); }

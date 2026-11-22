import { Router } from 'express';
import { query, one } from '../db/pool.js';
import { ah, int, HttpError } from '../lib/http.js';
import { getBook, getChapterForUser, loadFullBook, getChapters, getBrand, getCtas, assert } from '../lib/repo.js';
import { buildMatter, FRONT_MATTER_SET, BACK_MATTER_SET } from '../lib/matterTemplates.js';
import { countWords, docToHtml, emptyDoc } from '../../shared/render.js';
import { TRIM_SIZES, SECTION_TYPES, CHAPTER_STATUSES } from '../../shared/constants.js';
import { THEMES } from '../../shared/themes.js';

const r = Router();
const SECTIONS = SECTION_TYPES.map((s) => s.id);
const json = (v) => (v == null ? null : JSON.stringify(v));

const BOOK_FIELDS = ['brand_kit_id', 'title', 'subtitle', 'author_name', 'target_persona', 'core_pain_point', 'monetization_goal', 'price_amount', 'currency', 'trim_size', 'theme_preset', 'status', 'target_word_count'];

function validateBook(b) {
  if ('title' in b) assert(String(b.title || '').trim(), 400, 'Title is required');
  if (b.currency) assert(['NGN', 'USD'].includes(b.currency), 400, 'Currency must be NGN or USD');
  if (b.trim_size) assert(TRIM_SIZES[b.trim_size], 400, 'Unknown trim size');
  if (b.theme_preset) assert(THEMES[b.theme_preset], 400, 'Unknown theme');
  if (b.monetization_goal) assert(['direct_sales', 'lead_generation', 'hybrid'].includes(b.monetization_goal), 400, 'Unknown monetization goal');
  if (b.status) assert(['draft', 'review', 'published'].includes(b.status), 400, 'Unknown status');
}

// ---- Books -----------------------------------------------------------------------------------

r.get('/books', ah(async (req, res) => {
  const rows = await query(
    `SELECT b.*, COUNT(c.id) AS chapter_count, COALESCE(SUM(c.word_count),0) AS word_count,
            SUM(c.status='complete') AS complete_count
       FROM books b LEFT JOIN chapters c ON c.book_id=b.id
      WHERE b.user_id=? GROUP BY b.id ORDER BY b.updated_at DESC`, [req.user.id]);
  res.json(rows.map((b) => ({ ...b, price_amount: Number(b.price_amount), word_count: Number(b.word_count), complete_count: Number(b.complete_count || 0), cover_config_json: typeof b.cover_config_json === 'string' ? JSON.parse(b.cover_config_json) : b.cover_config_json })));
}));

r.post('/books', ah(async (req, res) => {
  const b = req.body || {};
  validateBook({ title: b.title || 'Untitled Book', ...b });
  const brand = await getBrand(b.brand_kit_id, req.user.id);
  const ins = await query(
    `INSERT INTO books (user_id, brand_kit_id, title, subtitle, author_name, target_persona, core_pain_point, monetization_goal, price_amount, currency, trim_size, theme_preset, target_word_count)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [req.user.id, brand.id || null, b.title || 'Untitled Book', b.subtitle || null, b.author_name || req.user.full_name, b.target_persona || null, b.core_pain_point || null,
      b.monetization_goal || 'hybrid', b.price_amount ?? (b.currency === 'USD' ? 15 : 7500), b.currency || brand.default_currency || 'NGN', b.trim_size || '6x9', b.theme_preset || 'executive-navy', b.target_word_count || 30000]);
  const bookId = ins.insertId;
  if (b.withMatter !== false) {
    const book = await getBook(bookId, req.user.id);
    let order = 0;
    for (const sub of [...FRONT_MATTER_SET, ...BACK_MATTER_SET]) {
      const m = buildMatter(sub, { book, brand, user: req.user, ctas: [] });
      await insertChapter(bookId, { ...m, sort_order: order++, status: 'complete' });
    }
    await insertChapter(bookId, { section_type: 'body', matter_subtype: 'chapter', title: 'Chapter One', doc: emptyDoc(), sort_order: 0, status: 'outline' });
  }
  res.status(201).json(await loadFullBook(bookId, req.user.id));
}));

r.get('/books/:id/full', ah(async (req, res) => res.json(await loadFullBook(int(req.params.id), req.user.id))));

r.put('/books/:id', ah(async (req, res) => {
  const id = int(req.params.id);
  await getBook(id, req.user.id);
  const b = req.body || {};
  validateBook(b);
  const sets = [];
  const vals = [];
  for (const f of BOOK_FIELDS) if (f in b) { sets.push(`${f}=?`); vals.push(b[f] === '' && f !== 'title' ? null : b[f]); }
  if ('cover_config_json' in b) { sets.push('cover_config_json=?'); vals.push(json(b.cover_config_json)); }
  if (sets.length) await query(`UPDATE books SET ${sets.join(', ')} WHERE id=?`, [...vals, id]);
  res.json(await getBook(id, req.user.id));
}));

r.delete('/books/:id', ah(async (req, res) => {
  const id = int(req.params.id);
  await getBook(id, req.user.id);
  await query('DELETE FROM books WHERE id=?', [id]);
  res.json({ ok: true });
}));

// ---- Chapters --------------------------------------------------------------------------------

export async function insertChapter(bookId, c) {
  const doc = c.doc || c.content_json || emptyDoc();
  const max = await one('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM chapters WHERE book_id=? AND section_type=?', [bookId, c.section_type || 'body']);
  const ins = await query(
    `INSERT INTO chapters (book_id, section_type, matter_subtype, title, subtitle, sort_order, content_json, content_html, word_count, status)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [bookId, c.section_type || 'body', c.matter_subtype || 'chapter', c.title || 'Untitled Chapter', c.subtitle || null,
      c.sort_order ?? max.n, json(doc), docToHtml(doc), countWords(doc), c.status || 'outline']);
  return ins.insertId;
}

r.post('/books/:id/chapters', ah(async (req, res) => {
  const bookId = int(req.params.id);
  await getBook(bookId, req.user.id);
  const c = req.body || {};
  if (c.section_type) assert(SECTIONS.includes(c.section_type), 400, 'Unknown section type');
  const id = await insertChapter(bookId, { ...c, sort_order: undefined });
  res.status(201).json(await getChapterForUser(id, req.user.id));
}));

r.post('/books/:id/matter', ah(async (req, res) => {
  const bookId = int(req.params.id);
  const book = await getBook(bookId, req.user.id);
  const [brand, ctas] = await Promise.all([getBrand(book.brand_kit_id, req.user.id), getCtas(bookId)]);
  const m = buildMatter(req.body?.subtype, { book, brand, user: req.user, ctas });
  if (!m) throw new HttpError(400, 'Unknown matter type');
  const id = await insertChapter(bookId, { ...m, status: 'complete' });
  res.status(201).json(await getChapterForUser(id, req.user.id));
}));

r.get('/chapters/:id', ah(async (req, res) => res.json(await getChapterForUser(int(req.params.id), req.user.id))));

r.put('/chapters/:id', ah(async (req, res) => {
  const id = int(req.params.id);
  await getChapterForUser(id, req.user.id);
  const c = req.body || {};
  const sets = [];
  const vals = [];
  for (const f of ['title', 'subtitle', 'matter_subtype', 'status', 'section_type']) if (f in c) { sets.push(`${f}=?`); vals.push(c[f]); }
  if (c.status) assert(CHAPTER_STATUSES.includes(c.status), 400, 'Unknown status');
  if (c.section_type) assert(SECTIONS.includes(c.section_type), 400, 'Unknown section type');
  if (c.content_json) {
    sets.push('content_json=?', 'content_html=?', 'word_count=?');
    vals.push(json(c.content_json), docToHtml(c.content_json), countWords(c.content_json));
  }
  if (sets.length) await query(`UPDATE chapters SET ${sets.join(', ')} WHERE id=?`, [...vals, id]);
  const ch = await getChapterForUser(id, req.user.id);
  await query('UPDATE books SET updated_at=NOW() WHERE id=?', [ch.book_id]);
  res.json(ch);
}));

r.delete('/chapters/:id', ah(async (req, res) => {
  const id = int(req.params.id);
  await getChapterForUser(id, req.user.id);
  await query('DELETE FROM chapters WHERE id=?', [id]);
  res.json({ ok: true });
}));

r.post('/books/:id/chapters/reorder', ah(async (req, res) => {
  const bookId = int(req.params.id);
  await getBook(bookId, req.user.id);
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  for (const it of items) {
    assert(SECTIONS.includes(it.section_type), 400, 'Unknown section type');
    await query('UPDATE chapters SET section_type=?, sort_order=? WHERE id=? AND book_id=?', [it.section_type, int(it.sort_order) ?? 0, int(it.id), bookId]);
  }
  res.json(await getChapters(bookId));
}));

// ---- Versions --------------------------------------------------------------------------------

r.get('/chapters/:id/versions', ah(async (req, res) => {
  const id = int(req.params.id);
  await getChapterForUser(id, req.user.id);
  res.json(await query('SELECT id, chapter_id, version_label, word_count, created_at FROM chapter_versions WHERE chapter_id=? ORDER BY created_at DESC, id DESC', [id]));
}));

r.post('/chapters/:id/versions', ah(async (req, res) => {
  const id = int(req.params.id);
  const ch = await getChapterForUser(id, req.user.id);
  const label = String(req.body?.label || '').trim() || `Snapshot ${new Date().toLocaleString('en-GB')}`;
  const ins = await query('INSERT INTO chapter_versions (chapter_id, version_label, content_json, word_count) VALUES (?,?,?,?)', [id, label, json(ch.content_json), ch.word_count]);
  res.status(201).json(await one('SELECT id, chapter_id, version_label, word_count, created_at FROM chapter_versions WHERE id=?', [ins.insertId]));
}));

r.get('/versions/:id', ah(async (req, res) => {
  const v = await one('SELECT v.* FROM chapter_versions v JOIN chapters c ON c.id=v.chapter_id JOIN books b ON b.id=c.book_id WHERE v.id=? AND b.user_id=?', [int(req.params.id), req.user.id]);
  if (!v) throw new HttpError(404, 'Version not found');
  if (typeof v.content_json === 'string') v.content_json = JSON.parse(v.content_json);
  res.json(v);
}));

r.post('/versions/:id/restore', ah(async (req, res) => {
  const v = await one('SELECT v.* FROM chapter_versions v JOIN chapters c ON c.id=v.chapter_id JOIN books b ON b.id=c.book_id WHERE v.id=? AND b.user_id=?', [int(req.params.id), req.user.id]);
  if (!v) throw new HttpError(404, 'Version not found');
  const ch = await getChapterForUser(v.chapter_id, req.user.id);
  // Safety net: snapshot the current text before overwriting it.
  await query('INSERT INTO chapter_versions (chapter_id, version_label, content_json, word_count) VALUES (?,?,?,?)', [ch.id, `Auto-backup before restoring “${v.version_label}”`, json(ch.content_json), ch.word_count]);
  const doc = typeof v.content_json === 'string' ? JSON.parse(v.content_json) : v.content_json;
  await query('UPDATE chapters SET content_json=?, content_html=?, word_count=? WHERE id=?', [json(doc), docToHtml(doc), countWords(doc), ch.id]);
  res.json(await getChapterForUser(ch.id, req.user.id));
}));

r.delete('/versions/:id', ah(async (req, res) => {
  const v = await one('SELECT v.id FROM chapter_versions v JOIN chapters c ON c.id=v.chapter_id JOIN books b ON b.id=c.book_id WHERE v.id=? AND b.user_id=?', [int(req.params.id), req.user.id]);
  if (!v) throw new HttpError(404, 'Version not found');
  await query('DELETE FROM chapter_versions WHERE id=?', [v.id]);
  res.json({ ok: true });
}));

export default r;

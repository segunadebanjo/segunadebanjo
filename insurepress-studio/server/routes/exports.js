import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { query } from '../db/pool.js';
import { ah, int, HttpError } from '../lib/http.js';
import { getBook, loadFullBook } from '../lib/repo.js';
import { config } from '../config.js';
import { buildBookPdf, buildLeadMagnetPdf, renderCoverPng } from '../services/pdfService.js';
import { buildBookEpub } from '../services/epubService.js';
import { buildBookDocx } from '../services/docxService.js';
import { qrForCta } from '../services/qrService.js';
import { THEMES } from '../../shared/themes.js';
import { TRIM_SIZES } from '../../shared/constants.js';

const r = Router();
const EXT = { pdf: 'pdf', epub: 'epub', docx: 'docx', lead_magnet_pdf: 'pdf' };

const slug = (s) => String(s || 'book').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'book';

r.post('/books/:id/exports', ah(async (req, res) => {
  const bookId = int(req.params.id);
  const { format, theme, trim, chapterIds, ctaId, headline } = req.body || {};
  if (!EXT[format]) throw new HttpError(400, 'Format must be pdf, epub, docx or lead_magnet_pdf');
  if (theme && !THEMES[theme]) throw new HttpError(400, 'Unknown theme');
  if (trim && !TRIM_SIZES[trim]) throw new HttpError(400, 'Unknown trim size');
  const full = await loadFullBook(bookId, req.user.id);
  const job = await query('INSERT INTO export_jobs (book_id, format, status) VALUES (?,?,?)', [bookId, format, 'processing']);
  const jobId = job.insertId;
  const started = Date.now();
  try {
    let buffer;
    let meta = {};
    if (format === 'pdf') {
      const out = await buildBookPdf({ ...full, theme, trim });
      buffer = Buffer.from(out.bytes); meta.pages = out.pageCount;
    } else if (format === 'epub') {
      buffer = await buildBookEpub({ ...full, theme });
    } else if (format === 'docx') {
      buffer = await buildBookDocx(full);
    } else {
      const ids = (Array.isArray(chapterIds) ? chapterIds : []).map(int);
      const chapters = ids.length ? full.chapters.filter((c) => ids.includes(c.id)) : full.chapters.filter((c) => c.section_type === 'workbook');
      if (!chapters.length) throw new HttpError(400, 'Select at least one worksheet or checklist chapter');
      const ctaRow = full.ctas.find((c) => c.id === int(ctaId)) || full.ctas.find((c) => ['selar_checkout', 'paystack_link'].includes(c.cta_type)) || full.ctas[0];
      let cta = null;
      if (ctaRow) { const q = await qrForCta(ctaRow, { bookId, dark: full.brand.primary_color }); cta = { ...ctaRow, url: q.url, qr: q.qr }; }
      const out = await buildLeadMagnetPdf({ ...full, chapters, cta, theme, trim: trim || 'A4', headline });
      buffer = Buffer.from(out.bytes); meta.pages = out.pageCount;
    }
    await fs.mkdir(config.exportDir, { recursive: true });
    const name = `${slug(full.book.title)}-${format.replaceAll('_', '-')}-${jobId}.${EXT[format]}`;
    await fs.writeFile(path.join(config.exportDir, name), buffer);
    await query('UPDATE export_jobs SET status=?, file_path=? WHERE id=?', ['done', name, jobId]);
    res.status(201).json({ id: jobId, format, status: 'done', file_path: name, url: `/exports/${name}`, bytes: buffer.length, ms: Date.now() - started, ...meta });
  } catch (e) {
    await query('UPDATE export_jobs SET status=? WHERE id=?', ['failed', jobId]);
    throw e;
  }
}));

r.get('/books/:id/exports', ah(async (req, res) => {
  const bookId = int(req.params.id);
  await getBook(bookId, req.user.id);
  const rows = await query('SELECT * FROM export_jobs WHERE book_id=? ORDER BY id DESC LIMIT 30', [bookId]);
  res.json(rows.map((j) => ({ ...j, url: j.file_path ? `/exports/${j.file_path}` : null })));
}));

r.get('/books/:id/cover.png', ah(async (req, res) => {
  const full = await loadFullBook(int(req.params.id), req.user.id);
  const part = req.query.part === 'back' ? 'back' : 'front';
  const png = await renderCoverPng(full.coverConfig, { trim: full.book.trim_size, part, widthPx: Math.min(int(req.query.width) || 1600, 3000), book: full.book });
  res.setHeader('Content-Type', 'image/png');
  if (req.query.download) res.setHeader('Content-Disposition', `attachment; filename="${slug(full.book.title)}-${part}-cover.png"`);
  res.send(png);
}));

// Download a generated file. Only the owner of the book can fetch it.
export async function downloadExport(req, res, next) {
  try {
    const name = String(req.params.file || '');
    if (!/^[a-z0-9-]+\.(pdf|epub|docx)$/.test(name)) return res.status(404).json({ error: 'Not found' });
    const job = await query('SELECT e.id FROM export_jobs e JOIN books b ON b.id=e.book_id WHERE e.file_path=? AND b.user_id=?', [name, req.user.id]);
    if (!job.length) return res.status(404).json({ error: 'Not found' });
    res.download(path.join(config.exportDir, name), name, (err) => { if (err && !res.headersSent) res.status(404).json({ error: 'File no longer exists' }); });
  } catch (e) { next(e); }
}

export default r;

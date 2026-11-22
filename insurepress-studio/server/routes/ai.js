import { Router } from 'express';
import { query } from '../db/pool.js';
import { ah, int, HttpError } from '../lib/http.js';
import { getBook, getBrand, getCtas, getChapterForUser, loadFullBook } from '../lib/repo.js';
import { aiStatus, generatePainPoints, generateOutline, runCopilot, generateSalesCopy, COPILOT_ACTIONS } from '../services/aiService.js';
import { buildMatter } from '../lib/matterTemplates.js';
import { insertChapter } from './books.js';
import { aiBlocksToDoc, P, BLOCK, H } from '../../shared/render.js';
import { AUDIENCES } from '../../shared/constants.js';

const r = Router();
const json = (v) => (v == null ? null : JSON.stringify(v));

r.get('/ai/status', (req, res) => res.json({ ...aiStatus(), actions: COPILOT_ACTIONS, audiences: AUDIENCES }));

r.post('/ai/pain-points', ah(async (req, res) => {
  const { audienceId, customAudience, notes } = req.body || {};
  res.json(await generatePainPoints({ audienceId, customAudience, notes }));
}));

r.post('/ai/outline', ah(async (req, res) => {
  res.json(await generateOutline({ ...(req.body || {}), authorName: req.body?.authorName || req.user.full_name }));
}));

r.post('/ai/copilot', ah(async (req, res) => {
  const { action, bookId, chapterId, doc, selection, notes } = req.body || {};
  if (!COPILOT_ACTIONS[action]) throw new HttpError(400, 'Unknown co-pilot action');
  const book = await getBook(int(bookId), req.user.id);
  const chapter = chapterId ? await getChapterForUser(int(chapterId), req.user.id) : {};
  const out = await runCopilot(action, { book, chapter, doc: doc || chapter.content_json, selection, notes });
  if (out.kind === 'compliance') return res.json(out);
  res.json({ ...out, action, doc: aiBlocksToDoc(out.blocks) });
}));

r.post('/ai/sales-copy', ah(async (req, res) => {
  const book = await getBook(int(req.body?.bookId), req.user.id);
  res.json(await generateSalesCopy({ book, ctas: await getCtas(book.id) }));
}));

// ---- Blueprint -> manuscript ------------------------------------------------------------------

function starterDoc(item, painPoint) {
  const content = [];
  if (item.summary) content.push(P(`*Outline notes:* ${item.summary}`));
  if (painPoint) {
    content.push(BLOCK('painPoint', { badge: 'Real Risk', severity: 'high', title: painPoint.fear || painPoint.title, body: `Trigger: ${painPoint.trigger}. Financial consequence: ${painPoint.financialConsequence}.` }));
    if (painPoint.misconception) content.push(BLOCK('mythFact', { myth: String(painPoint.misconception).replace(/[“”"]/g, ''), fact: `The right cover — ${(painPoint.policies || []).join(', ')} — responds when it is bought for the right amount and the premium is paid before the loss.` }));
  }
  if (item.suggestedBlocks?.length) content.push(P(`*Suggested visual blocks:* ${item.suggestedBlocks.join(', ')}. Use the AI Co-Pilot → “Draft Chapter from Outline Notes” to write the first draft.`));
  if (!content.length) content.push(P(''));
  return { type: 'doc', content };
}

r.post('/blueprints/populate', ah(async (req, res) => {
  const b = req.body || {};
  const outline = Array.isArray(b.outline) ? b.outline : [];
  if (!outline.length) throw new HttpError(400, 'Outline is empty');
  let bookId = int(b.bookId);
  const brand = await getBrand(null, req.user.id);
  if (bookId) {
    await getBook(bookId, req.user.id);
    if (b.replaceExisting) await query('DELETE FROM chapters WHERE book_id=?', [bookId]);
    if (b.title) await query('UPDATE books SET title=?, subtitle=?, target_persona=?, core_pain_point=? WHERE id=?', [b.title, b.subtitle || null, b.audience || null, b.corePainPoint || null, bookId]);
  } else {
    const ins = await query(
      `INSERT INTO books (user_id, brand_kit_id, title, subtitle, author_name, target_persona, core_pain_point, monetization_goal, price_amount, currency, trim_size, theme_preset, target_word_count)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id, brand.id || null, b.title || 'Untitled Book', b.subtitle || null, b.authorName || req.user.full_name, b.audience || null, b.corePainPoint || null,
        b.monetization_goal || 'hybrid', b.currency === 'USD' ? 15 : 7500, b.currency || 'NGN', '6x9', 'executive-navy', 32000]);
    bookId = ins.insertId;
  }
  const book = await getBook(bookId, req.user.id);
  const ctas = await getCtas(bookId);
  const orderBySection = {};
  for (const item of outline) {
    const section = item.section_type || 'body';
    const sort = (orderBySection[section] = (orderBySection[section] ?? -1) + 1);
    const matter = ['front_matter', 'back_matter'].includes(section) ? buildMatter(item.matter_subtype, { book, brand, user: req.user, ctas }) : null;
    if (matter) {
      await insertChapter(bookId, { ...matter, title: item.title || matter.title, sort_order: sort, status: 'complete' });
    } else {
      const pp = Number.isInteger(item.painPointIndex) ? (b.painPoints || [])[item.painPointIndex] : null;
      await insertChapter(bookId, {
        section_type: section, matter_subtype: item.matter_subtype || 'chapter', title: item.title, subtitle: item.subtitle,
        doc: section === 'workbook' ? { type: 'doc', content: [H(2, item.title), P(item.summary || ''), BLOCK('riskChecklist', { title: item.title, intro: 'Complete this with a pen — or with your broker on WhatsApp.' })] } : starterDoc(item, pp),
        sort_order: sort, status: 'outline',
      });
    }
  }
  await query('INSERT INTO pain_point_blueprints (book_id, audience_segment, pain_points_json, recommended_policies_json, generated_outline_json) VALUES (?,?,?,?,?)',
    [bookId, b.audience || 'Custom', json(b.painPoints || []), json(b.recommendedPolicies || []), json({ titles: b.titles || [], outline })]);
  res.status(201).json(await loadFullBook(bookId, req.user.id));
}));

r.get('/books/:id/blueprints', ah(async (req, res) => {
  const bookId = int(req.params.id);
  await getBook(bookId, req.user.id);
  res.json(await query('SELECT * FROM pain_point_blueprints WHERE book_id=? ORDER BY id DESC', [bookId]));
}));

export default r;

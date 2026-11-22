// npm run seed — loads the Sparklight Advisory Press brand kit, sample CTAs and the
// "Sleep Soundly" starter book. Safe to re-run: it replaces the demo records it created before.
import { migrate } from './migrate.js';
import { pool, query, one } from './pool.js';
import { insertChapter } from '../routes/books.js';
import { buildMatter } from '../lib/matterTemplates.js';
import { qrForCta } from '../services/qrService.js';
import { DEFAULT_DISCLAIMER, REGULATORY_FRAMEWORK, buildCtaUrl } from '../../shared/constants.js';
import { defaultCoverConfig } from '../../shared/cover.js';
import { BOOK, CTAS, introduction, chapter1, chapter2, chapter3, workbook } from './seedContent.js';

const BRAND = {
  name: 'Sparklight Advisory Press', primary_color: '#0F2942', secondary_color: '#334155', accent_color: '#D97706',
  heading_font: 'Merriweather', body_font: 'Inter', regulatory_framework: REGULATORY_FRAMEWORK, default_currency: 'NGN', default_disclaimer: DEFAULT_DISCLAIMER,
};

async function run() {
  await migrate({ quiet: true });

  // 1. Workspace user (the app acts as the first user).
  let user = await one('SELECT * FROM users ORDER BY id LIMIT 1');
  const profile = ['Funmilayo Adeyemi', 'Sparklight Insurance Brokers Ltd', 'NAICOM/BRK/0000 (sample)'];
  if (user) await query('UPDATE users SET full_name=?, brokerage_name=?, naicom_license_no=? WHERE id=?', [...profile, user.id]);
  else await query('INSERT INTO users (full_name, email, brokerage_name, naicom_license_no) VALUES (?,?,?,?)', [profile[0], 'author@sparklight.example', profile[1], profile[2]]);
  user = await one('SELECT * FROM users ORDER BY id LIMIT 1');

  // 2. Brand kit.
  let brand = await one('SELECT * FROM brand_kits WHERE user_id=? AND name=?', [user.id, BRAND.name]);
  const cols = Object.keys(BRAND);
  if (brand) await query(`UPDATE brand_kits SET ${cols.map((c) => `${c}=?`).join(', ')} WHERE id=?`, [...cols.map((c) => BRAND[c]), brand.id]);
  else await query(`INSERT INTO brand_kits (user_id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`, [user.id, ...cols.map((c) => BRAND[c])]);
  brand = await one('SELECT * FROM brand_kits WHERE user_id=? AND name=?', [user.id, BRAND.name]);

  // 3. Starter book (replace previous demo copy).
  await query('DELETE FROM books WHERE user_id=? AND title=? AND subtitle=?', [user.id, BOOK.title, BOOK.subtitle]);
  const b = await query(
    `INSERT INTO books (user_id, brand_kit_id, title, subtitle, author_name, target_persona, core_pain_point, monetization_goal, price_amount, currency, trim_size, theme_preset, status, target_word_count)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [user.id, brand.id, BOOK.title, BOOK.subtitle, BOOK.author_name, BOOK.target_persona, BOOK.core_pain_point, BOOK.monetization_goal, BOOK.price_amount, BOOK.currency, BOOK.trim_size, BOOK.theme_preset, 'draft', BOOK.target_word_count]);
  const bookId = b.insertId;
  const book = await one('SELECT * FROM books WHERE id=?', [bookId]);

  // 4. Monetization CTAs with QR codes.
  const ctas = [];
  for (const c of CTAS) {
    const { qr } = await qrForCta({ ...c, book_id: bookId }, { bookId, dark: brand.primary_color });
    const ins = await query('INSERT INTO monetization_ctas (book_id, label, cta_type, destination_url, whatsapp_prefill_text, promo_code, qr_data_url) VALUES (?,?,?,?,?,?,?)',
      [bookId, c.label, c.cta_type, c.destination_url, c.whatsapp_prefill_text || null, c.promo_code, qr]);
    ctas.push(await one('SELECT * FROM monetization_ctas WHERE id=?', [ins.insertId]));
  }
  const wa = ctas.find((c) => c.cta_type === 'whatsapp_quote');
  const selar = ctas.find((c) => c.cta_type === 'selar_checkout');

  // Wire the in-chapter CTA cards to the real WhatsApp CTA + QR.
  const wireCtas = (doc) => ({ ...doc, content: doc.content.map((n) => (n.type === 'ctaCard'
    ? { ...n, attrs: { data: { ...n.attrs.data, ctaId: wa.id, ctaType: 'whatsapp_quote', url: buildCtaUrl(wa, { bookId, source: 'book' }), qrDataUrl: wa.qr_data_url } } }
    : n)) });

  // 5. Manuscript.
  let order = 0;
  for (const sub of ['title_page', 'copyright', 'dedication', 'who_this_is_for']) {
    await insertChapter(bookId, { ...buildMatter(sub, { book, brand, user, ctas }), sort_order: order++, status: 'complete' });
  }
  order = 0;
  for (const ch of [introduction, chapter1, chapter2, chapter3]) await insertChapter(bookId, { ...ch, doc: wireCtas(ch.doc), sort_order: order++ });
  await insertChapter(bookId, { ...workbook, sort_order: 0 });
  order = 0;
  for (const sub of ['glossary', 'claims_directory', 'about_author', 'next_steps']) {
    await insertChapter(bookId, { ...buildMatter(sub, { book, brand, user, ctas }), sort_order: order++, status: 'complete' });
  }

  // A named snapshot so the Version History drawer has something to show.
  const c2 = await one('SELECT * FROM chapters WHERE book_id=? AND title=?', [bookId, chapter2.title]);
  await query('INSERT INTO chapter_versions (chapter_id, version_label, content_json, word_count) VALUES (?,?,?,?)', [c2.id, 'First full draft', JSON.stringify(c2.content_json && typeof c2.content_json === 'object' ? c2.content_json : JSON.parse(c2.content_json)), c2.word_count]);

  // 6. Cover.
  const cover = {
    ...defaultCoverConfig(book, brand), template: 'night-calm', icon: 'shield',
    tagline: 'Protect your company, cash flow & legacy', badge: 'Sparklight Advisory Press',
    blurb: 'One fire. One burglary. One rejected claim.\n\nThat is all it takes to undo ten years of hard work. In this plain-English guide, broker Funmilayo Adeyemi shows Nigerian business owners exactly which covers matter, how much to insure for, what NIIRA 2025 means for employers, and how to make sure claims actually get paid — with real (anonymised) Naira case studies and checklists you can finish in an afternoon.',
    authorBio: 'Funmilayo Adeyemi, ACIIN, is a risk advisor at Sparklight Insurance Brokers Ltd, a NAICOM-licensed brokerage serving SMEs across Nigeria.',
    isbn: 'ISBN 978-978-00000-0-0', qrDataUrl: selar?.qr_data_url || '', qrCaption: 'Scan to buy the eBook or gift a copy',
  };
  await query('UPDATE books SET cover_config_json=? WHERE id=?', [JSON.stringify(cover), bookId]);

  const words = await one('SELECT COUNT(*) AS n, SUM(word_count) AS w FROM chapters WHERE book_id=?', [bookId]);
  console.log(`✔ Seeded brand kit "${brand.name}", ${ctas.length} CTAs and "${BOOK.title}" (${words.n} sections, ${words.w} words). Book id ${bookId}.`);
}

run()
  .catch((e) => { console.error('Seed failed:', e); process.exitCode = 1; })
  .finally(() => pool.end());

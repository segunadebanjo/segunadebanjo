// Print-ready PDF engine.
// Each section is rendered by headless Chromium with exact @page trim/margins, then the pieces are
// merged with pdf-lib so we can (1) start chapters on right-hand pages, (2) build a Table of
// Contents with real page numbers, and (3) stamp running headers and folios.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { withPage } from './browser.js';
import {
  bookCss, htmlDocument, fontsHrefFor, orderChapters, chapterLabels, renderChapterHtml, renderTocHtml,
} from '../../shared/themes.js';
import { renderFrontCover, renderBackCover } from '../../shared/cover.js';
import { TRIM_SIZES } from '../../shared/constants.js';
import { blockToHtml, esc } from '../../shared/render.js';

const PT = 72;

async function htmlToPdf(html, ts, { margin0 = false } = {}) {
  return withPage(html, (page) =>
    page.pdf({
      width: `${ts.width}in`, height: `${ts.height}in`, printBackground: true, preferCSSPageSize: !margin0,
      margin: margin0 ? { top: 0, right: 0, bottom: 0, left: 0 } : undefined,
    }));
}

const coverPageHtml = (inner, ts) =>
  htmlDocument({
    title: 'Cover',
    css: `@page{size:${ts.width}in ${ts.height}in;margin:0}html,body{margin:0;padding:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}`,
    body: inner,
    fontsHref: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700;900&family=Inter:wght@400;600;700;800;900&display=swap',
  });

// pdf-lib standard fonts only cover WinAnsi; replace anything else for running heads.
function winAnsi(font, text) {
  let out = '';
  for (const ch of String(text || '')) {
    try { font.encodeText(ch); out += ch; } catch { out += ch === '₦' ? 'N' : ''; }
  }
  return out;
}

/**
 * sections: [{ key, html, kind: 'cover'|'section'|'toc', title, recto: bool, noFolio: bool, noHeader: bool }]
 */
async function assemble({ sections, ts, book, theme, tocBuilder, rectoStarts = true }) {
  const rendered = [];
  for (const s of sections) {
    if (s.kind === 'toc') { rendered.push({ ...s, pdf: null, pages: 0 }); continue; }
    const bytes = await htmlToPdf(s.html, ts, { margin0: s.kind === 'cover' });
    const doc = await PDFDocument.load(bytes);
    rendered.push({ ...s, pdf: doc, pages: doc.getPageCount() });
  }

  // First TOC pass (placeholder numbers) to learn how many pages it needs.
  const tocIdx = rendered.findIndex((s) => s.kind === 'toc');
  if (tocIdx >= 0) {
    const doc = await PDFDocument.load(await htmlToPdf(tocBuilder({}), ts));
    rendered[tocIdx].pdf = doc;
    rendered[tocIdx].pages = doc.getPageCount();
  }

  // Lay out: page numbers count from the first page after the cover.
  const layout = (list) => {
    let page = 0;
    const starts = {};
    for (const s of list) {
      if (s.kind === 'cover') { s.blanksBefore = 0; continue; }
      s.blanksBefore = rectoStarts && s.recto && page % 2 === 1 ? 1 : 0;
      page += s.blanksBefore;
      s.startPage = page + 1;
      if (s.chapterId) starts[s.chapterId] = s.startPage;
      page += s.pages;
    }
    return starts;
  };
  let starts = layout(rendered);
  if (tocIdx >= 0) {
    let doc = await PDFDocument.load(await htmlToPdf(tocBuilder(starts), ts));
    if (doc.getPageCount() !== rendered[tocIdx].pages) {
      rendered[tocIdx].pages = doc.getPageCount();
      starts = layout(rendered);
      doc = await PDFDocument.load(await htmlToPdf(tocBuilder(starts), ts));
    }
    rendered[tocIdx].pdf = doc;
  }

  const out = await PDFDocument.create();
  out.setTitle(book.title || 'Book');
  out.setAuthor(book.author_name || '');
  out.setSubject(book.subtitle || '');
  out.setKeywords(['insurance', 'NAICOM', 'NIIRA 2025', book.target_persona || ''].filter(Boolean));
  out.setCreator('InsurePress Studio');
  out.setProducer('InsurePress Studio (Chromium + pdf-lib)');

  const font = await out.embedFont(StandardFonts.Helvetica);
  const fontIt = await out.embedFont(StandardFonts.HelveticaOblique);
  const W = ts.width * PT;
  const H = ts.height * PT;
  const m = ts.margins;
  const grey = rgb(0.39, 0.45, 0.55);
  const bookTitle = winAnsi(fontIt, book.title || '');

  let pageNo = 0;
  for (const s of rendered) {
    for (let b = 0; b < (s.blanksBefore || 0); b++) { out.addPage([W, H]); pageNo++; }
    const copied = await out.copyPages(s.pdf, s.pdf.getPageIndices());
    copied.forEach((p, i) => {
      out.addPage(p);
      if (s.kind === 'cover') return;
      pageNo++;
      const recto = pageNo % 2 === 1;
      if (!s.noFolio) {
        const num = String(pageNo);
        const w = font.widthOfTextAtSize(num, 8.5);
        p.drawText(num, { x: (W - w) / 2, y: (m.bottom * PT) / 2 - 3, size: 8.5, font, color: grey });
      }
      if (i > 0 && !s.noHeader) {
        const text = recto ? winAnsi(font, (s.title || '').toUpperCase()) : bookTitle;
        const f = recto ? font : fontIt;
        const size = recto ? 7 : 8;
        const tw = f.widthOfTextAtSize(text, size);
        const y = H - (m.top * PT) / 2;
        const x = recto ? W - m.outside * PT - tw : m.outside * PT;
        p.drawText(text, { x, y, size, font: f, color: grey });
        p.drawLine({ start: { x: m.outside * PT, y: y - 5 }, end: { x: W - m.outside * PT, y: y - 5 }, thickness: 0.3, color: rgb(0.8, 0.83, 0.87) });
      }
    });
  }
  return { bytes: await out.save(), pageCount: out.getPageCount() };
}

export async function buildBookPdf({ book, brand = {}, chapters, coverConfig, theme, trim, includeCover = true, includeBackCover = true }) {
  const ts = TRIM_SIZES[trim || book.trim_size] || TRIM_SIZES['6x9'];
  const themeId = theme || book.theme_preset || 'executive-navy';
  const ordered = orderChapters(chapters);
  const labels = chapterLabels(ordered);
  const css = bookCss({ themeId, brand, mode: 'print', trim: ts.id });
  const fontsHref = fontsHrefFor(themeId, brand);
  const pageHtml = (body, title) => htmlDocument({ title, css, body, fontsHref });
  const widthPx = Math.round(ts.width * 96);

  const sections = [];
  if (includeCover) sections.push({ kind: 'cover', html: coverPageHtml(renderFrontCover(coverConfig, { widthPx, trim: ts.id }), ts) });
  const front = ordered.filter((c) => c.section_type === 'front_matter');
  const rest = ordered.filter((c) => c.section_type !== 'front_matter');
  const toSection = (c) => ({
    kind: 'section', chapterId: c.id, title: c.title,
    html: pageHtml(renderChapterHtml(c, { label: labels[c.id], book, brand, theme: themeId }), c.title),
    recto: c.matter_subtype !== 'copyright',
    noFolio: ['title_page', 'copyright', 'dedication'].includes(c.matter_subtype),
    noHeader: c.section_type === 'front_matter',
  });
  front.forEach((c) => sections.push(toSection(c)));
  sections.push({ kind: 'toc', title: 'Contents', recto: true, noHeader: true });
  rest.forEach((c) => sections.push(toSection(c)));
  if (includeCover && includeBackCover) sections.push({ kind: 'cover', html: coverPageHtml(renderBackCover(coverConfig, { widthPx, trim: ts.id, book }), ts) });

  const tocBuilder = (pages) => pageHtml(renderTocHtml(ordered, { labels, pages }), 'Contents');
  return assemble({ sections, ts, book, theme: themeId, tocBuilder });
}

/** Standalone branded mini-PDF made from selected worksheets/checklists. */
export async function buildLeadMagnetPdf({ book, brand = {}, chapters, cta, theme, trim = 'A4', headline }) {
  const ts = TRIM_SIZES[trim] || TRIM_SIZES.A4;
  const themeId = theme || 'bold-workbook';
  const css = bookCss({ themeId, brand, mode: 'print', trim: ts.id });
  const fontsHref = fontsHrefFor(themeId, brand);
  const primary = brand.primary_color || '#0F2942';
  const accent = brand.accent_color || '#D97706';
  const title = headline || (chapters.length === 1 ? chapters[0].title : 'Your Free Insurance Readiness Toolkit');

  const coverHtml = `<div style="width:${ts.width}in;height:${ts.height}in;background:${esc(primary)};color:#fff;position:relative;font-family:Inter,'DejaVu Sans',sans-serif;box-sizing:border-box;padding:1in">
  <div style="position:absolute;left:0;right:0;top:0;height:.35in;background:${esc(accent)}"></div>
  <div style="font-size:13pt;letter-spacing:.25em;text-transform:uppercase;color:${esc(accent)};font-weight:800;margin-top:1.2in">Free Toolkit</div>
  <div style="font-family:Merriweather,'DejaVu Serif',serif;font-size:34pt;font-weight:900;line-height:1.1;margin-top:.25in">${esc(title)}</div>
  <div style="width:1.4in;height:.08in;background:${esc(accent)};margin:.35in 0"></div>
  <div style="font-size:13pt;line-height:1.5;opacity:.9;max-width:80%">Printable worksheets and checklists from <em>${esc(book.title)}</em>${book.author_name ? ` by ${esc(book.author_name)}` : ''}.</div>
  <div style="position:absolute;left:1in;bottom:.9in;font-size:10pt;opacity:.8">${esc(brand.name || '')} · NAICOM-licensed insurance broker</div>
</div>`;
  const sections = [{ kind: 'cover', html: coverPageHtml(coverHtml, ts) }];
  for (const c of chapters) {
    sections.push({ kind: 'section', chapterId: c.id, title: c.title, recto: false,
      html: htmlDocument({ title: c.title, css, fontsHref, body: renderChapterHtml(c, { label: 'Worksheet', book, brand, theme: themeId }) }) });
  }
  if (cta) {
    const block = blockToHtml('ctaCard', {
      eyebrow: 'Next step', headline: `Want the full book? Get “${book.title}”`,
      body: 'Go deeper with real Naira case studies, plain-English explanations of NAICOM and NIIRA 2025 rules, and every checklist in one place.',
      buttonLabel: cta.label, url: cta.url, qrDataUrl: cta.qr, promoCode: cta.promo_code || '',
    });
    const disclaimer = `<p style="font-size:8pt;color:#64748b;margin-top:2em">${esc(brand.default_disclaimer || '')}</p>`;
    sections.push({ kind: 'section', title: 'Next step', recto: false, noHeader: true,
      html: htmlDocument({ title: 'Next', css, fontsHref, body: `<section class="ip-chapter"><header class="ip-ch-head"><h1>Ready for the full picture?</h1></header><div class="ip-ch-body">${block}${disclaimer}</div></section>` }) });
  }
  return assemble({ sections, ts, book, theme: themeId, tocBuilder: null, rectoStarts: false });
}

export async function renderCoverPng(coverConfig, { trim = '6x9', part = 'front', widthPx = 1200, book = {} } = {}) {
  const ts = TRIM_SIZES[trim] || TRIM_SIZES['6x9'];
  const h = Math.round((widthPx * ts.height) / ts.width);
  const inner = part === 'back' ? renderBackCover(coverConfig, { widthPx, trim, book }) : renderFrontCover(coverConfig, { widthPx, trim });
  const html = coverPageHtml(inner, ts);
  return withPage(html, (page) => page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: widthPx, height: h } }), { viewport: { width: widthPx, height: h } });
}

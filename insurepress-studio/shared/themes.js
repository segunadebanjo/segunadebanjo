// Publishing themes + the CSS/HTML used by the live previewer and every exporter.
import { esc, docToHtml } from './render.js';
import { TRIM_SIZES, googleFontsHref, DEFAULT_DISCLAIMER } from './constants.js';

export const THEMES = {
  'executive-navy': {
    id: 'executive-navy', name: 'Executive Navy',
    description: 'Boardroom-ready serif, navy chapter bands, gold rules.',
    headingFont: 'Merriweather', bodyFont: 'Source Serif 4', baseSize: 11, lineHeight: 1.55,
    dropCap: true, ornament: '◆ ◆ ◆', paragraph: 'indent', chapterAlign: 'left', band: true,
  },
  'modern-editorial': {
    id: 'modern-editorial', name: 'Modern Editorial',
    description: 'Magazine-style display headings with generous white space.',
    headingFont: 'Playfair Display', bodyFont: 'Lora', baseSize: 11, lineHeight: 1.6,
    dropCap: true, ornament: '— ✦ —', paragraph: 'indent', chapterAlign: 'center', band: false,
  },
  'warm-advisory': {
    id: 'warm-advisory', name: 'Warm Advisory',
    description: 'Friendly and reassuring, warm paper tones, rounded callouts.',
    headingFont: 'Lora', bodyFont: 'Nunito Sans', baseSize: 11, lineHeight: 1.65,
    dropCap: false, ornament: '❦', paragraph: 'block', chapterAlign: 'center', band: false, warm: true,
  },
  'clean-minimal': {
    id: 'clean-minimal', name: 'Clean Minimal',
    description: 'Swiss-style sans serif, quiet greys, accent colour only where it counts.',
    headingFont: 'Inter', bodyFont: 'Inter', baseSize: 10.5, lineHeight: 1.6,
    dropCap: false, ornament: '', paragraph: 'block', chapterAlign: 'left', band: false,
  },
  'bold-workbook': {
    id: 'bold-workbook', name: 'Bold Workbook',
    description: 'Chunky headings and high-contrast blocks for worksheets and checklists.',
    headingFont: 'Montserrat', bodyFont: 'DM Sans', baseSize: 11, lineHeight: 1.55,
    dropCap: false, ornament: '■■■', paragraph: 'block', chapterAlign: 'left', band: true, bold: true,
  },
};

export const DEVICE_PREVIEWS = {
  print6x9: { id: 'print6x9', label: '6" × 9" Print Spread', mode: 'print', trim: '6x9' },
  a5: { id: 'a5', label: 'A5 Paperback', mode: 'print', trim: 'A5' },
  ereader: { id: 'ereader', label: 'E-Reader (Kindle / EPUB)', mode: 'ebook', width: 380, height: 560 },
  tablet: { id: 'tablet', label: 'Tablet', mode: 'ebook', width: 620, height: 820 },
};

const serif = 'Georgia, "DejaVu Serif", "Times New Roman", serif';
const sans = '"Inter", "Helvetica Neue", Arial, "DejaVu Sans", sans-serif';
const fontStack = (f) => {
  const isSerif = /Merriweather|Serif|Lora|Playfair|Baskerville|Garamond/.test(f);
  return `"${f}", ${isSerif ? serif : sans}`;
};

export function themeFonts(themeId, brand) {
  const t = THEMES[themeId] || THEMES['executive-navy'];
  const heading = themeId === 'executive-navy' && brand?.heading_font ? brand.heading_font : t.headingFont;
  const body = themeId === 'executive-navy' && brand?.body_font && brand.body_font !== 'Inter' ? brand.body_font : t.bodyFont;
  return { heading, body };
}

export function fontsHrefFor(themeId, brand) {
  const f = themeFonts(themeId, brand);
  return googleFontsHref([f.heading, f.body, 'Inter']);
}

// ---- CSS ------------------------------------------------------------------------------------

export function blockCss() {
  return `
.ip-block{margin:1.3em 0;border-radius:var(--ip-radius);break-inside:avoid;page-break-inside:avoid;font-size:.92em;line-height:1.45;text-indent:0;font-family:var(--ip-ui-font)}
.ip-block p{margin:.35em 0;text-indent:0;text-align:left;hyphens:manual}
.ip-block-title{font-family:var(--ip-heading-font);font-size:1.12em;margin:.15em 0 .35em;line-height:1.25;color:var(--ip-primary)}
.ip-eyebrow{display:inline-flex;align-items:center;gap:.35em;font-size:.72em;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:var(--ip-accent)}
.ip-eyebrow svg,.ip-pain-badge svg,.ip-myth-label svg{flex:none}
.ip-pain{border:1.5px solid #f3c27a;background:#fff8ec;padding:.9em 1.1em;border-left:6px solid #d97706}
.ip-pain.ip-sev-critical{border-color:#f2a3a3;background:#fff1f1;border-left-color:#b91c1c}
.ip-pain.ip-sev-medium{border-color:#cbd5e1;background:#f8fafc;border-left-color:var(--ip-secondary)}
.ip-pain-badge{display:inline-flex;align-items:center;gap:.4em;background:#d97706;color:#fff;font-size:.68em;font-weight:800;letter-spacing:.1em;text-transform:uppercase;padding:.3em .7em;border-radius:99px}
.ip-sev-critical .ip-pain-badge{background:#b91c1c}.ip-sev-medium .ip-pain-badge{background:var(--ip-secondary)}
.ip-case{border:1px solid var(--ip-line);background:#fff;overflow:hidden}
.ip-case-head{background:var(--ip-primary);color:#fff;padding:.75em 1em}
.ip-case-head .ip-block-title{color:#fff;margin:.2em 0 0}
.ip-case-head .ip-eyebrow{color:var(--ip-accent-light)}
.ip-case-grid{display:block}
.ip-case-cell{padding:.65em .9em;border-bottom:1px solid var(--ip-line)}
.ip-case-cell:last-child{border-bottom:0}
.ip-case-outs{display:flex;gap:.6em}.ip-case-outs > .ip-case-out{flex:1;margin:.3em 0}
.ip-case-label{font-size:.68em;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--ip-secondary);margin-bottom:.35em}
.ip-case-out{border-radius:6px;padding:.4em .55em;margin:.3em 0}
.ip-case-out p{margin:.15em 0 0;font-size:.95em}
.ip-case-bad{background:#fef2f2}.ip-case-good{background:#ecfdf5}
.ip-case-amt{display:block;font-weight:800;font-size:1.08em;font-family:var(--ip-ui-font)}
.ip-case-bad .ip-case-amt{color:#b91c1c}.ip-case-good .ip-case-amt{color:#047857}
.ip-case-tag{font-size:.65em;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:#64748b}
.ip-case-lesson{background:var(--ip-accent-wash)}
.ip-jargon{background:var(--ip-primary-wash);border:1px solid var(--ip-line);padding:.9em 1.1em}
.ip-jargon-term .ip-block-title{margin-bottom:.5em}
.ip-jargon-row{display:grid;grid-template-columns:7.5em 1fr;gap:.8em;padding:.4em 0;border-top:1px dashed var(--ip-line)}
.ip-jargon-label{font-size:.7em;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--ip-secondary);padding-top:.25em}
.ip-jargon-tech{font-style:italic;color:#475569}.ip-jargon-plain{font-weight:600;color:var(--ip-primary)}
.ip-compare{margin-left:0;margin-right:0}
.ip-compare .ip-block-title{display:block;margin-bottom:.5em}
.ip-compare table,.ip-table{width:100%;border-collapse:collapse;font-size:.92em}
.ip-compare th{background:var(--ip-primary);color:#fff;text-align:left;padding:.5em .6em;font-weight:700}
.ip-compare th:first-child{background:var(--ip-secondary)}
.ip-compare td,.ip-table td,.ip-table th{border:1px solid var(--ip-line);padding:.45em .6em;vertical-align:top}
.ip-compare td:first-child{font-weight:700;background:#f8fafc}
.ip-compare tbody tr:nth-child(even) td:not(:first-child){background:#fbfcfe}
.ip-myth{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--ip-line);overflow:hidden}
.ip-myth-side{padding:.85em 1em}
.ip-myth-myth{background:#fef2f2}.ip-myth-fact{background:#ecfdf5}
.ip-myth-label{display:flex;align-items:center;gap:.35em;font-weight:800;text-transform:uppercase;letter-spacing:.1em;font-size:.75em;margin-bottom:.25em}
.ip-myth-myth .ip-myth-label{color:#b91c1c}.ip-myth-fact .ip-myth-label{color:#047857}
.ip-myth-myth p{text-decoration:line-through;text-decoration-color:rgba(185,28,28,.45);color:#7f1d1d}
.ip-check{border:2px solid var(--ip-primary);padding:.9em 1.1em;background:#fff}
.ip-check ul{list-style:none;margin:.5em 0;padding:0}
.ip-check li{display:flex;gap:.65em;align-items:flex-start;padding:.38em 0;border-bottom:1px dotted var(--ip-line)}
.ip-box{flex:none;width:1em;height:1em;border:2px solid var(--ip-primary);border-radius:3px;margin-top:.15em;background:#fff}
.ip-check-intro{color:#475569;font-style:italic}
.ip-check-score{font-size:.78em;color:#64748b;text-align:right;margin-top:.4em}
.ip-cta{display:flex;gap:1em;align-items:center;justify-content:space-between;background:var(--ip-primary);color:#fff;padding:1em 1.15em;border:3px solid var(--ip-accent)}
.ip-cta .ip-block-title{color:#fff}
.ip-cta .ip-eyebrow{color:var(--ip-accent-light)}
.ip-cta-text{flex:1;min-width:0}
.ip-cta p{color:#e2e8f0}
.ip-cta-btn{display:inline-block;margin-top:.4em;background:var(--ip-accent);color:#fff!important;text-decoration:none;font-weight:800;padding:.45em .9em;border-radius:6px;font-size:.9em}
.ip-cta-promo{margin-top:.5em;font-size:.82em;color:#fde68a}
.ip-cta-url{font-size:.72em;color:#cbd5e1;margin-top:.25em;word-break:break-all}
.ip-cta-qr{flex:none;width:6.4em;height:6.4em;background:#fff;padding:.3em;border-radius:6px}
.ip-cta-qr-empty{display:flex;align-items:center;justify-content:center;color:#94a3b8;font-weight:800}
`;
}

function hexToRgb(hex) {
  const h = String(hex || '#0F2942').replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) || 0);
}
const mix = (hex, pct) => {
  const [r, g, b] = hexToRgb(hex);
  const m = (c) => Math.round(c + (255 - c) * pct);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
};


export function cssVars(themeId, brand = {}) {
  const t = THEMES[themeId] || THEMES['executive-navy'];
  const fonts = themeFonts(t.id, brand);
  const primary = brand.primary_color || '#0F2942';
  const accent = brand.accent_color || '#D97706';
  const secondary = brand.secondary_color || '#334155';
  const minimal = t.id === 'clean-minimal';
  return `--ip-primary:${primary};--ip-accent:${accent};--ip-secondary:${secondary};--ip-line:${mix(secondary, 0.78)};
--ip-primary-wash:${mix(primary, 0.93)};--ip-accent-wash:${mix(accent, 0.88)};--ip-accent-light:${mix(accent, 0.45)};
--ip-heading-font:${fontStack(fonts.heading)};--ip-body-font:${fontStack(fonts.body)};--ip-ui-font:${t.bold ? fontStack(fonts.body) : fontStack('Inter')};
--ip-radius:${t.warm ? '14px' : minimal ? '4px' : t.bold ? '2px' : '8px'};`;
}

/** Block styles scoped to a container (used inside the editor so app styles are untouched). */
export function scopedBlockCss(selector, { themeId = 'executive-navy', brand = {} } = {}) {
  return `${selector}{${cssVars(themeId, brand)}}` + blockCss();
}

/**
 * Full book stylesheet.
 * mode: 'print' (paged, for PDF/print preview) | 'ebook' (reflowable, for EPUB and e-reader preview) | 'screen'
 */
export function bookCss({ themeId = 'executive-navy', brand = {}, mode = 'print', trim = '6x9' } = {}) {
  const t = THEMES[themeId] || THEMES['executive-navy'];
  const fonts = themeFonts(t.id, brand);
  const primary = brand.primary_color || '#0F2942';
  const accent = brand.accent_color || '#D97706';
  const secondary = brand.secondary_color || '#334155';
  const ts = TRIM_SIZES[trim] || TRIM_SIZES['6x9'];
  const minimal = t.id === 'clean-minimal';
  const paper = t.warm ? '#fffaf3' : '#ffffff';

  const pageRules = mode === 'print'
    ? `@page{size:${ts.width}in ${ts.height}in;margin:${ts.margins.top}in ${ts.margins.outside}in ${ts.margins.bottom}in ${ts.margins.inside}in}
@page :left{margin-left:${ts.margins.outside}in;margin-right:${ts.margins.inside}in}
@page :right{margin-left:${ts.margins.inside}in;margin-right:${ts.margins.outside}in}
@page cover{margin:0}
.ip-chapter{break-before:page;page-break-before:always}
.ip-chapter:first-child{break-before:auto;page-break-before:auto}`
    : '';

  return `${pageRules}
:root{${cssVars(t.id, brand)}}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:${paper};color:#1e293b;font-family:var(--ip-body-font);font-size:${t.baseSize}pt;line-height:${t.lineHeight};hyphens:auto;-webkit-hyphens:auto}
p{margin:0 0 ${t.paragraph === 'indent' ? '0' : '.75em'};orphans:2;widows:2;text-align:${mode === 'print' ? 'justify' : 'left'}}
${t.paragraph === 'indent' ? '.ip-ch-body > p + p{text-indent:1.4em}' : ''}
h1,h2,h3,h4{font-family:var(--ip-heading-font);color:var(--ip-primary);line-height:1.25;break-after:avoid;page-break-after:avoid}
h2{font-size:1.38em;margin:1.4em 0 .5em;${t.bold ? 'text-transform:uppercase;letter-spacing:.02em;' : ''}${minimal ? 'font-weight:700;' : ''}}
h3{font-size:1.15em;margin:1.2em 0 .4em;color:${minimal ? '#0f172a' : 'var(--ip-secondary)'}}
h4{font-size:1em;margin:1em 0 .3em}
a{color:var(--ip-accent)}
ul,ol{margin:.4em 0 .9em;padding-left:1.4em}li{margin:.2em 0}li p{margin:0;text-indent:0!important}
blockquote{margin:1em 0;padding:.6em 1em;border-left:4px solid var(--ip-accent);background:var(--ip-accent-wash);font-style:italic}
blockquote p{text-indent:0!important;margin:0}
hr{border:0;text-align:center;margin:1.5em 0}hr:after{content:"${t.ornament || '* * *'}";color:var(--ip-accent);letter-spacing:.4em}
mark{background:#fde68a}
img{max-width:100%}
.ip-ch-head{margin:${mode === 'print' ? '0.6in' : '1.2em'} 0 1.6em;text-align:${t.chapterAlign}}
${t.band ? `.ip-ch-head{border-top:${t.bold ? '10px' : '5px'} solid var(--ip-primary);padding-top:1.1em}` : ''}
.ip-ch-label{font-family:var(--ip-ui-font);font-size:.72em;letter-spacing:.22em;text-transform:uppercase;font-weight:700;color:var(--ip-accent);margin-bottom:.6em}
.ip-ch-head h1{font-size:${t.bold ? '2.1em' : '1.95em'};margin:0;${t.bold ? 'text-transform:uppercase;font-weight:800;' : 'font-weight:700;'}${t.id === 'modern-editorial' ? 'font-style:italic;font-weight:600;' : ''}}
.ip-ch-sub{font-family:var(--ip-heading-font);font-style:italic;color:var(--ip-secondary);margin:.5em 0 0;font-size:1.05em;text-align:inherit!important}
.ip-ornament{color:var(--ip-accent);letter-spacing:.3em;margin:.7em 0 0;font-size:.8em}
${t.dropCap ? `.ip-sec-body .ip-ch-body > p:first-child::first-letter{float:left;font-family:var(--ip-heading-font);font-size:3.4em;line-height:.85;padding:.06em .08em 0 0;color:var(--ip-primary);font-weight:700}` : ''}
.ip-ch-body > p:first-child{text-indent:0}
/* Front & back matter */
.ip-sub-title_page .ip-ch-head{display:none}
.ip-titlepage{text-align:center;padding-top:${mode === 'print' ? '1.4in' : '2em'}}
.ip-titlepage h1{font-size:2.2em;margin:0 0 .4em;color:var(--ip-primary)}
.ip-titlepage .ip-tp-sub{font-family:var(--ip-heading-font);font-style:italic;font-size:1.1em;color:var(--ip-secondary);margin:0 auto 2.4em;max-width:85%;text-align:center}
.ip-titlepage .ip-tp-author{font-family:var(--ip-ui-font);letter-spacing:.18em;text-transform:uppercase;font-weight:700;color:var(--ip-accent);text-align:center}
.ip-titlepage .ip-tp-pub{margin-top:${mode === 'print' ? '2.6in' : '3em'};font-size:.85em;color:#64748b;text-align:center}
.ip-sub-copyright{font-size:.72em;line-height:1.4}.ip-sub-copyright p{text-align:left;text-indent:0!important;margin-bottom:.55em}.ip-sub-copyright .ip-ch-head{margin-top:0}
.ip-sub-copyright .ip-ch-head h1{font-size:1.2em}
.ip-sub-dedication .ip-ch-body{text-align:center;font-style:italic;padding-top:1.5in}.ip-sub-dedication .ip-ch-body p{text-align:center}
.ip-sub-dedication .ip-ch-head{display:none}
.ip-sub-glossary .ip-ch-body p{text-indent:0!important}
/* Table of contents */
.ip-toc h1{font-size:1.6em;margin:${mode === 'print' ? '0.5in' : '1em'} 0 1em}
.ip-toc ol{list-style:none;padding:0;margin:0}
.ip-toc li{display:flex;align-items:baseline;gap:.4em;margin:.45em 0;font-family:var(--ip-ui-font);font-size:.92em}
.ip-toc li .ip-toc-label{color:var(--ip-accent);font-weight:700;font-size:.8em;min-width:6.2em;white-space:nowrap;text-transform:uppercase;letter-spacing:.06em}
.ip-toc li .ip-toc-title{flex:0 1 auto}
.ip-toc li .ip-toc-dots{flex:1;border-bottom:1px dotted #94a3b8;transform:translateY(-.3em);min-width:1em}
.ip-toc li .ip-toc-page{font-weight:700;color:var(--ip-primary);min-width:1.6em;text-align:right}
.ip-toc li.ip-toc-matter .ip-toc-title{font-style:italic;color:#475569}
.ip-toc a{color:inherit;text-decoration:none}
${blockCss()}
${mode === 'ebook' ? `body{padding:0 1em}.ip-myth{display:block}.ip-case-outs{display:block}.ip-cta{display:block}.ip-cta-qr{margin-top:.8em}.ip-jargon-row{display:block}` : ''}
`;
}

// ---- HTML assembly ------------------------------------------------------------------------

export function chapterLabels(chapters) {
  const labels = {};
  let n = 0;
  let w = 0;
  for (const c of chapters) {
    if (c.section_type === 'body' && c.matter_subtype !== 'introduction') labels[c.id] = c.matter_subtype === 'case_study' ? 'Case Study' : `Chapter ${++n}`;
    else if (c.section_type === 'workbook') labels[c.id] = `Workbook ${++w}`;
    else labels[c.id] = '';
  }
  return labels;
}

export const SECTION_ORDER = ['front_matter', 'body', 'workbook', 'back_matter'];
export function orderChapters(chapters = []) {
  return [...chapters].sort(
    (a, b) => SECTION_ORDER.indexOf(a.section_type) - SECTION_ORDER.indexOf(b.section_type) || (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id,
  );
}

function parseJson(v) {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
}

export function chapterBodyHtml(ch, ctx = {}) {
  const doc = parseJson(ch.content_json);
  if (doc) return docToHtml(doc, ctx);
  return ch.content_html || '';
}

export function renderChapterHtml(ch, { label = '', book = {}, brand = {}, theme } = {}) {
  const t = THEMES[theme] || THEMES['executive-navy'];
  const ctx = { currency: book.currency || 'NGN' };
  const sub = ch.matter_subtype || 'chapter';
  let body = chapterBodyHtml(ch, ctx);
  if (sub === 'title_page') {
    body = `<div class="ip-titlepage"><h1>${esc(book.title)}</h1>${book.subtitle ? `<p class="ip-tp-sub">${esc(book.subtitle)}</p>` : ''}
<div class="ip-tp-author">${esc(book.author_name || '')}</div><div class="ip-tp-pub">${esc(brand.name || '')}</div></div>${body}`;
  }
  const showOrn = ch.section_type === 'body' || ch.section_type === 'workbook';
  return `<section class="ip-chapter ip-sec-${esc(ch.section_type)} ip-sub-${esc(sub)}" id="ch-${esc(ch.id)}" data-title="${esc(ch.title)}">
<header class="ip-ch-head">${label ? `<div class="ip-ch-label">${esc(label)}</div>` : ''}<h1>${esc(ch.title)}</h1>${ch.subtitle ? `<p class="ip-ch-sub">${esc(ch.subtitle)}</p>` : ''}${showOrn && t.ornament ? `<div class="ip-ornament">${esc(t.ornament)}</div>` : ''}</header>
<div class="ip-ch-body">${body}</div></section>`;
}

export function renderTocHtml(chapters, { labels = {}, pages = {} } = {}) {
  const items = chapters
    .filter((c) => !['title_page', 'copyright', 'dedication'].includes(c.matter_subtype))
    .map((c) => `<li class="${labels[c.id] ? '' : 'ip-toc-matter'}"><span class="ip-toc-label">${esc(labels[c.id] || '')}</span><a class="ip-toc-title" href="#ch-${c.id}">${esc(c.title)}</a><span class="ip-toc-dots"></span><span class="ip-toc-page">${pages[c.id] ?? ''}</span></li>`)
    .join('');
  return `<section class="ip-chapter ip-toc" id="toc"><h1>Contents</h1><ol>${items}</ol></section>`;
}

export function htmlDocument({ title = '', css = '', body = '', fontsHref = '', extraHead = '' }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>${fontsHref ? `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/><link rel="stylesheet" href="${fontsHref}"/>` : ''}
<style>${css}</style>${extraHead}</head><body>${body}</body></html>`;
}

/** Whole-book HTML for the live previewer (TOC without page numbers). */
export function renderBookBody({ book, brand, chapters, theme, includeToc = true }) {
  const ordered = orderChapters(chapters);
  const labels = chapterLabels(ordered);
  const front = ordered.filter((c) => c.section_type === 'front_matter');
  const rest = ordered.filter((c) => c.section_type !== 'front_matter');
  const r = (c) => renderChapterHtml(c, { label: labels[c.id], book, brand, theme });
  return front.map(r).join('') + (includeToc ? renderTocHtml(ordered, { labels }) : '') + rest.map(r).join('');
}

export function ensureDisclaimer(text) {
  return text && text.trim() ? text : DEFAULT_DISCLAIMER;
}

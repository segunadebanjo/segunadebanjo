// Single source of truth for turning TipTap JSON (including the 7 insurance visual blocks)
// into HTML. Used by the editor node views, the live previewer, and the PDF/EPUB exporters,
// so a block looks the same everywhere.

import { fmtMoney } from './constants.js';

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Light inline formatting inside block fields: **bold**, *italic*, line breaks.
const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
    .replace(/\n/g, '<br/>');

const ICONS = {
  warning:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  book:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  x:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  file:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
};

// ---- Block catalogue (default data + metadata) ---------------------------------------------

export const BLOCK_TYPES = {
  painPoint: {
    label: 'Pain-Point Spotlight',
    description: 'Highlight a reader fear with a warning badge',
    defaults: {
      badge: 'Real Risk',
      title: 'What happens if your shop burns down tonight?',
      body: 'Most SME owners in Lagos keep their entire stock in one location. One electrical fault and ten years of work can disappear before the fire service arrives.',
      severity: 'high',
    },
  },
  claimCase: {
    label: 'Claim Case Study Card',
    description: 'Incident | Uninsured vs Insured | Broker lesson',
    defaults: {
      title: 'The Warehouse Fire in Apapa',
      incident: 'An electrical fault spread through a 40ft container store of imported fabric at 2 a.m.',
      uninsuredOutcome: 'Owner absorbs the full loss and borrows at 30% to restock.',
      uninsuredAmount: 42000000,
      insuredOutcome: 'Fire & Special Perils policy pays stock value less a 10% excess within 45 days.',
      insuredAmount: 37800000,
      lesson: 'Declare stock at full replacement value and update it before peak season — under-insurance triggers the Average Clause.',
      currency: 'NGN',
    },
  },
  jargon: {
    label: 'Jargon → Plain English',
    description: 'Translate a policy clause into everyday words',
    defaults: {
      term: 'Average Clause',
      technical: 'Where the sum insured is less than the value of the property at the time of loss, the insured shall be considered as being their own insurer for the difference and shall bear a rateable share of the loss accordingly.',
      plain: 'If you insure your goods for half of what they are really worth, the insurer will only pay half of any claim — even a small one.',
      example: 'Stock worth ₦20m insured for ₦10m. A ₦4m loss pays only ₦2m.',
    },
  },
  comparison: {
    label: 'Policy Comparison Matrix',
    description: 'Editable multi-column comparison table',
    defaults: {
      title: 'Third-Party vs. Comprehensive Motor',
      columns: ['Feature', 'Third-Party', 'Comprehensive'],
      rows: [
        ['Legally required on Nigerian roads', 'Yes', 'Yes (includes third-party)'],
        ['Damage to other people’s vehicles/property', 'Covered (up to policy limit)', 'Covered'],
        ['Damage to your own vehicle', 'Not covered', 'Covered'],
        ['Theft of your vehicle', 'Not covered', 'Covered'],
        ['Typical annual premium', 'Fixed tariff', 'About 3–5% of vehicle value'],
      ],
    },
  },
  mythFact: {
    label: 'Myth vs. Fact',
    description: 'Debunk a common insurance misconception',
    defaults: {
      myth: 'Insurance companies in Nigeria never pay claims.',
      fact: 'Insurers settle many claims every year. Most rejections trace back to late notification, non-disclosure, unpaid premium or under-insurance — all avoidable with the right broker and paperwork.',
    },
  },
  riskChecklist: {
    label: 'Risk Audit Checklist',
    description: 'Printable checkbox list for readers',
    defaults: {
      title: 'Your 10-Minute Business Risk Audit',
      intro: 'Tick each item you can confidently say “Yes” to today.',
      items: [
        'My stock is insured at today’s replacement value, not last year’s',
        'I have a written list of serial numbers and receipts stored off-site',
        'My premium is fully paid and I have the receipt (No Premium, No Cover)',
        'Group Life cover is in place for all employees',
        'I know the claim notification deadline in my policy',
      ],
    },
  },
  ctaCard: {
    label: 'Monetization & QR Action Card',
    description: 'Branded QR + Selar/Paystack/WhatsApp call to action',
    defaults: {
      ctaId: null,
      eyebrow: 'Free for readers',
      headline: 'Get a Free Policy Gap Audit on WhatsApp',
      body: 'Scan the code or tap the link. Send a photo of your current policy schedule and a licensed broker will show you exactly where you are exposed — within 24 hours.',
      buttonLabel: 'Chat on WhatsApp',
      url: 'https://wa.me/2348000000000',
      qrDataUrl: '',
      promoCode: 'SLEEPSOUNDLY',
      ctaType: 'whatsapp_quote',
    },
  },
};

export function blockToHtml(type, rawData = {}, ctx = {}) {
  const meta = BLOCK_TYPES[type];
  const d = { ...(meta ? meta.defaults : {}), ...(rawData || {}) };
  switch (type) {
    case 'painPoint':
      return `<aside class="ip-block ip-pain ip-sev-${esc(d.severity || 'high')}">
  <div class="ip-pain-badge">${ICONS.warning}<span>${esc(d.badge || 'Real Risk')}</span></div>
  <h4 class="ip-block-title">${inline(d.title)}</h4>
  <p>${inline(d.body)}</p>
</aside>`;
    case 'claimCase': {
      const cur = d.currency || ctx.currency || 'NGN';
      return `<section class="ip-block ip-case">
  <div class="ip-case-head"><span class="ip-eyebrow">${ICONS.file} Real-World Claim Case Study</span><h4 class="ip-block-title">${inline(d.title)}</h4></div>
  <div class="ip-case-grid">
    <div class="ip-case-cell ip-case-incident"><div class="ip-case-label">1 · The Incident</div><p>${inline(d.incident)}</p></div>
    <div class="ip-case-cell ip-case-outcomes"><div class="ip-case-label">2 · Uninsured vs. Insured</div><div class="ip-case-outs">
      <div class="ip-case-out ip-case-bad"><span class="ip-case-amt">${d.uninsuredAmount ? '−' + esc(fmtMoney(d.uninsuredAmount, cur)) : ''}</span><span class="ip-case-tag">Uninsured</span><p>${inline(d.uninsuredOutcome)}</p></div>
      <div class="ip-case-out ip-case-good"><span class="ip-case-amt">${d.insuredAmount ? '+' + esc(fmtMoney(d.insuredAmount, cur)) : ''}</span><span class="ip-case-tag">Insured</span><p>${inline(d.insuredOutcome)}</p></div></div>
    </div>
    <div class="ip-case-cell ip-case-lesson"><div class="ip-case-label">3 · Broker’s Key Lesson</div><p>${inline(d.lesson)}</p></div>
  </div>
</section>`;
    }
    case 'jargon':
      return `<aside class="ip-block ip-jargon">
  <div class="ip-jargon-term"><span class="ip-eyebrow">${ICONS.book} Jargon Buster</span><h4 class="ip-block-title">${inline(d.term)}</h4></div>
  <div class="ip-jargon-row"><div class="ip-jargon-label">Policy wording</div><p class="ip-jargon-tech">“${inline(d.technical)}”</p></div>
  <div class="ip-jargon-row"><div class="ip-jargon-label">In plain English</div><p class="ip-jargon-plain">${inline(d.plain)}</p></div>
  ${d.example ? `<div class="ip-jargon-row"><div class="ip-jargon-label">Example</div><p>${inline(d.example)}</p></div>` : ''}
</aside>`;
    case 'comparison': {
      const cols = Array.isArray(d.columns) ? d.columns : [];
      const rows = Array.isArray(d.rows) ? d.rows : [];
      return `<figure class="ip-block ip-compare">
  ${d.title ? `<figcaption class="ip-block-title">${inline(d.title)}</figcaption>` : ''}
  <table><thead><tr>${cols.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${cols.map((_, i) => `<td>${inline((r || [])[i] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>
</figure>`;
    }
    case 'mythFact':
      return `<section class="ip-block ip-myth">
  <div class="ip-myth-side ip-myth-myth"><div class="ip-myth-label">${ICONS.x} Myth</div><p>${inline(d.myth)}</p></div>
  <div class="ip-myth-side ip-myth-fact"><div class="ip-myth-label">${ICONS.check} Fact</div><p>${inline(d.fact)}</p></div>
</section>`;
    case 'riskChecklist': {
      const items = Array.isArray(d.items) ? d.items : [];
      return `<section class="ip-block ip-check">
  <h4 class="ip-block-title">${inline(d.title)}</h4>
  ${d.intro ? `<p class="ip-check-intro">${inline(d.intro)}</p>` : ''}
  <ul>${items.map((it) => `<li><span class="ip-box"></span><span>${inline(typeof it === 'string' ? it : it?.text)}</span></li>`).join('')}</ul>
  <div class="ip-check-score">Score: ____ / ${items.length} &nbsp;·&nbsp; Date: ____________</div>
</section>`;
    }
    case 'ctaCard': {
      const qr = d.qrDataUrl
        ? `<img class="ip-cta-qr" src="${esc(d.qrDataUrl)}" alt="QR code"/>`
        : `<div class="ip-cta-qr ip-cta-qr-empty">QR</div>`;
      return `<section class="ip-block ip-cta">
  <div class="ip-cta-text">
    ${d.eyebrow ? `<div class="ip-eyebrow">${esc(d.eyebrow)}</div>` : ''}
    <h4 class="ip-block-title">${inline(d.headline)}</h4>
    <p>${inline(d.body)}</p>
    ${d.url ? `<a class="ip-cta-btn" href="${esc(d.url)}">${esc(d.buttonLabel || 'Open link')} →</a>` : ''}
    ${d.promoCode ? `<div class="ip-cta-promo">Reader code: <strong>${esc(d.promoCode)}</strong></div>` : ''}
    ${d.url ? `<div class="ip-cta-url">${esc(String(d.url).replace(/^https?:\/\//, '').split('?')[0])}</div>` : ''}
  </div>
  ${qr}
</section>`;
    }
    default:
      return '';
  }
}

// ---- TipTap JSON -> HTML ------------------------------------------------------------------

function renderMarks(text, marks = []) {
  let out = esc(text);
  for (const m of marks) {
    switch (m.type) {
      case 'bold': out = `<strong>${out}</strong>`; break;
      case 'italic': out = `<em>${out}</em>`; break;
      case 'underline': out = `<u>${out}</u>`; break;
      case 'strike': out = `<s>${out}</s>`; break;
      case 'code': out = `<code>${out}</code>`; break;
      case 'highlight': out = `<mark>${out}</mark>`; break;
      case 'link': out = `<a href="${esc(m.attrs?.href)}">${out}</a>`; break;
      default: break;
    }
  }
  return out;
}

const alignAttr = (node) =>
  node.attrs?.textAlign && node.attrs.textAlign !== 'left' ? ` style="text-align:${esc(node.attrs.textAlign)}"` : '';

export function nodeToHtml(node, ctx = {}) {
  if (!node) return '';
  const kids = () => (node.content || []).map((n) => nodeToHtml(n, ctx)).join('');
  switch (node.type) {
    case 'doc': return kids();
    case 'text': return renderMarks(node.text, node.marks);
    case 'paragraph': return `<p${alignAttr(node)}>${kids() || ''}</p>`;
    case 'heading': {
      const l = Math.min(Math.max(Number(node.attrs?.level) || 2, 1), 4);
      return `<h${l}${alignAttr(node)}>${kids()}</h${l}>`;
    }
    case 'bulletList': return `<ul>${kids()}</ul>`;
    case 'orderedList': return `<ol${node.attrs?.start > 1 ? ` start="${node.attrs.start}"` : ''}>${kids()}</ol>`;
    case 'listItem': return `<li>${kids()}</li>`;
    case 'blockquote': return `<blockquote>${kids()}</blockquote>`;
    case 'horizontalRule': return '<hr/>';
    case 'hardBreak': return '<br/>';
    case 'codeBlock': return `<pre><code>${kids()}</code></pre>`;
    case 'image': return `<img src="${esc(node.attrs?.src)}" alt="${esc(node.attrs?.alt || '')}"/>`;
    case 'table': return `<table class="ip-table"><tbody>${kids()}</tbody></table>`;
    case 'tableRow': return `<tr>${kids()}</tr>`;
    case 'tableHeader': return `<th>${kids()}</th>`;
    case 'tableCell': return `<td>${kids()}</td>`;
    default:
      if (BLOCK_TYPES[node.type]) return blockToHtml(node.type, node.attrs?.data, ctx);
      return kids();
  }
}

export const docToHtml = (doc, ctx) => (doc ? nodeToHtml(doc, ctx) : '');

// ---- Plain-text helpers -------------------------------------------------------------------

function blockText(data) {
  if (!data) return '';
  const parts = [];
  const walk = (v) => {
    if (v == null) return;
    if (typeof v === 'string') { if (!/^data:|^https?:/.test(v)) parts.push(v); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object') Object.entries(v).forEach(([k, x]) => { if (!['ctaId', 'qrDataUrl', 'url', 'currency', 'severity', 'ctaType'].includes(k)) walk(x); });
  };
  walk(data);
  return parts.join(' ');
}

export function docToText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (BLOCK_TYPES[node.type]) return '\n' + blockText(node.attrs?.data) + '\n';
  const inner = (node.content || []).map(docToText).join(node.type === 'doc' ? '\n' : '');
  return ['paragraph', 'heading', 'listItem', 'blockquote'].includes(node.type) ? inner + '\n' : inner;
}

export const countWords = (doc) => (docToText(doc).match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;

// ---- Builders: lightweight "AI block" list -> TipTap JSON ---------------------------------
// The AI service and seed script describe content as simple blocks; this turns them into a doc.

function inlineToNodes(str) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m;
  const s = String(str ?? '');
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ type: 'text', text: s.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('**')) out.push({ type: 'text', text: tok.slice(2, -2), marks: [{ type: 'bold' }] });
    else out.push({ type: 'text', text: tok.slice(1, -1), marks: [{ type: 'italic' }] });
    last = m.index + tok.length;
  }
  if (last < s.length) out.push({ type: 'text', text: s.slice(last) });
  return out.filter((n) => n.text);
}

export const P = (text) => ({ type: 'paragraph', content: inlineToNodes(text) });
export const H = (level, text) => ({ type: 'heading', attrs: { level }, content: inlineToNodes(text) });
export const UL = (items) => ({ type: 'bulletList', content: items.map((t) => ({ type: 'listItem', content: [P(t)] })) });
export const OL = (items) => ({ type: 'orderedList', attrs: { start: 1 }, content: items.map((t) => ({ type: 'listItem', content: [P(t)] })) });
export const QUOTE = (text) => ({ type: 'blockquote', content: [P(text)] });
export const BLOCK = (type, data) => ({ type, attrs: { data: { ...(BLOCK_TYPES[type]?.defaults || {}), ...data } } });

export function aiBlocksToDoc(blocks = []) {
  const content = [];
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue;
    const t = b.type;
    if (t === 'heading') content.push(H(b.level || 2, b.text));
    else if (t === 'paragraph') content.push(P(b.text));
    else if (t === 'bullets') content.push(UL(b.items || []));
    else if (t === 'numbered') content.push(OL(b.items || []));
    else if (t === 'quote') content.push(QUOTE(b.text));
    else if (BLOCK_TYPES[t]) content.push(BLOCK(t, b.data || b.attrs || {}));
  }
  if (!content.length) content.push(P(''));
  return { type: 'doc', content };
}

export const emptyDoc = () => ({ type: 'doc', content: [{ type: 'paragraph' }] });

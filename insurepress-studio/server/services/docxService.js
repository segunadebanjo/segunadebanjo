// Editable DOCX manuscript export (for editors and Nigerian offset/digital print houses).
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, LevelFormat, Packer, PageBreak,
  PageNumber, Paragraph, ShadingType, Table, TableCell, TableOfContents, TableRow, TextRun, WidthType,
} from 'docx';
import { BLOCK_TYPES } from '../../shared/render.js';
import { orderChapters, chapterLabels } from '../../shared/themes.js';
import { fmtMoney, TRIM_SIZES } from '../../shared/constants.js';
import { dataUrlToBuffer } from './assetStore.js';

const hex = (c, d = '0F2942') => String(c || d).replace('#', '').toUpperCase();
const twip = (inches) => Math.round(inches * 1440);

function runsFrom(nodes = [], base = {}) {
  const runs = [];
  for (const n of nodes) {
    if (n.type === 'hardBreak') { runs.push(new TextRun({ break: 1 })); continue; }
    if (n.type !== 'text') continue;
    const marks = (n.marks || []).map((m) => m.type);
    runs.push(new TextRun({
      text: n.text, bold: marks.includes('bold') || base.bold, italics: marks.includes('italic') || base.italics,
      underline: marks.includes('underline') ? {} : undefined, strike: marks.includes('strike'),
      highlight: marks.includes('highlight') ? 'yellow' : undefined, color: base.color, size: base.size,
    }));
  }
  return runs;
}

const plainRuns = (str, opts = {}) => {
  const out = [];
  String(str ?? '').split(/(\*\*[^*]+\*\*)/).forEach((part) => {
    if (!part) return;
    if (part.startsWith('**')) out.push(new TextRun({ ...opts, text: part.slice(2, -2), bold: true }));
    else out.push(new TextRun({ ...opts, text: part }));
  });
  return out;
};

const cell = (children, { fill, width, color } = {}) =>
  new TableCell({
    children: children.length ? children : [new Paragraph('')],
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill: hex(fill) } : undefined,
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    ...(color ? {} : {}),
  });

const boxTable = (rows, borderColor = 'CBD5E1') =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: borderColor }, bottom: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
      left: { style: BorderStyle.SINGLE, size: 6, color: borderColor }, right: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: borderColor }, insideVertical: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
    },
    rows,
  });

const label = (t, color = '64748B') => new Paragraph({ children: [new TextRun({ text: t.toUpperCase(), bold: true, size: 15, color })] });
const para = (t, opts = {}) => new Paragraph({ children: plainRuns(t, opts), spacing: { after: 80 } });

function blockToDocx(type, raw, ctx) {
  const d = { ...(BLOCK_TYPES[type]?.defaults || {}), ...(raw || {}) };
  const P = ctx.primary;
  const A = ctx.accent;
  const spacer = new Paragraph({ text: '', spacing: { after: 120 } });
  switch (type) {
    case 'painPoint':
      return [boxTable([new TableRow({ children: [cell([label(`⚠ ${d.badge || 'Real Risk'}`, 'B45309'), para(d.title, { bold: true, size: 24, color: hex(P) }), para(d.body)], { fill: 'FFF8EC' })] })], 'F3C27A'), spacer];
    case 'claimCase': {
      const cur = d.currency || ctx.currency;
      return [boxTable([
        new TableRow({ children: [new TableCell({ columnSpan: 3, shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(P) }, margins: { top: 100, bottom: 100, left: 140, right: 140 },
          children: [label('Real-World Claim Case Study', hex(A)), new Paragraph({ children: [new TextRun({ text: d.title, bold: true, color: 'FFFFFF', size: 24 })] })] })] }),
        new TableRow({ children: [
          cell([label('1 · The Incident'), para(d.incident)], { width: 30 }),
          cell([label('2 · Uninsured vs. Insured'),
            para(`Uninsured: −${fmtMoney(d.uninsuredAmount, cur)}`, { bold: true, color: 'B91C1C' }), para(d.uninsuredOutcome),
            para(`Insured: +${fmtMoney(d.insuredAmount, cur)}`, { bold: true, color: '047857' }), para(d.insuredOutcome)], { width: 40 }),
          cell([label('3 · Broker’s Key Lesson'), para(d.lesson)], { width: 30, fill: 'FEF3C7' }),
        ] }),
      ]), spacer];
    }
    case 'jargon':
      return [boxTable([
        new TableRow({ children: [cell([label('Jargon Buster', hex(A)), para(d.term, { bold: true, size: 24, color: hex(P) })], { fill: 'EEF2F7' })] }),
        new TableRow({ children: [cell([label('Policy wording'), para(`“${d.technical}”`, { italics: true, color: '475569' })])] }),
        new TableRow({ children: [cell([label('In plain English'), para(d.plain, { bold: true, color: hex(P) })])] }),
        ...(d.example ? [new TableRow({ children: [cell([label('Example'), para(d.example)])] })] : []),
      ]), spacer];
    case 'comparison': {
      const cols = d.columns || [];
      return [
        ...(d.title ? [new Paragraph({ children: [new TextRun({ text: d.title, bold: true, color: hex(P) })], spacing: { after: 80 } })] : []),
        boxTable([
          new TableRow({ tableHeader: true, children: cols.map((c) => cell([new Paragraph({ children: [new TextRun({ text: c, bold: true, color: 'FFFFFF' })] })], { fill: P })) }),
          ...(d.rows || []).map((r) => new TableRow({ children: cols.map((_, i) => cell([para((r || [])[i] ?? '', { bold: i === 0 })], { fill: i === 0 ? 'F8FAFC' : undefined })) })),
        ]), spacer];
    }
    case 'mythFact':
      return [boxTable([new TableRow({ children: [
        cell([label('✖ Myth', 'B91C1C'), para(d.myth, { strike: true, color: '7F1D1D' })], { fill: 'FEF2F2', width: 50 }),
        cell([label('✔ Fact', '047857'), para(d.fact)], { fill: 'ECFDF5', width: 50 }),
      ] })]), spacer];
    case 'riskChecklist':
      return [boxTable([new TableRow({ children: [cell([
        para(d.title, { bold: true, size: 24, color: hex(P) }),
        ...(d.intro ? [para(d.intro, { italics: true, color: '475569' })] : []),
        ...(d.items || []).map((it) => new Paragraph({ children: [new TextRun({ text: '☐  ', size: 26 }), ...plainRuns(typeof it === 'string' ? it : it?.text)], spacing: { after: 60 } })),
        para(`Score: ____ / ${(d.items || []).length}`, { color: '64748B', size: 16 }),
      ])] })], hex(P)), spacer];
    case 'ctaCard': {
      const kids = [
        ...(d.eyebrow ? [label(d.eyebrow, hex(A))] : []),
        para(d.headline, { bold: true, size: 26, color: 'FFFFFF' }),
        para(d.body, { color: 'E2E8F0' }),
        ...(d.url ? [para(`${d.buttonLabel || 'Link'}: ${d.url}`, { bold: true, color: 'FDE68A' })] : []),
        ...(d.promoCode ? [para(`Reader code: ${d.promoCode}`, { color: 'FDE68A' })] : []),
      ];
      const img = d.qrDataUrl ? dataUrlToBuffer(d.qrDataUrl) : null;
      const cells = [cell(kids, { fill: P, width: 75 })];
      if (img) cells.push(cell([new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: img.buffer, transformation: { width: 110, height: 110 } })] })], { fill: 'FFFFFF', width: 25 }));
      return [boxTable([new TableRow({ children: cells })], hex(A)), spacer];
    }
    default:
      return [];
  }
}

function nodesToDocx(nodes = [], ctx, listLevel = null) {
  const out = [];
  for (const n of nodes) {
    switch (n.type) {
      case 'paragraph':
        out.push(new Paragraph({
          children: runsFrom(n.content),
          alignment: n.attrs?.textAlign === 'center' ? AlignmentType.CENTER : n.attrs?.textAlign === 'right' ? AlignmentType.RIGHT : undefined,
          ...(listLevel ? listLevel : {}),
          spacing: { after: 140, line: 300 },
        }));
        break;
      case 'heading': {
        const lv = n.attrs?.level || 2;
        out.push(new Paragraph({ heading: lv <= 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, children: runsFrom(n.content, { color: ctx.primary.replace('#', '') }) }));
        break;
      }
      case 'bulletList':
        for (const li of n.content || []) out.push(...nodesToDocx(li.content, ctx, { bullet: { level: 0 } }));
        break;
      case 'orderedList':
        ctx.listInstance = (ctx.listInstance || 0) + 1;
        for (const li of n.content || []) out.push(...nodesToDocx(li.content, ctx, { numbering: { reference: 'ip-num', level: 0, instance: ctx.listInstance } }));
        break;
      case 'blockquote':
        out.push(...(n.content || []).map((p) => new Paragraph({ children: runsFrom(p.content, { italics: true }), indent: { left: 567 }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: ctx.accent.replace('#', ''), space: 8 } } })));
        break;
      case 'horizontalRule':
        out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('◆ ◆ ◆')] }));
        break;
      case 'table':
        out.push(boxTable((n.content || []).map((row) => new TableRow({ children: (row.content || []).map((c) => cell(nodesToDocx(c.content, ctx), { fill: c.type === 'tableHeader' ? 'E2E8F0' : undefined })) }))));
        break;
      default:
        if (BLOCK_TYPES[n.type]) out.push(...blockToDocx(n.type, n.attrs?.data, ctx));
        else if (n.content) out.push(...nodesToDocx(n.content, ctx, listLevel));
    }
  }
  return out;
}

const parse = (v) => { if (!v) return null; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return null; } };

export async function buildBookDocx({ book, brand = {}, chapters }) {
  const ordered = orderChapters(chapters);
  const labels = chapterLabels(ordered);
  const ts = TRIM_SIZES[book.trim_size] || TRIM_SIZES['6x9'];
  const ctx = { primary: brand.primary_color || '#0F2942', accent: brand.accent_color || '#D97706', currency: book.currency || 'NGN' };
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 300 }, children: [new TextRun({ text: book.title, bold: true, size: 56, color: hex(ctx.primary) })] }),
    ...(book.subtitle ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: book.subtitle, italics: true, size: 28 })] })] : []),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600 }, children: [new TextRun({ text: (book.author_name || '').toUpperCase(), bold: true, color: hex(ctx.accent) })] }),
    new Paragraph({ children: [new PageBreak()] }),
    new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-1' }),
  ];
  for (const c of ordered) {
    if (c.matter_subtype === 'title_page') continue;
    children.push(new Paragraph({ children: [new PageBreak()] }));
    if (labels[c.id]) children.push(new Paragraph({ children: [new TextRun({ text: labels[c.id].toUpperCase(), bold: true, color: hex(ctx.accent), size: 18 })] }));
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: c.title, color: hex(ctx.primary) })] }));
    if (c.subtitle) children.push(new Paragraph({ children: [new TextRun({ text: c.subtitle, italics: true, color: '475569' })], spacing: { after: 300 } }));
    const doc = parse(c.content_json);
    if (doc) children.push(...nodesToDocx(doc.content, ctx));
  }

  const document = new Document({
    creator: book.author_name || 'InsurePress Studio',
    title: book.title,
    description: book.subtitle || '',
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: 'Georgia', size: 22 } }, heading1: { run: { font: 'Georgia', size: 40, bold: true } }, heading2: { run: { font: 'Georgia', size: 30, bold: true } }, heading3: { run: { font: 'Georgia', size: 25, bold: true } } },
    },
    numbering: { config: [{ reference: 'ip-num', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 567, hanging: 340 } } } }] }] },
    sections: [{
      properties: { page: { size: { width: twip(ts.width), height: twip(ts.height) }, margin: { top: twip(ts.margins.top), bottom: twip(ts.margins.bottom), left: twip(ts.margins.inside), right: twip(ts.margins.outside) } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: book.title, italics: true, size: 16, color: '94A3B8' })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18 })] })] }) },
      children,
    }],
  });
  return Packer.toBuffer(document);
}

// Cover renderer shared by the Cover Studio (client), the PDF cover page and the EPUB cover image.
// Sizes are expressed with a --u unit (1% of the front-cover width) so one design scales to any trim.
import { esc } from './render.js';
import { TRIM_SIZES, fmtMoney } from './constants.js';

export const COVER_ICONS = {
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  umbrella: '<path d="M22 12a10.06 10.06 1 0 0-20 0Z"/><path d="M12 12v8a2 2 0 0 0 4 0"/><path d="M12 2v1"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
};

export const COVER_TEMPLATES = {
  'navy-shield': { name: 'Navy Shield', description: 'Authority & trust: deep brand colour, gold band, big icon.' },
  'split-editorial': { name: 'Split Editorial', description: 'Colour block on top, crisp white title panel below.' },
  'bold-type': { name: 'Bold Type', description: 'Oversized title on accent colour — stands out in thumbnails.' },
  'minimal-frame': { name: 'Minimal Frame', description: 'White cover, fine frame, premium consulting feel.' },
  'night-calm': { name: 'Night Calm', description: 'Dark gradient with moon — perfect for “sleep soundly” promises.' },
};

export function defaultCoverConfig(book = {}, brand = {}) {
  return {
    template: 'navy-shield',
    title: book.title || 'Untitled Book',
    subtitle: book.subtitle || '',
    author: book.author_name || '',
    badge: brand.name ? `${brand.name}` : 'Licensed Insurance Broker',
    tagline: 'A plain-English protection guide',
    icon: 'shield',
    bg: brand.primary_color || '#0F2942',
    fg: '#FFFFFF',
    accent: brand.accent_color || '#D97706',
    blurb: book.core_pain_point || 'One fire, one burglary, one rejected claim can wipe out years of hard work. This book shows you, in plain English, how to protect what you have built.',
    authorBio: '',
    isbn: '',
    showQr: true,
    qrDataUrl: '',
    qrCaption: 'Scan for a free policy gap audit',
    showPrice: true,
  };
}

export function spineWidthIn(pageCount = 120) {
  return Math.max(0.12, pageCount * 0.0025 + 0.06); // white paper approx.
}

function iconSvg(name, color, size) {
  const p = COVER_ICONS[name] || COVER_ICONS.shield;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${esc(color)}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}

const pattern = (color) =>
  `background-image:radial-gradient(${color} 1px, transparent 1.2px);background-size:calc(var(--u)*4) calc(var(--u)*4);`;

/** Front cover HTML at the given pixel width (height follows the trim ratio). */
export function renderFrontCover(cfg, { widthPx = 600, trim = '6x9' } = {}) {
  const ts = TRIM_SIZES[trim] || TRIM_SIZES['6x9'];
  const h = Math.round((widthPx * ts.height) / ts.width);
  const c = { ...defaultCoverConfig(), ...cfg };
  const u = widthPx / 100;
  const base = `position:relative;width:${widthPx}px;height:${h}px;overflow:hidden;--u:${u}px;font-family:Inter,'DejaVu Sans',Arial,sans-serif;box-sizing:border-box;`;
  const serif = `font-family:Merriweather,'DejaVu Serif',Georgia,serif;`;
  const titleSize = c.title.length > 40 ? 7.2 : c.title.length > 22 ? 8.6 : 10.5;
  const badge = c.badge ? `<div style="display:inline-block;border:1px solid ${esc(c.accent)};color:${esc(c.accent)};padding:calc(var(--u)*0.9) calc(var(--u)*2.2);border-radius:99px;font-size:calc(var(--u)*2.3);letter-spacing:.14em;text-transform:uppercase;font-weight:700">${esc(c.badge)}</div>` : '';
  let inner = '';
  switch (c.template) {
    case 'split-editorial':
      inner = `<div style="${base}background:#fff;color:${esc(c.bg)}">
  <div style="position:absolute;inset:0 0 46% 0;background:${esc(c.bg)};${pattern('rgba(255,255,255,.08)')}display:flex;align-items:center;justify-content:center">${iconSvg(c.icon, c.accent, u * 34)}</div>
  <div style="position:absolute;left:0;right:0;top:54%;height:calc(var(--u)*1.6);background:${esc(c.accent)}"></div>
  <div style="position:absolute;left:8%;right:8%;top:58.5%;">
    <div style="font-size:calc(var(--u)*2.6);letter-spacing:.2em;text-transform:uppercase;color:${esc(c.accent)};font-weight:700;margin-bottom:calc(var(--u)*1.5)">${esc(c.tagline)}</div>
    <div style="${serif}font-weight:900;font-size:calc(var(--u)*${titleSize});line-height:1.05;color:${esc(c.bg)}">${esc(c.title)}</div>
    <div style="font-size:calc(var(--u)*3);line-height:1.35;color:#475569;margin-top:calc(var(--u)*2.2)">${esc(c.subtitle)}</div>
  </div>
  <div style="position:absolute;left:8%;bottom:4.5%;font-size:calc(var(--u)*3.4);font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${esc(c.bg)}">${esc(c.author)}</div>
</div>`;
      break;
    case 'bold-type':
      inner = `<div style="${base}background:${esc(c.accent)};color:${esc(c.fg)};padding:8%">
  <div style="position:absolute;right:-10%;bottom:12%;opacity:.16">${iconSvg(c.icon, c.fg, u * 80)}</div>
  ${badge.replace(new RegExp(esc(c.accent), 'g'), esc(c.fg))}
  <div style="${serif}font-weight:900;font-size:calc(var(--u)*${titleSize * 1.18});line-height:.98;text-transform:uppercase;margin-top:calc(var(--u)*7);letter-spacing:-.01em">${esc(c.title)}</div>
  <div style="width:calc(var(--u)*18);height:calc(var(--u)*1.4);background:${esc(c.bg)};margin:calc(var(--u)*4) 0"></div>
  <div style="font-size:calc(var(--u)*3.3);line-height:1.35;font-weight:600;max-width:88%">${esc(c.subtitle)}</div>
  <div style="position:absolute;left:8%;bottom:5%;font-size:calc(var(--u)*3.6);font-weight:900;letter-spacing:.1em;text-transform:uppercase">${esc(c.author)}</div>
</div>`;
      break;
    case 'minimal-frame':
      inner = `<div style="${base}background:#fdfcf9;color:${esc(c.bg)};">
  <div style="position:absolute;inset:4.5%;border:1px solid ${esc(c.bg)}"></div>
  <div style="position:absolute;inset:6%;border:calc(var(--u)*0.4) solid ${esc(c.accent)}"></div>
  <div style="position:absolute;left:14%;right:14%;top:14%;text-align:center">
    <div style="display:flex;justify-content:center;margin-bottom:calc(var(--u)*5)">${iconSvg(c.icon, c.accent, u * 16)}</div>
    <div style="${serif}font-weight:700;font-size:calc(var(--u)*${titleSize * 0.92});line-height:1.12">${esc(c.title)}</div>
    <div style="width:calc(var(--u)*10);height:1px;background:${esc(c.accent)};margin:calc(var(--u)*4) auto"></div>
    <div style="${serif}font-style:italic;font-size:calc(var(--u)*3.1);line-height:1.45;color:#475569">${esc(c.subtitle)}</div>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:11%;text-align:center;font-size:calc(var(--u)*3);letter-spacing:.24em;text-transform:uppercase;font-weight:700">${esc(c.author)}</div>
  <div style="position:absolute;left:0;right:0;bottom:7.5%;text-align:center;font-size:calc(var(--u)*2.1);letter-spacing:.14em;text-transform:uppercase;color:${esc(c.accent)}">${esc(c.badge)}</div>
</div>`;
      break;
    case 'night-calm':
      inner = `<div style="${base}background:linear-gradient(170deg, ${esc(c.bg)} 0%, #020617 100%);color:${esc(c.fg)};">
  <div style="position:absolute;inset:0;${pattern('rgba(255,255,255,.10)')}opacity:.6"></div>
  <div style="position:absolute;right:10%;top:7%">${iconSvg('moon', c.accent, u * 22)}</div>
  <div style="position:absolute;left:9%;right:9%;top:32%">
    <div style="font-size:calc(var(--u)*2.5);letter-spacing:.22em;text-transform:uppercase;color:${esc(c.accent)};font-weight:700">${esc(c.tagline)}</div>
    <div style="${serif}font-weight:900;font-size:calc(var(--u)*${titleSize * 1.05});line-height:1.04;margin-top:calc(var(--u)*2.5)">${esc(c.title)}</div>
    <div style="width:calc(var(--u)*14);height:calc(var(--u)*.8);background:${esc(c.accent)};margin:calc(var(--u)*4) 0"></div>
    <div style="font-size:calc(var(--u)*3.15);line-height:1.42;color:rgba(255,255,255,.85)">${esc(c.subtitle)}</div>
  </div>
  <div style="position:absolute;left:9%;bottom:9%;">${badge}</div>
  <div style="position:absolute;left:9%;bottom:4%;font-size:calc(var(--u)*3.4);font-weight:800;letter-spacing:.12em;text-transform:uppercase">${esc(c.author)}</div>
</div>`;
      break;
    case 'navy-shield':
    default:
      inner = `<div style="${base}background:${esc(c.bg)};color:${esc(c.fg)};">
  <div style="position:absolute;inset:0;${pattern('rgba(255,255,255,.06)')}"></div>
  <div style="position:absolute;left:0;right:0;top:0;height:calc(var(--u)*2.4);background:${esc(c.accent)}"></div>
  <div style="position:absolute;left:9%;top:7%">${badge}</div>
  <div style="position:absolute;right:-8%;top:16%;opacity:.95">${iconSvg(c.icon, c.accent, u * 46)}</div>
  <div style="position:absolute;left:9%;right:9%;top:50%">
    <div style="${serif}font-weight:900;font-size:calc(var(--u)*${titleSize});line-height:1.05">${esc(c.title)}</div>
    <div style="width:calc(var(--u)*16);height:calc(var(--u)*1);background:${esc(c.accent)};margin:calc(var(--u)*3.5) 0"></div>
    <div style="font-size:calc(var(--u)*3.1);line-height:1.4;color:rgba(255,255,255,.86)">${esc(c.subtitle)}</div>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:12%;background:rgba(0,0,0,.22);display:flex;align-items:center;padding:0 9%;font-size:calc(var(--u)*3.6);font-weight:800;letter-spacing:.12em;text-transform:uppercase">${esc(c.author)}</div>
</div>`;
  }
  return inner;
}

export function renderBackCover(cfg, { widthPx = 600, trim = '6x9', book = {} } = {}) {
  const ts = TRIM_SIZES[trim] || TRIM_SIZES['6x9'];
  const h = Math.round((widthPx * ts.height) / ts.width);
  const c = { ...defaultCoverConfig(), ...cfg };
  const u = widthPx / 100;
  const light = c.template === 'minimal-frame' || c.template === 'split-editorial';
  const bg = c.template === 'bold-type' ? c.accent : light ? '#fdfcf9' : c.bg;
  const fg = light ? c.bg : c.fg;
  return `<div style="position:relative;width:${widthPx}px;height:${h}px;overflow:hidden;--u:${u}px;background:${esc(bg)};color:${esc(fg)};font-family:Inter,'DejaVu Sans',Arial,sans-serif;box-sizing:border-box;padding:10% 9%">
  <div style="font-family:Merriweather,'DejaVu Serif',Georgia,serif;font-weight:800;font-size:calc(var(--u)*5);line-height:1.2;color:${esc(c.template === 'bold-type' ? c.fg : c.accent)}">${esc(c.tagline || 'Protect what you have built.')}</div>
  <div style="font-size:calc(var(--u)*3.15);line-height:1.6;margin-top:calc(var(--u)*4);white-space:pre-line">${esc(c.blurb)}</div>
  ${c.authorBio ? `<div style="font-size:calc(var(--u)*2.6);line-height:1.5;margin-top:calc(var(--u)*5);padding-top:calc(var(--u)*3);border-top:1px solid currentColor;opacity:.85"><strong>About the author.</strong> ${esc(c.authorBio)}</div>` : ''}
  <div style="position:absolute;left:9%;right:9%;bottom:7%;display:flex;align-items:flex-end;justify-content:space-between;gap:4%">
    ${c.showQr ? `<div style="display:flex;align-items:center;gap:calc(var(--u)*2.5)"><div style="background:#fff;padding:calc(var(--u)*1);border-radius:calc(var(--u)*1)">${c.qrDataUrl ? `<img src="${esc(c.qrDataUrl)}" style="width:calc(var(--u)*17);height:calc(var(--u)*17);display:block"/>` : `<div style="width:calc(var(--u)*17);height:calc(var(--u)*17);display:flex;align-items:center;justify-content:center;color:#94a3b8;font-weight:800">QR</div>`}</div><div style="font-size:calc(var(--u)*2.4);max-width:calc(var(--u)*24);line-height:1.35">${esc(c.qrCaption)}</div></div>` : '<div></div>'}
    <div style="background:#fff;color:#0f172a;padding:calc(var(--u)*1.6) calc(var(--u)*2.2);text-align:center;font-size:calc(var(--u)*2.1);min-width:calc(var(--u)*26)">
      <div style="height:calc(var(--u)*9);background:repeating-linear-gradient(90deg,#0f172a 0 2px,#fff 2px 3px,#0f172a 3px 4px,#fff 4px 7px)"></div>
      <div style="margin-top:calc(var(--u)*.8);letter-spacing:.08em">${esc(c.isbn || 'ISBN 978-000-0000-00-0')}</div>
      ${c.showPrice && book.price_amount ? `<div style="font-weight:800;margin-top:calc(var(--u)*.4)">${esc(fmtMoney(book.price_amount, book.currency || 'NGN'))}</div>` : ''}
    </div>
  </div>
</div>`;
}

export function renderSpine(cfg, { heightPx = 900, widthPx = 30 } = {}) {
  const c = { ...defaultCoverConfig(), ...cfg };
  const light = c.template === 'minimal-frame';
  const bg = c.template === 'bold-type' ? c.accent : light ? '#fdfcf9' : c.bg;
  const fg = light ? c.bg : c.fg;
  const fs = Math.max(7, Math.min(widthPx * 0.42, 22));
  return `<div style="width:${widthPx}px;height:${heightPx}px;background:${esc(bg)};color:${esc(fg)};display:flex;align-items:center;justify-content:center;overflow:hidden;box-sizing:border-box;border-left:1px solid rgba(0,0,0,.15);border-right:1px solid rgba(0,0,0,.15)">
  <div style="writing-mode:vertical-rl;white-space:nowrap;font-family:Inter,'DejaVu Sans',Arial,sans-serif;font-size:${fs}px;display:flex;gap:${fs * 1.6}px;align-items:center">
    <strong style="font-family:Merriweather,'DejaVu Serif',Georgia,serif">${esc(c.title)}</strong><span style="color:${esc(c.accent)};letter-spacing:.12em;text-transform:uppercase;font-weight:700;font-size:.8em">${esc(c.author)}</span>
  </div></div>`;
}

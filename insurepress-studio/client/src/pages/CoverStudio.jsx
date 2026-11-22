import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toPng } from 'html-to-image';
import { ArrowLeft, Save, Download, Box, BookOpen, LayoutTemplate, Tablet } from 'lucide-react';
import { api } from '../lib/api.js';
import { Field, Spinner, Tabs, useToast } from '../components/ui.jsx';
import CoverThumb from '../components/CoverThumb.jsx';
import { COVER_TEMPLATES, COVER_ICONS, defaultCoverConfig, renderBackCover, renderSpine, spineWidthIn } from '@shared/cover.js';
import { TRIM_SIZES, buildCtaUrl } from '@shared/constants.js';

const iconSvg = (name) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${COVER_ICONS[name]}</svg>`;

function Html({ html, scale = 1, className = '' }) {
  return <div className={className} style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }} dangerouslySetInnerHTML={{ __html: html }} />;
}

function Mockup3D({ cfg, book, brand, pages, showTablet, mockRef }) {
  const ts = TRIM_SIZES[book.trim_size] || TRIM_SIZES['6x9'];
  const W = 300;
  const H = Math.round((W * ts.height) / ts.width);
  const D = Math.max(14, Math.round((spineWidthIn(pages) / ts.width) * W));
  const spine = renderSpine(cfg, { heightPx: H * 2, widthPx: D * 2 });
  return (
    <div ref={mockRef} className="relative flex items-end justify-center gap-14 overflow-hidden rounded-2xl px-16 pb-16 pt-14" style={{ background: 'radial-gradient(circle at 50% 30%, #ffffff 0%, #e2e8f0 70%)', minWidth: showTablet ? 820 : 520 }}>
      <div style={{ perspective: 1400 }}>
        <div style={{ position: 'relative', width: W, height: H, transformStyle: 'preserve-3d', transform: 'rotateY(-32deg) rotateX(4deg)' }}>
          <div style={{ position: 'absolute', inset: 0, transform: `translateZ(${D / 2}px)`, boxShadow: '18px 22px 40px rgba(15,23,42,.35)' }}>
            <CoverThumb book={book} brand={brand} config={cfg} width={W} className="!rounded-none !shadow-none" />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,.25) 0%, rgba(255,255,255,.12) 3%, rgba(0,0,0,0) 8%, rgba(255,255,255,.06) 60%, rgba(0,0,0,.05) 100%)' }} />
          </div>
          <div style={{ position: 'absolute', top: 0, left: (W - D) / 2, width: D, height: H, transform: `rotateY(-90deg) translateZ(${W / 2}px)`, overflow: 'hidden' }}>
            <Html html={spine} scale={0.5} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,.25), rgba(0,0,0,.05))' }} />
          </div>
          <div style={{ position: 'absolute', top: 3, left: (W - D) / 2, width: D - 2, height: H - 6, transform: `rotateY(90deg) translateZ(${W / 2 - 3}px)`, background: 'repeating-linear-gradient(90deg,#fdfdfb 0 2px,#e7e5e4 2px 3px)' }} />
        </div>
        <div style={{ width: W * 1.1, height: 22, margin: '6px auto 0', background: 'radial-gradient(ellipse at center, rgba(15,23,42,.35), transparent 70%)', filter: 'blur(4px)' }} />
      </div>
      {showTablet && (
        <div style={{ perspective: 1400 }}>
          <div style={{ transform: 'rotateY(18deg) rotateX(3deg)', transformStyle: 'preserve-3d' }}>
            <div className="rounded-[26px] bg-slate-900 p-3 shadow-2xl" style={{ boxShadow: '-16px 22px 40px rgba(15,23,42,.35)' }}>
              <div className="overflow-hidden rounded-xl bg-white">
                <CoverThumb book={book} brand={brand} config={cfg} width={220} className="!rounded-none !shadow-none" />
              </div>
              <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-700" />
            </div>
          </div>
        </div>
      )}
      <div className="absolute bottom-4 left-0 right-0 text-center text-[11px] font-semibold uppercase tracking-[.25em] text-slate-400">{brand?.name}</div>
    </div>
  );
}

export default function CoverStudio() {
  const { id } = useParams();
  const toast = useToast();
  const [full, setFull] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [view, setView] = useState('front');
  const [tablet, setTablet] = useState(true);
  const [busy, setBusy] = useState(false);
  const mockRef = useRef(null);

  useEffect(() => {
    api.get(`/books/${id}/full`).then((f) => { setFull(f); setCfg(f.coverConfig); }).catch((e) => toast(e.message, 'error'));
  }, [id]);

  const pages = useMemo(() => (full ? Math.max(48, Math.round(full.chapters.reduce((a, c) => a + c.word_count, 0) / 280) + 24) : 120), [full]);
  if (!full || !cfg) return <div className="flex h-full items-center justify-center"><Spinner size={24} /></div>;
  const { book, brand, ctas } = full;
  const set = (k) => (e) => setCfg((c) => ({ ...c, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const ts = TRIM_SIZES[book.trim_size] || TRIM_SIZES['6x9'];

  const saveCover = async () => {
    setBusy(true);
    try { await api.put(`/books/${id}`, { cover_config_json: cfg }); toast('Cover saved — it is used in PDF, EPUB and mockups'); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const pickQr = (ctaId) => {
    const c = ctas.find((x) => x.id === Number(ctaId));
    setCfg((x) => ({ ...x, qrCtaId: c?.id || null, qrDataUrl: c?.qr_data_url || '', qrCaption: c ? (c.cta_type === 'whatsapp_quote' ? 'Scan for a free policy audit on WhatsApp' : 'Scan to buy or gift a copy') : x.qrCaption }));
  };
  const downloadServer = async (part) => {
    await saveCover();
    window.location.href = `/api/books/${id}/cover.png?part=${part}&download=1`;
  };
  const downloadMockup = async () => {
    try {
      const url = await toPng(mockRef.current, { pixelRatio: 2.5, cacheBust: true });
      const a = document.createElement('a');
      a.href = url; a.download = `${book.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-3d-mockup.png`; a.click();
    } catch (e) { toast(`Mockup export failed: ${e.message}`, 'error'); }
  };

  const flatW = 260;
  const spineW = Math.max(10, (spineWidthIn(pages) / ts.width) * flatW);
  const flatH = (flatW * ts.height) / ts.width;

  return (
    <div className="flex h-full">
      <aside className="w-[360px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4">
        <Link to={`/books/${id}`} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-navy-800"><ArrowLeft size={13} />Back to Studio</Link>
        <h1 className="font-serif text-lg font-bold text-navy-800">Cover Designer</h1>
        <p className="mb-4 text-xs text-slate-500">Design the front, spine and back. Saved covers flow into every export.</p>

        <div className="label">Template</div>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {Object.entries(COVER_TEMPLATES).map(([tid, t]) => (
            <button key={tid} onClick={() => setCfg((c) => ({ ...c, template: tid }))} title={t.description}
              className={`rounded-lg border p-1 text-center ${cfg.template === tid ? 'border-gold-500 ring-2 ring-gold-100' : 'border-slate-200 hover:border-slate-300'}`}>
              <CoverThumb book={book} brand={brand} config={{ ...cfg, template: tid }} width={90} className="mx-auto" />
              <div className="mt-1 truncate text-[10px] font-semibold text-slate-600">{t.name}</div>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <Field label="Title"><input className="input" value={cfg.title} onChange={set('title')} /></Field>
          <Field label="Subtitle"><textarea className="input" rows={3} value={cfg.subtitle} onChange={set('subtitle')} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Author"><input className="input" value={cfg.author} onChange={set('author')} /></Field>
            <Field label="Brokerage badge"><input className="input" value={cfg.badge} onChange={set('badge')} /></Field>
          </div>
          <Field label="Tagline"><input className="input" value={cfg.tagline} onChange={set('tagline')} /></Field>
          <div>
            <div className="label">Icon</div>
            <div className="flex flex-wrap gap-1">
              {Object.keys(COVER_ICONS).map((k) => (
                <button key={k} title={k} onClick={() => setCfg((c) => ({ ...c, icon: k }))} className={`flex h-9 w-9 items-center justify-center rounded-lg border ${cfg.icon === k ? 'border-gold-500 bg-gold-50 text-gold-600' : 'border-slate-200 text-slate-500'}`} dangerouslySetInnerHTML={{ __html: iconSvg(k) }} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[['bg', 'Background'], ['fg', 'Text'], ['accent', 'Accent']].map(([k, l]) => (
              <Field key={k} label={l}><div className="flex items-center gap-1"><input type="color" className="h-9 w-9 cursor-pointer rounded border border-slate-200" value={cfg[k]} onChange={set(k)} /><input className="input px-1.5 py-1 text-xs" value={cfg[k]} onChange={set(k)} /></div></Field>
            ))}
          </div>
          <button className="btn-outline btn-sm" onClick={() => setCfg((c) => ({ ...c, bg: brand.primary_color, accent: brand.accent_color, fg: '#FFFFFF' }))}>Apply Brand Kit colours</button>
          <hr />
          <Field label="Back-cover blurb"><textarea className="input" rows={6} value={cfg.blurb} onChange={set('blurb')} /></Field>
          <Field label="Short author bio"><textarea className="input" rows={2} value={cfg.authorBio} onChange={set('authorBio')} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="ISBN"><input className="input" value={cfg.isbn} onChange={set('isbn')} placeholder="ISBN 978-…" /></Field>
            <Field label="Back-cover QR offer">
              <select className="input" value={cfg.qrCtaId || ''} onChange={(e) => pickQr(e.target.value)}>
                <option value="">None</option>
                {ctas.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="QR caption"><input className="input" value={cfg.qrCaption} onChange={set('qrCaption')} /></Field>
          <div className="flex gap-4 text-sm text-slate-600">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!cfg.showQr} onChange={set('showQr')} />Show QR</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!cfg.showPrice} onChange={set('showPrice')} />Show price</label>
          </div>
          <button className="btn-ghost btn-sm text-slate-400" onClick={() => setCfg(defaultCoverConfig(book, brand))}>Reset to defaults</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
          <Tabs className="w-[420px]" value={view} onChange={setView} tabs={[{ id: 'front', label: 'Front', icon: BookOpen }, { id: 'wrap', label: 'Full wrap', icon: LayoutTemplate }, { id: 'mockup', label: '3D Mockup', icon: Box }]} />
          {view === 'mockup' && <label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={tablet} onChange={(e) => setTablet(e.target.checked)} /><Tablet size={13} />Tablet bundle</label>}
          <div className="ml-auto flex gap-2">
            {view === 'mockup'
              ? <button className="btn-outline" onClick={downloadMockup}><Download size={15} />Mockup PNG</button>
              : <>
                <button className="btn-outline" onClick={() => downloadServer('front')}><Download size={15} />Front PNG</button>
                <button className="btn-outline" onClick={() => downloadServer('back')}><Download size={15} />Back PNG</button>
              </>}
            <button className="btn-primary" onClick={saveCover} disabled={busy}>{busy ? <Spinner /> : <Save size={15} />}Save cover</button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-100 p-8">
          {view === 'front' && <CoverThumb book={book} brand={brand} config={cfg} width={380} className="shadow-2xl" />}
          {view === 'wrap' && (
            <div>
              <div className="flex shadow-2xl" style={{ height: flatH }}>
                <div style={{ width: flatW, height: flatH, overflow: 'hidden' }}><Html html={renderBackCover(cfg, { widthPx: 600, trim: book.trim_size, book })} scale={flatW / 600} /></div>
                <div style={{ width: spineW, height: flatH, overflow: 'hidden' }}><Html html={renderSpine(cfg, { heightPx: flatH * 2, widthPx: spineW * 2 })} scale={0.5} /></div>
                <CoverThumb book={book} brand={brand} config={cfg} width={flatW} className="!rounded-none !shadow-none" />
              </div>
              <div className="mt-3 flex justify-between text-[11px] text-slate-500">
                <span>Back cover</span><span>Spine ≈ {spineWidthIn(pages).toFixed(2)}" ({pages} pp est.)</span><span>Front cover · {ts.label}</span>
              </div>
            </div>
          )}
          {view === 'mockup' && <Mockup3D cfg={cfg} book={book} brand={brand} pages={pages} showTablet={tablet} mockRef={mockRef} />}
        </div>
        <div className="border-t border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-500">
          Mockups are sized for Selar product images, WhatsApp broadcasts and LinkedIn/Instagram posts. QR codes on the back cover link to {cfg.qrCtaId ? buildCtaUrl(ctas.find((c) => c.id === cfg.qrCtaId) || {}, { bookId: book.id }) : 'your chosen offer'}.
        </div>
      </div>
    </div>
  );
}

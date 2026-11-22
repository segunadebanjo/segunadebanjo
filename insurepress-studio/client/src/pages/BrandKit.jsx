import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, UserRound } from 'lucide-react';
import { api } from '../lib/api.js';
import { Field, Spinner, useToast } from '../components/ui.jsx';
import { GOOGLE_FONTS, DEFAULT_DISCLAIMER } from '@shared/constants.js';
import { scopedBlockCss } from '@shared/themes.js';
import { blockToHtml } from '@shared/render.js';

export default function BrandKit() {
  const toast = useToast();
  const [kits, setKits] = useState(null);
  const [sel, setSel] = useState(null);
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async (keep) => {
    const [k, u] = await Promise.all([api.get('/brand-kits'), api.get('/me')]);
    setKits(k); setMe(u);
    setSel(k.find((x) => x.id === keep) || k[0] || null);
  };
  useEffect(() => { load().catch((e) => toast(e.message, 'error')); }, []);
  if (!kits) return <div className="flex h-full items-center justify-center"><Spinner size={24} /></div>;
  const set = (k) => (e) => setSel((x) => ({ ...x, [k]: e.target.value }));

  const save = async () => {
    setBusy(true);
    try {
      const saved = sel.id ? await api.put(`/brand-kits/${sel.id}`, sel) : await api.post('/brand-kits', sel);
      await api.put('/me', me);
      toast('Brand kit saved');
      load(saved.id);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirm(`Delete brand kit “${sel.name}”?`)) return;
    try { await api.del(`/brand-kits/${sel.id}`); load(); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[220px_1fr_360px]">
        <div>
          <h1 className="mb-3 font-serif text-xl font-black text-navy-800">Brand Kits</h1>
          <div className="space-y-1">
            {kits.map((k) => (
              <button key={k.id} onClick={() => setSel(k)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${sel?.id === k.id ? 'bg-white font-semibold shadow-card' : 'text-slate-600 hover:bg-white'}`}>
                <span className="flex">{[k.primary_color, k.accent_color, k.secondary_color].map((c) => <span key={c} className="-mr-1 h-4 w-4 rounded-full border-2 border-white" style={{ background: c }} />)}</span>
                <span className="ml-2 truncate">{k.name}</span>
              </button>
            ))}
            <button className="btn-ghost btn-sm w-full" onClick={() => setSel({ name: 'New Brand Kit', primary_color: '#0F2942', secondary_color: '#334155', accent_color: '#D97706', heading_font: 'Merriweather', body_font: 'Inter', default_currency: 'NGN', regulatory_framework: 'NAICOM & Nigerian Insurance Industry Reform Act 2025', default_disclaimer: DEFAULT_DISCLAIMER })}><Plus size={13} />New kit</button>
          </div>
        </div>

        {sel && (
          <div className="card space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kit name" className="col-span-2"><input className="input" value={sel.name} onChange={set('name')} /></Field>
              {[['primary_color', 'Primary'], ['accent_color', 'Accent'], ['secondary_color', 'Secondary']].map(([k, l]) => (
                <Field key={k} label={l}><div className="flex gap-1"><input type="color" className="h-9 w-10 rounded border border-slate-200" value={sel[k]} onChange={set(k)} /><input className="input" value={sel[k]} onChange={set(k)} /></div></Field>
              ))}
              <Field label="Default currency"><select className="input" value={sel.default_currency} onChange={set('default_currency')}><option value="NGN">₦ NGN</option><option value="USD">$ USD</option></select></Field>
              <Field label="Heading font"><select className="input" value={sel.heading_font} onChange={set('heading_font')}>{GOOGLE_FONTS.map((f) => <option key={f}>{f}</option>)}</select></Field>
              <Field label="Body font"><select className="input" value={sel.body_font} onChange={set('body_font')}>{GOOGLE_FONTS.map((f) => <option key={f}>{f}</option>)}</select></Field>
              <Field label="Logo URL"><input className="input" value={sel.logo_url || ''} onChange={set('logo_url')} placeholder="https://…" /></Field>
              <Field label="Author photo URL"><input className="input" value={sel.author_photo_url || ''} onChange={set('author_photo_url')} placeholder="https://…" /></Field>
              <Field label="Regulatory framework" className="col-span-2"><input className="input" value={sel.regulatory_framework} onChange={set('regulatory_framework')} /></Field>
              <Field label="Default disclaimer (used on the copyright page)" className="col-span-2" hint="Have your compliance officer review this text.">
                <textarea className="input text-xs" rows={7} value={sel.default_disclaimer || ''} onChange={set('default_disclaimer')} />
              </Field>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner /> : <Save size={15} />}Save</button>
              {sel.id && kits.length > 1 && <button className="btn-ghost text-red-600" onClick={remove}><Trash2 size={15} />Delete</button>}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {me && (
            <div className="card space-y-3 p-4">
              <div className="flex items-center gap-2 font-serif font-bold text-navy-800"><UserRound size={16} />Author &amp; brokerage</div>
              <Field label="Full name"><input className="input" value={me.full_name || ''} onChange={(e) => setMe({ ...me, full_name: e.target.value })} /></Field>
              <Field label="Brokerage name"><input className="input" value={me.brokerage_name || ''} onChange={(e) => setMe({ ...me, brokerage_name: e.target.value })} /></Field>
              <Field label="NAICOM licence no."><input className="input" value={me.naicom_license_no || ''} onChange={(e) => setMe({ ...me, naicom_license_no: e.target.value })} /></Field>
            </div>
          )}
          {sel && (
            <div className="card p-4">
              <div className="label">Live block preview</div>
              <style>{scopedBlockCss('.ip-brand-preview', { brand: sel })}</style>
              <div className="ip-brand-preview space-y-3 text-sm" style={{ fontFamily: sel.body_font }}
                dangerouslySetInnerHTML={{ __html: blockToHtml('mythFact', {}) + blockToHtml('ctaCard', { qrDataUrl: '' }) }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

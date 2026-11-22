import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Pencil, Copy, Download, QrCode, Magnet, Megaphone, Calculator, Sparkles, ExternalLink, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { Modal, Field, Spinner, Tabs, Empty, useToast } from '../components/ui.jsx';
import RevenuePlanner from '../components/RevenuePlanner.jsx';
import { LeadMagnetFields, useExportRunner } from '../components/studio/ExportModal.jsx';
import { CTA_TYPES, fmtMoney } from '@shared/constants.js';

const BLANK = { label: '', cta_type: 'whatsapp_quote', destination_url: '', whatsapp_prefill_text: '', promo_code: '' };

function CtaManager({ book, ctas, reload }) {
  const toast = useToast();
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setEdit((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    setBusy(true);
    try {
      if (edit.id) await api.put(`/ctas/${edit.id}`, edit); else await api.post(`/books/${book.id}/ctas`, edit);
      toast('Offer saved and QR code generated');
      setEdit(null);
      reload();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const remove = async (c) => { if (confirm(`Delete “${c.label}”? QR cards already in chapters keep their old image.`)) { await api.del(`/ctas/${c.id}`); reload(); } };
  const copy = (t) => { navigator.clipboard?.writeText(t); toast('Link copied'); };

  return (
    <div>
      <div className="mb-3 flex items-center">
        <p className="text-sm text-slate-500">Reusable conversion offers. Each one gets a scannable QR code and a tracked link (UTM tags, WhatsApp pre-filled message, promo code) you can drop into any chapter with the <b>Monetization &amp; QR Action Card</b> block.</p>
        <button className="btn-primary ml-auto shrink-0" onClick={() => setEdit({ ...BLANK })}><Plus size={15} />New offer</button>
      </div>
      {ctas.length === 0 ? <div className="card"><Empty icon={QrCode} title="No offers yet">Create a Selar checkout, Paystack link or WhatsApp quote offer.</Empty></div> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ctas.map((c) => (
            <div key={c.id} className="card flex gap-3 p-3">
              <img src={c.qr_data_url} alt="QR" className="h-28 w-28 shrink-0 rounded border border-slate-100" />
              <div className="min-w-0 flex-1">
                <span className="chip bg-gold-50 text-gold-600">{CTA_TYPES[c.cta_type]?.label}</span>
                <div className="mt-1 font-semibold text-navy-800">{c.label}</div>
                {c.promo_code && <div className="text-xs text-slate-500">Code: <b>{c.promo_code}</b></div>}
                <div className="mt-1 truncate text-[11px] text-slate-400" title={c.tracked_url}>{c.tracked_url}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <button className="btn-outline btn-sm" onClick={() => copy(c.tracked_url)}><Copy size={12} />Link</button>
                  <a className="btn-outline btn-sm" href={c.qr_data_url} download={`${c.label.replace(/\W+/g, '-')}-qr.png`}><Download size={12} />QR</a>
                  <a className="btn-ghost btn-sm" href={c.tracked_url} target="_blank" rel="noreferrer"><ExternalLink size={12} /></a>
                  <button className="btn-ghost btn-sm" onClick={() => setEdit(c)}><Pencil size={12} /></button>
                  <button className="btn-ghost btn-sm text-slate-400 hover:text-red-600" onClick={() => remove(c)}><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit offer' : 'New conversion offer'} size="md"
        footer={<><button className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />}Save &amp; generate QR</button></>}>
        {edit && (
          <div className="space-y-3">
            <Field label="Offer type">
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(CTA_TYPES).map(([k, t]) => (
                  <button key={k} onClick={() => setEdit((x) => ({ ...x, cta_type: k }))} className={`rounded-lg border px-2 py-1.5 text-left text-xs font-semibold ${edit.cta_type === k ? 'border-gold-500 bg-gold-50 text-gold-600' : 'border-slate-200 text-slate-600'}`}>{t.label}</button>
                ))}
              </div>
            </Field>
            <Field label="Label (also used as button text)"><input className="input" value={edit.label} onChange={set('label')} placeholder="e.g. Free WhatsApp Policy Audit" /></Field>
            <Field label={edit.cta_type === 'whatsapp_quote' ? 'WhatsApp number or wa.me link' : 'Destination URL'} hint={CTA_TYPES[edit.cta_type]?.hint}>
              <input className="input" value={edit.destination_url} onChange={set('destination_url')} />
            </Field>
            {edit.cta_type === 'whatsapp_quote' && <Field label="Pre-filled WhatsApp message"><textarea className="input" rows={3} value={edit.whatsapp_prefill_text || ''} onChange={set('whatsapp_prefill_text')} placeholder="Hello! I’m reading your book and I’d like a free policy audit." /></Field>}
            <Field label="Promo / tracking code (optional)"><input className="input" value={edit.promo_code || ''} onChange={set('promo_code')} placeholder="SLEEPSOUNDLY" /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

function LeadMagnet({ book, chapters, ctas }) {
  const [lm, setLm] = useState({ chapterIds: chapters.filter((c) => c.section_type === 'workbook').map((c) => c.id), headline: '', ctaId: null });
  const { busy, last, run } = useExportRunner(book.id);
  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <div className="card p-4">
        <LeadMagnetFields chapters={chapters} ctas={ctas} value={lm} onChange={setLm} />
        <button className="btn-gold mt-4" disabled={busy || !lm.chapterIds.length} onClick={() => run({ format: 'lead_magnet_pdf', trim: 'A4', ...lm })}>{busy ? <Spinner /> : <Magnet size={15} />}Extract lead-magnet PDF</button>
        {last?.url && <a href={last.url} className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} />Download {last.file_path} ({last.pages} pages)</a>}
      </div>
      <div className="card p-4 text-sm text-slate-600">
        <h3 className="mb-2 font-serif font-bold text-navy-800">How to use your lead magnet</h3>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Share it free in WhatsApp groups, on your landing page or as a LinkedIn document post.</li>
          <li>Ask for a name and WhatsApp number in exchange (e.g. via a Selar free product).</li>
          <li>The last page carries a QR upsell to the full book — readers who scan it are warm buyers.</li>
          <li>Follow up with a free policy gap audit — that is where brokerage commission comes from.</li>
        </ol>
      </div>
    </div>
  );
}

function LaunchCopy({ book }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [copy, setCopy] = useState(null);
  const gen = async () => {
    setBusy(true);
    try { setCopy(await api.post('/ai/sales-copy', { bookId: book.id })); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const asText = () => {
    const s = copy.selar;
    return `${s.headline}\n${s.subheadline}\n\n${s.body}\n\n${s.bullets.map((b) => `✅ ${b}`).join('\n')}\n\n${s.guarantee}\n\n${s.cta}`;
  };
  const clip = (t) => { navigator.clipboard?.writeText(t); toast('Copied to clipboard'); };
  return (
    <div>
      <button className="btn-gold" onClick={gen} disabled={busy}>{busy ? <Spinner /> : <Sparkles size={15} />}{copy ? 'Regenerate' : 'Generate'} Selar page &amp; carousel copy</button>
      {copy && (
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div className="card p-5">
            <div className="mb-2 flex items-center"><span className="label">Selar / landing page</span><button className="btn-outline btn-sm ml-auto" onClick={() => clip(asText())}><Copy size={12} />Copy</button></div>
            <h3 className="font-serif text-xl font-black text-navy-800">{copy.selar.headline}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-600">{copy.selar.subheadline}</p>
            <p className="mt-3 text-sm text-slate-700">{copy.selar.body.replace(/\*/g, '')}</p>
            <ul className="mt-3 space-y-1 text-sm">{copy.selar.bullets.map((b) => <li key={b} className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />{b}</li>)}</ul>
            <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs italic text-slate-600">{copy.selar.guarantee}</p>
            <div className="btn-gold mt-3 w-full">{copy.selar.cta}</div>
          </div>
          <div>
            <div className="mb-2 flex items-center"><span className="label">5-slide LinkedIn / Instagram carousel</span>
              <button className="btn-outline btn-sm ml-auto" onClick={() => clip(copy.carousel.map((s) => `Slide ${s.slide}: ${s.headline}\n${s.body}`).join('\n\n'))}><Copy size={12} />Copy</button></div>
            <div className="grid grid-cols-2 gap-3">
              {copy.carousel.map((s, i) => (
                <div key={s.slide} className={`flex aspect-square flex-col justify-between rounded-xl p-4 ${i === 0 || i === 4 ? 'bg-navy-800 text-white' : 'bg-white text-navy-800 shadow-card'}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${i === 0 || i === 4 ? 'text-gold-400' : 'text-gold-600'}`}>{s.slide}/5</span>
                  <div><div className="font-serif text-lg font-black leading-tight">{s.headline}</div><div className={`mt-2 text-xs ${i === 0 || i === 4 ? 'text-navy-100' : 'text-slate-500'}`}>{s.body}</div></div>
                  <span className="text-[10px] opacity-60">{book.author_name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Monetize() {
  const { id } = useParams();
  const [full, setFull] = useState(null);
  const [tab, setTab] = useState('ctas');
  const load = () => api.get(`/books/${id}/full`).then(setFull);
  useEffect(() => { load(); }, [id]);
  if (!full) return <div className="flex h-full items-center justify-center"><Spinner size={24} /></div>;
  const { book, chapters, ctas } = full;
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-5 p-6">
        <div>
          <Link to={`/books/${id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-navy-800"><ArrowLeft size={13} />Back to Studio</Link>
          <h1 className="font-serif text-2xl font-black text-navy-800">Income &amp; Lead-Generation Engine</h1>
          <p className="text-sm text-slate-500">“{book.title}” · {fmtMoney(book.price_amount, book.currency)} · goal: {book.monetization_goal.replace('_', ' ')}</p>
        </div>
        <Tabs className="max-w-3xl" value={tab} onChange={setTab} tabs={[
          { id: 'ctas', label: 'CTAs & QR Manager', icon: QrCode }, { id: 'lead', label: 'Lead-Magnet Extractor', icon: Magnet },
          { id: 'copy', label: 'Launch Copy', icon: Megaphone }, { id: 'plan', label: 'Revenue Planner', icon: Calculator },
        ]} />
        {tab === 'ctas' && <CtaManager book={book} ctas={ctas} reload={load} />}
        {tab === 'lead' && <LeadMagnet book={book} chapters={chapters} ctas={ctas} />}
        {tab === 'copy' && <LaunchCopy book={book} />}
        {tab === 'plan' && <RevenuePlanner book={book} />}
      </div>
    </div>
  );
}

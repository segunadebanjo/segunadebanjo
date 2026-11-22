import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Truck, Users, Baby, Building2, Plane, Gem, Sparkles, ArrowRight, ArrowLeft, Trash2, ShieldAlert, Check, Wand2 } from 'lucide-react';
import { Modal, Spinner, useToast } from './ui.jsx';
import { api } from '../lib/api.js';
import { AUDIENCES, MATTER_SUBTYPES } from '@shared/constants.js';

const Icons = { Store, Truck, Users, Baby, Building2, Plane, Gem };
const SECTION_LABEL = { front_matter: 'Front', body: 'Chapter', workbook: 'Workbook', back_matter: 'Back' };
const SECTION_COLOR = { front_matter: 'bg-slate-100 text-slate-600', body: 'bg-navy-50 text-navy-700', workbook: 'bg-emerald-50 text-emerald-700', back_matter: 'bg-slate-100 text-slate-600' };

/** AI Pain-Point Architect: audience → pain points → titles & outline → populate manuscript. */
export default function BlueprintWizard({ open, onClose, bookId = null, onPopulated }) {
  const nav = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [audienceId, setAudienceId] = useState('sme');
  const [customAudience, setCustomAudience] = useState('');
  const [notes, setNotes] = useState('');
  const [pp, setPp] = useState(null);
  const [selected, setSelected] = useState([]);
  const [plan, setPlan] = useState(null);
  const [titleIdx, setTitleIdx] = useState(0);
  const [title, setTitle] = useState({ title: '', subtitle: '' });
  const [replaceExisting, setReplaceExisting] = useState(false);

  useEffect(() => { if (open) { setStep(1); setPp(null); setPlan(null); } }, [open]);

  const discover = async () => {
    setBusy(true);
    try {
      const out = await api.post('/ai/pain-points', { audienceId, customAudience: customAudience.trim() || undefined, notes });
      setPp(out);
      setSelected(out.painPoints.map((_, i) => i));
      setStep(2);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  const outline = async () => {
    setBusy(true);
    try {
      const chosen = selected.map((i) => pp.painPoints[i]);
      const out = await api.post('/ai/outline', { audience: pp.audience, persona: pp.persona, painPoints: chosen, notes });
      setPlan({ ...out, painPoints: chosen });
      setTitleIdx(0);
      setTitle({ title: out.titles?.[0]?.title || '', subtitle: out.titles?.[0]?.subtitle || '' });
      setStep(3);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  const populate = async () => {
    setBusy(true);
    try {
      const full = await api.post('/blueprints/populate', {
        bookId, replaceExisting, title: title.title, subtitle: title.subtitle, audience: pp.audience, corePainPoint: plan.corePainPoint,
        painPoints: plan.painPoints, recommendedPolicies: pp.recommendedPolicies, titles: plan.titles, outline: plan.outline,
      });
      toast(`Manuscript populated with ${full.chapters.length} sections`);
      onClose?.();
      if (bookId && onPopulated) onPopulated(full);
      else nav(`/books/${full.book.id}`);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  const editItem = (i, k, v) => setPlan((p) => ({ ...p, outline: p.outline.map((o, j) => (j === i ? { ...o, [k]: v } : o)) }));
  const removeItem = (i) => setPlan((p) => ({ ...p, outline: p.outline.filter((_, j) => j !== i) }));

  const steps = ['Audience', 'Pain points', 'Titles & outline'];
  const footer = (
    <>
      {step > 1 && <button className="btn-ghost mr-auto" onClick={() => setStep(step - 1)} disabled={busy}><ArrowLeft size={15} />Back</button>}
      {step === 1 && <button className="btn-primary" onClick={discover} disabled={busy}>{busy ? <Spinner /> : <Sparkles size={15} />}Discover pain points</button>}
      {step === 2 && <button className="btn-primary" onClick={outline} disabled={busy || !selected.length}>{busy ? <Spinner /> : <Wand2 size={15} />}Generate titles &amp; outline</button>}
      {step === 3 && <button className="btn-gold" onClick={populate} disabled={busy || !title.title.trim()}>{busy ? <Spinner /> : <Check size={15} />}Populate manuscript</button>}
    </>
  );

  return (
    <Modal open={open} onClose={onClose} size="xl" title="AI Pain-Point Architect" subtitle="Turn a target audience into a high-converting insurance book blueprint" footer={footer}>
      <ol className="mb-5 flex gap-2">
        {steps.map((s, i) => (
          <li key={s} className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${step === i + 1 ? 'border-gold-500 bg-gold-50 text-gold-600' : step > i + 1 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400'}`}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] shadow">{step > i + 1 ? <Check size={12} /> : i + 1}</span>{s}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {AUDIENCES.map((a) => {
              const Icon = Icons[a.icon] || Icons.Users;
              return (
                <button key={a.id} onClick={() => setAudienceId(a.id)}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${audienceId === a.id ? 'border-gold-500 bg-gold-50 ring-2 ring-gold-100' : 'border-slate-200 hover:border-slate-300'}`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${audienceId === a.id ? 'bg-gold-500 text-white' : 'bg-slate-100 text-slate-500'}`}><Icon size={18} /></span>
                  <span className="text-sm font-semibold text-slate-700">{a.label}</span>
                </button>
              );
            })}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label><span className="label">Customise the audience (optional)</span><input className="input" placeholder="e.g. Pharmacy owners in Kano and Kaduna" value={customAudience} onChange={(e) => setCustomAudience(e.target.value)} /></label>
            <label><span className="label">Your notes for the AI (optional)</span><input className="input" placeholder="e.g. Many of my clients lost stock in the 2024 floods" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          </div>
        </div>
      )}

      {step === 2 && pp && (
        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <p className="mb-2 text-sm text-slate-500">{pp.persona}. Untick any pain point you don’t want a chapter on.</p>
            <div className="space-y-2">
              {pp.painPoints.map((p, i) => {
                const on = selected.includes(i);
                return (
                  <button key={i} onClick={() => setSelected((s) => (on ? s.filter((x) => x !== i) : [...s, i].sort((a, b) => a - b)))}
                    className={`w-full rounded-xl border p-3 text-left transition ${on ? 'border-navy-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${on ? 'border-navy-800 bg-navy-800 text-white' : 'border-slate-300 bg-white'}`}>{on && <Check size={13} />}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-navy-800">{p.title}</div>
                        <div className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-slate-600 sm:grid-cols-2">
                          <div><b className="text-slate-500">Fear:</b> {p.fear}</div>
                          <div><b className="text-slate-500">Trigger:</b> {p.trigger}</div>
                          <div><b className="text-red-600">Myth:</b> {p.misconception}</div>
                          <div><b className="text-slate-500">Cost:</b> {p.financialConsequence}</div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">{(p.policies || []).map((x) => <span key={x} className="chip bg-navy-50 text-navy-700">{x}</span>)}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="label">Recommended policies & statutory covers</div>
            <div className="space-y-2">
              {(pp.recommendedPolicies || []).map((r) => (
                <div key={r.name} className="rounded-lg border border-slate-200 p-2.5 text-sm">
                  <div className="flex items-center gap-2 font-semibold text-slate-700">{r.statutory && <ShieldAlert size={14} className="text-gold-600" />}{r.name}{r.statutory && <span className="chip bg-gold-50 text-gold-600">Statutory</span>}</div>
                  <div className="text-xs text-slate-500">Solves: {r.solves}</div>
                  {r.note && <div className="mt-1 text-[11px] italic text-slate-400">{r.note}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 3 && plan && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
          <div className="space-y-2">
            <div className="label">Choose a title (edit freely)</div>
            {plan.titles.map((t, i) => (
              <button key={i} onClick={() => { setTitleIdx(i); setTitle({ title: t.title, subtitle: t.subtitle }); }}
                className={`w-full rounded-xl border p-3 text-left ${titleIdx === i ? 'border-gold-500 bg-gold-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className="font-serif font-bold text-navy-800">{t.title}</div>
                <div className="text-xs text-slate-600">{t.subtitle}</div>
                {t.hook && <div className="mt-1 text-[11px] text-gold-600">{t.hook}</div>}
              </button>
            ))}
            <input className="input font-serif font-bold" value={title.title} onChange={(e) => setTitle((x) => ({ ...x, title: e.target.value }))} />
            <textarea className="input" rows={2} value={title.subtitle} onChange={(e) => setTitle((x) => ({ ...x, subtitle: e.target.value }))} />
            {plan.corePainPoint && <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600"><b>Core pain point:</b> {plan.corePainPoint}</p>}
            {bookId && <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} />Replace the current manuscript (otherwise sections are appended)</label>}
          </div>
          <div>
            <div className="label">Book outline — {plan.outline.length} sections</div>
            <div className="max-h-[52vh] space-y-1.5 overflow-y-auto pr-1">
              {plan.outline.map((o, i) => (
                <div key={i} className="group flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2">
                  <span className={`chip mt-1 shrink-0 ${SECTION_COLOR[o.section_type]}`}>{SECTION_LABEL[o.section_type]}</span>
                  <div className="min-w-0 flex-1">
                    <input className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none" value={o.title} onChange={(e) => editItem(i, 'title', e.target.value)} />
                    {o.summary && <div className="text-xs text-slate-500">{o.summary}</div>}
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">{MATTER_SUBTYPES[o.matter_subtype] || o.matter_subtype}{o.suggestedBlocks?.length ? ` · blocks: ${o.suggestedBlocks.join(', ')}` : ''}</div>
                  </div>
                  <button className="btn-ghost p-1 opacity-0 group-hover:opacity-100" onClick={() => removeItem(i)} title="Remove"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {busy && step < 3 && <div className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Spinner />The architect is thinking…</div>}
      {step === 3 && <p className="mt-4 flex items-center gap-1 text-xs text-slate-400"><ArrowRight size={12} />“Populate Manuscript” creates every section with front/back matter, outline notes and starter visual blocks.</p>}
    </Modal>
  );
}

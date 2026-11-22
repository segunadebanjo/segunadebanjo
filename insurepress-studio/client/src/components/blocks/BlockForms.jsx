import { Plus, Trash2 } from 'lucide-react';
import { Field } from '../ui.jsx';
import { buildCtaUrl, CTA_TYPES } from '@shared/constants.js';

const Text = ({ label, value, onChange, rows, ...rest }) => (
  <Field label={label}>
    {rows ? <textarea className="input" rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
      : <input className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />}
  </Field>
);

function ComparisonForm({ d, set }) {
  const cols = d.columns || [];
  const rows = d.rows || [];
  const setCell = (ri, ci, v) => set('rows', rows.map((r, i) => (i === ri ? cols.map((_, j) => (j === ci ? v : (r || [])[j] ?? '')) : r)));
  return (
    <div className="space-y-3">
      <Text label="Table title" value={d.title} onChange={(v) => set('title', v)} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {cols.map((c, ci) => (
                <th key={ci} className="p-1">
                  <div className="flex gap-1">
                    <input className="input bg-navy-50 font-semibold" value={c} onChange={(e) => set('columns', cols.map((x, j) => (j === ci ? e.target.value : x)))} />
                    {cols.length > 2 && <button className="btn-ghost p-1" title="Remove column" onClick={() => { set('columns', cols.filter((_, j) => j !== ci)); set('rows', rows.map((r) => (r || []).filter((_, j) => j !== ci))); }}><Trash2 size={13} /></button>}
                  </div>
                </th>
              ))}
              <th className="w-8"><button className="btn-ghost p-1" title="Add column" onClick={() => { set('columns', [...cols, `Option ${cols.length}`]); set('rows', rows.map((r) => [...(r || []), ''])); }}><Plus size={14} /></button></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {cols.map((_, ci) => <td key={ci} className="p-1"><input className="input" value={(r || [])[ci] ?? ''} onChange={(e) => setCell(ri, ci, e.target.value)} /></td>)}
                <td><button className="btn-ghost p-1" onClick={() => set('rows', rows.filter((_, i) => i !== ri))}><Trash2 size={13} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn-outline btn-sm" onClick={() => set('rows', [...rows, cols.map(() => '')])}><Plus size={13} />Add row</button>
    </div>
  );
}

function CtaForm({ d, set, setMany, ctas = [], bookId }) {
  const pick = (id) => {
    const c = ctas.find((x) => x.id === Number(id));
    if (!c) return setMany({ ctaId: null });
    setMany({ ctaId: c.id, ctaType: c.cta_type, url: buildCtaUrl(c, { bookId, source: 'book' }), qrDataUrl: c.qr_data_url || '', promoCode: c.promo_code || '', buttonLabel: c.label });
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Linked offer (CTA)" className="col-span-2" hint={ctas.length ? 'The QR code and tracked link update automatically.' : 'Create offers in Monetize → CTAs & QR Manager.'}>
        <select className="input" value={d.ctaId || ''} onChange={(e) => pick(e.target.value)}>
          <option value="">— Manual link —</option>
          {ctas.map((c) => <option key={c.id} value={c.id}>{c.label} ({CTA_TYPES[c.cta_type]?.label})</option>)}
        </select>
      </Field>
      <Text label="Eyebrow" value={d.eyebrow} onChange={(v) => set('eyebrow', v)} />
      <Text label="Button label" value={d.buttonLabel} onChange={(v) => set('buttonLabel', v)} />
      <div className="col-span-2"><Text label="Headline" value={d.headline} onChange={(v) => set('headline', v)} /></div>
      <div className="col-span-2"><Text label="Body" rows={3} value={d.body} onChange={(v) => set('body', v)} /></div>
      <Text label="URL" value={d.url} onChange={(v) => set('url', v)} disabled={!!d.ctaId} />
      <Text label="Reader promo code" value={d.promoCode} onChange={(v) => set('promoCode', v)} />
    </div>
  );
}

export default function BlockForm({ type, data, onChange, ctas, bookId, currency }) {
  const d = data || {};
  const set = (k, v) => onChange({ ...d, [k]: v });
  const setMany = (o) => onChange({ ...d, ...o });
  switch (type) {
    case 'painPoint':
      return (
        <div className="grid grid-cols-2 gap-3">
          <Text label="Badge" value={d.badge} onChange={(v) => set('badge', v)} />
          <Field label="Severity"><select className="input" value={d.severity} onChange={(e) => set('severity', e.target.value)}><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></Field>
          <div className="col-span-2"><Text label="Headline (the reader’s fear)" value={d.title} onChange={(v) => set('title', v)} /></div>
          <div className="col-span-2"><Text label="Body" rows={4} value={d.body} onChange={(v) => set('body', v)} /></div>
        </div>
      );
    case 'claimCase':
      return (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Text label="Case title" value={d.title} onChange={(v) => set('title', v)} /></div>
          <div className="col-span-2"><Text label="1 · The incident" rows={2} value={d.incident} onChange={(v) => set('incident', v)} /></div>
          <Text label="Uninsured outcome" rows={2} value={d.uninsuredOutcome} onChange={(v) => set('uninsuredOutcome', v)} />
          <Text label="Insured outcome" rows={2} value={d.insuredOutcome} onChange={(v) => set('insuredOutcome', v)} />
          <Field label={`Uninsured loss (${d.currency || currency})`}><input type="number" className="input" value={d.uninsuredAmount ?? ''} onChange={(e) => set('uninsuredAmount', Number(e.target.value))} /></Field>
          <Field label={`Insured payout (${d.currency || currency})`}><input type="number" className="input" value={d.insuredAmount ?? ''} onChange={(e) => set('insuredAmount', Number(e.target.value))} /></Field>
          <div className="col-span-2"><Text label="3 · Broker’s key lesson" rows={2} value={d.lesson} onChange={(v) => set('lesson', v)} /></div>
          <Field label="Currency"><select className="input" value={d.currency || currency} onChange={(e) => set('currency', e.target.value)}><option value="NGN">₦ NGN</option><option value="USD">$ USD</option></select></Field>
        </div>
      );
    case 'jargon':
      return (
        <div className="space-y-3">
          <Text label="Term / clause" value={d.term} onChange={(v) => set('term', v)} />
          <Text label="Policy wording (technical)" rows={3} value={d.technical} onChange={(v) => set('technical', v)} />
          <Text label="In plain English" rows={2} value={d.plain} onChange={(v) => set('plain', v)} />
          <Text label="Example (optional)" value={d.example} onChange={(v) => set('example', v)} />
        </div>
      );
    case 'comparison':
      return <ComparisonForm d={d} set={set} />;
    case 'mythFact':
      return (
        <div className="grid grid-cols-2 gap-3">
          <Text label="Myth" rows={4} value={d.myth} onChange={(v) => set('myth', v)} />
          <Text label="Fact" rows={4} value={d.fact} onChange={(v) => set('fact', v)} />
        </div>
      );
    case 'riskChecklist':
      return (
        <div className="space-y-3">
          <Text label="Checklist title" value={d.title} onChange={(v) => set('title', v)} />
          <Text label="Intro line" value={d.intro} onChange={(v) => set('intro', v)} />
          <Field label="Items (one per line)">
            <textarea className="input" rows={8} value={(d.items || []).map((i) => (typeof i === 'string' ? i : i.text)).join('\n')}
              onChange={(e) => set('items', e.target.value.split('\n'))} onBlur={(e) => set('items', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} />
          </Field>
        </div>
      );
    case 'ctaCard':
      return <CtaForm d={d} set={set} setMany={setMany} ctas={ctas} bookId={bookId} />;
    default:
      return null;
  }
}

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Film, Pencil, ShieldAlert, Sparkles } from 'lucide-react';
import { api } from '../api';
import { COMPLIANCE_STYLE, PLATFORM_COLOR, PLATFORM_LABEL, label } from '../format';
import type { Variant } from '../types';
import { Badge, Button, ErrorBanner, cx, inputCls } from './ui';

const GOOGLE = (p: Variant['platform']) => p === 'GOOGLE_SEARCH' || p === 'GOOGLE_DISPLAY';

export function FindingsList({ findings }: { findings: Variant['complianceNotes'] }) {
  if (!findings.length)
    return (
      <p className="flex items-center gap-1.5 text-xs text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> No compliance issues
      </p>
    );
  return (
    <ul className="space-y-1.5">
      {findings.map((f, i) => (
        <li key={i} className={cx('flex gap-2 rounded-md p-2 text-xs', f.severity === 'BLOCK' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-900')}>
          {f.severity === 'BLOCK' ? <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          <span>
            <strong className="font-semibold">{f.code}</strong>
            {f.source === 'ai' && <Sparkles className="ml-1 inline h-3 w-3" />} · <span className="opacity-75">{f.field}</span> — {f.message}
            {f.autoFixable && <em className="ml-1 opacity-75">(auto-fixable)</em>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CharCount({ text, max }: { text: string; max: number }) {
  const over = text.length > max;
  return <span className={cx('ml-2 shrink-0 text-[10px] tabular-nums', over ? 'font-semibold text-rose-600' : 'text-slate-400')}>{text.length}/{max}</span>;
}

export function VariantCard({ variant, editable, onChanged }: { variant: Variant; editable: boolean; onChanged: (v: Variant) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ headlines: '', primaryTexts: '', descriptions: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const google = GOOGLE(variant.platform);

  const startEdit = () => {
    setDraft({ headlines: variant.headlines.join('\n'), primaryTexts: variant.primaryTexts.join('\n---\n'), descriptions: variant.descriptions.join('\n') });
    setEditing(true);
  };
  const save = async (patch: Partial<Variant>) => {
    setBusy(true);
    setError(null);
    try {
      onChanged(await api.updateVariant(variant.campaignId, variant.id, patch));
      setEditing(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={cx('rounded-xl border bg-white p-4 shadow-sm', variant.isSelected ? 'border-brand-500 ring-1 ring-brand-500' : 'border-slate-200')}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLATFORM_COLOR[variant.platform] }} />
          <span className="text-xs font-medium text-slate-500">{PLATFORM_LABEL[variant.platform]}</span>
          <span className="text-sm font-semibold text-slate-900">{variant.hookAngle}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={COMPLIANCE_STYLE[variant.complianceStatus]}>{label(variant.complianceStatus)}</Badge>
          {editable && !editing && (
            <button aria-label="Edit variant" onClick={startEdit} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>
      <ErrorBanner error={error} onClose={() => setError(null)} />

      {editing ? (
        <div className="mt-3 space-y-3 text-sm">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Headlines (one per line{google ? ', max 30 chars' : ''})</span>
            <textarea rows={google ? 8 : 2} className={inputCls + ' mt-1 font-mono text-xs'} value={draft.headlines} onChange={(e) => setDraft({ ...draft, headlines: e.target.value })} />
          </label>
          {!google && (
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Primary text (separate variants with a line containing ---)</span>
              <textarea rows={6} className={inputCls + ' mt-1 text-xs'} value={draft.primaryTexts} onChange={(e) => setDraft({ ...draft, primaryTexts: e.target.value })} />
            </label>
          )}
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Descriptions (one per line{google ? ', max 90 chars' : ''})</span>
            <textarea rows={google ? 4 : 2} className={inputCls + ' mt-1 font-mono text-xs'} value={draft.descriptions} onChange={(e) => setDraft({ ...draft, descriptions: e.target.value })} />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={() =>
                save({
                  headlines: draft.headlines.split('\n').map((s) => s.trim()).filter(Boolean),
                  primaryTexts: google ? [] : draft.primaryTexts.split(/\n---\n/).map((s) => s.trim()).filter(Boolean),
                  descriptions: draft.descriptions.split('\n').map((s) => s.trim()).filter(Boolean),
                })
              }
            >
              Save &amp; re-check
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3 text-sm">
          {google ? (
            <>
              <div>
                <p className="text-xs font-medium text-slate-500">Headlines ({variant.headlines.length})</p>
                <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                  {variant.headlines.map((h, i) => (
                    <li key={i} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs">
                      <span className="truncate">{h}</span>
                      <CharCount text={h} max={30} />
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Descriptions ({variant.descriptions.length})</p>
                <ul className="mt-1 space-y-1">
                  {variant.descriptions.map((d, i) => (
                    <li key={i} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs">
                      <span>{d}</span>
                      <CharCount text={d} max={90} />
                    </li>
                  ))}
                </ul>
              </div>
              {variant.keywords && variant.keywords.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500">High-intent keywords (phrase match)</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {variant.keywords.map((k) => (
                      <Badge key={k}>"{k}"</Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="font-semibold text-slate-900">{variant.headlines[0]}</p>
              {variant.primaryTexts.map((t, i) => (
                <p key={i} className="whitespace-pre-line text-slate-700">
                  {t}
                </p>
              ))}
              <p className="text-xs text-slate-500">
                {variant.descriptions[0]} · CTA: <strong>{label(variant.callToAction)}</strong>
              </p>
            </>
          )}
          {variant.targetingSuggestions && (
            <div className="rounded-lg bg-sky-50 p-2 text-xs text-sky-900">
              <p className="font-medium">Recommended LinkedIn targeting</p>
              {variant.targetingSuggestions.jobTitles && <p>Job titles: {variant.targetingSuggestions.jobTitles.join(', ')}</p>}
              {variant.targetingSuggestions.industries && <p>Industries: {variant.targetingSuggestions.industries.join(', ')}</p>}
              {variant.targetingSuggestions.companySizes && <p>Company sizes: {variant.targetingSuggestions.companySizes.join(', ')}</p>}
            </div>
          )}
          {variant.mediaBriefOrUrl && (
            <p className="flex gap-2 rounded-lg bg-violet-50 p-2 text-xs text-violet-900">
              <Film className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {variant.mediaBriefOrUrl}
            </p>
          )}
        </div>
      )}

      <div className="mt-3 border-t border-slate-100 pt-3">
        <FindingsList findings={variant.complianceNotes} />
      </div>
      {editable && (
        <div className="mt-3 flex justify-end">
          {variant.isSelected ? (
            <Badge className="bg-brand-50 text-brand-700">Selected for {PLATFORM_LABEL[variant.platform]}</Badge>
          ) : (
            <Button variant="secondary" loading={busy} onClick={() => save({ isSelected: true })}>
              Use this variant
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

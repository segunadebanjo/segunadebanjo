import { useState } from 'react';
import { Play, Save, Settings2 } from 'lucide-react';
import { api } from '../api';
import { n } from '../format';
import type { OptimizationRule } from '../types';
import { Badge, Button, Card, ErrorBanner, Spinner, inputCls, useAsync } from './ui';

const DESCRIPTION: Record<OptimizationRule['ruleType'], string> = {
  PAUSE_ZERO_QUOTES: 'Pause a deployment that spends at least the threshold without a single quote started.',
  SCALE_HIGH_ROAS: 'Recommend a budget increase for deployments beating the target Policy ROAS.',
  FLAG_HIGH_CPA: 'Flag deployments whose cost per policy exceeds the maximum.',
};

type Draft = { spendThreshold: string; targetRoas: string; maxCostPerPolicy: string; budgetIncreasePct: string; lookbackDays: string; mode: OptimizationRule['mode']; isEnabled: boolean };
const toDraft = (r: OptimizationRule): Draft => ({
  spendThreshold: r.spendThreshold === null ? '' : String(n(r.spendThreshold)),
  targetRoas: r.targetRoas === null ? '' : String(n(r.targetRoas)),
  maxCostPerPolicy: r.maxCostPerPolicy === null ? '' : String(n(r.maxCostPerPolicy)),
  budgetIncreasePct: String(r.budgetIncreasePct),
  lookbackDays: String(r.lookbackDays),
  mode: r.mode,
  isEnabled: r.isEnabled,
});

export function RulesPanel({ onRun }: { onRun?: () => void }) {
  const rules = useAsync(() => api.rules(), []);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const draft = (r: OptimizationRule) => drafts[r.id] ?? toDraft(r);
  const set = (r: OptimizationRule, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [r.id]: { ...draft(r), ...patch } }));
  const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s));

  const save = async (r: OptimizationRule) => {
    const d = draft(r);
    setSaving(r.id);
    setError(null);
    try {
      await api.updateRule(r.id, {
        spendThreshold: numOrNull(d.spendThreshold),
        targetRoas: numOrNull(d.targetRoas),
        maxCostPerPolicy: numOrNull(d.maxCostPerPolicy),
        budgetIncreasePct: Number(d.budgetIncreasePct),
        lookbackDays: Number(d.lookbackDays),
        mode: d.mode,
        isEnabled: d.isEnabled,
      });
      setDrafts((x) => {
        const { [r.id]: _, ...rest } = x;
        return rest;
      });
      await rules.reload();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(null);
    }
  };

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const r = await api.runOptimization();
      setMsg(`${r.created} new recommendation(s)${r.autoApplied ? `, ${r.autoApplied} auto-applied` : ''}.`);
      onRun?.();
    } catch (e) {
      setError(e);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-slate-400" /> Automated optimization rules
        </span>
      }
      actions={
        <Button variant="secondary" icon={<Play className="h-4 w-4" />} loading={running} onClick={run}>
          Run now
        </Button>
      }
    >
      <ErrorBanner error={error ?? rules.error} onClose={() => setError(null)} />
      {msg && <p className="mb-3 text-sm text-emerald-700">{msg}</p>}
      {rules.loading && !rules.data ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          {rules.data?.map((r) => {
            const d = draft(r);
            const dirty = Boolean(drafts[r.id]);
            return (
              <div key={r.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{r.name}</p>
                    <p className="text-xs text-slate-500">{DESCRIPTION[r.ruleType]}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={d.isEnabled} onChange={(e) => set(r, { isEnabled: e.target.checked })} className="h-4 w-4 accent-brand-700" />
                    Enabled
                  </label>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">
                  <Small label="Spend threshold (₦)">
                    <input className={inputCls} inputMode="decimal" value={d.spendThreshold} onChange={(e) => set(r, { spendThreshold: e.target.value })} />
                  </Small>
                  {r.ruleType === 'SCALE_HIGH_ROAS' && (
                    <>
                      <Small label="Target ROAS (x)">
                        <input className={inputCls} inputMode="decimal" value={d.targetRoas} onChange={(e) => set(r, { targetRoas: e.target.value })} />
                      </Small>
                      <Small label="Budget increase %">
                        <input className={inputCls} inputMode="numeric" value={d.budgetIncreasePct} onChange={(e) => set(r, { budgetIncreasePct: e.target.value })} />
                      </Small>
                    </>
                  )}
                  {r.ruleType === 'FLAG_HIGH_CPA' && (
                    <Small label="Max cost / policy (₦)">
                      <input className={inputCls} inputMode="decimal" value={d.maxCostPerPolicy} onChange={(e) => set(r, { maxCostPerPolicy: e.target.value })} />
                    </Small>
                  )}
                  <Small label="Lookback (days)">
                    <input className={inputCls} inputMode="numeric" value={d.lookbackDays} onChange={(e) => set(r, { lookbackDays: e.target.value })} />
                  </Small>
                  <Small label="Mode">
                    <select className={inputCls} value={d.mode} onChange={(e) => set(r, { mode: e.target.value as Draft['mode'] })}>
                      <option value="RECOMMEND">Recommend</option>
                      <option value="AUTO_APPLY">Auto-apply</option>
                    </select>
                  </Small>
                  <div className="flex items-end">
                    <Button variant={dirty ? 'primary' : 'secondary'} disabled={!dirty} loading={saving === r.id} icon={<Save className="h-4 w-4" />} onClick={() => save(r)}>
                      Save
                    </Button>
                  </div>
                </div>
                {d.mode === 'AUTO_APPLY' && <Badge className="mt-3 bg-amber-100 text-amber-800">Changes live budgets/status automatically</Badge>}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function Small({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-slate-500">{label}</span>
      {children}
    </label>
  );
}

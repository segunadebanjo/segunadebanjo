import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, PauseCircle, TrendingUp, Flag, X, Zap } from 'lucide-react';
import { api } from '../api';
import { PLATFORM_LABEL, label, money } from '../format';
import type { Recommendation } from '../types';
import { Badge, Button, Card, EmptyState, ErrorBanner, PageHeader, Spinner, cx, filterCls, useAsync } from '../components/ui';
import { RulesPanel } from '../components/RulesPanel';
import { useAuth } from '../auth';

const ICON = { PAUSE: PauseCircle, INCREASE_BUDGET: TrendingUp, FLAG: Flag };
const TONE = { PAUSE: 'bg-rose-100 text-rose-700', INCREASE_BUDGET: 'bg-emerald-100 text-emerald-700', FLAG: 'bg-amber-100 text-amber-700' };

export function Optimization() {
  const { canWrite } = useAuth();
  const [status, setStatus] = useState('OPEN');
  const recs = useAsync(() => api.recommendations(status || undefined), [status]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);

  const act = async (r: Recommendation, kind: 'apply' | 'dismiss') => {
    setBusy(r.id);
    setError(null);
    try {
      if (kind === 'apply') await api.applyRecommendation(r.id);
      else await api.dismissRecommendation(r.id);
      await recs.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Optimization" subtitle="Rules flag wasted spend and scale winners. Apply recommendations to push budget/status changes to the ad platform." />
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Card
            title="Recommendations"
            actions={
              <select aria-label="Status" className={filterCls + ' py-1'} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="OPEN">Open</option>
                <option value="APPLIED">Applied</option>
                <option value="DISMISSED">Dismissed</option>
                <option value="">All</option>
              </select>
            }
            padded={false}
          >
            <div className="p-4">
              <ErrorBanner error={error ?? recs.error} onClose={() => setError(null)} />
            </div>
            {recs.loading && !recs.data ? (
              <Spinner />
            ) : !recs.data?.length ? (
              <EmptyState icon={<Zap className="h-10 w-10" />} title="Nothing to review">
                Run the rules to evaluate active deployments.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recs.data.map((r) => {
                  const Icon = ICON[r.action];
                  return (
                    <li key={r.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                      <div className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', TONE[r.action])}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {label(r.action)} · {PLATFORM_LABEL[r.deployment.platform]} ·{' '}
                          <Link className="text-brand-700 hover:underline" to={`/campaigns/${r.deployment.campaign.id}`}>
                            {r.deployment.campaign.name}
                          </Link>
                        </p>
                        <p className="text-sm text-slate-600">{r.reason}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {r.rule.name} · {r.metricsSnapshot.lookbackDays}d: spend {money(r.metricsSnapshot.spend)}, {r.metricsSnapshot.quotesStarted} quotes, {r.metricsSnapshot.policiesSold} policies
                          {r.suggestedBudget && (
                            <>
                              {' '}
                              · budget {money(r.deployment.dailyBudget)} → <strong>{money(r.suggestedBudget)}</strong>
                            </>
                          )}
                        </p>
                      </div>
                      {r.status === 'OPEN' && !canWrite ? (
                        <Badge>Open</Badge>
                      ) : r.status === 'OPEN' ? (
                        <div className="flex gap-2">
                          <Button variant="secondary" icon={<X className="h-4 w-4" />} disabled={busy === r.id} onClick={() => act(r, 'dismiss')}>
                            Dismiss
                          </Button>
                          <Button icon={<Check className="h-4 w-4" />} loading={busy === r.id} onClick={() => act(r, 'apply')}>
                            {r.action === 'FLAG' ? 'Acknowledge' : 'Apply'}
                          </Button>
                        </div>
                      ) : (
                        <Badge>{label(r.status)}</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
        <div className="xl:col-span-2">
          <RulesPanel onRun={recs.reload} />
        </div>
      </div>
    </>
  );
}

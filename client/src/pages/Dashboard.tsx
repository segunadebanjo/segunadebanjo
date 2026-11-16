import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Cell } from 'recharts';
import { BarChart3, RefreshCw, Zap } from 'lucide-react';
import { api } from '../api';
import { CLASS_LABEL, PLATFORM_COLOR, PLATFORM_LABEL, compact, int, money, pct, roas } from '../format';
import { CLASSES, PLATFORMS, type Kpis } from '../types';
import { Button, Card, EmptyState, ErrorBanner, PageHeader, Spinner, filterCls, useAsync } from '../components/ui';
import { RulesPanel } from '../components/RulesPanel';
import { useAuth } from '../auth';

const KPI_DEFS: { key: keyof Kpis; label: string; fmt: (v: number | null) => string; hint?: string }[] = [
  { key: 'spend', label: 'Spend', fmt: (v) => money(v, 'NGN', true) },
  { key: 'clicks', label: 'Clicks', fmt: int },
  { key: 'ctr', label: 'CTR', fmt: (v) => pct(v) },
  { key: 'quotesStarted', label: 'Quotes started', fmt: int },
  { key: 'costPerQuote', label: 'Cost / quote', fmt: (v) => money(v) },
  { key: 'policiesSold', label: 'Policies sold', fmt: int },
  { key: 'costPerPolicy', label: 'Cost / policy', fmt: (v) => money(v) },
  { key: 'revenue', label: 'Policy revenue', fmt: (v) => money(v, 'NGN', true) },
  { key: 'roas', label: 'Policy ROAS', fmt: roas, hint: 'revenue ÷ spend' },
];

const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function Dashboard() {
  const { canWrite } = useAuth();
  const [cls, setCls] = useState('');
  const [platform, setPlatform] = useState('');
  const [days, setDays] = useState(30);
  const ov = useAsync(() => api.overview({ insuranceClass: cls || undefined, platform: platform || undefined, days }), [cls, platform, days]);
  const [syncing, setSyncing] = useState(false);

  const sync = async () => {
    setSyncing(true);
    try {
      await api.syncMetrics();
      await ov.reload();
    } finally {
      setSyncing(false);
    }
  };

  const d = ov.data;
  // Hide the Applications stage when the ERP doesn't send APPLICATION_SUBMITTED events.
  const funnel = d ? d.funnel.filter((s) => s.stage !== 'Applications' || s.value > 0) : [];
  return (
    <>
      <PageHeader
        title="Performance dashboard"
        subtitle="Spend, funnel and Policy ROAS across Facebook, Instagram, Google Ads and LinkedIn"
        actions={
          <>
            <select aria-label="Insurance class" className={filterCls} value={cls} onChange={(e) => setCls(e.target.value)}>
              <option value="">All classes</option>
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  {CLASS_LABEL[c]}
                </option>
              ))}
            </select>
            <select aria-label="Platform" className={filterCls} value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="">All platforms</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABEL[p]}
                </option>
              ))}
            </select>
            <select aria-label="Date range" className={filterCls} value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[7, 14, 30, 90].map((x) => (
                <option key={x} value={x}>
                  Last {x} days
                </option>
              ))}
            </select>
            {canWrite && (
              <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={syncing} onClick={sync}>
                Sync metrics
              </Button>
            )}
          </>
        }
      />
      <ErrorBanner error={ov.error} />
      {!d ? (
        <Spinner />
      ) : (
        <div className={ov.loading ? 'opacity-60 transition' : 'transition'}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-9">
            {KPI_DEFS.map((k) => (
              <div key={k.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-500">{k.label}</p>
                <p className="mt-1 truncate text-lg font-semibold text-slate-900 tabular-nums" title={String(d.totals[k.key] ?? '')}>{k.fmt(d.totals[k.key] as number | null)}</p>
                {k.hint && <p className="text-[11px] text-slate-400">{k.hint}</p>}
              </div>
            ))}
          </div>

          {d.totals.spend === 0 ? (
            <Card className="mt-6">
              <EmptyState icon={<BarChart3 className="h-10 w-10" />} title="No performance data for this filter">
                Publish and activate a campaign, then sync metrics.
              </EmptyState>
            </Card>
          ) : (
            <>
              <div className="mt-6 grid gap-6 xl:grid-cols-3">
                <Card title="Spend vs. policy revenue" className="xl:col-span-2">
                  <div className="h-72">
                    <ResponsiveContainer>
                      <ComposedChart data={d.daily} margin={{ left: 8, right: 8, top: 8 }}>
                        <CartesianGrid stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} minTickGap={24} />
                        <YAxis yAxisId="ngn" tickFormatter={(v: number) => `₦${compact(v)}`} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={64} />
                        <YAxis yAxisId="roas" orientation="right" tickFormatter={(v: number) => `${v}x`} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={40} />
                        <Tooltip
                          formatter={(value, name) => (name === 'Policy ROAS' ? roas(Number(value)) : money(Number(value)))}
                          labelFormatter={(l) => shortDate(String(l))}
                          contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar yAxisId="ngn" dataKey="spend" name="Spend" fill="#94a3b8" radius={[3, 3, 0, 0]} maxBarSize={18} />
                        <Bar yAxisId="ngn" dataKey="revenue" name="Policy revenue" fill="#0d9488" radius={[3, 3, 0, 0]} maxBarSize={18} />
                        <Line yAxisId="roas" dataKey="roas" name="Policy ROAS" stroke="#7c3aed" strokeWidth={2} dot={false} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card title="Funnel">
                  <ol className="space-y-3">
                    {funnel.map((s, i) => {
                      const max = funnel[0].value || 1;
                      const prev = i > 0 ? funnel[i - 1].value : null;
                      const w = Math.max(2, Math.sqrt(s.value / max) * 100);
                      return (
                        <li key={s.stage}>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-600">{s.stage}</span>
                            <span className="tabular-nums text-slate-900">
                              {int(s.value)}
                              {prev ? <span className="ml-1 text-slate-400">({pct(s.value / prev, 1)})</span> : null}
                            </span>
                          </div>
                          <div className="mt-1 h-2.5 rounded-full bg-slate-100">
                            <div className="h-2.5 rounded-full bg-brand-600" style={{ width: `${w}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  <p className="mt-4 text-[11px] text-slate-400">Bar widths use a square-root scale so later stages stay visible.</p>
                </Card>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <Card title="By platform" padded={false}>
                  <div className="h-48 px-3 pt-4">
                    <ResponsiveContainer>
                      <BarChart data={d.byPlatform} layout="vertical" margin={{ left: 8, right: 24 }}>
                        <XAxis type="number" tickFormatter={(v: number) => `${v.toFixed(1)}x`} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="platform" tickFormatter={(p: keyof typeof PLATFORM_LABEL) => PLATFORM_LABEL[p]} width={110} tick={{ fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v) => roas(Number(v))} labelFormatter={(p) => PLATFORM_LABEL[p as keyof typeof PLATFORM_LABEL]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="roas" name="Policy ROAS" radius={[0, 4, 4, 0]} maxBarSize={16}>
                          {d.byPlatform.map((p) => (
                            <Cell key={p.platform} fill={PLATFORM_COLOR[p.platform]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <BreakdownTable rows={d.byPlatform.map((p) => ({ key: p.platform, label: PLATFORM_LABEL[p.platform], color: PLATFORM_COLOR[p.platform], k: p }))} />
                </Card>
                <Card title="By insurance class" padded={false}>
                  <BreakdownTable rows={d.byClass.map((c) => ({ key: c.insuranceClass, label: CLASS_LABEL[c.insuranceClass], k: c }))} />
                  <div className="border-t border-slate-100 px-5 py-3">
                    <p className="mb-2 text-xs font-medium text-slate-500">Top campaigns by ROAS</p>
                    <ul className="space-y-1 text-sm">
                      {d.topCampaigns.slice(0, 5).map((c) => (
                        <li key={c.campaignId} className="flex justify-between gap-2">
                          <Link to={`/campaigns/${c.campaignId}`} className="truncate text-brand-700 hover:underline">
                            {c.name}
                          </Link>
                          <span className="tabular-nums text-slate-700">{roas(c.roas)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              </div>
            </>
          )}

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <RulesPanel onRun={ov.reload} />
            </div>
            <Card title="Recommendations">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums">{d.openRecommendations}</p>
                  <p className="text-xs text-slate-500">open recommendations</p>
                </div>
              </div>
              <Link to="/optimization" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline">
                Review &amp; apply →
              </Link>
              <p className="mt-4 text-xs text-slate-500">{d.activeCampaigns} active campaign(s). Rules run on a schedule (node-cron) and on demand.</p>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

function BreakdownTable({ rows }: { rows: { key: string; label: string; color?: string; k: Kpis }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500">
          <tr className="border-b border-slate-100">
            <th className="px-5 py-2 font-medium">Name</th>
            <th className="px-3 py-2 text-right font-medium">Spend</th>
            <th className="px-3 py-2 text-right font-medium">CTR</th>
            <th className="px-3 py-2 text-right font-medium">Quotes</th>
            <th className="px-3 py-2 text-right font-medium">Cost/quote</th>
            <th className="px-3 py-2 text-right font-medium">Policies</th>
            <th className="px-3 py-2 text-right font-medium">Cost/policy</th>
            <th className="px-5 py-2 text-right font-medium">ROAS</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-slate-50 last:border-0">
              <td className="px-5 py-2 whitespace-nowrap">
                {r.color && <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />}
                {r.label}
              </td>
              <td className="px-3 py-2 text-right">{money(r.k.spend, 'NGN', true)}</td>
              <td className="px-3 py-2 text-right">{pct(r.k.ctr)}</td>
              <td className="px-3 py-2 text-right">{int(r.k.quotesStarted)}</td>
              <td className="px-3 py-2 text-right">{money(r.k.costPerQuote)}</td>
              <td className="px-3 py-2 text-right">{int(r.k.policiesSold)}</td>
              <td className="px-3 py-2 text-right">{money(r.k.costPerPolicy)}</td>
              <td className={'px-5 py-2 text-right font-medium ' + ((r.k.roas ?? 0) >= 1 ? 'text-emerald-700' : 'text-rose-700')}>{roas(r.k.roas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

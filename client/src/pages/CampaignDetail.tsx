import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Archive, Pause, Pencil, Play, Rocket } from 'lucide-react';
import { api } from '../api';
import { CLASS_LABEL, PLATFORM_COLOR, PLATFORM_LABEL, STATUS_STYLE, int, label, money, roas } from '../format';
import { Badge, Button, Card, ErrorBanner, PageHeader, Spinner, useAsync } from '../components/ui';
import { VariantCard } from '../components/VariantCard';
import { useAuth } from '../auth';

export function CampaignDetail() {
  const { canWrite } = useAuth();
  const id = Number(useParams().id);
  const c = useAsync(() => api.campaign(id), [id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const act = async (kind: 'activate' | 'pause' | 'archive') => {
    if (kind === 'activate' && !confirm('Activate this campaign? Ads will start spending their daily budgets on every published platform.')) return;
    if (kind === 'archive' && !confirm('Archive this campaign? Active ads will be paused first.')) return;
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'activate') await api.activate(id);
      else if (kind === 'pause') await api.pause(id);
      else await api.archiveCampaign(id);
      await c.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  if (c.loading && !c.data) return <Spinner />;
  if (!c.data) return <ErrorBanner error={c.error ?? 'Campaign not found'} />;
  const campaign = c.data;
  const draft = ['DRAFT', 'PENDING_REVIEW'].includes(campaign.status);
  const published = campaign.deployments.some((d) => d.externalCampaignId);
  const perf = new Map((campaign.performance ?? []).map((p) => [p.deploymentId, p]));
  const tot = (campaign.performance ?? []).reduce(
    (a, p) => ({ spend: a.spend + p.spend, revenue: a.revenue + p.revenue, quotes: a.quotes + p.quotesStarted, policies: a.policies + p.policiesSold }),
    { spend: 0, revenue: 0, quotes: 0, policies: 0 },
  );

  return (
    <>
      <PageHeader
        title={campaign.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge className={STATUS_STYLE[campaign.status]}>{label(campaign.status)}</Badge>
            <span>
              {CLASS_LABEL[campaign.product.insuranceClass]} · {campaign.product.name} · {label(campaign.objective)} · {money(campaign.totalDailyBudget, campaign.currency)}/day
            </span>
          </span>
        }
        actions={
          canWrite && (
          <>
            {draft && (
              <Link to={`/campaigns/new?id=${campaign.id}&step=${campaign.variants.length ? 2 : 1}`}>
                <Button variant="secondary" icon={<Pencil className="h-4 w-4" />}>
                  Continue in builder
                </Button>
              </Link>
            )}
            {draft && campaign.variants.length > 0 && (
              <Link to={`/campaigns/new?id=${campaign.id}&step=3`}>
                <Button icon={<Rocket className="h-4 w-4" />}>Publish</Button>
              </Link>
            )}
            {published && campaign.status !== 'ACTIVE' && campaign.status !== 'ARCHIVED' && (
              <Button icon={<Play className="h-4 w-4" />} loading={busy === 'activate'} onClick={() => act('activate')}>
                Activate
              </Button>
            )}
            {campaign.status === 'ACTIVE' && (
              <Button variant="secondary" icon={<Pause className="h-4 w-4" />} loading={busy === 'pause'} onClick={() => act('pause')}>
                Pause all
              </Button>
            )}
            {campaign.status !== 'ARCHIVED' && (
              <Button variant="ghost" icon={<Archive className="h-4 w-4" />} loading={busy === 'archive'} onClick={() => act('archive')}>
                Archive
              </Button>
            )}
          </>
          )
        }
      />
      <ErrorBanner error={error} onClose={() => setError(null)} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ['30d spend', money(tot.spend)],
          ['Quotes', int(tot.quotes)],
          ['Policies', int(tot.policies)],
          ['Policy revenue', money(tot.revenue)],
          ['Policy ROAS', roas(tot.spend ? tot.revenue / tot.spend : null)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{k}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Platform deployments" className="xl:col-span-2" padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-2 font-medium">Platform</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Budget/day</th>
                  <th className="px-3 py-2 text-right font-medium">Spend</th>
                  <th className="px-3 py-2 text-right font-medium">Clicks</th>
                  <th className="px-3 py-2 text-right font-medium">Quotes</th>
                  <th className="px-3 py-2 text-right font-medium">Policies</th>
                  <th className="px-5 py-2 text-right font-medium">ROAS</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {campaign.deployments.map((d) => {
                  const p = perf.get(d.id);
                  return (
                    <tr key={d.id} className="border-b border-slate-50 align-top">
                      <td className="px-5 py-2">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLATFORM_COLOR[d.platform] }} />
                          {PLATFORM_LABEL[d.platform]}
                        </span>
                        {d.externalCampaignId && <p className="mt-0.5 max-w-[14rem] truncate font-mono text-[10px] text-slate-400" title={d.externalCampaignId}>{d.externalCampaignId}</p>}
                        {d.lastError && <p className="mt-0.5 max-w-xs text-xs text-rose-600">{d.lastError}</p>}
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={d.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : d.status === 'ERROR' ? 'bg-rose-100 text-rose-700' : undefined}>{label(d.status)}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">{money(d.dailyBudget, campaign.currency)}</td>
                      <td className="px-3 py-2 text-right">{p ? money(p.spend) : '—'}</td>
                      <td className="px-3 py-2 text-right">{p ? int(p.clicks) : '—'}</td>
                      <td className="px-3 py-2 text-right">{p ? int(p.quotesStarted) : '—'}</td>
                      <td className="px-3 py-2 text-right">{p ? int(p.policiesSold) : '—'}</td>
                      <td className="px-5 py-2 text-right font-medium">{p ? roas(p.roas) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Tracking & compliance">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">utm_campaign (send back in the conversion webhook)</dt>
              <dd className="mt-0.5 font-mono text-xs break-all">{campaign.utmCampaign ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Meta Special Ad Category</dt>
              <dd>{campaign.specialAdCategory ? <Badge className="bg-indigo-100 text-indigo-800">{campaign.specialAdCategory}</Badge> : 'None (no Meta placements)'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Locations</dt>
              <dd>
                {campaign.targetLocations.countries.join(', ')}
                {campaign.targetLocations.regions?.length ? ` · ${campaign.targetLocations.regions.join(', ')}` : ''}
                {campaign.targetLocations.cities?.length ? ` · ${campaign.targetLocations.cities.map((c) => `${c.name}${c.radiusKm ? ` (${c.radiusKm} km)` : ''}`).join(', ')}` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">License disclosure</dt>
              <dd>{campaign.product.regulatoryLicenseNumber}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-slate-700">Creatives ({campaign.variants.length})</h2>
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {campaign.variants.map((v) => (
          <VariantCard key={v.id} variant={v} editable={false} onChanged={() => c.reload()} />
        ))}
      </div>
    </>
  );
}

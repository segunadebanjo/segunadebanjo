import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Plus } from 'lucide-react';
import { api } from '../api';
import { CLASS_LABEL, PLATFORM_COLOR, PLATFORM_LABEL, STATUS_STYLE, label, money } from '../format';
import { Badge, Button, Card, EmptyState, ErrorBanner, PageHeader, Spinner, filterCls, useAsync } from '../components/ui';

export function Campaigns() {
  const [status, setStatus] = useState('');
  const list = useAsync(() => api.campaigns({ status: status || undefined }), [status]);
  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="Multi-platform insurance campaigns. New campaigns publish PAUSED; nothing spends until you activate."
        actions={
          <>
            <select aria-label="Status" className={filterCls} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All (excl. archived)</option>
              {['DRAFT', 'PENDING_REVIEW', 'PAUSED', 'ACTIVE', 'ARCHIVED'].map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
            <Link to="/campaigns/new">
              <Button icon={<Plus className="h-4 w-4" />}>New campaign</Button>
            </Link>
          </>
        }
      />
      <ErrorBanner error={list.error} />
      <Card padded={false}>
        {list.loading && !list.data ? (
          <Spinner />
        ) : !list.data?.length ? (
          <EmptyState icon={<Megaphone className="h-10 w-10" />} title="No campaigns">
            <Link to="/campaigns/new" className="text-brand-700 hover:underline">
              Create your first campaign
            </Link>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3 font-medium">Campaign</th>
                  <th className="px-3 py-3 font-medium">Class</th>
                  <th className="px-3 py-3 font-medium">Objective</th>
                  <th className="px-3 py-3 font-medium">Platforms</th>
                  <th className="px-3 py-3 text-right font-medium">Daily budget</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link to={`/campaigns/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {c.name}
                      </Link>
                      <p className="text-xs text-slate-500">{c.product.name}</p>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{CLASS_LABEL[c.product.insuranceClass]}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{label(c.objective)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.deployments.map((d) => (
                          <span key={d.id} className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs" title={d.status}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: PLATFORM_COLOR[d.platform] }} />
                            {PLATFORM_LABEL[d.platform]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{money(c.totalDailyBudget, c.currency)}</td>
                    <td className="px-5 py-3">
                      <Badge className={STATUS_STYLE[c.status]}>{label(c.status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

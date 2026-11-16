import { useState } from 'react';
import { Send, Webhook } from 'lucide-react';
import { api } from '../api';
import { PLATFORM_LABEL, label, money } from '../format';
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, PageHeader, Spinner, inputCls, useAsync } from '../components/ui';

const CURL = `curl -X POST "$API_URL/api/webhooks/conversions" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $WEBHOOK_SECRET_KEY" \\
  -d '{
    "eventId": "erp-policy-000123",
    "gclid": "Cj0KCQiA...",
    "utm_campaign": "ins-1-motor-q4-lagos-abuja",
    "eventType": "POLICY_PURCHASED",
    "policyPremiumValue": 87500.00,
    "currency": "NGN",
    "email": "customer@example.com"
  }'`;

export function Conversions() {
  const events = useAsync(() => api.conversions(), []);
  const status = useAsync(() => api.platformStatus(), []);
  const [form, setForm] = useState({ clickType: 'fbclid', clickId: 'IwAR-demo-' + Math.random().toString(36).slice(2, 8), utm: '', utmSource: '', eventType: 'POLICY_PURCHASED', value: '85000' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<unknown>(null);

  const simulate = async () => {
    setSending(true);
    setError(null);
    try {
      const r = await api.simulateConversion({
        [form.clickType]: form.clickId,
        utm_campaign: form.utm || undefined,
        utm_source: form.utmSource || undefined,
        eventType: form.eventType,
        policyPremiumValue: Number(form.value) || 0,
      });
      setResult(r);
      await events.reload();
    } catch (e) {
      setError(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader title="Conversions" subtitle="Events from the ERP / quote portal, attributed to campaigns and sent back to Meta CAPI, Google Enhanced Conversions and LinkedIn CAPI" />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-1">
          <Card title="Webhook integration">
            <p className="text-sm text-slate-600">
              <code className="rounded bg-slate-100 px-1">POST /api/webhooks/conversions</code> with header <code className="rounded bg-slate-100 px-1">x-api-key</code>. Send <code>eventId</code> for idempotency.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{CURL}</pre>
          </Card>
          {status.data?.sandboxMode && (
            <Card title="Simulate an event (sandbox)">
              <ErrorBanner error={error} onClose={() => setError(null)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Click id type">
                  <select className={inputCls} value={form.clickType} onChange={(e) => setForm({ ...form, clickType: e.target.value })}>
                    <option value="fbclid">fbclid</option>
                    <option value="gclid">gclid</option>
                    <option value="li_fat_id">li_fat_id</option>
                  </select>
                </Field>
                <Field label="Click id">
                  <input className={inputCls} value={form.clickId} onChange={(e) => setForm({ ...form, clickId: e.target.value })} />
                </Field>
                <Field label="utm_campaign" className="col-span-2" hint="e.g. ins-1-motor-q4-lagos-abuja (shown on each campaign page)">
                  <input className={inputCls} value={form.utm} onChange={(e) => setForm({ ...form, utm: e.target.value })} />
                </Field>
                <Field label="utm_source" hint="instagram / facebook / google_display">
                  <input className={inputCls} value={form.utmSource} onChange={(e) => setForm({ ...form, utmSource: e.target.value })} />
                </Field>
                <Field label="Event">
                  <select className={inputCls} value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })}>
                    <option value="QUOTE_STARTED">Quote started</option>
                    <option value="APPLICATION_SUBMITTED">Application submitted</option>
                    <option value="POLICY_PURCHASED">Policy purchased</option>
                  </select>
                </Field>
                <Field label="Policy premium (₦)" className="col-span-2">
                  <input className={inputCls} inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
                </Field>
              </div>
              <Button className="mt-4" icon={<Send className="h-4 w-4" />} loading={sending} onClick={simulate}>
                Send test event
              </Button>
              {result !== null && <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(result, null, 2)}</pre>}
            </Card>
          )}
        </div>
        <Card title="Recent events" className="xl:col-span-2" padded={false}>
          <ErrorBanner error={events.error} />
          {events.loading && !events.data ? (
            <Spinner />
          ) : !events.data?.length ? (
            <EmptyState icon={<Webhook className="h-10 w-10" />} title="No conversion events yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="px-5 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Event</th>
                    <th className="px-3 py-2 font-medium">Campaign / platform</th>
                    <th className="px-3 py-2 font-medium">Click id</th>
                    <th className="px-3 py-2 text-right font-medium">Premium</th>
                    <th className="px-5 py-2 font-medium">CAPI dispatch</th>
                  </tr>
                </thead>
                <tbody>
                  {events.data.map((e) => (
                    <tr key={e.id} className="border-b border-slate-50 align-top">
                      <td className="px-5 py-2 whitespace-nowrap text-slate-500">{new Date(e.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{label(e.eventType)}</td>
                      <td className="px-3 py-2">
                        {e.campaign ? e.campaign.name : <span className="text-slate-400">Unattributed</span>}
                        {e.platform && <p className="text-xs text-slate-500">{PLATFORM_LABEL[e.platform]}</p>}
                      </td>
                      <td className="max-w-[10rem] truncate px-3 py-2 font-mono text-xs text-slate-500" title={e.clickId ?? ''}>
                        {e.clickIdType ? `${e.clickIdType}: ` : ''}
                        {e.clickId ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.eventType === 'POLICY_PURCHASED' ? money(e.policyPremiumValue, e.currency) : '—'}</td>
                      <td className="px-5 py-2">
                        <div className="flex flex-wrap gap-1">
                          {(e.dispatchResults ?? [])
                            .filter((d) => d.status !== 'skipped')
                            .map((d) => (
                              <Badge key={d.destination} className={d.status === 'failed' ? 'bg-rose-100 text-rose-700' : d.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                                <span title={d.detail}>
                                  {d.destination.replace('_', ' ')}: {d.status}
                                </span>
                              </Badge>
                            ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

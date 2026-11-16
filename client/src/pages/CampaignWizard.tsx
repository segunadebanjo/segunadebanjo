import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Rocket, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { api, type CampaignInput } from '../api';
import { CLASS_LABEL, PLATFORM_COLOR, PLATFORM_LABEL, label, money, n } from '../format';
import { PLATFORMS, type Campaign, type Objective, type Platform, type ValidationReport, type Variant } from '../types';
import { Badge, Button, Card, ErrorBanner, Field, PageHeader, Spinner, cx, inputCls, useAsync } from '../components/ui';
import { FindingsList, VariantCard } from '../components/VariantCard';

const STEPS = ['Setup & budget', 'AI creatives', 'Compliance', 'Publish'];
const NG_STATES = ['Lagos', 'Federal Capital Territory', 'Rivers', 'Oyo', 'Kano', 'Kaduna', 'Ogun', 'Enugu', 'Delta', 'Anambra', 'Edo', 'Akwa Ibom'];
const DEFAULT_SPLIT: Partial<Record<Platform, number>> = { FACEBOOK: 30, INSTAGRAM: 20, GOOGLE_SEARCH: 40, LINKEDIN: 10 };

interface SetupForm {
  productId: number | '';
  name: string;
  objective: Objective;
  totalDailyBudget: string;
  countries: string;
  regions: string[];
  cities: string; // "Ikeja:25, Lekki:30"
  postalCodes: string;
  split: Partial<Record<Platform, number>>;
}

export function CampaignWizard() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const campaignId = params.get('id') ? Number(params.get('id')) : null;
  const step = Math.min(3, Math.max(0, Number(params.get('step') ?? 0)));
  const go = (s: number, id = campaignId) => setParams(id ? { id: String(id), step: String(s) } : { step: String(s) });

  const products = useAsync(() => api.products({ active: true }), []);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<SetupForm>({ productId: '', name: '', objective: 'POLICY_PURCHASE', totalDailyBudget: '100000', countries: 'NG', regions: ['Lagos'], cities: '', postalCodes: '', split: DEFAULT_SPLIT });

  // Load an existing draft when resuming (?id=)
  useEffect(() => {
    if (!campaignId) return;
    api
      .campaign(campaignId)
      .then((c) => {
        setCampaign(c);
        const total = n(c.totalDailyBudget);
        const split: Partial<Record<Platform, number>> = {};
        c.deployments.forEach((d) => (split[d.platform] = total ? Math.round((n(d.dailyBudget) / total) * 10000) / 100 : 0));
        setForm({
          productId: c.productId,
          name: c.name,
          objective: c.objective,
          totalDailyBudget: String(total),
          countries: c.targetLocations.countries.join(', '),
          regions: c.targetLocations.regions ?? [],
          cities: (c.targetLocations.cities ?? []).map((x) => `${x.name}${x.radiusKm ? `:${x.radiusKm}` : ''}`).join(', '),
          postalCodes: (c.targetLocations.postalCodes ?? []).join(', '),
          split,
        });
      })
      .catch(setError);
  }, [campaignId]);

  const product = products.data?.find((p) => p.id === form.productId);
  const splitTotal = useMemo(() => Object.values(form.split).reduce((s, v) => s + (v ?? 0), 0), [form.split]);
  const locked = campaign && !['DRAFT', 'PENDING_REVIEW'].includes(campaign.status);

  const payload = (): CampaignInput => ({
    productId: Number(form.productId),
    name: form.name.trim(),
    objective: form.objective,
    totalDailyBudget: Number(form.totalDailyBudget),
    budgetSplit: Object.fromEntries(Object.entries(form.split).filter(([, v]) => (v ?? 0) > 0)),
    targetLocations: {
      countries: form.countries.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
      ...(form.regions.length ? { regions: form.regions } : {}),
      ...(form.cities.trim()
        ? {
            cities: form.cities.split(',').map((s) => {
              const [name, r] = s.split(':').map((x) => x.trim());
              return r ? { name, radiusKm: Number(r) } : { name };
            }),
          }
        : {}),
      ...(form.postalCodes.trim() ? { postalCodes: form.postalCodes.split(',').map((s) => s.trim()).filter(Boolean) } : {}),
    },
  });

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const saveSetup = () =>
    run(async () => {
      const c = campaign ? await api.updateCampaign(campaign.id, payload()) : await api.createCampaign(payload());
      setCampaign(c);
      go(1, c.id);
    });

  return (
    <>
      <PageHeader
        title={campaign ? `Campaign: ${campaign.name}` : 'New multi-platform campaign'}
        subtitle="Build once, generate platform-native creatives, pass compliance, then publish PAUSED to every platform."
        actions={
          campaign && (
            <Link to={`/campaigns/${campaign.id}`} className="text-sm text-brand-700 hover:underline">
              Open campaign page →
            </Link>
          )
        }
      />
      <ol className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              disabled={!campaign && i > 0}
              onClick={() => go(i)}
              className={cx(
                'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50',
                i === step ? 'border-brand-600 bg-brand-50 font-medium text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              <span className={cx('flex h-6 w-6 items-center justify-center rounded-full text-xs', i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-brand-700 text-white' : 'bg-slate-100')}>
                {i < step ? '✓' : i + 1}
              </span>
              {s}
            </button>
          </li>
        ))}
      </ol>
      <ErrorBanner error={error} onClose={() => setError(null)} />

      {step === 0 && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card title="Product & objective" className="xl:col-span-2">
            {products.loading && !products.data ? (
              <Spinner />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Insurance product" className="sm:col-span-2">
                  <select className={inputCls} disabled={Boolean(locked)} value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value ? Number(e.target.value) : '' })}>
                    <option value="">Select a product…</option>
                    {products.data?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {CLASS_LABEL[p.insuranceClass]} — {p.name} (from {money(p.startingPremium, p.currency)})
                      </option>
                    ))}
                  </select>
                </Field>
                {product && (
                  <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 sm:col-span-2">
                    <p>{product.targetAudienceSummary}</p>
                    <p className="mt-1 flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> License disclosure: {product.regulatoryLicenseNumber}
                    </p>
                    {(product.insuranceClass === 'PROPERTY' ? (
                      <p className="mt-1 text-amber-700">Meta placements will be tagged HOUSING (Special Ad Category).</p>
                    ) : (
                      <p className="mt-1 text-amber-700">Meta placements will be tagged FINANCIAL_PRODUCTS_SERVICES (Special Ad Category).</p>
                    ))}
                  </div>
                )}
                <Field label="Campaign name" className="sm:col-span-2">
                  <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Motor Q1 – Lagos commuters" />
                </Field>
                <Field label="Conversion objective" className="sm:col-span-2">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(['POLICY_PURCHASE', 'QUOTE_LEADS', 'TRAFFIC'] as Objective[]).map((o) => (
                      <button
                        type="button"
                        key={o}
                        onClick={() => setForm({ ...form, objective: o })}
                        className={cx('rounded-lg border px-3 py-2 text-left text-sm', form.objective === o ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 hover:bg-slate-50')}
                      >
                        <span className="font-medium">{o === 'POLICY_PURCHASE' ? 'Policy purchase' : o === 'QUOTE_LEADS' ? 'Quote leads' : 'Traffic'}</span>
                        <span className="block text-xs text-slate-500">{o === 'POLICY_PURCHASE' ? 'Optimise for completed checkouts' : o === 'QUOTE_LEADS' ? 'Optimise for quote requests' : 'Drive landing-page visits'}</span>
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Countries (ISO codes)" hint="Comma separated, e.g. NG, GH">
                  <input className={inputCls} value={form.countries} onChange={(e) => setForm({ ...form, countries: e.target.value })} />
                </Field>
                <Field label="Cities with radius (optional)" hint="e.g. Ikeja:25, Lekki:30 (km). Meta SAC minimum is 24 km.">
                  <input className={inputCls} value={form.cities} onChange={(e) => setForm({ ...form, cities: e.target.value })} />
                </Field>
                <Field label="States / regions" className="sm:col-span-2">
                  <div className="flex flex-wrap gap-1.5">
                    {NG_STATES.map((s) => {
                      const on = form.regions.includes(s);
                      return (
                        <button
                          type="button"
                          key={s}
                          onClick={() => setForm({ ...form, regions: on ? form.regions.filter((x) => x !== s) : [...form.regions, s] })}
                          className={cx('rounded-full border px-2.5 py-1 text-xs', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50')}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Postal / ZIP codes (not recommended)" hint="Blocked for Meta Special Ad Category campaigns — compliance will flag this." className="sm:col-span-2">
                  <input className={inputCls} value={form.postalCodes} onChange={(e) => setForm({ ...form, postalCodes: e.target.value })} placeholder="Leave empty" />
                </Field>
              </div>
            )}
          </Card>

          <Card title="Daily budget split">
            <Field label="Total daily budget (₦)">
              <input className={inputCls} type="number" min={1} step="0.01" disabled={Boolean(locked)} value={form.totalDailyBudget} onChange={(e) => setForm({ ...form, totalDailyBudget: e.target.value })} />
            </Field>
            <div className="mt-4 space-y-4">
              {PLATFORMS.map((p) => {
                const v = form.split[p] ?? 0;
                return (
                  <div key={p}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLATFORM_COLOR[p] }} />
                        {PLATFORM_LABEL[p]}
                      </span>
                      <span className="tabular-nums text-slate-600">
                        {v}% · {money((Number(form.totalDailyBudget) || 0) * (v / 100))}
                      </span>
                    </div>
                    <input
                      aria-label={`${PLATFORM_LABEL[p]} budget %`}
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      disabled={Boolean(locked)}
                      value={v}
                      onChange={(e) => setForm({ ...form, split: { ...form.split, [p]: Number(e.target.value) } })}
                      className="mt-1 w-full accent-brand-700"
                    />
                  </div>
                );
              })}
            </div>
            <p className={cx('mt-4 text-sm font-medium', Math.abs(splitTotal - 100) < 0.01 ? 'text-emerald-700' : 'text-rose-600')}>Allocated: {splitTotal}% {Math.abs(splitTotal - 100) < 0.01 ? '✓' : '(must equal 100%)'}</p>
            {locked && <p className="mt-2 text-xs text-slate-500">Budget and product are locked after publishing.</p>}
            <Button className="mt-4 w-full" loading={busy} disabled={!form.productId || form.name.trim().length < 3 || Math.abs(splitTotal - 100) > 0.01} icon={<ArrowRight className="h-4 w-4" />} onClick={saveSetup}>
              {campaign ? 'Save & continue' : 'Create draft & continue'}
            </Button>
          </Card>
        </div>
      )}

      {step === 1 && campaign && <CreativesStep campaign={campaign} setCampaign={setCampaign} next={() => go(2)} back={() => go(0)} />}
      {step === 2 && campaign && <ComplianceStep campaign={campaign} setCampaign={setCampaign} next={() => go(3)} back={() => go(1)} />}
      {step === 3 && campaign && <PublishStep campaign={campaign} back={() => go(2)} done={(id) => navigate(`/campaigns/${id}`)} />}
      {step > 0 && !campaign && <Spinner />}
    </>
  );
}

function groupByPlatform(variants: Variant[]) {
  const m = new Map<Platform, Variant[]>();
  for (const v of variants) m.set(v.platform, [...(m.get(v.platform) ?? []), v]);
  return [...m.entries()];
}

function CreativesStep({ campaign, setCampaign, next, back }: { campaign: Campaign; setCampaign: (c: Campaign) => void; next: () => void; back: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [note, setNote] = useState<string | null>(null);
  const [extra, setExtra] = useState('');
  const editable = ['DRAFT', 'PENDING_REVIEW'].includes(campaign.status);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.generateCreatives(campaign.id, extra || undefined);
      setCampaign(r.campaign);
      setNote(r.source === 'claude' ? 'Generated with Claude.' : (r.note ?? 'Generated from templates.'));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const onChanged = (v: Variant) =>
    setCampaign({ ...campaign, variants: campaign.variants.map((x) => (x.id === v.id ? v : v.isSelected && x.platform === v.platform ? { ...x, isSelected: false } : x)) });

  return (
    <div className="space-y-6">
      <Card
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" /> Generate platform-native creatives
          </span>
        }
      >
        <ErrorBanner error={error} onClose={() => setError(null)} />
        <p className="text-sm text-slate-600">
          One click produces 3 hook angles for Facebook & Instagram (with Reels/carousel briefs), a Google Responsive Search Ad pack (10 headlines ≤30 chars, 4 descriptions ≤90 chars + keywords) and B2B
          LinkedIn Sponsored Content with job-title/industry targeting. Every variant is compliance-checked immediately.
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input className={inputCls} placeholder="Optional extra direction, e.g. mention instalment payments, focus on Abuja" value={extra} onChange={(e) => setExtra(e.target.value)} disabled={!editable} />
          <Button loading={busy} disabled={!editable} icon={<Wand2 className="h-4 w-4" />} onClick={generate} className="shrink-0">
            {campaign.variants.length ? 'Regenerate all' : 'Generate creatives'}
          </Button>
        </div>
        {note && <p className="mt-2 text-xs text-slate-500">{note}</p>}
      </Card>

      {groupByPlatform(campaign.variants).map(([platform, vs]) => (
        <section key={platform}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLATFORM_COLOR[platform] }} />
            {PLATFORM_LABEL[platform]} <span className="font-normal text-slate-400">· {vs.length} variant(s)</span>
          </h3>
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {vs.map((v) => (
              <VariantCard key={v.id} variant={v} editable={editable} onChanged={onChanged} />
            ))}
          </div>
        </section>
      ))}

      <div className="flex justify-between">
        <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={back}>
          Back
        </Button>
        <Button disabled={!campaign.variants.length} icon={<ArrowRight className="h-4 w-4" />} onClick={next}>
          Continue to compliance
        </Button>
      </div>
    </div>
  );
}

function ComplianceStep({ campaign, setCampaign, next, back }: { campaign: Campaign; setCampaign: (c: Campaign) => void; next: () => void; back: () => void }) {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [busy, setBusy] = useState<'check' | 'fix' | null>(null);
  const [useAi, setUseAi] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const check = async (autoFix: boolean) => {
    setBusy(autoFix ? 'fix' : 'check');
    setError(null);
    try {
      setReport(await api.validate(campaign.id, { autoFix, useAi }));
      setCampaign(await api.campaign(campaign.id));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };
  useEffect(() => {
    void check(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = report?.variants.filter((v) => v.isSelected) ?? [];
  return (
    <div className="space-y-6">
      <Card
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-600" /> Compliance guardrail engine
          </span>
        }
        actions={
          <>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} /> AI pre-flight review
            </label>
            <Button variant="secondary" loading={busy === 'check'} onClick={() => check(false)}>
              Re-check
            </Button>
            <Button loading={busy === 'fix'} icon={<Wand2 className="h-4 w-4" />} onClick={() => check(true)}>
              Auto-fix &amp; re-check
            </Button>
          </>
        }
      >
        <ErrorBanner error={error} onClose={() => setError(null)} />
        {!report ? (
          <Spinner label="Validating…" />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              {report.readyToPublish ? (
                <Badge className="bg-emerald-100 px-3 py-1 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" /> Ready to publish
                </Badge>
              ) : (
                <Badge className="bg-rose-100 px-3 py-1 text-sm text-rose-800">Blocked — fix the issues below</Badge>
              )}
              {report.specialAdCategory && <Badge className="bg-indigo-100 text-indigo-800">Meta Special Ad Category: {report.specialAdCategory}</Badge>}
              {report.aiError && <span className="text-xs text-amber-700">AI review skipped: {report.aiError}</span>}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Targeting</p>
              <FindingsList findings={report.targeting.findings} />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Selected creatives</p>
              <ul className="space-y-3">
                {selected.map((v) => (
                  <li key={v.id} className="rounded-lg border border-slate-200 p-3">
                    <p className="mb-2 text-sm">
                      <span className="font-medium">{PLATFORM_LABEL[v.platform]}</span> · {v.hookAngle} <Badge className="ml-1">{label(v.status)}</Badge>
                    </p>
                    <FindingsList findings={v.findings} />
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-slate-500">
              Auto-fix appends the license disclosure, trims Google assets to 30/90 chars and removes ZIP/demographic targeting. Personal-attribute and guaranteed-return copy must be rewritten by hand (edit the
              variant in the previous step).
            </p>
          </div>
        )}
      </Card>
      <div className="flex justify-between">
        <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={back}>
          Back to creatives
        </Button>
        <Button disabled={!report?.readyToPublish} icon={<ArrowRight className="h-4 w-4" />} onClick={next}>
          Continue to publish
        </Button>
      </div>
    </div>
  );
}

function PublishStep({ campaign, back, done }: { campaign: Campaign; back: () => void; done: (id: number) => void }) {
  const status = useAsync(() => api.platformStatus(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [results, setResults] = useState<{ platform: Platform; status: string; mode?: string; error?: string }[] | null>(null);

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.publish(campaign.id);
      setResults(r.results);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title={
          <span className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-brand-600" /> Unified multi-platform publisher
          </span>
        }
      >
        <ErrorBanner error={error} onClose={() => setError(null)} />
        <p className="text-sm text-slate-600">
          Each platform receives its selected creative via the <code>AdPlatformAdapter</code>. Everything is created in a <strong>PAUSED</strong> state — no budget is spent until you activate the campaign.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="py-2 font-medium">Platform</th>
                <th className="py-2 font-medium">Mode</th>
                <th className="py-2 font-medium">Creative</th>
                <th className="py-2 text-right font-medium">Daily budget</th>
                <th className="py-2 pl-4 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {campaign.deployments.map((d) => {
                const v = campaign.variants.find((x) => x.platform === d.platform && x.isSelected);
                const mode = status.data?.platforms.find((p) => p.platform === d.platform)?.mode;
                const r = results?.find((x) => x.platform === d.platform);
                return (
                  <tr key={d.id} className="border-b border-slate-50">
                    <td className="py-2">{PLATFORM_LABEL[d.platform]}</td>
                    <td className="py-2">{mode && <Badge className={mode === 'live' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}>{mode}</Badge>}</td>
                    <td className="py-2">{v ? `${v.hookAngle} (${label(v.complianceStatus)})` : <span className="text-rose-600">none selected</span>}</td>
                    <td className="py-2 text-right tabular-nums">{money(d.dailyBudget, campaign.currency)}</td>
                    <td className="py-2 pl-4">{r ? <Badge className={r.status === 'ERROR' ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-800'}>{r.error ?? r.status}</Badge> : d.externalCampaignId ? <Badge>{d.status}</Badge> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex flex-wrap justify-between gap-2">
          <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={back}>
            Back
          </Button>
          {results ? (
            <Button icon={<ArrowRight className="h-4 w-4" />} onClick={() => done(campaign.id)}>
              Go to campaign
            </Button>
          ) : (
            <Button loading={busy} icon={<Rocket className="h-4 w-4" />} onClick={publish}>
              Publish to all platforms (paused)
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

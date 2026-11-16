import { useState } from 'react';
import { ExternalLink, PackageOpen, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { api, type ProductInput } from '../api';
import { CLASS_LABEL, money, n } from '../format';
import { CLASSES, type InsuranceClass, type Product } from '../types';
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Modal, PageHeader, Spinner, inputCls, filterCls, useAsync } from '../components/ui';

const blank = (): ProductInput => ({
  insuranceClass: 'AUTO_MOTOR',
  name: '',
  targetAudienceSummary: '',
  keyBenefits: [],
  startingPremium: 0,
  currency: 'NGN',
  landingPageUrl: 'https://',
  regulatoryLicenseNumber: '',
  isActive: true,
});

export function Products() {
  const [cls, setCls] = useState<InsuranceClass | ''>('');
  const list = useAsync(() => api.products({ class: cls || undefined }), [cls]);
  const [editing, setEditing] = useState<{ id: number | null; form: ProductInput; benefitsText: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const open = (p?: Product) =>
    setEditing(
      p
        ? {
            id: p.id,
            form: { insuranceClass: p.insuranceClass, name: p.name, targetAudienceSummary: p.targetAudienceSummary, keyBenefits: p.keyBenefits, startingPremium: n(p.startingPremium), currency: p.currency, landingPageUrl: p.landingPageUrl, regulatoryLicenseNumber: p.regulatoryLicenseNumber, isActive: p.isActive },
            benefitsText: p.keyBenefits.join('\n'),
          }
        : { id: null, form: blank(), benefitsText: '' },
    );

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    const payload = { ...editing.form, keyBenefits: editing.benefitsText.split('\n').map((s) => s.trim()).filter(Boolean) };
    try {
      if (editing.id) await api.updateProduct(editing.id, payload);
      else await api.createProduct(payload);
      setEditing(null);
      await list.reload();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    setError(null);
    try {
      await api.deleteProduct(p.id);
      await list.reload();
    } catch (e) {
      setError(e);
    }
  };

  const toggle = async (p: Product) => {
    try {
      await api.updateProduct(p.id, { isActive: !p.isActive });
      await list.reload();
    } catch (e) {
      setError(e);
    }
  };

  const f = editing?.form;
  const setF = (patch: Partial<ProductInput>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));

  return (
    <>
      <PageHeader
        title="Insurance product catalog"
        subtitle="Underwriting selling points, starting premiums, quote landing pages and mandatory license disclosures"
        actions={
          <>
            <select aria-label="Filter by class" className={filterCls} value={cls} onChange={(e) => setCls(e.target.value as InsuranceClass | '')}>
              <option value="">All classes</option>
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  {CLASS_LABEL[c]}
                </option>
              ))}
            </select>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => open()}>
              Add product
            </Button>
          </>
        }
      />
      <ErrorBanner error={error ?? list.error} onClose={() => setError(null)} />
      {list.loading && !list.data ? (
        <Spinner />
      ) : list.data?.length === 0 ? (
        <Card>
          <EmptyState icon={<PackageOpen className="h-10 w-10" />} title="No products yet">
            Add your first insurance product to start building campaigns.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {list.data?.map((p) => (
            <Card key={p.id} className={p.isActive ? '' : 'opacity-60'}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge className="bg-brand-50 text-brand-700">{CLASS_LABEL[p.insuranceClass]}</Badge>
                  <h3 className="mt-2 font-semibold text-slate-900">{p.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button aria-label={`Edit ${p.name}`} onClick={() => open(p)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button aria-label={`Delete ${p.name}`} onClick={() => remove(p)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-600">{p.targetAudienceSummary}</p>
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                {p.keyBenefits.slice(0, 4).map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="text-brand-600">✓</span>
                    {b}
                  </li>
                ))}
              </ul>
              <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                <div>
                  <dt className="text-slate-500">Starting premium</dt>
                  <dd className="font-semibold text-slate-900">{money(p.startingPremium, p.currency)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Campaigns</dt>
                  <dd className="font-semibold text-slate-900">{p._count?.campaigns ?? 0}</dd>
                </div>
                <div className="col-span-2 flex items-center gap-1.5 text-slate-600">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-400" /> {p.regulatoryLicenseNumber}
                </div>
                <a href={p.landingPageUrl} target="_blank" rel="noreferrer" className="col-span-2 flex items-center gap-1.5 truncate text-brand-700 hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" /> {p.landingPageUrl}
                </a>
              </dl>
              <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={p.isActive} onChange={() => toggle(p)} /> Active (available for new campaigns)
              </label>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        title={editing?.id ? 'Edit product' : 'New product'}
        onClose={() => setEditing(null)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={save}>
              Save product
            </Button>
          </>
        }
      >
        {f && (
          <div className="grid gap-4 sm:grid-cols-2">
            <ErrorBanner error={error} />
            <Field label="Insurance class" className="sm:col-span-1">
              <select className={inputCls} value={f.insuranceClass} onChange={(e) => setF({ insuranceClass: e.target.value as InsuranceClass })}>
                {CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {CLASS_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Product name">
              <input className={inputCls} value={f.name} onChange={(e) => setF({ name: e.target.value })} />
            </Field>
            <Field label="Target audience" className="sm:col-span-2">
              <textarea rows={2} className={inputCls} value={f.targetAudienceSummary} onChange={(e) => setF({ targetAudienceSummary: e.target.value })} />
            </Field>
            <Field label="Key benefits / selling points" hint="One per line" className="sm:col-span-2">
              <textarea rows={4} className={inputCls} value={editing!.benefitsText} onChange={(e) => setEditing((x) => (x ? { ...x, benefitsText: e.target.value } : x))} />
            </Field>
            <Field label="Starting premium">
              <input type="number" min={0} step="0.01" className={inputCls} value={f.startingPremium} onChange={(e) => setF({ startingPremium: Number(e.target.value) })} />
            </Field>
            <Field label="Currency">
              <input maxLength={3} className={inputCls} value={f.currency} onChange={(e) => setF({ currency: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Quote landing page URL" className="sm:col-span-2">
              <input type="url" className={inputCls} value={f.landingPageUrl} onChange={(e) => setF({ landingPageUrl: e.target.value })} />
            </Field>
            <Field label="Regulatory license number" hint="Appended to every Meta/LinkedIn ad as “Licensed by NAICOM. Reg. No: …”" className="sm:col-span-2">
              <input className={inputCls} value={f.regulatoryLicenseNumber} onChange={(e) => setF({ regulatoryLicenseNumber: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={f.isActive} onChange={(e) => setF({ isActive: e.target.checked })} /> Active
            </label>
          </div>
        )}
      </Modal>
    </>
  );
}

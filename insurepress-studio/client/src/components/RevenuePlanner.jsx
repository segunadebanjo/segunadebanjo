import { useMemo, useState } from 'react';
import { Calculator, BookOpen, Printer, Building2, QrCode } from 'lucide-react';
import { fmtMoney } from '@shared/constants.js';

const CLASSES = [
  { id: 'motor', label: 'Motor (Comprehensive)', premium: 350000, rate: 12.5, share: 35 },
  { id: 'fire', label: 'Fire & Burglary', premium: 600000, rate: 20, share: 30 },
  { id: 'glife', label: 'Group Life', premium: 900000, rate: 10, share: 20 },
  { id: 'sme', label: 'SME Package / BI', premium: 1200000, rate: 20, share: 15 },
];

const Num = ({ label, value, onChange, step = 1, suffix }) => (
  <label className="block">
    <span className="label">{label}</span>
    <div className="relative"><input type="number" className="input pr-8" value={value} step={step} onChange={onChange} />{suffix && <span className="pointer-events-none absolute right-2.5 top-2 text-xs text-slate-400">{suffix}</span>}</div>
  </label>
);

// All money is stored in NGN; the USD toggle converts for display and input.
export default function RevenuePlanner({ book }) {
  const [currency, setCurrency] = useState('NGN');
  const [fx, setFx] = useState(1550);
  const [s, setS] = useState({
    digitalPrice: book?.currency === 'USD' ? Number(book.price_amount) * 1550 : Number(book?.price_amount) || 7500,
    digitalUnits: 120, printPrice: 15000, printUnits: 40, printCost: 5200, feePct: 5,
    bulkCopies: 150, bulkPrice: 6000, bulkDeals: 4,
    readersScanPct: 18, quoteToBindPct: 22, classes: CLASSES,
  });
  const set = (k) => (e) => setS((x) => ({ ...x, [k]: Number(e.target.value) }));
  const toDisp = (ngn) => (currency === 'USD' ? +(ngn / fx).toFixed(2) : ngn);
  const fromDisp = (v) => (currency === 'USD' ? Number(v) * fx : Number(v));
  const money = (ngn) => fmtMoney(currency === 'USD' ? ngn / fx : ngn, currency, { decimals: currency === 'USD' ? 0 : 0 });
  const setMoney = (k) => (e) => setS((x) => ({ ...x, [k]: fromDisp(e.target.value) }));

  const r = useMemo(() => {
    const fee = 1 - s.feePct / 100;
    const digital = s.digitalPrice * s.digitalUnits * 12 * fee;
    const print = (s.printPrice - s.printCost) * s.printUnits * 12 - s.printPrice * s.printUnits * 12 * (s.feePct / 100);
    const bulk = s.bulkCopies * s.bulkPrice * s.bulkDeals;
    const readers = (s.digitalUnits + s.printUnits) * 12 + s.bulkCopies * s.bulkDeals;
    const leads = readers * (s.readersScanPct / 100);
    const policies = leads * (s.quoteToBindPct / 100);
    const totalShare = s.classes.reduce((a, c) => a + c.share, 0) || 1;
    const avgComm = s.classes.reduce((a, c) => a + (c.share / totalShare) * c.premium * (c.rate / 100), 0);
    const commission = policies * avgComm;
    const byClass = s.classes.map((c) => ({ ...c, policies: policies * (c.share / totalShare), commission: policies * (c.share / totalShare) * c.premium * (c.rate / 100) }));
    return { digital, print, bulk, readers, leads, policies, commission, byClass, books: digital + print + bulk, total: digital + print + bulk + commission };
  }, [s]);

  const setClass = (i, k) => (e) => setS((x) => ({ ...x, classes: x.classes.map((c, j) => (j === i ? { ...c, [k]: k === 'premium' ? fromDisp(e.target.value) : Number(e.target.value) } : c)) }));
  const sym = currency === 'USD' ? '$' : '₦';
  const bar = (v) => `${Math.max(2, (v / (r.total || 1)) * 100)}%`;

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-50 text-gold-600"><Calculator size={18} /></div>
        <div>
          <h2 className="font-serif text-lg font-bold text-navy-800">Book Revenue &amp; Brokerage Commission Planner</h2>
          <p className="text-sm text-slate-500">Model 12 months of book sales and the policies your readers bind through in-book QR codes{book ? ` for “${book.title}”` : ''}.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {currency === 'USD' && <label className="flex items-center gap-1 text-xs text-slate-500">₦/$ <input type="number" className="input w-20 py-1" value={fx} onChange={(e) => setFx(Number(e.target.value) || 1)} /></label>}
          <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-bold">
            {['NGN', 'USD'].map((c) => <button key={c} onClick={() => setCurrency(c)} className={`rounded-md px-3 py-1 ${currency === c ? 'bg-white text-navy-800 shadow' : 'text-slate-500'}`}>{c === 'NGN' ? '₦ NGN' : '$ USD'}</button>)}
          </div>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-navy-800"><BookOpen size={15} />Digital PDF / EPUB (Selar, Paystack)</div>
            <div className="grid grid-cols-3 gap-2">
              <Num label={`Price (${sym})`} value={toDisp(s.digitalPrice)} onChange={setMoney('digitalPrice')} />
              <Num label="Copies / month" value={s.digitalUnits} onChange={set('digitalUnits')} />
              <Num label="Platform fees" value={s.feePct} onChange={set('feePct')} step={0.5} suffix="%" />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-navy-800"><Printer size={15} />Print paperback</div>
            <div className="grid grid-cols-3 gap-2">
              <Num label={`Price (${sym})`} value={toDisp(s.printPrice)} onChange={setMoney('printPrice')} />
              <Num label="Copies / month" value={s.printUnits} onChange={set('printUnits')} />
              <Num label={`Print + delivery cost (${sym})`} value={toDisp(s.printCost)} onChange={setMoney('printCost')} />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-navy-800"><Building2 size={15} />Corporate bulk licensing (HR teams, SME associations)</div>
            <div className="grid grid-cols-3 gap-2">
              <label className="block"><span className="label">Copies per deal: {s.bulkCopies}</span><input type="range" min={50} max={500} step={10} value={s.bulkCopies} onChange={set('bulkCopies')} className="mt-2 w-full accent-amber-600" /></label>
              <Num label={`Price / copy (${sym})`} value={toDisp(s.bulkPrice)} onChange={setMoney('bulkPrice')} />
              <Num label="Deals / year" value={s.bulkDeals} onChange={set('bulkDeals')} />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-navy-800"><QrCode size={15} />Downstream brokerage commission from QR scans</div>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <Num label="Readers who scan a QR" value={s.readersScanPct} onChange={set('readersScanPct')} suffix="%" />
              <Num label="Quotes that bind a policy" value={s.quoteToBindPct} onChange={set('quoteToBindPct')} suffix="%" />
            </div>
            <table className="w-full text-xs">
              <thead><tr className="text-left text-slate-500"><th className="py-1">Class</th><th>Avg premium ({sym})</th><th>Commission %</th><th>Mix %</th></tr></thead>
              <tbody>
                {s.classes.map((c, i) => (
                  <tr key={c.id}>
                    <td className="py-1 pr-2 font-semibold text-slate-700">{c.label}</td>
                    <td className="pr-1"><input className="input py-1" type="number" value={toDisp(c.premium)} onChange={setClass(i, 'premium')} /></td>
                    <td className="pr-1"><input className="input py-1" type="number" step={0.5} value={c.rate} onChange={setClass(i, 'rate')} /></td>
                    <td><input className="input py-1" type="number" value={c.share} onChange={setClass(i, 'share')} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-slate-400">Commission rates are planning assumptions — use the rates in your insurer agreements and NAICOM guidelines.</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl bg-navy-800 p-5 text-white">
            <div className="text-xs font-semibold uppercase tracking-widest text-gold-400">Projected 12-month income</div>
            <div className="mt-1 font-serif text-4xl font-black">{money(r.total)}</div>
            <div className="mt-1 text-sm text-navy-100">{money(r.books)} from books · {money(r.commission)} commission</div>
          </div>
          {[
            ['Digital sales (net of fees)', r.digital, 'bg-sky-500'],
            ['Print sales (net of print cost & fees)', r.print, 'bg-indigo-500'],
            ['Corporate bulk licences', r.bulk, 'bg-violet-500'],
            ['Brokerage commission', r.commission, 'bg-gold-500'],
          ].map(([l, v, c]) => (
            <div key={l}>
              <div className="flex justify-between text-sm"><span className="text-slate-600">{l}</span><span className="font-bold text-navy-800">{money(v)}</span></div>
              <div className="mt-1 h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${c}`} style={{ width: bar(v) }} /></div>
            </div>
          ))}
          <div className="grid grid-cols-3 gap-2 pt-2 text-center">
            {[['Readers', r.readers], ['QR leads', r.leads], ['Policies bound', r.policies]].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-slate-50 p-2"><div className="text-lg font-black text-navy-800">{Math.round(v).toLocaleString()}</div><div className="text-[11px] text-slate-500">{l}</div></div>
            ))}
          </div>
          <table className="w-full text-xs">
            <tbody>
              {r.byClass.map((c) => <tr key={c.id} className="border-t border-slate-100"><td className="py-1.5 text-slate-600">{c.label}</td><td className="text-right text-slate-500">{c.policies.toFixed(1)} policies</td><td className="text-right font-semibold text-navy-800">{money(c.commission)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { api, download, can } from '../api';
import { useAuth } from '../App.jsx';
import ReportView from '../components/ReportView.jsx';
import { Msg, PeriodPicker, useMsg } from '../components/ui.jsx';

export default function Generate() {
  const { code } = useParams();
  const [qs] = useSearchParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [rep, setRep] = useState(null);
  const [period, setPeriod] = useState(null);
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState('');
  const m = useMsg();

  useEffect(() => {
    api.get('/reports/catalog').then((list) => {
      const r = list.find((x) => x.code === code);
      setRep(r);
      if (!r) return;
      const now = new Date();
      const freq = qs.get('frequency') && r.frequencies.includes(qs.get('frequency')) ? qs.get('frequency') : r.frequencies[0];
      const lastQ = Math.floor(now.getMonth() / 3) || 4;
      const prevYear = freq === 'annual' || (freq === 'quarterly' && now.getMonth() < 3) || (freq === 'monthly' && now.getMonth() === 0) || (freq === 'half-yearly' && now.getMonth() < 6);
      const defYear = prevYear ? now.getFullYear() - 1 : now.getFullYear();
      setPeriod({ frequency: freq, year: Number(qs.get('year')) || defYear, index: Number(qs.get('index')) || (freq === 'quarterly' ? lastQ : freq === 'monthly' ? (now.getMonth() || 12) : freq === 'half-yearly' ? (now.getMonth() < 6 ? 2 : 1) : 1) });
    });
  }, [code]);

  const preview = async () => {
    setBusy('preview'); m.clear();
    try { setOut(await api.post(`/reports/${code}/preview`, period)); } catch (e) { m.err(e); } finally { setBusy(''); }
  };
  const save = async () => {
    setBusy('save');
    try { const r = await api.post(`/reports/${code}/runs`, period); nav(`/runs/${r.id}`); } catch (e) { m.err(e); setBusy(''); }
  };
  const exp = async (f) => {
    setBusy(f);
    try { await download(`/reports/${code}/export/${f}?${new URLSearchParams(period)}`, `${code}.${f}`); } catch (e) { m.err(e); } finally { setBusy(''); }
  };

  if (!rep || !period) return <p className="muted">Loading…</p>;
  return (
    <div>
      <div className="page-head">
        <div><p className="crumbs"><Link to="/reports">Statutory returns</Link> ›</p><h1>{rep.code} · {rep.name}</h1><p className="muted">{rep.description}</p></div>
      </div>
      <div className="card toolbar">
        <PeriodPicker frequencies={rep.frequencies} value={period} onChange={(p) => { setPeriod(p); setOut(null); }} />
        <div className="row wrap">
          <button className="btn primary" onClick={preview} disabled={!!busy}>{busy === 'preview' ? 'Generating…' : 'Generate preview'}</button>
          {out && <>
            <button className="btn" onClick={() => exp('xlsx')} disabled={!!busy}>Excel</button>
            <button className="btn" onClick={() => exp('pdf')} disabled={!!busy}>PDF</button>
            {can(user, 'preparer') && <button className="btn accent" onClick={save} disabled={!!busy}>{busy === 'save' ? 'Saving…' : 'Save as draft for review'}</button>}
          </>}
        </div>
      </div>
      <Msg msg={m.msg} onClose={m.clear} />
      {out ? <ReportView out={out} /> : <p className="muted">Choose the reporting period and generate a preview. Nothing is saved until you save it as a draft.</p>}
    </div>
  );
}

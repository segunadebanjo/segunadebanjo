import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmt } from '../api';
import { Status, Msg, useMsg } from '../components/ui.jsx';

export default function Runs() {
  const [rows, setRows] = useState(null);
  const [f, setF] = useState({ year: '', status: '', code: '' });
  const [codes, setCodes] = useState([]);
  const m = useMsg();
  useEffect(() => { api.get('/reports/catalog').then((c) => setCodes(c.map((x) => x.code))); }, []);
  useEffect(() => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(f).filter(([, v]) => v)));
    api.get(`/reports/runs?${q}`).then(setRows).catch(m.err);
  }, [f]);
  const y = new Date().getFullYear();
  return (
    <div>
      <div className="page-head"><div><h1>Generated returns</h1><p className="muted">Versioned snapshots with maker-checker approval and NAICOM submission tracking.</p></div></div>
      <div className="card toolbar row wrap">
        <label className="field">Year<select value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })}><option value="">All</option>{[0, 1, 2, 3].map((i) => <option key={i}>{y - i}</option>)}</select></label>
        <label className="field">Status<select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">All</option>{['draft', 'reviewed', 'approved', 'submitted', 'rejected'].map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="field">Return<select value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })}><option value="">All</option>{codes.map((c) => <option key={c}>{c}</option>)}</select></label>
      </div>
      <Msg msg={m.msg} onClose={m.clear} />
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Return</th><th>Period</th><th>Ver.</th><th>Status</th><th className="r">Errors</th><th className="r">Warnings</th><th>Prepared</th><th>NAICOM ref.</th></tr></thead>
            <tbody>
              {!rows && <tr><td colSpan={8} className="muted">Loading…</td></tr>}
              {rows?.length === 0 && <tr><td colSpan={8} className="muted">No returns generated yet. Go to Statutory returns to prepare one.</td></tr>}
              {rows?.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/runs/${r.id}`}><b>{r.report_code}</b> {r.report_name}</Link></td>
                  <td className="nowrap">{r.period_label}</td>
                  <td>v{r.version}</td>
                  <td><Status value={r.status} /></td>
                  <td className="r">{r.error_count ? <b className="c-err">{r.error_count}</b> : 0}</td>
                  <td className="r">{r.warning_count}</td>
                  <td className="nowrap">{fmt.dt(r.generated_at)}<br /><small className="muted">{r.generated_by_name}</small></td>
                  <td>{r.submission_ref || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

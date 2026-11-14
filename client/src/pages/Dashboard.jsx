import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmt } from '../api';
import { Msg, useMsg } from '../components/ui.jsx';

const STATE_LABEL = { overdue: 'Overdue', due: 'Due now', upcoming: 'Upcoming', submitted: 'Submitted' };
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

function Bars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.gp));
  return (
    <div className="bars" role="img" aria-label="Monthly gross premium">
      {MONTHS.map((m, i) => {
        const d = data.find((x) => x.m === i + 1) || { gp: 0, comm: 0 };
        return (
          <div key={i} className="bar-col" title={`Month ${i + 1}: premium ${fmt.short(d.gp)}, commission ${fmt.short(d.comm)}`}>
            <div className="bar" style={{ height: `${(d.gp / max) * 100}%` }}><div className="bar-in" style={{ height: `${d.gp ? (d.comm / d.gp) * 100 : 0}%` }} /></div>
            <span>{m}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('open');
  const m = useMsg();
  useEffect(() => { setData(null); api.get(`/dashboard?year=${year}`).then(setData).catch(m.err); }, [year]);
  const list = useMemo(() => {
    if (!data) return [];
    if (filter === 'open') return data.obligations.filter((o) => o.state === 'overdue' || o.state === 'due');
    return filter === 'all' ? data.obligations : data.obligations.filter((o) => o.state === filter);
  }, [data, filter]);
  const k = data?.kpis || {};
  return (
    <div>
      <div className="page-head">
        <div><h1>Compliance calendar</h1><p className="muted">{data?.company?.name} · NAICOM licence {data?.company?.naicomLicenseNo || 'not set'}</p></div>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
          {[0, 1, 2, 3].map((i) => <option key={i}>{new Date().getFullYear() - i}</option>)}
        </select>
      </div>
      <Msg msg={m.msg} onClose={m.clear} />
      {!data ? <p className="muted">Loading…</p> : (<>
        <div className="kpis">
          <div className="kpi bad"><small>Overdue returns</small><b>{k.overdue || 0}</b></div>
          <div className="kpi warn"><small>Due now</small><b>{k.due || 0}</b></div>
          <div className="kpi good"><small>Submitted</small><b>{k.submitted || 0}</b></div>
          <div className="kpi"><small>Gross premium {year}</small><b>{fmt.short(k.gp)}</b><em>{fmt.number(k.n)} placements</em></div>
          <div className="kpi"><small>Commission {year}</small><b>{fmt.short(k.comm)}</b></div>
          <div className="kpi"><small>Open claims · complaints</small><b>{k.open_claims} · {k.open_complaints}</b><em>Last ERP sync {fmt.dt(k.last_sync) || 'never'}</em></div>
        </div>
        <div className="grid2">
          <div className="card">
            <div className="row between"><h3>Return obligations</h3>
              <div className="seg">
                {['open', 'upcoming', 'submitted', 'all'].map((f) => <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f === 'open' ? 'Action needed' : f}</button>)}
              </div>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Return</th><th>Period</th><th>Due</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {!list.length && <tr><td colSpan={5} className="muted">Nothing here.</td></tr>}
                  {list.map((o) => (
                    <tr key={o.code + o.period}>
                      <td><b>{o.code}</b> {o.name}</td>
                      <td className="nowrap">{o.period}</td>
                      <td className="nowrap">{o.dueDate}<br /><small className="muted">{o.daysToDue >= 0 ? `in ${o.daysToDue} days` : `${-o.daysToDue} days ago`}</small></td>
                      <td><span className={`badge st-${o.state}`}>{STATE_LABEL[o.state]}</span>{o.runStatus && o.runStatus !== 'submitted' && <small className="muted"> ({o.runStatus})</small>}</td>
                      <td className="nowrap">{o.runId ? <Link to={`/runs/${o.runId}`}>Open</Link> : <Link to={`/reports/${o.code}?frequency=${o.frequency}&year=${o.year}&index=${o.index}`}>Prepare</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <h3>Premium placed by month ({year})</h3>
            <Bars data={data.monthly} />
            <p className="muted small legend"><i className="sw a" /> Gross premium <i className="sw b" /> Commission share</p>
            <p className="muted small">Due dates are computed from Settings › Due dates. Confirm deadlines against the latest NAICOM circulars.</p>
          </div>
        </div>
      </>)}
    </div>
  );
}

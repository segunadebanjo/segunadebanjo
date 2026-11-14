import { useState } from 'react';
import { fmtCell } from '../api';

function Validations({ items }) {
  if (!items?.length) return <div className="msg ok">All validation checks passed.</div>;
  const order = { error: 0, warning: 1, info: 2 };
  return (
    <ul className="vals">
      {[...items].sort((a, b) => order[a.level] - order[b.level]).map((v, i) => (
        <li key={i} className={`v-${v.level}`}><b>{v.level}</b>{v.message}</li>
      ))}
    </ul>
  );
}

function Table({ sec }) {
  const [limit, setLimit] = useState(200);
  const right = (c) => ['money', 'number', 'pct'].includes(c.type);
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr>{sec.columns.map((c) => <th key={c.key} className={right(c) ? 'r' : ''}>{c.label}</th>)}</tr></thead>
        <tbody>
          {!sec.rows.length && <tr><td colSpan={sec.columns.length} className="muted">No records for this period</td></tr>}
          {sec.rows.slice(0, limit).map((r, i) => (
            <tr key={i}>{sec.columns.map((c) => <td key={c.key} className={right(c) ? 'r num' : ''}>{fmtCell(r[c.key], c.type)}</td>)}</tr>
          ))}
        </tbody>
        {sec.totals && (
          <tfoot><tr>{sec.columns.map((c) => <td key={c.key} className={right(c) ? 'r num' : ''}>{fmtCell(sec.totals[c.key], c.type)}</td>)}</tr></tfoot>
        )}
      </table>
      {sec.rows.length > limit && <button className="btn ghost sm" onClick={() => setLimit(limit + 500)}>Show more ({sec.rows.length - limit} hidden)</button>}
    </div>
  );
}

function KV({ sec }) {
  return (
    <dl className="kv">
      {sec.items.map((it, i) => (
        <div key={i}><dt>{it.label}</dt><dd className={['money', 'number', 'pct'].includes(it.type) ? 'num' : ''}>{fmtCell(it.value, it.type) || '—'}</dd></div>
      ))}
    </dl>
  );
}

export default function ReportView({ out }) {
  const [tab, setTab] = useState(0);
  const sec = out.sections[tab] || out.sections[0];
  return (
    <div className="report">
      <div className="report-head">
        <div>
          <h2>{out.code} · {out.name}</h2>
          <p className="muted">{out.company.name} · Licence {out.company.naicomLicenseNo || '—'} · {out.period.label} ({out.period.start} to {out.period.end}) · Due {out.dueDate}</p>
        </div>
        <div className="counts">
          <span className="c-err">{out.counts.error} errors</span>
          <span className="c-warn">{out.counts.warning} warnings</span>
        </div>
      </div>
      <Validations items={out.validations} />
      <div className="tabs" role="tablist">
        {out.sections.map((s, i) => (
          <button key={s.key} role="tab" aria-selected={i === tab} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>
            {s.title.length > 48 ? s.title.slice(0, 46) + '…' : s.title}
            {s.type === 'table' && <span className="cnt">{s.rows.length}</span>}
          </button>
        ))}
      </div>
      <div className="card flat">
        <h3>{sec.title}</h3>
        {sec.note && <p className="muted small">{sec.note}</p>}
        {sec.type === 'kv' ? <KV sec={sec} /> : <Table key={sec.key + tab} sec={sec} />}
      </div>
    </div>
  );
}

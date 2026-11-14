import { useEffect, useRef, useState } from 'react';
import { api, download, fmt, can } from '../api';
import { useAuth } from '../App.jsx';
import { Msg, useMsg, Modal } from '../components/ui.jsx';

function Browse({ entity, onClose }) {
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/data/browse/${entity.key}?limit=50&offset=${offset}&q=${encodeURIComponent(q)}`).then(setD); }, [entity, offset, q]);
  return (
    <Modal title={entity.label} onClose={onClose} wide>
      <input placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} />
      {d && <>
        <div className="tbl-wrap"><table className="tbl small">
          <thead><tr>{d.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{d.rows.map((r, i) => <tr key={i}>{d.columns.map((c) => <td key={c}>{r[c] ?? ''}</td>)}</tr>)}</tbody>
        </table></div>
        <div className="row between"><span className="muted small">{offset + 1}–{Math.min(offset + 50, d.total)} of {d.total}</span>
          <div className="row"><button className="btn sm" disabled={!offset} onClick={() => setOffset(offset - 50)}>Prev</button><button className="btn sm" disabled={offset + 50 >= d.total} onClick={() => setOffset(offset + 50)}>Next</button></div></div>
      </>}
    </Modal>
  );
}

export default function DataSync() {
  const { user } = useAuth();
  const [st, setSt] = useState(null);
  const [ents, setEnts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState('');
  const [browse, setBrowse] = useState(null);
  const [uploadFor, setUploadFor] = useState('');
  const fileRef = useRef();
  const m = useMsg();
  const load = () => Promise.all([api.get('/data/status').then(setSt), api.get('/data/logs').then(setLogs)]).catch(m.err);
  useEffect(() => { load(); api.get('/data/entities').then(setEnts); }, []);

  const sync = async (full) => {
    setBusy('sync'); m.clear();
    try {
      const r = await api.post('/data/sync', { full });
      const failed = r.results.filter((x) => x.error);
      failed.length ? m.err(`Sync finished with ${failed.length} failure(s): ${failed.map((f) => `${f.entity}: ${f.error}`).join('; ')}`) : m.ok(`Synced ${r.results.length} entities from the ERP.`);
      load();
    } catch (e) { m.err(e); } finally { setBusy(''); }
  };
  const onFile = async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    setBusy('upload'); m.clear();
    const fd = new FormData(); fd.append('file', file);
    try {
      const r = await api.upload(`/data/upload/${uploadFor}`, fd);
      const rej = r.rejected.length ? ` ${r.rejected.length} rejected (first: row ${r.rejected[0].row} – ${r.rejected[0].error}).` : '';
      (r.rejected.length ? m.err : m.ok)(`${r.entity}: ${r.upserted} of ${r.received} rows loaded.${rej}`);
      load();
    } catch (er) { m.err(er); } finally { setBusy(''); }
  };
  const pickFile = (key) => { setUploadFor(key); setTimeout(() => fileRef.current.click(), 0); };
  const erp = st?.erp;
  return (
    <div>
      <div className="page-head"><div><h1>ERP data</h1><p className="muted">The returns are built from a copy of your brokerage ERP data, kept in sync through any of three channels.</p></div></div>
      <Msg msg={m.msg} onClose={m.clear} />
      <div className="grid3">
        <div className="card">
          <h3>1 · Direct database pull</h3>
          {!erp ? '…' : !erp.configured ? <p className="muted small">Not configured. Set <code>ERP_DB_*</code> in the server <code>.env</code> and edit <code>server/config/erp-mapping.js</code>.</p>
            : erp.ok ? <p className="small"><span className="dot ok" /> Connected · mapping <code>{erp.mappingFile}</code></p>
              : <p className="small c-err"><span className="dot bad" /> {erp.error}</p>}
          {can(user, 'preparer') && <div className="row wrap">
            <button className="btn primary" disabled={!erp?.ok || !!busy} onClick={() => sync(false)}>{busy === 'sync' ? 'Syncing…' : 'Sync changes'}</button>
            <button className="btn" disabled={!erp?.ok || !!busy} onClick={() => sync(true)}>Full reload</button>
          </div>}
        </div>
        <div className="card">
          <h3>2 · Push API</h3>
          <p className="muted small">Your ERP posts records to <code>POST /api/ingest/&lt;entity&gt;</code> with header <code>x-api-key</code>. Re-sending a record updates it.</p>
        </div>
        <div className="card">
          <h3>3 · CSV upload</h3>
          <p className="muted small">Download a template, fill it from an ERP export, and upload it on the entity's row below. Dates as YYYY-MM-DD or DD/MM/YYYY.</p>
        </div>
      </div>
      <input type="file" accept=".csv,text/csv" ref={fileRef} hidden onChange={onFile} />
      <div className="card">
        <h3>Synced data</h3>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Entity</th><th className="r">Records</th><th>Last load</th><th>Required fields</th><th /></tr></thead>
          <tbody>
            {st?.entities.map((e) => {
              const spec = ents.find((x) => x.key === e.key);
              return (
                <tr key={e.key}>
                  <td><b>{e.label}</b><br /><small className="muted"><code>{e.key}</code></small></td>
                  <td className="r num">{fmt.number(e.records)}</td>
                  <td className="nowrap">{e.last ? <>{fmt.dt(e.last.finished_at)} <span className={`badge s-${e.last.status}`}>{e.last.status}</span><br /><small className="muted">{e.last.source} · {e.last.records_upserted} rows{e.last.rejected ? ` · ${e.last.rejected} rejected` : ''}</small></> : <span className="muted">never</span>}</td>
                  <td><small className="muted">{spec?.required.join(', ')}</small></td>
                  <td className="nowrap">
                    <button className="btn sm ghost" onClick={() => setBrowse(e)}>View</button>
                    <button className="btn sm ghost" onClick={() => download(`/data/template/${e.key}`, `${e.key}.csv`).catch(m.err)}>Template</button>
                    {can(user, 'preparer') && <button className="btn sm" disabled={!!busy} onClick={() => pickFile(e.key)}>Upload CSV</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>
      <div className="card">
        <h3>Sync history</h3>
        <div className="tbl-wrap"><table className="tbl small">
          <thead><tr><th>Started</th><th>Source</th><th>Entity</th><th>Status</th><th className="r">In</th><th className="r">Loaded</th><th className="r">Rejected</th><th>By</th><th>Message</th></tr></thead>
          <tbody>{logs.slice(0, 60).map((l) => (
            <tr key={l.id}><td className="nowrap">{fmt.dt(l.started_at)}</td><td>{l.source}</td><td>{l.entity}</td><td><span className={`badge s-${l.status}`}>{l.status}</span></td>
              <td className="r">{l.records_in}</td><td className="r">{l.records_upserted}</td><td className="r">{l.rejected}</td><td>{l.user_name || (l.source === 'api' ? 'ERP API' : '')}</td>
              <td className="msgcell" title={l.message || ''}>{l.message ? l.message.slice(0, 120) : ''}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
      {browse && <Browse entity={browse} onClose={() => setBrowse(null)} />}
    </div>
  );
}

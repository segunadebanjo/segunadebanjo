import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, download, fmt, can } from '../api';
import { useAuth } from '../App.jsx';
import ReportView from '../components/ReportView.jsx';
import { Status, Msg, useMsg, Modal } from '../components/ui.jsx';

const ACTIONS = {
  review: { label: 'Mark as reviewed', role: 'reviewer', from: ['draft'] },
  approve: { label: 'Approve', role: 'approver', from: ['reviewed'] },
  submit: { label: 'Record NAICOM submission', role: 'approver', from: ['approved'] },
  reject: { label: 'Reject', role: 'reviewer', from: ['draft', 'reviewed', 'approved'] },
};

export default function RunDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [run, setRun] = useState(null);
  const [act, setAct] = useState(null);
  const [notes, setNotes] = useState('');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const m = useMsg();
  const load = () => api.get(`/reports/runs/${id}`).then(setRun).catch(m.err);
  useEffect(() => { load(); }, [id]);

  const doAction = async () => {
    setBusy(true);
    try {
      await api.post(`/reports/runs/${id}/${act}`, { notes, submission_ref: ref });
      setAct(null); setNotes(''); setRef(''); m.ok(`Return ${act === 'submit' ? 'marked as submitted' : act + 'd'}.`); load();
    } catch (e) { m.err(e); setAct(null); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!window.confirm('Delete this draft?')) return;
    try { await api.del(`/reports/runs/${id}`); nav('/runs'); } catch (e) { m.err(e); }
  };
  const exp = (f) => download(`/reports/runs/${id}/export/${f}`, `return.${f}`).catch(m.err);

  if (!run) return <div><Msg msg={m.msg} /><p className="muted">Loading…</p></div>;
  const steps = [
    ['Prepared', run.generated_at, run.generated_by_name],
    ['Reviewed', run.reviewed_at, run.reviewed_by_name],
    ['Approved', run.approved_at, run.approved_by_name],
    ['Submitted to NAICOM', run.submitted_at, run.submitted_by_name],
  ];
  const available = Object.entries(ACTIONS).filter(([, a]) => a.from.includes(run.status) && can(user, a.role));
  return (
    <div>
      <div className="page-head">
        <div>
          <p className="crumbs"><Link to="/runs">Generated returns</Link> ›</p>
          <h1>{run.report_code} · {run.period_label} <small className="muted">v{run.version}</small> <Status value={run.status} /></h1>
        </div>
        <div className="row wrap">
          <button className="btn" onClick={() => exp('xlsx')}>Excel</button>
          <button className="btn" onClick={() => exp('pdf')}>PDF</button>
          <button className="btn ghost" onClick={() => exp('json')}>JSON</button>
        </div>
      </div>
      <Msg msg={m.msg} onClose={m.clear} />
      <div className="card">
        <ol className="steps">
          {steps.map(([l, at, by]) => (
            <li key={l} className={at ? 'done' : ''}><b>{l}</b><small>{at ? `${fmt.dt(at)} · ${by || ''}` : '—'}</small></li>
          ))}
        </ol>
        {run.submission_ref && <p>NAICOM acknowledgement reference: <b>{run.submission_ref}</b></p>}
        {run.notes && <pre className="notes">{run.notes}</pre>}
        <div className="row wrap">
          {available.map(([k, a]) => <button key={k} className={`btn ${k === 'reject' ? 'danger' : 'primary'}`} onClick={() => setAct(k)}>{a.label}</button>)}
          {['draft', 'rejected'].includes(run.status) && can(user, 'preparer') && <button className="btn ghost" onClick={del}>Delete</button>}
          {['draft', 'rejected'].includes(run.status) && <Link className="btn ghost" to={`/reports/${run.report_code}?frequency=${run.frequency}&year=${run.period_end.slice(0, 4)}&index=${run.output.period.index}`}>Regenerate</Link>}
        </div>
        {run.status === 'draft' && <p className="muted small">The person who prepared a return cannot review or approve it (maker-checker).</p>}
      </div>
      <ReportView out={run.output} />
      {act && (
        <Modal title={ACTIONS[act].label} onClose={() => setAct(null)}>
          {act === 'submit' && <label className="field">NAICOM portal / acknowledgement reference<input value={ref} onChange={(e) => setRef(e.target.value)} autoFocus /></label>}
          {act === 'approve' && run.error_count > 0 && <div className="msg err">This return has {run.error_count} validation error(s). A justification note is required to approve it.</div>}
          <label className="field">{act === 'reject' ? 'Reason (required)' : 'Notes'}<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <div className="row"><button className="btn primary" disabled={busy} onClick={doAction}>Confirm</button><button className="btn ghost" onClick={() => setAct(null)}>Cancel</button></div>
        </Modal>
      )}
    </div>
  );
}

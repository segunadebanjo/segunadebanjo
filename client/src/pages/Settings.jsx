import { useEffect, useState } from 'react';
import { api, fmt, can } from '../api';
import { useAuth } from '../App.jsx';
import { Msg, useMsg } from '../components/ui.jsx';

const FIELDS = {
  company: [['name', 'Broker name'], ['naicomLicenseNo', 'NAICOM licence number'], ['licenseExpiry', 'Licence expiry', 'date'], ['rcNumber', 'CAC RC number'],
    ['tin', 'TIN'], ['address', 'Registered address'], ['email', 'Email'], ['phone', 'Telephone'], ['mdCeo', 'MD / CEO'], ['complianceOfficer', 'Compliance officer']],
  insurance: [['piiInsurer', 'PII insurer'], ['piiPolicyNo', 'PII policy no.'], ['piiLimit', 'PII limit (₦)', 'number'], ['piiExpiry', 'PII expiry', 'date'],
    ['fidelityInsurer', 'Fidelity guarantee insurer'], ['fidelityPolicyNo', 'Fidelity policy no.'], ['fidelityLimit', 'Fidelity limit (₦)', 'number'], ['fidelityExpiry', 'Fidelity expiry', 'date']],
  compliance: [['remittanceDays', 'Max days to remit premium to insurer', 'number'], ['minimumCapital', 'Minimum paid-up capital (₦)', 'number'],
    ['piiMinimumCover', 'Minimum PII cover (₦, 0 = skip)', 'number'], ['cashCtrThreshold', 'CTR threshold – individuals (₦)', 'number'],
    ['corporateCtrThreshold', 'CTR threshold – corporates (₦)', 'number'], ['complaintResolutionDays', 'Complaint resolution target (days)', 'number'],
    ['claimsSubmissionDays', 'Days to forward claim notice to insurer', 'number']],
};
const TABS = [['company', 'Company'], ['insurance', 'PII & fidelity'], ['compliance', 'Thresholds'], ['commissionCaps', 'Commission caps'], ['dueDays', 'Due dates'], ['gl', 'GL mapping'], ['classes', 'Class mapping']];

function Form({ fields, value, onChange, disabled }) {
  return <div className="form-grid">{fields.map(([k, label, type]) => (
    <label key={k} className="field">{label}
      <input type={type || 'text'} disabled={disabled} value={value[k] ?? ''} onChange={(e) => onChange({ ...value, [k]: type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value })} />
    </label>))}</div>;
}

export default function Settings() {
  const { user } = useAuth();
  const admin = can(user, 'admin');
  const [tab, setTab] = useState('company');
  const [s, setS] = useState(null);
  const [meta, setMeta] = useState(null);
  const [gl, setGl] = useState([]);
  const [cls, setCls] = useState([]);
  const [glFilter, setGlFilter] = useState('');
  const m = useMsg();
  useEffect(() => {
    api.get('/settings').then(setS); api.get('/settings/meta').then(setMeta);
    api.get('/settings/gl-mapping').then(setGl); api.get('/settings/class-mapping').then(setCls);
  }, []);
  const save = async (key) => { try { await api.put(`/settings/${key}`, s[key]); m.ok('Saved.'); } catch (e) { m.err(e); } };
  const saveGl = async () => { try { await api.put('/settings/gl-mapping', { mappings: gl.map(({ id, fs_line }) => ({ id, fs_line })) }); m.ok('GL mapping saved.'); } catch (e) { m.err(e); } };
  const saveCls = async () => { try { await api.put('/settings/class-mapping', { mappings: cls.map(({ id, naicom_class }) => ({ id, naicom_class })) }); m.ok('Class mapping saved.'); } catch (e) { m.err(e); } };
  if (!s || !meta) return <p className="muted">Loading…</p>;
  const unmapped = gl.filter((g) => !g.fs_line && Math.abs(g.latest_balance || 0) > 0).length;
  const saveBtn = (key) => admin && <button className="btn primary" onClick={() => save(key)}>Save</button>;
  return (
    <div>
      <div className="page-head"><div><h1>Settings</h1><p className="muted">{admin ? 'Regulatory thresholds are defaults. Confirm them against current NAICOM guidelines before relying on them.' : 'Read only. Only administrators can change settings.'}</p></div></div>
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); m.clear(); }}>{l}{k === 'gl' && unmapped ? <span className="cnt bad">{unmapped}</span> : null}</button>)}</div>
      <Msg msg={m.msg} onClose={m.clear} />
      <div className="card flat">
        {FIELDS[tab] && <><Form fields={FIELDS[tab]} value={s[tab]} disabled={!admin} onChange={(v) => setS({ ...s, [tab]: v })} />{saveBtn(tab)}</>}
        {tab === 'commissionCaps' && <>
          <p className="muted small">Maximum brokerage commission (%) per NAICOM class. Placements above the cap are flagged on QR-03.</p>
          <Form fields={meta.naicomClasses.map((c) => [c.code, c.name, 'number'])} value={s.commissionCaps} disabled={!admin} onChange={(v) => setS({ ...s, commissionCaps: v })} />
          {saveBtn('commissionCaps')}
        </>}
        {tab === 'dueDays' && <>
          <p className="muted small">Days after the period end that a return falls due, by frequency.</p>
          <Form fields={[['quarterly', 'Quarterly returns', 'number'], ['half-yearly', 'Half-yearly returns', 'number'], ['monthly', 'Monthly returns', 'number'], ['annual', 'Annual returns', 'number']]}
            value={s.dueDays} disabled={!admin} onChange={(v) => setS({ ...s, dueDays: v })} />
          {saveBtn('dueDays')}
        </>}
        {tab === 'gl' && <>
          <div className="row between wrap"><p className="muted small">Map each ERP general-ledger account to a line on the NAICOM financial statements. Mappings are kept when the chart of accounts is re-synced.</p>
            <input placeholder="Filter accounts" value={glFilter} onChange={(e) => setGlFilter(e.target.value)} /></div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Code</th><th>Account</th><th>Type</th><th className="r">Latest balance</th><th>NAICOM line</th></tr></thead>
            <tbody>{gl.filter((g) => !glFilter || `${g.code} ${g.name}`.toLowerCase().includes(glFilter.toLowerCase())).map((g) => (
              <tr key={g.id} className={!g.fs_line && g.latest_balance ? 'warn-row' : ''}><td>{g.code}</td><td>{g.name}</td><td>{g.account_type}</td><td className="r num">{fmt.money(g.latest_balance)}</td>
                <td><select disabled={!admin} value={g.fs_line || ''} onChange={(e) => setGl(gl.map((x) => (x.id === g.id ? { ...x, fs_line: e.target.value || null } : x)))}>
                  <option value="">— not mapped —</option>
                  {['SOFP', 'PL'].map((st) => <optgroup key={st} label={st === 'SOFP' ? 'Financial position' : 'Profit or loss'}>
                    {meta.fsLines.filter((l) => l.statement === st).map((l) => <option key={l.code} value={l.code}>{l.group}: {l.name}</option>)}</optgroup>)}
                </select></td></tr>))}</tbody>
          </table></div>
          {admin && <button className="btn primary" onClick={saveGl}>Save mapping</button>}
        </>}
        {tab === 'classes' && <>
          <p className="muted small">Map each class of business in your ERP to its NAICOM class.</p>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>ERP code</th><th>ERP class</th><th>NAICOM class</th></tr></thead>
            <tbody>{cls.map((c) => (
              <tr key={c.id}><td>{c.code}</td><td>{c.name}</td><td><select disabled={!admin} value={c.naicom_class} onChange={(e) => setCls(cls.map((x) => (x.id === c.id ? { ...x, naicom_class: e.target.value } : x)))}>
                {meta.naicomClasses.map((n) => <option key={n.code} value={n.code}>{n.name}</option>)}</select></td></tr>))}</tbody>
          </table></div>
          {admin && <button className="btn primary" onClick={saveCls}>Save mapping</button>}
        </>}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api, fmt } from '../api';

export default function Audit() {
  const [rows, setRows] = useState([]);
  const [user, setUser] = useState('');
  useEffect(() => { const t = setTimeout(() => api.get(`/audit?limit=500&user=${encodeURIComponent(user)}`).then(setRows), 250); return () => clearTimeout(t); }, [user]);
  return (
    <div>
      <div className="page-head"><div><h1>Audit trail</h1><p className="muted">Every sign-in, data load, generation, approval, submission, export and settings change.</p></div>
        <input placeholder="Filter by user email" value={user} onChange={(e) => setUser(e.target.value)} /></div>
      <div className="card"><div className="tbl-wrap"><table className="tbl small">
        <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Object</th><th>Details</th><th>IP</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}><td className="nowrap">{fmt.dt(r.created_at)}</td><td>{r.user_email}</td><td>{r.action}</td><td>{r.entity}{r.entity_id ? ` #${r.entity_id}` : ''}</td>
            <td className="msgcell" title={r.details || ''}>{r.details?.slice(0, 140)}</td><td>{r.ip}</td></tr>
        ))}</tbody>
      </table></div></div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api, fmt } from '../api';
import { Msg, useMsg, Modal } from '../components/ui.jsx';

const ROLES = { viewer: 'View only', preparer: 'Prepares returns (maker)', reviewer: 'Reviews returns (checker)', approver: 'Approves & records submission', admin: 'Full control incl. settings' };

export default function Users() {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const m = useMsg();
  const load = () => api.get('/users').then(setRows).catch(m.err);
  useEffect(() => { load(); }, []);
  const save = async () => {
    try {
      if (edit.id) await api.put(`/users/${edit.id}`, { name: edit.name, role: edit.role, active: !!edit.active, password: edit.password || undefined });
      else await api.post('/users', edit);
      setEdit(null); m.ok('User saved.'); load();
    } catch (e) { m.err(e); }
  };
  return (
    <div>
      <div className="page-head"><div><h1>Users</h1><p className="muted">Users launched from the ERP are created automatically on first sign-on.</p></div>
        <button className="btn primary" onClick={() => setEdit({ name: '', email: '', role: 'preparer', password: '', active: 1 })}>Add user</button></div>
      <Msg msg={m.msg} onClose={m.clear} />
      <div className="card"><div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th>Last sign-in</th><th /></tr></thead>
        <tbody>{rows.map((u) => (
          <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td>{u.active ? 'Yes' : 'No'}</td><td>{fmt.dt(u.last_login_at)}</td>
            <td><button className="btn sm ghost" onClick={() => setEdit({ ...u, password: '' })}>Edit</button></td></tr>
        ))}</tbody>
      </table></div></div>
      {edit && (
        <Modal title={edit.id ? 'Edit user' : 'Add user'} onClose={() => setEdit(null)}>
          <label className="field">Name<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
          {!edit.id && <label className="field">Email<input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></label>}
          <label className="field">Role<select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{k} – {v}</option>)}</select></label>
          <label className="field">{edit.id ? 'Reset password (leave blank to keep)' : 'Password (blank = ERP sign-on only)'}<input type="password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></label>
          {edit.id && <label className="check"><input type="checkbox" checked={!!edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active</label>}
          <div className="row"><button className="btn primary" onClick={save}>Save</button></div>
        </Modal>
      )}
    </div>
  );
}

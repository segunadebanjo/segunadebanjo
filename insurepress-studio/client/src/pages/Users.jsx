import { useEffect, useState } from 'react';
import { UserPlus, Trash2, KeyRound, Users as UsersIcon } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Modal, Field, Spinner, useToast } from '../components/ui.jsx';

export default function Users() {
  const auth = useAuth();
  const toast = useToast();
  const [list, setList] = useState(null);
  const [adding, setAdding] = useState(null);
  const [reset, setReset] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/users').then(setList).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); }, []);

  if (auth.user.role !== 'admin') return <div className="p-10 text-center text-slate-500">Only admins can manage users.</div>;

  const create = async () => {
    setBusy(true);
    try { await api.post('/users', adding); toast(`Account created for ${adding.email}. Share the password with them securely.`); setAdding(null); load(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const changeRole = async (u, role) => {
    try { await api.put(`/users/${u.id}`, { role }); toast('Role updated'); load(); } catch (e) { toast(e.message, 'error'); }
  };
  const doReset = async () => {
    setBusy(true);
    try { await api.put(`/users/${reset.id}`, { password: reset.password }); toast('Password reset. They have been signed out everywhere.'); setReset(null); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const remove = async (u) => {
    if (!confirm(`Delete ${u.full_name} (${u.email})?\n\nThis permanently deletes their ${u.book_count} book(s), brand kits, offers and exported files.`)) return;
    try { await api.del(`/users/${u.id}`); toast('User deleted'); load(); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <div className="flex items-end">
          <div>
            <h1 className="flex items-center gap-2 font-serif text-2xl font-black text-navy-800"><UsersIcon size={22} />Users</h1>
            <p className="text-sm text-slate-500">Each author has a private library, brand kits and offers. Admins can also manage accounts.</p>
          </div>
          <button className="btn-primary ml-auto" onClick={() => setAdding({ full_name: '', email: '', password: '', role: 'author', brokerage_name: '' })}><UserPlus size={15} />Add user</button>
        </div>
        <div className="card overflow-hidden">
          {!list ? <div className="p-6"><Spinner /></div> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2">Name</th><th>Email</th><th>Role</th><th>Books</th><th>Last sign-in</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2.5 font-semibold text-slate-700">{u.full_name}{u.id === auth.user.id && <span className="ml-1 text-xs font-normal text-slate-400">(you)</span>}</td>
                    <td className="text-slate-600">{u.email}{!u.has_password && <span className="chip ml-2 bg-amber-50 text-amber-700">no password</span>}</td>
                    <td>
                      <select className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs" value={u.role} disabled={u.id === auth.user.id} onChange={(e) => changeRole(u, e.target.value)}>
                        <option value="author">Author</option><option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="text-slate-600">{u.book_count}</td>
                    <td className="text-xs text-slate-500">{u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-GB') : 'Never'}</td>
                    <td className="pr-3 text-right">
                      <button className="btn-ghost btn-sm" title="Reset password" onClick={() => setReset({ ...u, password: '' })}><KeyRound size={13} /></button>
                      {u.id !== auth.user.id && <button className="btn-ghost btn-sm text-slate-400 hover:text-red-600" title="Delete user" onClick={() => remove(u)}><Trash2 size={13} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={!!adding} onClose={() => setAdding(null)} title="Add a user" subtitle="They can change their password after signing in." size="md"
        footer={<><button className="btn-ghost" onClick={() => setAdding(null)}>Cancel</button><button className="btn-primary" onClick={create} disabled={busy}>{busy && <Spinner />}Create account</button></>}>
        {adding && (
          <div className="space-y-3">
            <Field label="Full name"><input className="input" value={adding.full_name} onChange={(e) => setAdding({ ...adding, full_name: e.target.value })} /></Field>
            <Field label="Email"><input className="input" type="email" value={adding.email} onChange={(e) => setAdding({ ...adding, email: e.target.value })} /></Field>
            <Field label="Brokerage (optional)"><input className="input" value={adding.brokerage_name} onChange={(e) => setAdding({ ...adding, brokerage_name: e.target.value })} /></Field>
            <Field label="Temporary password" hint="At least 10 characters, with letters and numbers."><input className="input" type="text" autoComplete="off" value={adding.password} onChange={(e) => setAdding({ ...adding, password: e.target.value })} /></Field>
            <Field label="Role"><select className="input" value={adding.role} onChange={(e) => setAdding({ ...adding, role: e.target.value })}><option value="author">Author</option><option value="admin">Admin</option></select></Field>
          </div>
        )}
      </Modal>
      <Modal open={!!reset} onClose={() => setReset(null)} title={`Reset password for ${reset?.full_name || ''}`} subtitle="They will be signed out on every device." size="sm"
        footer={<><button className="btn-ghost" onClick={() => setReset(null)}>Cancel</button><button className="btn-primary" onClick={doReset} disabled={busy}>{busy && <Spinner />}Reset password</button></>}>
        {reset && <Field label="New temporary password" hint="At least 10 characters, with letters and numbers."><input className="input" type="text" autoComplete="off" value={reset.password} onChange={(e) => setReset({ ...reset, password: e.target.value })} /></Field>}
      </Modal>
    </div>
  );
}

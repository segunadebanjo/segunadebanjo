import { useState } from 'react';
import { KeyRound, LogOut, UserRound } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Field, Spinner, useToast } from '../components/ui.jsx';

export default function Account() {
  const auth = useAuth();
  const toast = useToast();
  const [p, setP] = useState({ full_name: auth.user.full_name || '', brokerage_name: auth.user.brokerage_name || '', naicom_license_no: auth.user.naicom_license_no || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(null);

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy('profile');
    try { auth.updateUser(await api.put('/me', p)); toast('Profile saved'); } catch (err) { toast(err.message, 'error'); } finally { setBusy(null); }
  };
  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) return toast('The new passwords don’t match', 'error');
    setBusy('pw');
    try {
      await api.put('/auth/password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      toast('Password changed. Other devices have been signed out.');
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(null); }
  };
  const signOutEverywhere = async () => {
    if (!confirm('Sign out of InsurePress Studio on every device, including this one?')) return;
    await api.post('/auth/logout-all');
    auth.signOut();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-4xl gap-6 p-6 md:grid-cols-2">
        <form onSubmit={saveProfile} className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-navy-800"><UserRound size={18} />Your profile</h2>
          <Field label="Email"><input className="input bg-slate-50" value={auth.user.email} disabled /></Field>
          <Field label="Full name"><input className="input" value={p.full_name} onChange={(e) => setP({ ...p, full_name: e.target.value })} required /></Field>
          <Field label="Brokerage name"><input className="input" value={p.brokerage_name} onChange={(e) => setP({ ...p, brokerage_name: e.target.value })} /></Field>
          <Field label="NAICOM licence no."><input className="input" value={p.naicom_license_no} onChange={(e) => setP({ ...p, naicom_license_no: e.target.value })} /></Field>
          <div className="flex items-center gap-2 text-xs text-slate-500">Role: <span className="chip bg-navy-50 capitalize text-navy-700">{auth.user.role}</span></div>
          <button className="btn-primary" disabled={busy === 'profile'}>{busy === 'profile' && <Spinner />}Save profile</button>
        </form>
        <div className="space-y-6">
          <form onSubmit={changePassword} className="card space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-navy-800"><KeyRound size={18} />Change password</h2>
            <Field label="Current password"><input className="input" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required /></Field>
            <Field label="New password" hint="At least 10 characters, with letters and numbers."><input className="input" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required /></Field>
            <Field label="Confirm new password"><input className="input" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required /></Field>
            <button className="btn-primary" disabled={busy === 'pw'}>{busy === 'pw' && <Spinner />}Change password</button>
          </form>
          <div className="card p-5">
            <h2 className="font-serif text-lg font-bold text-navy-800">Sessions</h2>
            <p className="mt-1 text-sm text-slate-500">Lost a laptop or signed in on a shared computer? Sign out everywhere.</p>
            <button className="btn-outline mt-3 text-red-600" onClick={signOutEverywhere}><LogOut size={15} />Sign out on all devices</button>
          </div>
        </div>
      </div>
    </div>
  );
}

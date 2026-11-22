import { useEffect, useState } from 'react';
import { KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api.js';
import { Field, Spinner } from '../components/ui.jsx';
import { AuthShell } from './SignIn.jsx';

/** Opened from the reset email: /reset-password?token=… */
export default function ResetPassword() {
  // Read the token once, then drop it from the address bar and browser history.
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') || '');
  const [check, setCheck] = useState(null);
  const [pw, setPw] = useState({ password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    window.history.replaceState(null, '', '/reset-password');
    if (!token) { setCheck({ valid: false }); return; }
    api.get(`/auth/reset/check?token=${encodeURIComponent(token)}`).then(setCheck).catch(() => setCheck({ valid: false }));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (pw.password !== pw.confirm) return setError('The two passwords don’t match');
    setBusy(true);
    try {
      await api.post('/auth/reset', { token, password: pw.password });
      setDone(true);
      setTimeout(() => window.location.assign('/'), 1200); // already signed in by the server
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const goSignIn = () => window.location.assign('/');

  if (!check) return <AuthShell title="Checking your link…"><Spinner /></AuthShell>;
  if (!check.valid && !done) {
    return (
      <AuthShell title="This link has expired" subtitle="Reset links work once and expire after an hour. Request a new one from the sign-in page.">
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"><AlertTriangle size={16} />Invalid or expired reset link</div>
        <button className="btn-primary w-full py-2.5" onClick={goSignIn}>Back to sign in</button>
      </AuthShell>
    );
  }
  if (done) {
    return (
      <AuthShell title="Password updated">
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"><CheckCircle2 size={16} />You’re signed in. Other devices have been signed out.</div>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={`Choose a new password${check.firstName ? `, ${check.firstName}` : ''}`} subtitle="You’ll be signed in straight away, and signed out on every other device.">
      <form onSubmit={submit} className="space-y-3">
        <Field label="New password" hint="At least 10 characters, with letters and numbers."><input className="input" type="password" autoComplete="new-password" autoFocus value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} required /></Field>
        <Field label="Confirm new password"><input className="input" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required /></Field>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
        <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? <Spinner /> : <KeyRound size={16} />}Set new password</button>
      </form>
    </AuthShell>
  );
}

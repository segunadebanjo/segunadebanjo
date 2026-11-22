import { useState } from 'react';
import { ShieldCheck, LogIn, UserPlus, KeyRound, Mail, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Field, Spinner } from '../components/ui.jsx';

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 font-serif text-xl font-bold text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500"><ShieldCheck size={20} /></span>
          InsurePress <span className="font-sans text-xs font-semibold uppercase tracking-widest text-gold-400">Studio</span>
        </div>
        <div className="card p-6">
          <h1 className="font-serif text-xl font-bold text-navy-800">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        <p className="mt-4 text-center text-xs text-navy-200">Write, design and publish insurance books that sell.</p>
      </div>
    </div>
  );
}

const PASSWORD_HINT = 'At least 10 characters, with letters and numbers.';

export default function SignIn() {
  const auth = useAuth();
  const [mode, setMode] = useState(auth.needsSetup ? 'setup' : 'login');
  const [f, setF] = useState({ full_name: '', email: '', password: '', confirm: '', brokerage_name: '', naicom_license_no: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if ((mode === 'setup' || mode === 'register') && f.password !== f.confirm) return setError('The two passwords don’t match');
    setBusy(true);
    try {
      if (mode === 'forgot') { const r = await api.post('/auth/forgot', { email: f.email }); setSent(r.message); return; }
      if (mode === 'login') await auth.signIn(f.email, f.password);
      else if (mode === 'setup') await auth.setup(f);
      else await auth.register(f);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const accountFields = (
    <>
      <Field label="Full name"><input className="input" value={f.full_name} onChange={set('full_name')} autoComplete="name" required /></Field>
      <Field label="Email"><input className="input" type="email" value={f.email} onChange={set('email')} autoComplete="email" required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Brokerage (optional)"><input className="input" value={f.brokerage_name} onChange={set('brokerage_name')} autoComplete="organization" /></Field>
        <Field label="NAICOM licence (optional)"><input className="input" value={f.naicom_license_no} onChange={set('naicom_license_no')} /></Field>
      </div>
      <Field label="Password" hint={PASSWORD_HINT}><input className="input" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" required minLength={10} /></Field>
      <Field label="Confirm password"><input className="input" type="password" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" required /></Field>
    </>
  );

  const content = {
    setup: { title: 'Create your admin account', subtitle: 'This is a one-time setup. You’ll be the admin and can add other authors later. Any existing books are kept and moved into your account.', button: 'Create admin account', icon: KeyRound },
    login: { title: auth.expired ? 'Your session has ended' : 'Sign in', subtitle: auth.expired ? 'Sign in again to keep working. Your unsaved changes are kept and will save once you’re back.' : 'Welcome back.', button: 'Sign in', icon: LogIn },
    register: { title: 'Create an account', subtitle: 'Start building your insurance book.', button: 'Create account', icon: UserPlus },
    forgot: { title: 'Reset your password', subtitle: 'Enter your account email and we’ll send you a link to choose a new password.', button: 'Send reset link', icon: Mail },
  }[mode];

  return (
    <AuthShell title={content.title} subtitle={content.subtitle}>
      <form onSubmit={submit} className="space-y-3">
        {mode === 'forgot' ? (
          sent ? <div className="flex gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"><CheckCircle2 size={16} className="mt-0.5 shrink-0" />{sent}</div>
            : <Field label="Email"><input className="input" type="email" value={f.email} onChange={set('email')} autoComplete="email" autoFocus required /></Field>
        ) : mode === 'login' ? (
          <>
            <Field label="Email"><input className="input" type="email" value={f.email} onChange={set('email')} autoComplete="email" autoFocus required /></Field>
            <Field label="Password"><input className="input" type="password" value={f.password} onChange={set('password')} autoComplete="current-password" required /></Field>
            {auth.emailEnabled && <div className="-mt-1 text-right"><button type="button" className="text-xs font-semibold text-gold-600 hover:underline" onClick={() => { setMode('forgot'); setError(''); setSent(''); }}>Forgot password?</button></div>}
          </>
        ) : accountFields}
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
        {!(mode === 'forgot' && sent) && <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? <Spinner /> : <content.icon size={16} />}{content.button}</button>}
      </form>
      {mode === 'forgot' && (
        <p className="mt-4 text-center text-sm text-slate-500"><button className="font-semibold text-gold-600 hover:underline" onClick={() => { setMode('login'); setError(''); setSent(''); }}>Back to sign in</button></p>
      )}
      {mode === 'login' && auth.allowRegistration && (
        <p className="mt-4 text-center text-sm text-slate-500">New here? <button className="font-semibold text-gold-600 hover:underline" onClick={() => { setMode('register'); setError(''); }}>Create an account</button></p>
      )}
      {mode === 'register' && (
        <p className="mt-4 text-center text-sm text-slate-500">Already have an account? <button className="font-semibold text-gold-600 hover:underline" onClick={() => { setMode('login'); setError(''); }}>Sign in</button></p>
      )}
      {mode === 'login' && !auth.allowRegistration && (
        <p className="mt-4 text-center text-xs text-slate-400">{auth.emailEnabled ? 'Need an account? Ask your workspace admin.' : 'Forgot your password or need an account? Ask your workspace admin.'}</p>
      )}
    </AuthShell>
  );
}

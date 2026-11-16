import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth';
import { Button, ErrorBanner, Field, inputCls } from '../components/ui';

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const state = useLocation().state as { from?: string; notice?: string } | null;
  const from = state?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (user) return <Navigate to={user.mustChangePassword ? '/account/password' : from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(email, password);
      navigate(u.mustChangePassword ? '/account/password' : from, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-3 text-lg font-semibold text-slate-900">Insurance Ad Manager</h1>
          <p className="text-sm text-slate-500">Sign in to continue</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {state?.notice && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{state.notice}</p>}
          <ErrorBanner error={error} />
          <Field label="Email">
            <input className={inputCls} type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={<span className="flex items-center justify-between">Password<Link to="/forgot-password" className="text-xs font-normal text-brand-700 hover:underline">Forgot password?</Link></span>}>
            <input className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" loading={busy} icon={<LogIn className="h-4 w-4" />}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}

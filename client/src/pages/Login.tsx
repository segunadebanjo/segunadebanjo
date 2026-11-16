import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Smartphone } from 'lucide-react';
import { useAuth } from '../auth';
import type { User } from '../types';
import { Button, ErrorBanner, Field, inputCls } from '../components/ui';
import { AuthShell } from './AuthShell';

const landing = (u: User, from: string) => (u.mustChangePassword ? '/account/password' : u.mustSetUpTwoFactor ? '/account/security' : from);

export function Login() {
  const { user, login, completeTwoFactor } = useAuth();
  const navigate = useNavigate();
  const state = useLocation().state as { from?: string; notice?: string } | null;
  const from = state?.from ?? '/';
  const [step, setStep] = useState<'password' | 'code'>('password');
  const [useRecovery, setUseRecovery] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(state?.notice ?? null);

  if (user && step === 'password') return <Navigate to={landing(user, from)} replace />;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const r = await login(email, password);
      if (r === 'twoFactor') {
        setNotice(null);
        setStep('code');
      } else navigate(landing(r, from), { replace: true });
    });
  };

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const r = await completeTwoFactor(useRecovery ? { recoveryCode: code } : { code });
      if (r.recoveryCodesRemaining !== undefined && r.recoveryCodesRemaining <= 3)
        alert(`You have ${r.recoveryCodesRemaining} recovery code(s) left. Create new ones on the Security page.`);
      navigate(landing(r.user, from), { replace: true });
    });
  };

  if (step === 'code')
    return (
      <AuthShell
        subtitle="Two-factor authentication"
        footer={
          <button className="text-brand-700 hover:underline" onClick={() => (setStep('password'), setCode(''), setPassword(''), setError(null))}>
            Start over
          </button>
        }
      >
        <form onSubmit={submitCode} className="space-y-4">
          <p className="flex gap-2 text-sm text-slate-600">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
            {useRecovery ? 'Enter one of the recovery codes you saved when you set up two-factor authentication. Each code works once.' : 'Open your authenticator app and enter the 6-digit code for Insurance Ad Manager.'}
          </p>
          <ErrorBanner error={error} />
          <Field label={useRecovery ? 'Recovery code' : 'Authentication code'}>
            {useRecovery ? (
              <input key="rc" className={inputCls + ' font-mono'} autoComplete="off" required autoFocus placeholder="xxxxx-xxxxx" value={code} onChange={(e) => setCode(e.target.value)} />
            ) : (
              <input
                key="otp"
                className={inputCls + ' text-center font-mono text-lg tracking-[0.4em]'}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            )}
          </Field>
          <Button type="submit" className="w-full" loading={busy}>
            Verify
          </Button>
          <button type="button" className="w-full text-center text-xs text-brand-700 hover:underline" onClick={() => (setUseRecovery(!useRecovery), setCode(''), setError(null))}>
            {useRecovery ? 'Use my authenticator app instead' : "Can't use your phone? Use a recovery code"}
          </button>
        </form>
      </AuthShell>
    );

  return (
    <AuthShell subtitle="Sign in to continue">
      <form onSubmit={submitPassword} className="space-y-4">
        {notice && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        <ErrorBanner error={error} />
        <Field label="Email">
          <input className={inputCls} type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field
          label={
            <span className="flex items-center justify-between">
              Password
              <Link to="/forgot-password" className="text-xs font-normal text-brand-700 hover:underline">
                Forgot password?
              </Link>
            </span>
          }
        >
          <input className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full" loading={busy} icon={<LogIn className="h-4 w-4" />}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}

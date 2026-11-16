import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { api } from '../api';
import { Button, ErrorBanner, Field, Spinner, inputCls } from '../components/ui';
import { AuthShell } from './AuthShell';

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token] = useState(() => params.get('token') ?? '');
  const [valid, setValid] = useState<boolean | null>(null);
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    // Drop the token from the address bar/history as soon as we've read it.
    if (params.get('token')) window.history.replaceState(null, '', '/reset-password');
    if (token.length < 20) {
      setValid(false);
      return;
    }
    api
      .validateResetToken(token)
      .then((r) => setValid(r.valid))
      .catch(() => setValid(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError(new Error('The new passwords do not match'));
      return;
    }
    setBusy(true);
    try {
      const r = await api.resetPassword(token, next);
      navigate('/login', { replace: true, state: { notice: r.message } });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      subtitle="Choose a new password"
      footer={
        <Link to="/login" className="text-brand-700 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {valid === null ? (
        <Spinner label="Checking your link…" />
      ) : !valid ? (
        <div className="space-y-3 text-sm text-slate-700">
          <p className="font-medium text-rose-700">This reset link is invalid or has expired.</p>
          <p>Links work once and expire after a short time. Request a new one.</p>
          <Link to="/forgot-password">
            <Button className="w-full">Request a new link</Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <ErrorBanner error={error} />
          <Field label="New password" hint="At least 10 characters, with letters and numbers. Signs you out on every device.">
            <input className={inputCls} type="password" autoComplete="new-password" required minLength={10} autoFocus value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label="Confirm new password">
            <input className={inputCls} type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" loading={busy} icon={<KeyRound className="h-4 w-4" />}>
            Set new password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

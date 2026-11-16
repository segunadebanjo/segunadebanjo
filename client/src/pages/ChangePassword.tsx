import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button, Card, ErrorBanner, Field, PageHeader, inputCls } from '../components/ui';

export function ChangePassword() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const forced = user?.mustChangePassword;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError(new Error('The new passwords do not match'));
      return;
    }
    setBusy(true);
    try {
      const r = await api.changePassword(current, next);
      setUser(r.user);
      setDone(true);
      if (forced) navigate(r.user.mustSetUpTwoFactor ? '/account/security' : '/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Change password" subtitle={forced ? 'You are using a temporary password. Choose your own to continue.' : 'Changing your password signs you out on every other device.'} />
      <Card className="max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <ErrorBanner error={error} />
          {done && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Password changed.</p>}
          <Field label={forced ? 'Temporary password' : 'Current password'}>
            <input className={inputCls} type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label="New password" hint="At least 10 characters, with letters and numbers.">
            <input className={inputCls} type="password" autoComplete="new-password" required minLength={10} value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label="Confirm new password">
            <input className={inputCls} type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button type="submit" loading={busy} icon={<KeyRound className="h-4 w-4" />}>
            Change password
          </Button>
        </form>
      </Card>
    </>
  );
}

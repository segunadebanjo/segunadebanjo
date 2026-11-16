import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { api } from '../api';
import { Button, ErrorBanner, Field, inputCls } from '../components/ui';
import { AuthShell } from './AuthShell';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSent((await api.forgotPassword(email)).message);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      subtitle="Reset your password"
      footer={
        <Link to="/login" className="text-brand-700 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-3 text-sm text-slate-700">
          <p className="flex items-center gap-2 font-medium text-emerald-700">
            <Mail className="h-4 w-4" /> Check your email
          </p>
          <p>{sent}</p>
          <p className="text-xs text-slate-500">No email after a few minutes? Check your spam folder, or ask an administrator to reset your password.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-600">Enter the email you sign in with. We'll send you a link to choose a new password.</p>
          <ErrorBanner error={error} />
          <Field label="Email">
            <input className={inputCls} type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" loading={busy} icon={<Mail className="h-4 w-4" />}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

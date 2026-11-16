import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Download, KeyRound, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Badge, Button, Card, ErrorBanner, Field, PageHeader, Spinner, inputCls, useAsync } from '../components/ui';

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Insurance Ad Manager recovery codes\nEach code can be used once.\n\n${codes.join('\n')}\n`;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700">
        <strong>Save these recovery codes now.</strong> They're the only way in if you lose your phone, and they won't be shown again. Each works once.
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-4 font-mono text-sm">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          icon={<Copy className="h-4 w-4" />}
          onClick={async () => {
            await navigator.clipboard.writeText(text).catch(() => undefined);
            setCopied(true);
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button
          variant="secondary"
          icon={<Download className="h-4 w-4" />}
          onClick={() => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
            a.download = 'insurance-ad-manager-recovery-codes.txt';
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >
          Download
        </Button>
        <Button onClick={onDone}>I've saved them</Button>
      </div>
    </div>
  );
}

export function Security() {
  const { user, setUser } = useAuth();
  const status = useAsync(() => api.twoFactorStatus(), []);
  const [setup, setSetup] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'idle' | 'disable' | 'regenerate'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const start = () => run(async () => setSetup(await api.twoFactorSetup()));
  const confirm = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const r = await api.twoFactorEnable(code);
      setCodes(r.recoveryCodes);
      setSetup(null);
      setCode('');
      // Don't unlock the rest of the app until the codes have been acknowledged (see onDone).
      await status.reload();
    });
  };
  const finishCodes = () => {
    setCodes(null);
    if (user) setUser({ ...user, twoFactorEnabled: true, mustSetUpTwoFactor: false });
  };
  const disable = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.twoFactorDisable(password, code.includes('-') ? { recoveryCode: code } : { code });
      setMode('idle');
      setCode('');
      setPassword('');
      if (user) setUser({ ...user, twoFactorEnabled: false });
      await status.reload();
    });
  };
  const regenerate = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      setCodes((await api.twoFactorRecoveryCodes(code)).recoveryCodes);
      setMode('idle');
      setCode('');
      await status.reload();
    });
  };

  const s = status.data;
  return (
    <>
      <PageHeader title="Security" subtitle={`Sign-in settings for ${user?.email ?? 'your account'}`} />
      {user?.mustSetUpTwoFactor && !codes && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Your role requires two-factor authentication. Set it up below to continue using the app.</div>
      )}
      <div className="grid max-w-3xl gap-6">
        <Card
          title={
            <span className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-brand-700" /> Two-factor authentication
            </span>
          }
          actions={s && (s.enabled ? <Badge className="bg-emerald-100 text-emerald-800">On</Badge> : <Badge>Off</Badge>)}
        >
          <ErrorBanner error={error ?? status.error} onClose={() => setError(null)} />
          {!s ? (
            <Spinner />
          ) : codes ? (
            <RecoveryCodes codes={codes} onDone={finishCodes} />
          ) : setup ? (
            <form onSubmit={confirm} className="space-y-4">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
                <li>Install an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password.</li>
                <li>Scan this QR code with it (or type the key below).</li>
                <li>Enter the 6-digit code the app shows.</li>
              </ol>
              <div className="flex flex-wrap items-center gap-5">
                <img src={setup.qrCodeDataUrl} alt="QR code for your authenticator app" width={180} height={180} className="rounded-lg border border-slate-200" />
                <div className="min-w-0 text-sm">
                  <p className="text-xs text-slate-500">Can't scan? Enter this key:</p>
                  <p className="mt-1 font-mono text-sm break-all text-slate-900">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</p>
                </div>
              </div>
              <Field label="6-digit code">
                <input
                  className={inputCls + ' max-w-48 text-center font-mono text-lg tracking-[0.4em]'}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" loading={busy} icon={<ShieldCheck className="h-4 w-4" />}>
                  Turn on
                </Button>
                <Button type="button" variant="secondary" onClick={() => (setSetup(null), setCode(''))}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : !s.enabled ? (
            <div className="space-y-3 text-sm text-slate-700">
              <p>Protect your account with a code from your phone in addition to your password, so a stolen password isn't enough to sign in.</p>
              <Button loading={busy} icon={<ShieldCheck className="h-4 w-4" />} onClick={start}>
                Set up two-factor authentication
              </Button>
            </div>
          ) : (
            <div className="space-y-4 text-sm text-slate-700">
              <p>
                On since {s.enabledAt ? new Date(s.enabledAt).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : '—'}. {s.recoveryCodesRemaining} unused recovery code
                {s.recoveryCodesRemaining === 1 ? '' : 's'} left.
                {s.required && ' Required for your role.'}
              </p>
              {s.recoveryCodesRemaining <= 3 && <p className="rounded-lg bg-amber-50 p-2 text-amber-900">You're running low on recovery codes. Create a new set.</p>}
              {mode === 'idle' && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" icon={<KeyRound className="h-4 w-4" />} onClick={() => setMode('regenerate')}>
                    New recovery codes
                  </Button>
                  {!s.required && (
                    <Button variant="secondary" icon={<ShieldOff className="h-4 w-4" />} onClick={() => setMode('disable')}>
                      Turn off
                    </Button>
                  )}
                </div>
              )}
              {mode === 'regenerate' && (
                <form onSubmit={regenerate} className="space-y-3 rounded-lg border border-slate-200 p-4">
                  <p>Your current recovery codes will stop working.</p>
                  <Field label="Code from your authenticator app">
                    <input className={inputCls + ' max-w-48 font-mono'} inputMode="numeric" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                  </Field>
                  <div className="flex gap-2">
                    <Button type="submit" loading={busy}>
                      Create new codes
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => (setMode('idle'), setCode(''))}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
              {mode === 'disable' && (
                <form onSubmit={disable} className="space-y-3 rounded-lg border border-rose-200 p-4">
                  <p>Turning this off makes your account easier to break into.</p>
                  <Field label="Password">
                    <input className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </Field>
                  <Field label="Authentication code or recovery code">
                    <input className={inputCls + ' max-w-56 font-mono'} autoComplete="off" required value={code} onChange={(e) => setCode(e.target.value)} />
                  </Field>
                  <div className="flex gap-2">
                    <Button type="submit" variant="danger" loading={busy}>
                      Turn off
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => (setMode('idle'), setCode(''), setPassword(''))}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </Card>
        <Card title="Password">
          <p className="text-sm text-slate-700">
            <Link to="/account/password" className="font-medium text-brand-700 hover:underline">
              Change your password
            </Link>{' '}
            · Signs you out on every other device.
          </p>
        </Card>
      </div>
    </>
  );
}

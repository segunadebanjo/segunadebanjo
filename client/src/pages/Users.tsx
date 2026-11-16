import { useState } from 'react';
import { KeyRound, Plus, Smartphone, Trash2, UserCog, Users as UsersIcon } from 'lucide-react';
import { api, type ManagedUser } from '../api';
import { ROLE_HELP, ROLE_LABEL, useAuth } from '../auth';
import type { UserRole } from '../types';
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Modal, PageHeader, Spinner, filterCls, inputCls, useAsync } from '../components/ui';

const ROLES: UserRole[] = ['ADMIN', 'MARKETER', 'VIEWER'];
const ROLE_STYLE: Record<UserRole, string> = { ADMIN: 'bg-violet-100 text-violet-800', MARKETER: 'bg-sky-100 text-sky-800', VIEWER: 'bg-slate-100 text-slate-700' };

/** Random temporary password that satisfies the policy (letters + digits, 14 chars). */
const tempPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const rnd = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(rnd, (v, i) => (i % 4 === 3 ? digits[v % digits.length] : chars[v % chars.length])).join('');
};

export function Users() {
  const { user: me } = useAuth();
  const list = useAsync(() => api.users(), []);
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState<{ email: string; name: string; role: UserRole; password: string } | null>(null);
  const [resetFor, setResetFor] = useState<{ user: ManagedUser; password: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (msg) setNotice(msg);
      await list.reload();
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Who can sign in, and what they can do"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating({ email: '', name: '', role: 'MARKETER', password: tempPassword() })}>
            Add user
          </Button>
        }
      />
      <ErrorBanner error={error ?? list.error} onClose={() => setError(null)} />
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r} className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
            <Badge className={ROLE_STYLE[r]}>{ROLE_LABEL[r]}</Badge>
            <p className="mt-1.5">{ROLE_HELP[r]}</p>
          </div>
        ))}
      </div>
      <Card padded={false}>
        {list.loading && !list.data ? (
          <Spinner />
        ) : !list.data?.length ? (
          <EmptyState icon={<UsersIcon className="h-10 w-10" />} title="No users" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Last sign-in</th>
                  <th className="px-5 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((u) => {
                  const self = u.id === me?.id;
                  return (
                    <tr key={u.id} className={'border-b border-slate-50 ' + (u.isActive ? '' : 'opacity-60')}>
                      <td className="px-5 py-2">
                        <p className="font-medium text-slate-900">
                          {u.name} {self && <span className="text-xs font-normal text-slate-400">(you)</span>}
                        </p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          aria-label={`Role for ${u.email}`}
                          className={filterCls + ' py-1 text-xs'}
                          value={u.role}
                          disabled={self || busy}
                          onChange={(e) => run(() => api.updateUser(u.id, { role: e.target.value as UserRole }), `${u.email} is now ${ROLE_LABEL[e.target.value as UserRole]}.`)}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        {u.isActive ? <Badge className="bg-emerald-100 text-emerald-800">Active</Badge> : <Badge>Deactivated</Badge>}
                        {u.mustChangePassword && u.isActive && <Badge className="ml-1 bg-amber-100 text-amber-800">Temp password</Badge>}
                        {u.twoFactorEnabledAt && (
                          <Badge className="ml-1 bg-indigo-100 text-indigo-800">
                            <Smartphone className="h-3 w-3" /> 2FA
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap text-slate-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'}</td>
                      <td className="px-5 py-2">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" className="px-2 py-1 text-xs" icon={<KeyRound className="h-3.5 w-3.5" />} disabled={busy} onClick={() => setResetFor({ user: u, password: tempPassword() })}>
                            Reset password
                          </Button>
                          {u.twoFactorEnabledAt && !self && (
                            <Button
                              variant="ghost"
                              className="px-2 py-1 text-xs"
                              icon={<Smartphone className="h-3.5 w-3.5" />}
                              disabled={busy}
                              onClick={() =>
                                confirm(`Reset two-factor authentication for ${u.email}? Use this when they've lost their phone. They'll be signed out and can sign in with just their password until they set it up again.`) &&
                                run(() => api.adminReset2fa(u.id), `Two-factor authentication reset for ${u.email}.`)
                              }
                            >
                              Reset 2FA
                            </Button>
                          )}
                          {!self && (
                            <Button
                              variant="ghost"
                              className="px-2 py-1 text-xs"
                              icon={<UserCog className="h-3.5 w-3.5" />}
                              disabled={busy}
                              onClick={() => run(() => api.updateUser(u.id, { isActive: !u.isActive }), `${u.email} ${u.isActive ? 'deactivated and signed out' : 'reactivated'}.`)}
                            >
                              {u.isActive ? 'Deactivate' : 'Reactivate'}
                            </Button>
                          )}
                          {!self && (
                            <button
                              aria-label={`Delete ${u.email}`}
                              className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              disabled={busy}
                              onClick={() => confirm(`Delete ${u.email}? This cannot be undone. Deactivating keeps their history instead.`) && run(() => api.deleteUser(u.id), `${u.email} deleted.`)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(creating)}
        title="Add user"
        onClose={() => setCreating(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(null)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                if (!creating) return;
                const c = creating;
                if (await run(() => api.createUser(c), `${c.email} created. Share the temporary password "${c.password}" securely; they must change it at first sign-in.`)) setCreating(null);
              }}
            >
              Create user
            </Button>
          </>
        }
      >
        {creating && (
          <div className="space-y-4">
            <ErrorBanner error={error} />
            <Field label="Full name">
              <input className={inputCls} value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className={inputCls} type="email" value={creating.email} onChange={(e) => setCreating({ ...creating, email: e.target.value })} />
            </Field>
            <Field label="Role" hint={ROLE_HELP[creating.role]}>
              <select className={inputCls} value={creating.role} onChange={(e) => setCreating({ ...creating, role: e.target.value as UserRole })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Temporary password" hint="They must replace it at first sign-in. Share it securely, not by email.">
              <input className={inputCls + ' font-mono'} value={creating.password} onChange={(e) => setCreating({ ...creating, password: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(resetFor)}
        title={`Reset password for ${resetFor?.user.email ?? ''}`}
        onClose={() => setResetFor(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetFor(null)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                if (!resetFor) return;
                const r = resetFor;
                if (await run(() => api.adminResetPassword(r.user.id, r.password), `Password for ${r.user.email} reset to "${r.password}". They are signed out and must choose a new one at next sign-in.`))
                  setResetFor(null);
              }}
            >
              Reset password
            </Button>
          </>
        }
      >
        {resetFor && (
          <div className="space-y-3">
            <ErrorBanner error={error} />
            <p className="text-sm text-slate-600">This signs the user out everywhere. They'll have to set their own password at next sign-in.</p>
            <Field label="Temporary password">
              <input className={inputCls + ' font-mono'} value={resetFor.password} onChange={(e) => setResetFor({ ...resetFor, password: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}

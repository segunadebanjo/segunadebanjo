import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BarChart3, FlaskConical, KeyRound, LogOut, Megaphone, PackageOpen, Plus, ShieldCheck, Sparkles, Users, Webhook, Zap } from 'lucide-react';
import { ROLE_LABEL, useAuth } from '../auth';
import { api } from '../api';
import { cx, useAsync } from './ui';

type Access = 'all' | 'write' | 'admin';
const NAV: { to: string; label: string; icon: typeof BarChart3; end: boolean; access: Access }[] = [
  { to: '/', label: 'Dashboard', icon: BarChart3, end: true, access: 'all' },
  { to: '/campaigns', label: 'Campaigns', icon: Megaphone, end: true, access: 'all' },
  { to: '/campaigns/new', label: 'New campaign', icon: Plus, end: true, access: 'write' },
  { to: '/products', label: 'Products', icon: PackageOpen, end: false, access: 'all' },
  { to: '/optimization', label: 'Optimization', icon: Zap, end: false, access: 'all' },
  { to: '/conversions', label: 'Conversions', icon: Webhook, end: false, access: 'all' },
  { to: '/users', label: 'Users', icon: Users, end: false, access: 'admin' },
];

export function Layout() {
  const status = useAsync(() => api.platformStatus(), []);
  const { user, canWrite, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const nav = NAV.filter((n) => n.access === 'all' || (n.access === 'write' && canWrite) || (n.access === 'admin' && isAdmin));
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center gap-2 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">Insurance Ads</p>
            <p className="text-xs text-slate-500">Campaign automation</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition', isActive ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-600 hover:bg-slate-100')
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        {user && (
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 md:block">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{user.name}</p>
              <p className="truncate text-xs text-slate-500">
                {user.email} · <span className="font-medium text-brand-700">{ROLE_LABEL[user.role]}</span>
              </p>
            </div>
            <div className="flex gap-1 md:mt-2">
              <NavLink to="/account/security" title="Password and two-factor authentication" className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
                <KeyRound className="h-3.5 w-3.5" /> Security
              </NavLink>
              <button
                onClick={async () => {
                  await logout();
                  navigate('/login', { replace: true });
                }}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          </div>
        )}
        {status.data && (
          <div className="hidden space-y-1.5 border-t border-slate-100 px-5 py-4 text-xs text-slate-500 md:block">
            {status.data.sandboxMode && (
              <p className="flex items-center gap-1.5 font-medium text-amber-700">
                <FlaskConical className="h-3.5 w-3.5" /> Sandbox mode
              </p>
            )}
            <p className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> AI: {status.data.aiEnabled ? status.data.aiModel : 'templates (no API key)'}
            </p>
          </div>
        )}
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}

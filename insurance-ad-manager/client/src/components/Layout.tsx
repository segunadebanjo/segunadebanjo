import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, FlaskConical, Megaphone, PackageOpen, Plus, ShieldCheck, Sparkles, Webhook, Zap } from 'lucide-react';
import { api } from '../api';
import { cx, useAsync } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: BarChart3, end: true },
  { to: '/campaigns', label: 'Campaigns', icon: Megaphone, end: true },
  { to: '/campaigns/new', label: 'New campaign', icon: Plus, end: true },
  { to: '/products', label: 'Products', icon: PackageOpen, end: false },
  { to: '/optimization', label: 'Optimization', icon: Zap, end: false },
  { to: '/conversions', label: 'Conversions', icon: Webhook, end: false },
];

export function Layout() {
  const status = useAsync(() => api.platformStatus(), []);
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
          {NAV.map(({ to, label, icon: Icon, end }) => (
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

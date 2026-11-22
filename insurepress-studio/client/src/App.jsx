import { Routes, Route, NavLink, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Library, Palette, Sparkles, ShieldCheck, Users as UsersIcon, LogOut, UserRound, ChevronDown } from 'lucide-react';
import { ToastProvider, Spinner } from './components/ui.jsx';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import SignIn from './pages/SignIn.jsx';
import Account from './pages/Account.jsx';
import Users from './pages/Users.jsx';
import { api } from './lib/api.js';
import Dashboard from './pages/Dashboard.jsx';
import Studio from './pages/Studio.jsx';
import CoverStudio from './pages/CoverStudio.jsx';
import Monetize from './pages/Monetize.jsx';
import BrandKit from './pages/BrandKit.jsx';

function UserMenu() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const initials = (auth.user.full_name || auth.user.email).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="relative">
      <button className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-white/10" onClick={() => setOpen((o) => !o)}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-500 text-[11px] font-bold">{initials}</span>
        <ChevronDown size={14} className="text-navy-200" />
      </button>
      {open && (
        <div className="card absolute right-0 top-10 z-50 w-56 p-1 text-sm text-slate-700" onMouseLeave={() => setOpen(false)}>
          <div className="border-b border-slate-100 px-3 py-2"><div className="truncate font-semibold">{auth.user.full_name}</div><div className="truncate text-xs text-slate-500">{auth.user.email}</div></div>
          <Link to="/account" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded px-3 py-2 hover:bg-slate-50"><UserRound size={14} />Account &amp; password</Link>
          {auth.user.role === 'admin' && <Link to="/users" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded px-3 py-2 hover:bg-slate-50"><UsersIcon size={14} />Manage users</Link>}
          <button onClick={() => { setOpen(false); auth.signOut(); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-red-600 hover:bg-red-50"><LogOut size={14} />Sign out</button>
        </div>
      )}
    </div>
  );
}

function TopBar() {
  const [ai, setAi] = useState(null);
  useEffect(() => { api.get('/ai/status').then(setAi).catch(() => setAi({ mode: 'offline' })); }, []);
  const link = ({ isActive }) => `btn-ghost ${isActive ? 'bg-white/10 text-white' : 'text-navy-100 hover:bg-white/10 hover:text-white'}`;
  return (
    <header className="flex h-12 shrink-0 items-center gap-4 bg-navy-800 px-4 text-white">
      <Link to="/" className="flex items-center gap-2 font-serif text-[15px] font-bold">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gold-500"><ShieldCheck size={16} /></span>
        InsurePress <span className="font-sans text-xs font-semibold uppercase tracking-widest text-gold-400">Studio</span>
      </Link>
      <nav className="flex gap-1">
        <NavLink to="/" end className={link}><Library size={15} />Library</NavLink>
        <NavLink to="/brand" className={link}><Palette size={15} />Brand Kit</NavLink>
      </nav>
      <div className="ml-auto flex items-center gap-3 text-xs">
        <span className="hidden text-navy-200 md:inline">NAICOM &amp; NIIRA 2025 ready · ₦ NGN default</span>
        {ai && (
          <span title={ai.mode === 'mock' ? 'Set ANTHROPIC_API_KEY in .env to enable live AI' : `Model: ${ai.model}`}
            className={`chip gap-1 ${ai.mode === 'live' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-gold-500/20 text-gold-100'}`}>
            <Sparkles size={12} />AI {ai.mode === 'live' ? 'live' : ai.mode === 'mock' ? 'mock mode' : 'offline'}
          </span>
        )}
        <UserMenu />
      </div>
    </header>
  );
}

function Workspace() {
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <main className="min-h-0 flex-1">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/brand" element={<BrandKit />} />
          <Route path="/account" element={<Account />} />
          <Route path="/users" element={<Users />} />
          <Route path="/books/:id" element={<Studio />} />
          <Route path="/books/:id/cover" element={<CoverStudio />} />
          <Route path="/books/:id/monetize" element={<Monetize />} />
          <Route path="*" element={<div className="p-10 text-center text-slate-500">Page not found. <Link className="text-gold-600 underline" to="/">Back to library</Link></div>} />
        </Routes>
      </main>
    </div>
  );
}

function Gate() {
  const auth = useAuth();
  if (auth.loading) return <div className="flex h-full items-center justify-center"><Spinner size={24} /></div>;
  if (!auth.user) return <SignIn />;
  if (!auth.expired) return <Workspace />;
  // Session expired mid-work: keep the workspace mounted (so the open chapter isn't lost) and sign in on top.
  return (
    <>
      <Workspace />
      <div className="fixed inset-0 z-[80] overflow-y-auto"><SignIn /></div>
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ToastProvider>
  );
}

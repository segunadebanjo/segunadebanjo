import { Routes, Route, NavLink, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Library, Palette, Sparkles, ShieldCheck } from 'lucide-react';
import { ToastProvider } from './components/ui.jsx';
import { api } from './lib/api.js';
import Dashboard from './pages/Dashboard.jsx';
import Studio from './pages/Studio.jsx';
import CoverStudio from './pages/CoverStudio.jsx';
import Monetize from './pages/Monetize.jsx';
import BrandKit from './pages/BrandKit.jsx';

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
      </div>
    </header>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <div className="flex h-full flex-col">
        <TopBar />
        <main className="min-h-0 flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/brand" element={<BrandKit />} />
            <Route path="/books/:id" element={<Studio />} />
            <Route path="/books/:id/cover" element={<CoverStudio />} />
            <Route path="/books/:id/monetize" element={<Monetize />} />
            <Route path="*" element={<div className="p-10 text-center text-slate-500">Page not found. <Link className="text-gold-600 underline" to="/">Back to library</Link></div>} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  );
}

import { createContext, useContext, useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { api, setToken, getToken, can } from './api';
import Login from './pages/Login.jsx';
import Sso from './pages/Sso.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Catalog from './pages/Catalog.jsx';
import Generate from './pages/Generate.jsx';
import Runs from './pages/Runs.jsx';
import RunDetail from './pages/RunDetail.jsx';
import DataSync from './pages/DataSync.jsx';
import Settings from './pages/Settings.jsx';
import Users from './pages/Users.jsx';
import Audit from './pages/Audit.jsx';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const NAV = [
  { to: '/', label: 'Compliance calendar', end: true },
  { to: '/reports', label: 'Statutory returns' },
  { to: '/runs', label: 'Generated returns' },
  { to: '/data', label: 'ERP data' },
  { to: '/settings', label: 'Settings' },
  { to: '/users', label: 'Users', role: 'admin' },
  { to: '/audit', label: 'Audit trail', role: 'reviewer' },
];

function Shell({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  // ?embed=1 hides the sidebar chrome when the add-on is opened inside the ERP in an iframe
  const embedded = new URLSearchParams(loc.search).get('embed') === '1' || window.self !== window.top;
  return (
    <div className={`shell ${embedded ? 'embedded' : ''}`}>
      <aside className={`side ${open ? 'open' : ''}`}>
        <div className="brand"><span className="logo">N</span><div><b>NAICOM Returns</b><small>Broker ERP add-on</small></div></div>
        <nav>
          {NAV.filter((n) => !n.role || can(user, n.role)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>{n.label}</NavLink>
          ))}
        </nav>
        <div className="me">
          <div><b>{user.name}</b><small>{user.role}</small></div>
          <button className="btn ghost sm" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main>
        <button className="menu-btn" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const nav = useNavigate();
  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    api.get('/auth/me').then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setReady(true));
  }, []);
  const login = (token, u) => { setToken(token); setUser(u); };
  const logout = () => { setToken(null); setUser(null); nav('/login'); };
  if (!ready) return <div className="center muted">Loading…</div>;
  return (
    <AuthCtx.Provider value={{ user, login, logout }}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/sso" element={<Sso />} />
        <Route path="*" element={!user ? <Navigate to="/login" /> : (
          <Shell>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/reports" element={<Catalog />} />
              <Route path="/reports/:code" element={<Generate />} />
              <Route path="/runs" element={<Runs />} />
              <Route path="/runs/:id" element={<RunDetail />} />
              <Route path="/data" element={<DataSync />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/users" element={<Users />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Shell>
        )} />
      </Routes>
    </AuthCtx.Provider>
  );
}

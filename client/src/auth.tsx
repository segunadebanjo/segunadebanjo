import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from './api';
import type { User, UserRole } from './types';
import { Spinner } from './components/ui';

interface AuthState {
  user: User | null;
  loading: boolean;
  /** ADMIN or MARKETER: may create/change campaigns, products, rules. */
  canWrite: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    // Any API call that comes back 401 (expired / revoked session) signs the user out of the UI.
    const onUnauthorized = () => setUser(null);
    const onPasswordChange = () => setUser((u) => (u ? { ...u, mustChangePassword: true } : u));
    window.addEventListener('auth:unauthorized', onUnauthorized);
    window.addEventListener('auth:password-change', onPasswordChange);
    return () => {
      window.removeEventListener('auth:unauthorized', onUnauthorized);
      window.removeEventListener('auth:password-change', onPasswordChange);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.login(email, password);
    setUser(r.user);
    return r.user;
  }, []);
  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, logout, setUser, canWrite: user?.role === 'ADMIN' || user?.role === 'MARKETER', isAdmin: user?.role === 'ADMIN' }),
    [user, loading, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Route guard: sign-in required; optional role list; forced password change first. */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (user.mustChangePassword && location.pathname !== '/account/password') return <Navigate to="/account/password" replace />;
  if (roles && !roles.includes(user.role))
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Your role (<strong>{user.role}</strong>) can't open this page. Ask an administrator if you need access.
      </div>
    );
  return <>{children}</>;
}

export const ROLE_LABEL: Record<UserRole, string> = { ADMIN: 'Admin', MARKETER: 'Marketer', VIEWER: 'Viewer' };
export const ROLE_HELP: Record<UserRole, string> = {
  ADMIN: 'Everything, plus user management',
  MARKETER: 'Create, publish and optimize campaigns; manage products and rules',
  VIEWER: 'Read-only: dashboards, campaigns, conversions',
};

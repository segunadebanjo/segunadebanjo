import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, needsSetup: false, allowRegistration: false, expired: false });

  const refresh = useCallback(async () => {
    try {
      const s = await api.get('/auth/status');
      setState((x) => ({ ...x, loading: false, ...s }));
    } catch (e) {
      setState((x) => ({ ...x, loading: false, error: e.message }));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    // Keep the last user's details so the open workspace can stay mounted under the sign-in overlay.
    const onOut = () => setState((x) => (x.user ? { ...x, expired: true } : x));
    window.addEventListener('ip:signed-out', onOut);
    return () => window.removeEventListener('ip:signed-out', onOut);
  }, []);

  const signIn = async (email, password) => {
    const { user } = await api.post('/auth/login', { email, password });
    if (state.expired && state.user && state.user.id !== user.id) {
      // A different person signed in on the expiry overlay: start them on a fresh page.
      window.location.assign('/');
      return;
    }
    setState((x) => ({ ...x, user, expired: false }));
    window.dispatchEvent(new Event('ip:signed-in'));
  };
  const register = async (body) => {
    const { user } = await api.post('/auth/register', body);
    setState((x) => ({ ...x, user, expired: false }));
  };
  const setup = async (body) => {
    const { user } = await api.post('/auth/setup', body);
    setState((x) => ({ ...x, user, needsSetup: false, expired: false }));
  };
  const signOut = async () => {
    await api.post('/auth/logout').catch(() => {});
    setState((x) => ({ ...x, user: null, expired: false }));
  };
  const updateUser = (patch) => setState((x) => ({ ...x, user: { ...x.user, ...patch } }));

  return <AuthCtx.Provider value={{ ...state, refresh, signIn, register, setup, signOut, updateUser }}>{children}</AuthCtx.Provider>;
}

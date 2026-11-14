import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App.jsx';

// Entry point when launched from the host ERP: /sso?token=<ERP-signed JWT>&next=/reports
export default function Sso() {
  const [params] = useSearchParams();
  const { login } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState('');
  useEffect(() => {
    api.post('/auth/sso', { token: params.get('token') })
      .then((r) => { login(r.token, r.user); const next = params.get('next') || '/'; nav(next.startsWith('/') ? next : '/', { replace: true }); })
      .catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div className="center">{err ? <div className="msg err">ERP sign-on failed: {err}</div> : <span className="muted">Signing you in from the ERP…</span>}</div>;
}

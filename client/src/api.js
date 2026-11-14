// Thin API client. Token is kept in sessionStorage so an ERP-embedded tab is isolated per session.
const KEY = 'naicom_token';
export const getToken = () => sessionStorage.getItem(KEY);
export const setToken = (t) => (t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY));

async function request(method, path, body, isForm) {
  const headers = {};
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, { method, headers, body: body ? (isForm ? body : JSON.stringify(body)) : undefined });
  if (res.status === 401 && path !== '/auth/login') {
    setToken(null);
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b || {}),
  put: (p, b) => request('PUT', p, b),
  del: (p) => request('DELETE', p),
  upload: (p, form) => request('POST', p, form, true),
};

/** Download a file from an authenticated endpoint. */
export async function download(path, fallbackName) {
  const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) {
    let msg = `Download failed (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch { /* binary */ }
    throw new Error(msg);
  }
  const cd = res.headers.get('content-disposition') || '';
  const name = (cd.match(/filename="([^"]+)"/) || [])[1] || fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const fmt = {
  money: (v) => (v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })),
  number: (v) => (v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('en-NG')),
  pct: (v) => (v === null || v === undefined || v === '' ? '' : `${Number(v).toFixed(2)}`),
  short: (v) => {
    const n = Number(v || 0), a = Math.abs(n);
    if (a >= 1e9) return `₦${(n / 1e9).toFixed(2)}bn`;
    if (a >= 1e6) return `₦${(n / 1e6).toFixed(1)}m`;
    if (a >= 1e3) return `₦${(n / 1e3).toFixed(0)}k`;
    return `₦${n.toFixed(0)}`;
  },
  dt: (v) => (v ? String(v).replace('T', ' ').slice(0, 16) : ''),
};
export const fmtCell = (v, type) => (type === 'money' ? fmt.money(v) : type === 'number' ? fmt.number(v) : type === 'pct' ? fmt.pct(v) : v ?? '');

export const ROLE_RANK = { viewer: 0, preparer: 1, reviewer: 2, approver: 3, admin: 4 };
export const can = (user, role) => (ROLE_RANK[user?.role] ?? -1) >= ROLE_RANK[role];

export const PERIOD_OPTIONS = {
  quarterly: [1, 2, 3, 4].map((i) => ({ v: i, l: `Q${i}` })),
  'half-yearly': [{ v: 1, l: 'H1 (Jan-Jun)' }, { v: 2, l: 'H2 (Jul-Dec)' }],
  monthly: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((l, i) => ({ v: i + 1, l })),
  annual: [{ v: 1, l: 'Full year' }],
};

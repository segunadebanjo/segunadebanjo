import { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl', full: 'max-w-7xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`card my-8 w-full ${width} flex max-h-[calc(100vh-4rem)] flex-col`}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-serif text-lg font-bold text-navy-800">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button className="btn-ghost -mr-2 p-1.5" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export const Spinner = ({ size = 16, className = '' }) => <Loader2 size={size} className={`animate-spin ${className}`} />;

const STATUS = {
  outline: 'bg-slate-100 text-slate-600', drafting: 'bg-sky-100 text-sky-700', polishing: 'bg-amber-100 text-amber-700', complete: 'bg-emerald-100 text-emerald-700',
  draft: 'bg-slate-100 text-slate-600', review: 'bg-amber-100 text-amber-700', published: 'bg-emerald-100 text-emerald-700',
};
export const StatusBadge = ({ status }) => <span className={`chip ${STATUS[status] || 'bg-slate-100 text-slate-600'} capitalize`}>{status}</span>;

export function Progress({ value, className = '', color = 'bg-gold-500' }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-slate-200 ${className}`}>
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center text-slate-500">
      {Icon && <Icon size={28} className="mb-2 text-slate-300" />}
      <div className="font-semibold text-slate-700">{title}</div>
      <div className="mt-1 max-w-sm text-sm">{children}</div>
    </div>
  );
}

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = 'success') => {
    const id = Math.random();
    setItems((x) => [...x, { id, message, type }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), type === 'error' ? 6000 : 3000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className={`card flex items-center gap-2 px-4 py-3 text-sm ${t.type === 'error' ? 'border-red-200 text-red-700' : 'text-slate-700'}`}>
            {t.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} className="text-emerald-600" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`flex gap-1 rounded-lg bg-slate-100 p-1 ${className}`}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition ${value === t.id ? 'bg-white text-navy-800 shadow' : 'text-slate-500 hover:text-slate-700'}`}>
          {t.icon && <t.icon size={14} />}{t.label}
        </button>
      ))}
    </div>
  );
}

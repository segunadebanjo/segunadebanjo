import { useState } from 'react';
import { PERIOD_OPTIONS } from '../api';

export function Status({ value }) {
  return <span className={`badge s-${value}`}>{value}</span>;
}

export function Msg({ msg, onClose }) {
  if (!msg) return null;
  return <div className={`msg ${msg.type || 'ok'}`}><span>{msg.text}</span>{onClose && <button onClick={onClose} aria-label="Dismiss">×</button>}</div>;
}

export function useMsg() {
  const [msg, setMsg] = useState(null);
  return {
    msg, clear: () => setMsg(null),
    ok: (text) => setMsg({ type: 'ok', text }),
    err: (e) => setMsg({ type: 'err', text: e?.message || String(e) }),
  };
}

export function PeriodPicker({ frequencies, value, onChange }) {
  const years = [];
  const y = new Date().getFullYear();
  for (let i = y + 1; i >= y - 6; i--) years.push(i);
  const opts = PERIOD_OPTIONS[value.frequency] || [];
  return (
    <div className="row wrap">
      <label className="field">Frequency
        <select value={value.frequency} onChange={(e) => onChange({ ...value, frequency: e.target.value, index: 1 })}>
          {frequencies.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </label>
      <label className="field">Year
        <select value={value.year} onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}>
          {years.map((yr) => <option key={yr}>{yr}</option>)}
        </select>
      </label>
      {value.frequency !== 'annual' && (
        <label className="field">Period
          <select value={value.index} onChange={(e) => onChange({ ...value, index: Number(e.target.value) })}>
            {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

export function Modal({ title, children, onClose, wide }) {
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
        <div className="modal-head"><h3>{title}</h3><button className="btn ghost sm" onClick={onClose}>Close</button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

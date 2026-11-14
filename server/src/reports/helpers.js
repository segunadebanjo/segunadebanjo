const { query } = require('../db');

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Build a tabular section. Totals are computed for money/number columns unless totals:false. */
function table(key, title, columns, rows, opts = {}) {
  const sec = { type: 'table', key, title, columns, rows: rows.map((row) => {
    const out = { ...row };
    for (const c of columns) if (c.type === 'money') out[c.key] = r2(out[c.key]);
    return out;
  }) };
  if (opts.note) sec.note = opts.note;
  if (opts.totals !== false && rows.length) {
    const t = {};
    for (const c of columns) {
      if ((c.type === 'money' || c.type === 'number') && c.total !== false) t[c.key] = r2(sec.rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0));
    }
    t[columns[0].key] = opts.totalLabel || 'TOTAL';
    sec.totals = t;
  }
  return sec;
}

/** Key/value section, e.g. corporate information. */
const kv = (key, title, items, opts = {}) => ({ type: 'kv', key, title, items, ...(opts.note ? { note: opts.note } : {}) });

const C = {
  text: (key, label) => ({ key, label, type: 'text' }),
  money: (key, label, extra) => ({ key, label, type: 'money', ...extra }),
  num: (key, label, extra) => ({ key, label, type: 'number', ...extra }),
  pct: (key, label) => ({ key, label, type: 'pct' }),
  date: (key, label) => ({ key, label, type: 'date' }),
};

const pct = (a, b) => (b ? r2((a / b) * 100) : 0);

class Validator {
  constructor() { this.items = []; }
  error(message, ref) { this.items.push({ level: 'error', message, ...(ref ? { ref } : {}) }); }
  warn(message, ref) { this.items.push({ level: 'warning', message, ...(ref ? { ref } : {}) }); }
  info(message, ref) { this.items.push({ level: 'info', message, ...(ref ? { ref } : {}) }); }
}

const fmtN = (n) => Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = { query, table, kv, C, r2, pct, Validator, fmtN };

// Shared computation of the broker's financial statements from the synced trial balance.
const { query, r2 } = require('./helpers');
const { FS_LINES } = require('./fsLines');
const { startOfYear } = require('../lib/periods');

async function tbDateFor(end) {
  const r = await query('SELECT MAX(period_end) AS d FROM stg_gl_balances WHERE period_end <= ?', [end]);
  return r[0].d;
}

async function computeFinancials(period) {
  const tbDate = await tbDateFor(period.end);
  const closing = {};
  const movement = {};
  const ytd = {};
  let unmapped = [];
  let tbSum = 0;
  if (tbDate) {
    const rows = await query(
      `SELECT a.fs_line, SUM(b.closing_balance) AS bal FROM stg_gl_balances b
         JOIN stg_gl_accounts a ON a.id=b.gl_account_id WHERE b.period_end=? GROUP BY a.fs_line`, [tbDate]);
    for (const r of rows) { if (r.fs_line) closing[r.fs_line] = r.bal; tbSum += r.bal; }
    unmapped = await query(
      `SELECT a.code, a.name, SUM(b.closing_balance) AS bal FROM stg_gl_balances b JOIN stg_gl_accounts a ON a.id=b.gl_account_id
        WHERE b.period_end=? AND (a.fs_line IS NULL OR a.fs_line='') GROUP BY a.code, a.name HAVING ABS(bal) > 0.005`, [tbDate]);
    const mv = await query(
      `SELECT a.fs_line, SUM(b.period_movement) AS m FROM stg_gl_balances b JOIN stg_gl_accounts a ON a.id=b.gl_account_id
        WHERE b.period_end BETWEEN ? AND ? GROUP BY a.fs_line`, [period.start, period.end]);
    for (const r of mv) if (r.fs_line) movement[r.fs_line] = r.m;
    const y = await query(
      `SELECT a.fs_line, SUM(b.period_movement) AS m FROM stg_gl_balances b JOIN stg_gl_accounts a ON a.id=b.gl_account_id
        WHERE b.period_end BETWEEN ? AND ? GROUP BY a.fs_line`, [startOfYear(period.end), period.end]);
    for (const r of y) if (r.fs_line) ytd[r.fs_line] = r.m;
  }
  const line = (code, src) => r2((src[code] || 0) * FS_LINES.find((l) => l.code === code).sign);

  // Profit or loss
  const plLines = FS_LINES.filter((l) => l.statement === 'PL');
  const pl = plLines.map((l) => ({ code: l.code, name: l.name, group: l.group, period: line(l.code, movement), ytd: line(l.code, ytd) }));
  const sumG = (grp, k) => r2(pl.filter((x) => x.group === grp).reduce((s, x) => s + x[k], 0));
  const totals = {};
  for (const k of ['period', 'ytd']) {
    const income = sumG('Income', k), expenses = sumG('Expenses', k), tax = sumG('Tax', k);
    totals[k] = { income, expenses, pbt: r2(income - expenses), tax, pat: r2(income - expenses - tax) };
  }

  // Financial position
  const sofp = FS_LINES.filter((l) => l.statement === 'SOFP').map((l) => ({ code: l.code, name: l.name, group: l.group, amount: line(l.code, closing) }));
  const g = (grp) => r2(sofp.filter((x) => x.group === grp).reduce((s, x) => s + x.amount, 0));
  const assets = g('Assets'), liabilities = g('Liabilities');
  const equityExclProfit = g('Equity');
  const equity = r2(equityExclProfit + totals.ytd.pat);
  const val = (code) => sofp.find((x) => x.code === code)?.amount || 0;

  return {
    tbDate, unmapped, tbOutOfBalance: r2(tbSum),
    pl, plTotals: totals,
    sofp, assets, liabilities, equity, profitYtd: totals.ytd.pat,
    difference: r2(assets - liabilities - equity),
    val,
  };
}

function financialValidations(v, fin, period) {
  if (!fin.tbDate) { v.error('No trial balance (GL balances) has been synced for this period. Sync gl_balances from the ERP.'); return; }
  if (fin.tbDate < period.end) v.warn(`Latest trial balance is at ${fin.tbDate}, before period end ${period.end}.`);
  if (Math.abs(fin.tbOutOfBalance) > 1) v.error(`Trial balance at ${fin.tbDate} does not balance (net ${fin.tbOutOfBalance}).`);
  if (fin.unmapped.length) v.error(`${fin.unmapped.length} GL account(s) with balances are not mapped to a NAICOM line: ` +
    fin.unmapped.slice(0, 8).map((u) => `${u.code} ${u.name}`).join('; ') + '. Map them under Settings > GL Mapping.');
}

module.exports = { computeFinancials, financialValidations };

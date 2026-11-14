const router = require('express').Router();
const { query } = require('../db');
const { REPORTS, dueDate } = require('../reports/registry');
const { getAllSettings } = require('../lib/settings');
const { resolvePeriod, today, daysBetween } = require('../lib/periods');

// Compliance calendar: every return obligation (primary frequency of each report) for the year.
router.get('/', async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const settings = await getAllSettings();
  const now = today();
  const runs = await query(
    `SELECT report_code, period_start, period_end, status, version, id, submitted_at, submission_ref FROM report_runs
      WHERE YEAR(period_end)=? ORDER BY version DESC`, [year]);
  const latest = {};
  const rank = { submitted: 4, approved: 3, reviewed: 2, draft: 1, rejected: 0 };
  for (const r of runs) {
    const k = `${r.report_code}|${r.period_start}|${r.period_end}`;
    if (!latest[k] || rank[r.status] > rank[latest[k].status]) latest[k] = r;
  }
  const obligations = [];
  for (const rep of REPORTS) {
    const freq = rep.frequencies[0];
    const n = { quarterly: 4, monthly: 12, 'half-yearly': 2, annual: 1 }[freq];
    for (let i = 1; i <= n; i++) {
      const p = resolvePeriod(freq, year, i);
      const due = dueDate(rep, p, settings);
      const run = latest[`${rep.code}|${p.start}|${p.end}`];
      let state;
      if (run?.status === 'submitted') state = 'submitted';
      else if (p.end >= now) state = 'upcoming';
      else if (due < now) state = 'overdue';
      else state = 'due';
      obligations.push({ code: rep.code, name: rep.name, category: rep.category, frequency: freq, index: i, year,
        period: p.label, periodEnd: p.end, dueDate: due, daysToDue: daysBetween(now, due), state,
        runId: run?.id || null, runStatus: run?.status || null, submissionRef: run?.submission_ref || null });
    }
  }
  obligations.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.code.localeCompare(b.code));

  const [k] = await query(
    `SELECT (SELECT COALESCE(SUM(gross_premium),0) FROM stg_placements WHERE YEAR(placement_date)=:y) gp,
            (SELECT COALESCE(SUM(commission_amount),0) FROM stg_placements WHERE YEAR(placement_date)=:y) comm,
            (SELECT COUNT(*) FROM stg_placements WHERE YEAR(placement_date)=:y) n,
            (SELECT COUNT(*) FROM stg_claims WHERE status='open') open_claims,
            (SELECT COUNT(*) FROM stg_complaints WHERE status<>'resolved') open_complaints,
            (SELECT MAX(finished_at) FROM sync_logs WHERE status='success') last_sync`, { y: year });
  const monthly = await query(
    `SELECT MONTH(placement_date) m, SUM(gross_premium) gp, SUM(commission_amount) comm FROM stg_placements
      WHERE YEAR(placement_date)=? GROUP BY MONTH(placement_date) ORDER BY m`, [year]);
  const counts = obligations.reduce((s, o) => ({ ...s, [o.state]: (s[o.state] || 0) + 1 }), {});
  res.json({ year, today: now, company: settings.company, kpis: { ...k, ...counts }, monthly, obligations });
});

module.exports = router;

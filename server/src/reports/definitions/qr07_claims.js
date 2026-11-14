const { query, table, C, Validator, r2 } = require('../helpers');
const { NAICOM_CLASSES, CLASS_NAME } = require('../classes');
const { daysBetween } = require('../../lib/periods');

module.exports = {
  code: 'QR-07',
  name: 'Claims Returns (Claims Handled on Behalf of Clients)',
  category: 'Claims & Conduct',
  frequencies: ['quarterly', 'half-yearly', 'annual', 'monthly'],
  description: 'Claims movement by class: brought forward, notified, settled, repudiated, withdrawn and outstanding; turnaround times and claims forwarded to insurers late.',
  async run({ period, settings }) {
    const v = new Validator();
    const fwdDays = Number(settings.compliance.claimsSubmissionDays) || 3;
    // settled_date doubles as the "closed date" for settled, repudiated and withdrawn claims.
    const all = await query(
      `SELECT k.*, c.naicom_class AS cls, cl.name AS client, i.name AS insurer
         FROM stg_claims k JOIN stg_classes c ON c.id=k.class_id
         LEFT JOIN stg_clients cl ON cl.id=k.client_id LEFT JOIN stg_insurers i ON i.id=k.insurer_id
        WHERE k.notified_date <= ?`, [period.end]);
    const closedBy = (k, d) => k.status !== 'open' && k.settled_date && k.settled_date <= d;
    const missingClose = all.filter((k) => k.status !== 'open' && !k.settled_date);
    if (missingClose.length) v.warn(`${missingClose.length} closed claim(s) have no closure/settlement date and are treated as outstanding.`);

    const m = {};
    for (const c of NAICOM_CLASSES) m[c.code] = { cls: c.name, bf_n: 0, bf_amt: 0, new_n: 0, new_amt: 0, set_n: 0, set_amt: 0, rep_n: 0, rep_amt: 0, wd_n: 0, cf_n: 0, cf_amt: 0, tat: [] };
    const outstandingList = [];
    for (const k of all) {
      const g = m[k.cls]; if (!g) continue;
      const prev = new Date(period.start + 'T00:00:00Z'); prev.setUTCDate(prev.getUTCDate() - 1);
      const dayBefore = prev.toISOString().slice(0, 10);
      if (k.notified_date < period.start && !closedBy(k, dayBefore)) { g.bf_n++; g.bf_amt += k.amount_claimed; }
      if (k.notified_date >= period.start) { g.new_n++; g.new_amt += k.amount_claimed; }
      const closedInPeriod = k.status !== 'open' && k.settled_date && k.settled_date >= period.start && k.settled_date <= period.end;
      if (closedInPeriod && k.status === 'settled') { g.set_n++; g.set_amt += k.amount_settled; g.tat.push(daysBetween(k.notified_date, k.settled_date)); }
      if (closedInPeriod && k.status === 'repudiated') { g.rep_n++; g.rep_amt += k.amount_claimed; }
      if (closedInPeriod && k.status === 'withdrawn') g.wd_n++;
      if (!closedBy(k, period.end)) {
        g.cf_n++; g.cf_amt += k.amount_claimed;
        outstandingList.push({ claim_no: k.claim_no, client: k.client, insurer: k.insurer, cls: CLASS_NAME[k.cls], notified_date: k.notified_date,
          amount_claimed: k.amount_claimed, age: daysBetween(k.notified_date, period.end), remarks: k.remarks });
      }
    }
    const rows = Object.values(m).map(({ tat, ...g }) => ({ ...g, tat: tat.length ? r2(tat.reduce((a, b) => a + b, 0) / tat.length) : 0 }));

    const late = all.filter((k) => k.notified_date >= period.start && (
      (k.submitted_to_insurer_date && daysBetween(k.notified_date, k.submitted_to_insurer_date) > fwdDays) ||
      (!k.submitted_to_insurer_date && daysBetween(k.notified_date, period.end) > fwdDays)));
    if (late.length) v.warn(`${late.length} claim(s) notified in the period were not forwarded to the insurer within ${fwdDays} days.`);
    const old = outstandingList.filter((o) => o.age > 90);
    if (old.length) v.warn(`${old.length} claim(s) outstanding for more than 90 days.`);

    // By insurer
    const bi = {};
    for (const k of all.filter((k) => k.status === 'settled' && k.settled_date >= period.start && k.settled_date <= period.end)) {
      const g = bi[k.insurer] ||= { insurer: k.insurer, n: 0, claimed: 0, settled: 0, tat: [] };
      g.n++; g.claimed += k.amount_claimed; g.settled += k.amount_settled; g.tat.push(daysBetween(k.notified_date, k.settled_date));
    }
    const byIns = Object.values(bi).map(({ tat, ...g }) => ({ ...g, tat: r2(tat.reduce((a, b) => a + b, 0) / tat.length) })).sort((a, b) => b.settled - a.settled);

    return {
      sections: [
        table('movement', `Claims movement by class - ${period.label}`, [
          C.text('cls', 'Class'), C.num('bf_n', 'O/S b/f (no.)'), C.money('bf_amt', 'O/S b/f (₦)'), C.num('new_n', 'Notified (no.)'),
          C.money('new_amt', 'Notified (₦)'), C.num('set_n', 'Settled (no.)'), C.money('set_amt', 'Settled (₦)'), C.num('rep_n', 'Repudiated (no.)'),
          C.money('rep_amt', 'Repudiated (₦)'), C.num('wd_n', 'Withdrawn (no.)'), C.num('cf_n', 'O/S c/f (no.)'), C.money('cf_amt', 'O/S c/f (₦)'),
          C.num('tat', 'Avg settlement days', { total: false }),
        ], rows),
        table('by_insurer', 'Claims settled by insurer', [C.text('insurer', 'Insurer'), C.num('n', 'No. settled'), C.money('claimed', 'Amount claimed (₦)'),
          C.money('settled', 'Amount settled (₦)'), C.num('tat', 'Avg days to settle', { total: false })], byIns),
        table('outstanding', `Outstanding claims register as at ${period.end}`, [C.text('claim_no', 'Claim no.'), C.text('client', 'Client'),
          C.text('insurer', 'Insurer'), C.text('cls', 'Class'), C.date('notified_date', 'Notified'), C.money('amount_claimed', 'Amount (₦)'),
          C.num('age', 'Age (days)', { total: false }), C.text('remarks', 'Remarks')], outstandingList.sort((a, b) => b.age - a.age)),
      ],
      validations: v.items,
    };
  },
};

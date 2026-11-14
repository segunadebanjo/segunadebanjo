const { query, table, C, Validator, r2 } = require('../helpers');
const { daysBetween } = require('../../lib/periods');

module.exports = {
  code: 'QR-05',
  name: 'Premium Remittance Compliance ("No Premium, No Cover")',
  category: 'Business',
  frequencies: ['quarterly', 'monthly', 'half-yearly', 'annual'],
  description: 'Premiums received from clients in the period, amounts remitted to insurers and days taken, flagging remittances outside the statutory window and unremitted balances.',
  async run({ period, settings }) {
    const v = new Validator();
    const limit = Number(settings.compliance.remittanceDays) || 30;
    const recs = await query(
      `SELECT p.id, p.debit_note_no, p.policy_no, cl.name AS client, i.name AS insurer,
              MIN(r.receipt_date) AS first_receipt, MAX(r.receipt_date) AS last_receipt, SUM(r.amount) AS received
         FROM stg_premium_receipts r JOIN stg_placements p ON p.id=r.placement_id
         LEFT JOIN stg_clients cl ON cl.id=p.client_id LEFT JOIN stg_insurers i ON i.id=p.insurer_id
        WHERE r.receipt_date BETWEEN ? AND ?
        GROUP BY p.id, p.debit_note_no, p.policy_no, cl.name, i.name`, [period.start, period.end]);
    const ids = recs.map((r) => r.id);
    const rem = {};
    const priorRec = {};
    if (ids.length) {
      for (const m of await query(
        `SELECT placement_id, SUM(gross_amount) gross, SUM(net_amount) net, MAX(remittance_date) last_date
           FROM stg_premium_remittances WHERE placement_id IN (?) AND remittance_date <= ? GROUP BY placement_id`, [ids, period.end])) rem[m.placement_id] = m;
      for (const m of await query(
        `SELECT placement_id, SUM(amount) amt FROM stg_premium_receipts WHERE placement_id IN (?) AND receipt_date < ? GROUP BY placement_id`,
        [ids, period.start])) priorRec[m.placement_id] = m.amt;
    }
    const detail = recs.map((r) => {
      const m = rem[r.id] || { gross: 0, net: 0, last_date: null };
      // Remittances are first applied to receipts from earlier periods.
      const remittedForPeriod = Math.max(0, Math.min(r.received, m.gross - (priorRec[r.id] || 0)));
      const outstanding = r2(r.received - remittedForPeriod);
      let status, days;
      if (outstanding <= 0.01) {
        days = m.last_date ? daysBetween(r.last_receipt, m.last_date) : 0;
        status = days > limit ? 'Remitted late' : 'Remitted on time';
      } else {
        days = daysBetween(r.first_receipt, period.end);
        status = days > limit ? 'Unremitted - overdue' : 'Unremitted - within window';
      }
      return { ...r, remitted: r2(remittedForPeriod), outstanding: Math.max(0, outstanding), last_remit: m.last_date, days: Math.max(0, days), status };
    });
    const byIns = {};
    for (const d of detail) {
      const b = byIns[d.insurer] ||= { insurer: d.insurer, received: 0, remitted: 0, outstanding: 0, n: 0, n_late: 0, late_value: 0, n_overdue: 0, overdue_value: 0 };
      b.n++; b.received += d.received; b.remitted += d.remitted; b.outstanding += d.outstanding;
      if (d.status === 'Remitted late') { b.n_late++; b.late_value += d.received; }
      if (d.status === 'Unremitted - overdue') { b.n_overdue++; b.overdue_value += d.outstanding; }
    }
    const summary = Object.values(byIns).sort((a, b) => b.received - a.received);
    const tot = summary.reduce((s, b) => ({ received: s.received + b.received, remitted: s.remitted + b.remitted, late: s.late + b.n_late, overdue: s.overdue + b.n_overdue, ov: s.ov + b.overdue_value }), { received: 0, remitted: 0, late: 0, overdue: 0, ov: 0 });
    if (tot.overdue) v.error(`${tot.overdue} placement(s) with ₦${r2(tot.ov).toLocaleString()} premium received but not remitted within ${limit} days.`);
    if (tot.late) v.warn(`${tot.late} placement(s) were remitted after the ${limit}-day window.`);
    const compliance = detail.length ? r2((detail.filter((d) => d.status === 'Remitted on time' || d.status === 'Unremitted - within window').length / detail.length) * 100) : 100;
    v.info(`Remittance compliance rate: ${compliance}% of placements with receipts in the period.`);
    const exceptions = detail.filter((d) => d.status === 'Remitted late' || d.status === 'Unremitted - overdue').sort((a, b) => b.days - a.days);
    return {
      sections: [
        table('summary', `Remittance summary by insurer - ${period.label} (statutory window: ${limit} days)`, [
          C.text('insurer', 'Insurer'), C.num('n', 'Placements'), C.money('received', 'Premium received (₦)'), C.money('remitted', 'Remitted (₦)'),
          C.money('outstanding', 'Unremitted (₦)'), C.num('n_late', 'No. remitted late'), C.money('late_value', 'Value remitted late (₦)'),
          C.num('n_overdue', 'No. overdue'), C.money('overdue_value', 'Overdue unremitted (₦)'),
        ], summary),
        table('exceptions', 'Exceptions - late or overdue remittances', [
          C.text('debit_note_no', 'Debit note'), C.text('policy_no', 'Policy no.'), C.text('client', 'Client'), C.text('insurer', 'Insurer'),
          C.date('first_receipt', 'First receipt'), C.money('received', 'Received (₦)'), C.money('remitted', 'Remitted (₦)'),
          C.money('outstanding', 'Unremitted (₦)'), C.date('last_remit', 'Last remittance'), C.num('days', 'Days', { total: false }), C.text('status', 'Status'),
        ], exceptions),
      ],
      validations: v.items,
    };
  },
};

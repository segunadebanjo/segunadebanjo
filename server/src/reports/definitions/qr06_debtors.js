const { query, table, C, Validator, r2 } = require('../helpers');
const { daysBetween } = require('../../lib/periods');
const { CLASS_NAME } = require('../classes');

const BUCKETS = [[0, 30, 'b0_30'], [31, 60, 'b31_60'], [61, 90, 'b61_90'], [91, 180, 'b91_180'], [181, 1e9, 'b180p']];

module.exports = {
  code: 'QR-06',
  name: 'Outstanding Premium (Premium Debtors) Age Analysis',
  category: 'Business',
  frequencies: ['quarterly', 'monthly', 'half-yearly', 'annual'],
  description: 'Premium placed but not yet collected from clients at period end, aged from policy inception, by class and by insurer.',
  async run({ period }) {
    const v = new Validator();
    const rows = await query(
      `SELECT p.id, p.debit_note_no, p.policy_no, cl.name AS client, i.name AS insurer, c.naicom_class AS cls,
              COALESCE(p.inception_date, p.placement_date) AS from_date, p.gross_premium,
              COALESCE((SELECT SUM(r.amount) FROM stg_premium_receipts r WHERE r.placement_id=p.id AND r.receipt_date <= :end),0) AS paid
         FROM stg_placements p JOIN stg_classes c ON c.id=p.class_id
         LEFT JOIN stg_clients cl ON cl.id=p.client_id LEFT JOIN stg_insurers i ON i.id=p.insurer_id
        WHERE p.placement_date <= :end AND p.gross_premium > 0`, { end: period.end });
    const out = rows.map((r) => ({ ...r, outstanding: r2(r.gross_premium - r.paid), age: Math.max(0, daysBetween(r.from_date, period.end)) }))
      .filter((r) => r.outstanding > 0.01);
    const bucketOf = (age) => BUCKETS.find(([a, b]) => age >= a && age <= b)[2];
    const group = (keyFn) => {
      const m = {};
      for (const r of out) {
        const k = keyFn(r);
        const g = m[k] ||= { name: k, n: 0, total: 0, b0_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, b180p: 0 };
        g.n++; g.total += r.outstanding; g[bucketOf(r.age)] += r.outstanding;
      }
      return Object.values(m).sort((a, b) => b.total - a.total);
    };
    const cols = (first) => [C.text('name', first), C.num('n', 'No.'), C.money('b0_30', '0-30 days'), C.money('b31_60', '31-60 days'),
      C.money('b61_90', '61-90 days'), C.money('b91_180', '91-180 days'), C.money('b180p', 'Over 180 days'), C.money('total', 'Total outstanding (₦)')];
    const over90 = out.filter((r) => r.age > 90);
    if (over90.length) v.warn(`${over90.length} debit note(s) totalling ₦${r2(over90.reduce((s, r) => s + r.outstanding, 0)).toLocaleString()} are over 90 days outstanding - confirm cover status under "No Premium, No Cover".`);
    return {
      sections: [
        table('by_class', `Premium debtors by class as at ${period.end}`, cols('Class of business'), group((r) => CLASS_NAME[r.cls] || r.cls)),
        table('by_insurer', 'Premium debtors by insurer', cols('Insurer'), group((r) => r.insurer || '(unknown)')),
        table('detail', 'Debit notes outstanding over 90 days', [C.text('debit_note_no', 'Debit note'), C.text('policy_no', 'Policy no.'),
          C.text('client', 'Client'), C.text('insurer', 'Insurer'), C.date('from_date', 'Inception'), C.money('gross_premium', 'Premium (₦)'),
          C.money('paid', 'Paid (₦)'), C.money('outstanding', 'Outstanding (₦)'), C.num('age', 'Age (days)', { total: false })],
          over90.sort((a, b) => b.age - a.age)),
      ],
      validations: v.items,
    };
  },
};

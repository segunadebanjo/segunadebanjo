const { query, table, C, Validator, pct } = require('../helpers');

module.exports = {
  code: 'QR-04',
  name: 'Premium Placement by Insurer',
  category: 'Business',
  frequencies: ['quarterly', 'monthly', 'half-yearly', 'annual'],
  description: 'Business placed with each underwriter: placements, premium, commission, premium collected and remitted, and concentration.',
  async run({ period }) {
    const v = new Validator();
    const rows = await query(
      `SELECT i.name AS insurer, i.naicom_reg_no AS reg, i.insurer_type AS type,
              COALESCE(p.n,0) AS n, COALESCE(p.gp,0) AS gp, COALESCE(p.comm,0) AS comm,
              COALESCE(rc.amt,0) AS received, COALESCE(rm.gross,0) AS remitted_gross, COALESCE(rm.net,0) AS remitted_net
         FROM stg_insurers i
         LEFT JOIN (SELECT insurer_id, COUNT(*) n, SUM(gross_premium) gp, SUM(commission_amount) comm FROM stg_placements
                     WHERE placement_date BETWEEN :start AND :end GROUP BY insurer_id) p ON p.insurer_id=i.id
         LEFT JOIN (SELECT pl.insurer_id, SUM(r.amount) amt FROM stg_premium_receipts r JOIN stg_placements pl ON pl.id=r.placement_id
                     WHERE r.receipt_date BETWEEN :start AND :end GROUP BY pl.insurer_id) rc ON rc.insurer_id=i.id
         LEFT JOIN (SELECT pl.insurer_id, SUM(m.gross_amount) gross, SUM(m.net_amount) net FROM stg_premium_remittances m
                      JOIN stg_placements pl ON pl.id=m.placement_id
                     WHERE m.remittance_date BETWEEN :start AND :end GROUP BY pl.insurer_id) rm ON rm.insurer_id=i.id
        WHERE COALESCE(p.n,0) > 0 OR COALESCE(rc.amt,0) <> 0 OR COALESCE(rm.gross,0) <> 0
        ORDER BY gp DESC`, { start: period.start, end: period.end });
    const tot = rows.reduce((s, r) => s + r.gp, 0);
    rows.forEach((r) => { r.share = pct(r.gp, tot); });
    const top = rows[0];
    if (top && top.share > 50) v.warn(`High concentration: ${top.insurer} accounts for ${top.share}% of premium placed.`);
    const noReg = rows.filter((r) => !r.reg);
    if (noReg.length) v.warn(`${noReg.length} insurer(s) have no NAICOM registration number recorded: ${noReg.map((r) => r.insurer).join(', ')}`);
    return {
      sections: [table('by_insurer', `Premium placed by insurer - ${period.label}`, [
        C.text('insurer', 'Insurer'), C.text('reg', 'NAICOM reg. no.'), C.text('type', 'Type'), C.num('n', 'No. of placements'),
        C.money('gp', 'Gross premium placed (₦)'), C.pct('share', '% share'), C.money('comm', 'Commission (₦)'),
        C.money('received', 'Premium received from clients (₦)'), C.money('remitted_gross', 'Premium settled to insurer (₦)'),
        C.money('remitted_net', 'Net cash remitted (₦)'),
      ], rows)],
      validations: v.items,
    };
  },
};

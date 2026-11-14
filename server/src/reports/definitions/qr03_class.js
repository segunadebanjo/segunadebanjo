const { query, table, C, Validator, r2, pct } = require('../helpers');
const { NAICOM_CLASSES } = require('../classes');
const { startOfYear } = require('../../lib/periods');

module.exports = {
  code: 'QR-03',
  name: 'Premium Generated & Commission Earned by Class of Business',
  category: 'Business',
  frequencies: ['quarterly', 'monthly', 'half-yearly', 'annual'],
  description: 'Number of placements, sum insured, gross premium and brokerage commission per NAICOM class, split new vs renewal, with year-to-date figures and commission-rate checks against NAICOM caps.',
  async run({ period, settings }) {
    const v = new Validator();
    const agg = async (start, end) => query(
      `SELECT c.naicom_class AS cls,
              SUM(p.business_type='new') AS n_new, SUM(p.business_type='renewal') AS n_ren, COUNT(*) AS n_all,
              SUM(CASE WHEN p.business_type='new' THEN p.gross_premium ELSE 0 END) AS gp_new,
              SUM(CASE WHEN p.business_type='renewal' THEN p.gross_premium ELSE 0 END) AS gp_ren,
              SUM(p.gross_premium) AS gp, SUM(p.commission_amount) AS comm, SUM(p.sum_insured) AS si
         FROM stg_placements p JOIN stg_classes c ON c.id=p.class_id
        WHERE p.placement_date BETWEEN ? AND ? GROUP BY c.naicom_class`, [start, end]);
    const cur = Object.fromEntries((await agg(period.start, period.end)).map((r) => [r.cls, r]));
    const ytd = Object.fromEntries((await agg(startOfYear(period.end), period.end)).map((r) => [r.cls, r]));

    const unknown = Object.keys(cur).filter((k) => !NAICOM_CLASSES.find((c) => c.code === k));
    if (unknown.length) v.error(`ERP classes mapped to unknown NAICOM class codes: ${unknown.join(', ')}`);

    const rows = NAICOM_CLASSES.map((c) => {
      const r = cur[c.code] || {}, y = ytd[c.code] || {};
      return {
        cls: c.name, category: c.category,
        n_new: Number(r.n_new || 0), n_ren: Number(r.n_ren || 0), n_all: Number(r.n_all || 0),
        si: r.si || 0, gp_new: r.gp_new || 0, gp_ren: r.gp_ren || 0, gp: r.gp || 0, comm: r.comm || 0,
        rate: pct(r.comm || 0, r.gp || 0), ytd_gp: y.gp || 0, ytd_comm: y.comm || 0,
      };
    });
    const totGp = rows.reduce((s, r) => s + r.gp, 0);
    rows.forEach((r) => { r.share = pct(r.gp, totGp); });

    // Commission rate exceptions vs NAICOM caps
    const caps = settings.commissionCaps || {};
    const exc = await query(
      `SELECT p.debit_note_no, p.policy_no, cl.name AS client, i.name AS insurer, c.naicom_class AS cls,
              p.gross_premium, p.commission_rate, p.commission_amount
         FROM stg_placements p JOIN stg_classes c ON c.id=p.class_id
         LEFT JOIN stg_clients cl ON cl.id=p.client_id LEFT JOIN stg_insurers i ON i.id=p.insurer_id
        WHERE p.placement_date BETWEEN ? AND ? AND p.gross_premium > 0`, [period.start, period.end]);
    const exceptions = exc.filter((e) => {
      const cap = caps[e.cls];
      const rate = e.commission_rate || (e.gross_premium ? (e.commission_amount / e.gross_premium) * 100 : 0);
      e.rate = r2(rate); e.cap = cap;
      return cap !== undefined && rate > cap + 0.0001;
    });
    if (exceptions.length) v.warn(`${exceptions.length} placement(s) carry commission above the NAICOM cap for their class.`);
    const neg = await query(`SELECT COUNT(*) AS n FROM stg_placements WHERE placement_date BETWEEN ? AND ? AND commission_amount > ABS(gross_premium)`, [period.start, period.end]);
    if (neg[0].n) v.error(`${neg[0].n} placement(s) have commission greater than premium - check ERP data.`);
    if (!totGp) v.warn('No placements found for this period.');

    return {
      sections: [
        table('by_class', `Premium & Commission by Class of Business - ${period.label}`, [
          C.text('cls', 'Class of business'), C.num('n_new', 'No. new'), C.num('n_ren', 'No. renewal'), C.num('n_all', 'Total no.'),
          C.money('si', 'Sum insured (₦)'), C.money('gp_new', 'Premium - new (₦)'), C.money('gp_ren', 'Premium - renewal (₦)'),
          C.money('gp', 'Gross premium (₦)'), C.pct('share', '% of total'), C.money('comm', 'Commission (₦)'), C.pct('rate', 'Avg comm. rate %'),
          C.money('ytd_gp', 'YTD premium (₦)'), C.money('ytd_comm', 'YTD commission (₦)'),
        ], rows),
        table('rate_exceptions', 'Commission rate exceptions (above NAICOM cap)', [
          C.text('debit_note_no', 'Debit note'), C.text('policy_no', 'Policy no.'), C.text('client', 'Client'), C.text('insurer', 'Insurer'),
          C.text('cls', 'Class'), C.money('gross_premium', 'Premium (₦)'), C.pct('rate', 'Rate %'), C.pct('cap', 'Cap %'), C.money('commission_amount', 'Commission (₦)'),
        ], exceptions),
      ],
      validations: v.items,
    };
  },
};

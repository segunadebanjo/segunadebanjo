const { query, table, C, Validator, pct } = require('../helpers');
const { NAICOM_CLASSES } = require('../classes');

module.exports = {
  code: 'AR-02',
  name: 'Annual Business Review (Premium & Commission by Quarter, Top Insurers & Clients)',
  category: 'Business',
  frequencies: ['annual', 'half-yearly'],
  description: 'Year view of premium and commission by class split by quarter, top 10 insurers and top 10 clients, and branch performance.',
  async run({ period }) {
    const v = new Validator();
    const rows = await query(
      `SELECT c.naicom_class cls, QUARTER(p.placement_date) q, SUM(p.gross_premium) gp, SUM(p.commission_amount) comm
         FROM stg_placements p JOIN stg_classes c ON c.id=p.class_id
        WHERE p.placement_date BETWEEN ? AND ? GROUP BY c.naicom_class, QUARTER(p.placement_date)`, [period.start, period.end]);
    const byClass = NAICOM_CLASSES.map((c) => {
      const r = { cls: c.name, q1: 0, q2: 0, q3: 0, q4: 0, gp: 0, comm: 0 };
      rows.filter((x) => x.cls === c.code).forEach((x) => { r['q' + x.q] += x.gp; r.gp += x.gp; r.comm += x.comm; });
      r.rate = pct(r.comm, r.gp);
      return r;
    });
    const total = byClass.reduce((s, r) => s + r.gp, 0);
    if (!total) v.warn('No placements in the period.');
    const topIns = await query(
      `SELECT i.name insurer, COUNT(*) n, SUM(p.gross_premium) gp, SUM(p.commission_amount) comm FROM stg_placements p JOIN stg_insurers i ON i.id=p.insurer_id
        WHERE p.placement_date BETWEEN ? AND ? GROUP BY i.name ORDER BY gp DESC LIMIT 10`, [period.start, period.end]);
    topIns.forEach((r) => { r.share = pct(r.gp, total); });
    const topCl = await query(
      `SELECT cl.name client, cl.sector, COUNT(*) n, SUM(p.gross_premium) gp, SUM(p.commission_amount) comm FROM stg_placements p JOIN stg_clients cl ON cl.id=p.client_id
        WHERE p.placement_date BETWEEN ? AND ? GROUP BY cl.name, cl.sector ORDER BY gp DESC LIMIT 10`, [period.start, period.end]);
    topCl.forEach((r) => { r.share = pct(r.gp, total); });
    const br = await query(
      `SELECT COALESCE(b.name,'(Head office / unassigned)') branch, COUNT(*) n, SUM(p.gross_premium) gp, SUM(p.commission_amount) comm
         FROM stg_placements p LEFT JOIN stg_branches b ON b.id=p.branch_id
        WHERE p.placement_date BETWEEN ? AND ? GROUP BY b.name ORDER BY gp DESC`, [period.start, period.end]);
    br.forEach((r) => { r.share = pct(r.gp, total); });
    return {
      sections: [
        table('by_class', `Gross premium by class and quarter - ${period.label}`, [C.text('cls', 'Class'), C.money('q1', 'Q1 (₦)'), C.money('q2', 'Q2 (₦)'),
          C.money('q3', 'Q3 (₦)'), C.money('q4', 'Q4 (₦)'), C.money('gp', 'Total premium (₦)'), C.money('comm', 'Commission (₦)'), C.pct('rate', 'Avg rate %')], byClass),
        table('top_insurers', 'Top 10 insurers by premium placed', [C.text('insurer', 'Insurer'), C.num('n', 'Placements'), C.money('gp', 'Premium (₦)'), C.pct('share', '% of total'), C.money('comm', 'Commission (₦)')], topIns),
        table('top_clients', 'Top 10 clients by premium', [C.text('client', 'Client'), C.text('sector', 'Sector'), C.num('n', 'Placements'), C.money('gp', 'Premium (₦)'), C.pct('share', '% of total'), C.money('comm', 'Commission (₦)')], topCl),
        table('branches', 'Performance by branch', [C.text('branch', 'Branch'), C.num('n', 'Placements'), C.money('gp', 'Premium (₦)'), C.pct('share', '% of total'), C.money('comm', 'Commission (₦)')], br),
      ],
      validations: v.items,
    };
  },
};

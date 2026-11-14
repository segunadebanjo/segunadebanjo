const { query, table, C, Validator } = require('../helpers');
const { daysBetween, addDays } = require('../../lib/periods');

module.exports = {
  code: 'QR-08',
  name: 'Complaints Management Returns',
  category: 'Claims & Conduct',
  frequencies: ['quarterly', 'monthly', 'half-yearly', 'annual'],
  description: 'Consumer complaints received, resolved and outstanding by category, resolution within target time, and the complaints register.',
  async run({ period, settings }) {
    const v = new Validator();
    const target = Number(settings.compliance.complaintResolutionDays) || 14;
    const all = await query(
      `SELECT k.*, cl.name AS client, i.name AS insurer FROM stg_complaints k
         LEFT JOIN stg_clients cl ON cl.id=k.client_id LEFT JOIN stg_insurers i ON i.id=k.insurer_id
        WHERE k.received_date <= ?`, [period.end]);
    const dayBefore = addDays(period.start, -1);
    const closedBy = (k, d) => k.status === 'resolved' && k.resolved_date && k.resolved_date <= d;
    const cats = {};
    const register = [];
    for (const k of all) {
      const g = cats[k.category || 'other'] ||= { category: k.category || 'other', bf: 0, received: 0, resolved: 0, in_target: 0, escalated: 0, cf: 0 };
      if (k.received_date < period.start && !closedBy(k, dayBefore)) g.bf++;
      const inPeriod = k.received_date >= period.start;
      if (inPeriod) g.received++;
      if (k.status === 'resolved' && k.resolved_date >= period.start && k.resolved_date <= period.end) {
        g.resolved++;
        if (daysBetween(k.received_date, k.resolved_date) <= target) g.in_target++;
      }
      if (k.status === 'escalated' && inPeriod) g.escalated++;
      const open = !closedBy(k, period.end);
      if (open) g.cf++;
      if (inPeriod || open) register.push({ ref_no: k.ref_no, received_date: k.received_date, complainant: k.complainant, insurer: k.insurer,
        category: k.category, channel: k.channel, description: k.description, status: open ? (k.status === 'escalated' ? 'escalated' : 'open') : 'resolved',
        resolved_date: open ? null : k.resolved_date, days: daysBetween(k.received_date, open ? period.end : k.resolved_date) });
    }
    const rows = Object.values(cats).sort((a, b) => b.received - a.received);
    const overdue = register.filter((r) => r.status !== 'resolved' && r.days > target);
    if (overdue.length) v.warn(`${overdue.length} complaint(s) unresolved beyond the ${target}-day target.`);
    const res = rows.reduce((s, r) => s + r.resolved, 0), inT = rows.reduce((s, r) => s + r.in_target, 0);
    if (res) v.info(`${Math.round((inT / res) * 100)}% of complaints resolved in the period were resolved within ${target} days.`);
    return {
      sections: [
        table('summary', `Complaints summary - ${period.label}`, [C.text('category', 'Category'), C.num('bf', 'Outstanding b/f'), C.num('received', 'Received'),
          C.num('resolved', 'Resolved'), C.num('in_target', `Resolved ≤ ${target} days`), C.num('escalated', 'Escalated'), C.num('cf', 'Outstanding c/f')], rows),
        table('register', 'Complaints register', [C.text('ref_no', 'Ref.'), C.date('received_date', 'Received'), C.text('complainant', 'Complainant'),
          C.text('insurer', 'Insurer involved'), C.text('category', 'Category'), C.text('channel', 'Channel'), C.text('description', 'Nature of complaint'),
          C.text('status', 'Status'), C.date('resolved_date', 'Resolved'), C.num('days', 'Days', { total: false })], register, { totals: false }),
      ],
      validations: v.items,
    };
  },
};

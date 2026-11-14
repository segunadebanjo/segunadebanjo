const { query, table, kv, C, Validator, pct } = require('../helpers');

module.exports = {
  code: 'AR-04',
  name: 'Staff Strength, Movement & Professional Qualification Returns',
  category: 'Corporate',
  frequencies: ['annual', 'half-yearly', 'quarterly'],
  description: 'Headcount by branch and department, gender mix, joiners and leavers, and staff holding professional insurance qualifications (CIIN etc.).',
  async run({ period }) {
    const v = new Validator();
    const p = { start: period.start, end: period.end };
    const activeAt = '(s.date_joined IS NULL OR s.date_joined <= :end) AND (s.date_exited IS NULL OR s.date_exited > :end)';
    const staff = await query(`SELECT s.*, b.name AS branch FROM stg_staff s LEFT JOIN stg_branches b ON b.id=s.branch_id WHERE ${activeAt}`, p);
    const [mv] = await query(`SELECT SUM(date_joined BETWEEN :start AND :end) joiners, SUM(date_exited BETWEEN :start AND :end) leavers,
      SUM((date_joined IS NULL OR date_joined < :start) AND (date_exited IS NULL OR date_exited >= :start)) opening FROM stg_staff`, p);
    const cnt = (f) => staff.filter(f).length;
    const qualified = cnt((s) => s.professional_cert);
    const group = (key) => {
      const m = {};
      for (const s of staff) {
        const k = s[key] || '(unspecified)';
        const g = m[k] ||= { name: k, total: 0, male: 0, female: 0, qualified: 0 };
        g.total++; if ((s.gender || '').toLowerCase().startsWith('m')) g.male++; else if ((s.gender || '').toLowerCase().startsWith('f')) g.female++;
        if (s.professional_cert) g.qualified++;
      }
      return Object.values(m).sort((a, b) => b.total - a.total);
    };
    const certs = {};
    staff.filter((s) => s.professional_cert).forEach((s) => { certs[s.professional_cert] = (certs[s.professional_cert] || 0) + 1; });
    if (!staff.length) v.warn('No staff records for this period.');
    const cols = (first) => [C.text('name', first), C.num('total', 'Total'), C.num('male', 'Male'), C.num('female', 'Female'), C.num('qualified', 'Professionally qualified')];
    return {
      sections: [
        kv('summary', `Staff summary - ${period.label}`, [
          { label: 'Staff at beginning of period', value: Number(mv.opening || 0), type: 'number' },
          { label: 'Joiners', value: Number(mv.joiners || 0), type: 'number' },
          { label: 'Leavers', value: Number(mv.leavers || 0), type: 'number' },
          { label: 'Staff at end of period', value: staff.length, type: 'number' },
          { label: 'Professionally qualified staff', value: qualified, type: 'number' },
          { label: '% professionally qualified', value: pct(qualified, staff.length), type: 'pct' },
        ]),
        table('by_branch', 'Staff by branch', cols('Branch'), group('branch')),
        table('by_dept', 'Staff by department', cols('Department'), group('department')),
        table('certs', 'Professional qualifications held', [C.text('cert', 'Qualification'), C.num('n', 'No. of staff')],
          Object.entries(certs).map(([cert, n]) => ({ cert, n })).sort((a, b) => b.n - a.n)),
        table('register', 'Staff register', [C.text('staff_no', 'Staff no.'), C.text('name', 'Name'), C.text('gender', 'Gender'), C.text('designation', 'Designation'),
          C.text('department', 'Department'), C.text('branch', 'Branch'), C.text('professional_cert', 'Prof. qualification'), C.date('date_joined', 'Joined')],
          staff.sort((a, b) => String(a.name).localeCompare(b.name)), { totals: false }),
      ],
      validations: v.items,
    };
  },
};

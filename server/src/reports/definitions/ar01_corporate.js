const { query, table, kv, C, Validator } = require('../helpers');

module.exports = {
  code: 'AR-01',
  name: 'Annual Returns - Corporate Information, Board & Shareholding',
  category: 'Corporate',
  frequencies: ['annual', 'half-yearly', 'quarterly'],
  description: 'Licence details, professional indemnity and fidelity guarantee cover, directors, shareholders, key officers and branch network.',
  async run({ period, settings }) {
    const v = new Validator();
    const co = settings.company, ins = settings.insurance, comp = settings.compliance;
    for (const [k, label] of [['naicomLicenseNo', 'NAICOM licence number'], ['rcNumber', 'CAC RC number'], ['address', 'registered address'], ['complianceOfficer', 'compliance officer'], ['mdCeo', 'MD/CEO']])
      if (!co[k]) v.error(`Company ${label} is not set (Settings > Company).`);
    if (co.licenseExpiry && co.licenseExpiry < period.end) v.error(`NAICOM licence expired on ${co.licenseExpiry}.`);
    if (!ins.piiPolicyNo) v.error('Professional indemnity insurance details are not recorded.');
    else if (ins.piiExpiry && ins.piiExpiry < period.end) v.error(`Professional indemnity cover expired on ${ins.piiExpiry}.`);
    if (comp.piiMinimumCover && Number(ins.piiLimit) < Number(comp.piiMinimumCover)) v.error(`PII limit ₦${Number(ins.piiLimit).toLocaleString()} is below the minimum ₦${Number(comp.piiMinimumCover).toLocaleString()}.`);
    if (!ins.fidelityPolicyNo) v.warn('Fidelity guarantee insurance details are not recorded.');
    else if (ins.fidelityExpiry && ins.fidelityExpiry < period.end) v.warn(`Fidelity guarantee cover expired on ${ins.fidelityExpiry}.`);

    const active = 'appointed_on IS NULL OR appointed_on <= :end) AND (ceased_on IS NULL OR ceased_on > :end';
    const directors = await query(`SELECT name, designation, nationality, appointed_on FROM stg_directors WHERE role IN ('director','both') AND (${active}) ORDER BY designation, name`, { end: period.end });
    const changes = await query(`SELECT name, role, designation, appointed_on, ceased_on FROM stg_directors
      WHERE appointed_on BETWEEN :start AND :end OR ceased_on BETWEEN :start AND :end`, { start: period.start, end: period.end });
    const holders = await query(`SELECT name, nationality, shares_held, pct_holding FROM stg_directors WHERE role IN ('shareholder','both') AND (${active}) ORDER BY pct_holding DESC`, { end: period.end });
    const totalPct = holders.reduce((s, h) => s + Number(h.pct_holding), 0);
    if (holders.length && Math.abs(totalPct - 100) > 0.01) v.warn(`Shareholding percentages total ${totalPct.toFixed(2)}%, not 100%.`);
    if (!directors.length) v.error('No directors recorded.');
    const officers = await query(`SELECT s.name, s.designation, s.professional_cert, s.qualification, s.date_joined, b.name AS branch
      FROM stg_staff s LEFT JOIN stg_branches b ON b.id=s.branch_id WHERE s.is_key_officer=1 AND (s.date_joined IS NULL OR s.date_joined <= :end) AND (s.date_exited IS NULL OR s.date_exited > :end)`, { end: period.end });
    officers.filter((o) => !o.professional_cert).forEach((o) => v.warn(`Key officer ${o.name} (${o.designation}) has no professional insurance qualification recorded.`));
    const branches = await query(`SELECT code, name, state, address, opened_on FROM stg_branches WHERE (opened_on IS NULL OR opened_on <= :end) AND (closed_on IS NULL OR closed_on > :end) ORDER BY state, name`, { end: period.end });
    const money = (n) => Number(n || 0);
    return {
      sections: [
        kv('company', 'Corporate information', [
          { label: 'Name of broker', value: co.name }, { label: 'NAICOM licence number', value: co.naicomLicenseNo },
          { label: 'Licence expiry date', value: co.licenseExpiry, type: 'date' }, { label: 'CAC RC number', value: co.rcNumber },
          { label: 'Tax identification number', value: co.tin }, { label: 'Registered address', value: co.address },
          { label: 'Email', value: co.email }, { label: 'Telephone', value: co.phone },
          { label: 'Managing Director / CEO', value: co.mdCeo }, { label: 'Compliance officer', value: co.complianceOfficer },
        ]),
        kv('cover', 'Professional indemnity & fidelity guarantee insurance', [
          { label: 'PII insurer', value: ins.piiInsurer }, { label: 'PII policy number', value: ins.piiPolicyNo },
          { label: 'PII limit of indemnity (₦)', value: money(ins.piiLimit), type: 'money' }, { label: 'PII expiry', value: ins.piiExpiry, type: 'date' },
          { label: 'Fidelity guarantee insurer', value: ins.fidelityInsurer }, { label: 'Fidelity policy number', value: ins.fidelityPolicyNo },
          { label: 'Fidelity limit (₦)', value: money(ins.fidelityLimit), type: 'money' }, { label: 'Fidelity expiry', value: ins.fidelityExpiry, type: 'date' },
        ]),
        table('directors', `Board of directors as at ${period.end}`, [C.text('name', 'Name'), C.text('designation', 'Designation'), C.text('nationality', 'Nationality'), C.date('appointed_on', 'Date appointed')], directors, { totals: false }),
        table('board_changes', 'Changes in directors/shareholders during the period', [C.text('name', 'Name'), C.text('role', 'Role'), C.text('designation', 'Designation'), C.date('appointed_on', 'Appointed'), C.date('ceased_on', 'Ceased')], changes, { totals: false }),
        table('shareholders', 'Shareholding structure', [C.text('name', 'Shareholder'), C.text('nationality', 'Nationality'), C.num('shares_held', 'No. of shares'), C.pct('pct_holding', '% holding')], holders),
        table('officers', 'Key management / principal officers', [C.text('name', 'Name'), C.text('designation', 'Designation'), C.text('professional_cert', 'Professional qualification'), C.text('qualification', 'Academic qualification'), C.text('branch', 'Location'), C.date('date_joined', 'Date joined')], officers, { totals: false }),
        table('branches', 'Branch network', [C.text('code', 'Code'), C.text('name', 'Branch'), C.text('state', 'State'), C.text('address', 'Address'), C.date('opened_on', 'Opened')], branches, { totals: false }),
      ],
      validations: v.items,
    };
  },
};

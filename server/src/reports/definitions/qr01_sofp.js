const { table, C, Validator } = require('../helpers');
const { computeFinancials, financialValidations } = require('../financials');

module.exports = {
  code: 'QR-01',
  name: 'Statement of Financial Position',
  category: 'Financial',
  frequencies: ['quarterly', 'half-yearly', 'annual', 'monthly'],
  description: 'Assets, liabilities and shareholders\' funds at period end, built from the ERP trial balance via the GL-to-NAICOM line mapping.',
  async run({ period }) {
    const v = new Validator();
    const fin = await computeFinancials(period);
    financialValidations(v, fin, period);
    const rows = [];
    for (const grp of ['Assets', 'Liabilities', 'Equity']) {
      fin.sofp.filter((l) => l.group === grp).forEach((l) => rows.push({ group: grp, line: l.name, amount: l.amount }));
      if (grp === 'Equity') rows.push({ group: grp, line: 'Profit/(loss) for the year to date', amount: fin.profitYtd });
    }
    const summary = [
      { line: 'Total assets', amount: fin.assets },
      { line: 'Total liabilities', amount: fin.liabilities },
      { line: "Total shareholders' funds", amount: fin.equity },
      { line: 'Total liabilities and equity', amount: fin.liabilities + fin.equity },
      { line: 'Difference (should be nil)', amount: fin.difference },
    ];
    if (fin.tbDate && Math.abs(fin.difference) > 1) v.error(`Statement does not balance: difference of ${fin.difference}.`);
    if (fin.val('PREMIUM_PAYABLE') > fin.val('CLIENT_CASH') + 0.01)
      v.warn('Premium payable to insurers exceeds cash held in premium (client) accounts - review client money position.');
    return {
      sections: [
        table('sofp', `Statement of Financial Position as at ${period.end}`, [C.text('group', 'Group'), C.text('line', 'Line item'), C.money('amount', 'Amount (₦)', { total: false })], rows, { totals: false }),
        table('summary', 'Summary', [C.text('line', 'Item'), C.money('amount', 'Amount (₦)')], summary, { totals: false }),
      ],
      validations: v.items,
    };
  },
};

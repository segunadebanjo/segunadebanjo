const { table, C, Validator } = require('../helpers');
const { computeFinancials, financialValidations } = require('../financials');

module.exports = {
  code: 'QR-02',
  name: 'Statement of Profit or Loss',
  category: 'Financial',
  frequencies: ['quarterly', 'half-yearly', 'annual', 'monthly'],
  description: 'Income and expenses for the period and year-to-date from the ERP trial balance.',
  async run({ period }) {
    const v = new Validator();
    const fin = await computeFinancials(period);
    financialValidations(v, fin, period);
    const rows = fin.pl.map((l) => ({ group: l.group, line: l.name, period: l.period, ytd: l.ytd }));
    const t = fin.plTotals;
    const summary = [
      { line: 'Total income', period: t.period.income, ytd: t.ytd.income },
      { line: 'Total expenses', period: t.period.expenses, ytd: t.ytd.expenses },
      { line: 'Profit/(loss) before tax', period: t.period.pbt, ytd: t.ytd.pbt },
      { line: 'Income tax', period: t.period.tax, ytd: t.ytd.tax },
      { line: 'Profit/(loss) after tax', period: t.period.pat, ytd: t.ytd.pat },
    ];
    if (t.ytd.pat < 0) v.warn('The company reports a loss for the year to date.');
    const cols = [C.text('group', 'Group'), C.text('line', 'Line item'), C.money('period', `${period.label} (₦)`, { total: false }), C.money('ytd', 'Year to date (₦)', { total: false })];
    return {
      sections: [
        table('pl', `Statement of Profit or Loss for ${period.label}`, cols, rows, { totals: false }),
        table('summary', 'Summary', [C.text('line', 'Item'), C.money('period', `${period.label} (₦)`), C.money('ytd', 'Year to date (₦)')], summary, { totals: false }),
      ],
      validations: v.items,
    };
  },
};

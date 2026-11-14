const { kv, table, C, Validator, r2, query } = require('../helpers');
const { computeFinancials, financialValidations } = require('../financials');

module.exports = {
  code: 'AR-03',
  name: 'Capital Adequacy, Liquidity & Solvency Compliance',
  category: 'Financial',
  frequencies: ['annual', 'half-yearly', 'quarterly'],
  description: 'Paid-up capital and shareholders\' funds against the minimum capital requirement, liquidity ratios, client money cover and PII adequacy.',
  async run({ period, settings }) {
    const v = new Validator();
    const fin = await computeFinancials(period);
    financialValidations(v, fin, period);
    const minCap = Number(settings.compliance.minimumCapital) || 0;
    const paidUp = fin.val('SHARE_CAPITAL');
    const shf = fin.equity;
    const currentAssets = ['CASH', 'CLIENT_CASH', 'PREMIUM_RECEIVABLE', 'COMMISSION_RECEIVABLE', 'OTHER_RECEIVABLES'].reduce((s, c) => s + fin.val(c), 0);
    const currentLiab = ['PREMIUM_PAYABLE', 'OTHER_PAYABLES', 'CURRENT_TAX'].reduce((s, c) => s + fin.val(c), 0);
    const ratio = currentLiab ? r2(currentAssets / currentLiab) : null;
    const cashRatio = currentLiab ? r2((fin.val('CASH') + fin.val('CLIENT_CASH')) / currentLiab) : null;
    if (paidUp < minCap) v.error(`Paid-up share capital ₦${paidUp.toLocaleString()} is below the minimum capital of ₦${minCap.toLocaleString()}.`);
    if (shf < minCap) v.error(`Shareholders' funds ₦${shf.toLocaleString()} are below the minimum capital requirement - capital impaired.`);
    if (ratio !== null && ratio < 1) v.warn(`Current ratio is ${ratio}, below 1.0.`);
    const [cm] = await query(
      `SELECT (SELECT COALESCE(SUM(amount),0) FROM stg_premium_receipts WHERE receipt_date <= :end) -
              (SELECT COALESCE(SUM(gross_amount),0) FROM stg_premium_remittances WHERE remittance_date <= :end) AS due`, { end: period.end });
    const ins = settings.insurance;
    return {
      sections: [
        kv('capital', `Capital adequacy as at ${period.end}`, [
          { label: 'Issued and paid-up share capital (₦)', value: paidUp, type: 'money' },
          { label: 'Share premium (₦)', value: fin.val('SHARE_PREMIUM'), type: 'money' },
          { label: 'Retained earnings incl. current year (₦)', value: r2(fin.val('RETAINED_EARNINGS') + fin.profitYtd), type: 'money' },
          { label: "Total shareholders' funds (₦)", value: shf, type: 'money' },
          { label: 'Minimum capital requirement (₦)', value: minCap, type: 'money' },
          { label: 'Surplus / (deficit) over minimum (₦)', value: r2(shf - minCap), type: 'money' },
          { label: 'Compliance status', value: shf >= minCap && paidUp >= minCap ? 'COMPLIANT' : 'NOT COMPLIANT' },
        ]),
        kv('liquidity', 'Liquidity', [
          { label: 'Current assets (₦)', value: r2(currentAssets), type: 'money' },
          { label: 'Current liabilities (₦)', value: r2(currentLiab), type: 'money' },
          { label: 'Current ratio (times)', value: ratio ?? 'n/a' },
          { label: 'Cash ratio (times)', value: cashRatio ?? 'n/a' },
          { label: 'Premium collected not yet remitted (₦)', value: r2(cm.due), type: 'money' },
          { label: 'Cash in premium (client) accounts per GL (₦)', value: fin.val('CLIENT_CASH'), type: 'money' },
        ]),
        kv('pii', 'Professional indemnity adequacy', [
          { label: 'PII limit of indemnity (₦)', value: Number(ins.piiLimit || 0), type: 'money' },
          { label: 'Minimum PII required (₦)', value: Number(settings.compliance.piiMinimumCover || 0), type: 'money' },
          { label: 'Commission income year to date (₦)', value: fin.plTotals.ytd.income, type: 'money' },
        ]),
        table('fs', 'Supporting balances', [C.text('name', 'Line'), C.text('group', 'Group'), C.money('amount', 'Amount (₦)', { total: false })], fin.sofp.filter((l) => l.amount), { totals: false }),
      ],
      validations: v.items,
    };
  },
};

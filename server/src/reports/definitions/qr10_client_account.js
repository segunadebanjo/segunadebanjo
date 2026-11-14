const { query, table, kv, C, Validator, r2 } = require('../helpers');

module.exports = {
  code: 'QR-10',
  name: 'Premium (Client) Account Reconciliation & Client Money Position',
  category: 'Financial',
  frequencies: ['quarterly', 'monthly', 'half-yearly', 'annual'],
  description: 'Bank reconciliation of premium collection accounts and comparison of client money held against premium due to insurers.',
  async run({ period }) {
    const v = new Validator();
    const accts = await query(
      `SELECT a.bank_name, a.account_no, a.account_name, a.account_type, b.as_at, COALESCE(b.ledger_balance,0) ledger, COALESCE(b.bank_balance,0) bank
         FROM stg_bank_accounts a
         LEFT JOIN stg_bank_balances b ON b.bank_account_id=a.id
               AND b.as_at=(SELECT MAX(as_at) FROM stg_bank_balances x WHERE x.bank_account_id=a.id AND x.as_at <= ?)
        ORDER BY a.account_type DESC, a.bank_name`, [period.end]);
    accts.forEach((a) => { a.diff = r2(a.bank - a.ledger); });
    const prem = accts.filter((a) => a.account_type === 'premium');
    if (!prem.length) v.error('No premium (client) collection bank account is defined. Mark the account(s) used for client premiums as type "premium".');
    prem.filter((a) => !a.as_at || a.as_at < period.end).forEach((a) => v.warn(`No reconciliation at ${period.end} for ${a.bank_name} ${a.account_no}.`));
    accts.filter((a) => Math.abs(a.diff) > 1).forEach((a) => v.warn(`Unreconciled difference of ₦${a.diff.toLocaleString()} on ${a.bank_name} ${a.account_no}.`));

    const [x] = await query(
      `SELECT
        (SELECT COALESCE(SUM(amount),0) FROM stg_premium_receipts WHERE receipt_date <= :end) AS rec_all,
        (SELECT COALESCE(SUM(gross_amount),0) FROM stg_premium_remittances WHERE remittance_date <= :end) AS rem_all,
        (SELECT COALESCE(SUM(amount),0) FROM stg_premium_receipts WHERE receipt_date BETWEEN :start AND :end) AS rec_p,
        (SELECT COALESCE(SUM(gross_amount),0) FROM stg_premium_remittances WHERE remittance_date BETWEEN :start AND :end) AS rem_p,
        (SELECT COALESCE(SUM(net_amount),0) FROM stg_premium_remittances WHERE remittance_date BETWEEN :start AND :end) AS net_p,
        (SELECT COALESCE(SUM(commission_deducted),0) FROM stg_premium_remittances WHERE remittance_date BETWEEN :start AND :end) AS comm_p`,
      { start: period.start, end: period.end });
    const premiumDue = r2(x.rec_all - x.rem_all);
    const clientCash = r2(prem.reduce((s, a) => s + a.bank, 0));
    const surplus = r2(clientCash - premiumDue);
    if (surplus < -1) v.error(`Client money shortfall: premium accounts hold ₦${clientCash.toLocaleString()} against ₦${premiumDue.toLocaleString()} premium collected but not yet remitted.`);
    return {
      sections: [
        table('recon', `Bank reconciliation summary as at ${period.end}`, [C.text('bank_name', 'Bank'), C.text('account_no', 'Account no.'),
          C.text('account_type', 'Type'), C.date('as_at', 'Recon date'), C.money('ledger', 'Cash book (₦)'), C.money('bank', 'Bank statement (₦)'),
          C.money('diff', 'Difference (₦)')], accts),
        kv('flows', `Premium fund movement - ${period.label}`, [
          { label: 'Premium received from clients', value: x.rec_p, type: 'money' },
          { label: 'Premium settled to insurers (gross)', value: x.rem_p, type: 'money' },
          { label: 'Brokerage commission retained at source', value: x.comm_p, type: 'money' },
          { label: 'Net cash remitted to insurers', value: x.net_p, type: 'money' },
        ]),
        kv('position', `Client money position as at ${period.end}`, [
          { label: 'Premium collected not yet remitted to insurers', value: premiumDue, type: 'money' },
          { label: 'Balance in premium (client) bank accounts', value: clientCash, type: 'money' },
          { label: 'Surplus / (shortfall)', value: surplus, type: 'money' },
        ]),
      ],
      validations: v.items,
    };
  },
};

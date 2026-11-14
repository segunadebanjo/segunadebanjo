const { query, table, kv, C, Validator, pct } = require('../helpers');

module.exports = {
  code: 'QR-09',
  name: 'AML/CFT/CPF Compliance Returns',
  category: 'AML/CFT',
  frequencies: ['quarterly', 'monthly', 'half-yearly', 'annual'],
  description: 'KYC/CDD status of the client base, high-risk and PEP clients, cash transactions above threshold, CTRs and STRs filed with the NFIU.',
  async run({ period, settings }) {
    const v = new Validator();
    const comp = settings.compliance;
    const [k] = await query(
      `SELECT COUNT(*) total, SUM(kyc_complete=1) kyc, SUM(risk_rating='high') high, SUM(is_pep=1) pep,
              SUM(onboarded_on BETWEEN :start AND :end) new_clients,
              SUM(onboarded_on BETWEEN :start AND :end AND kyc_complete=0) new_no_kyc,
              SUM(client_type='individual') indiv, SUM(client_type<>'individual') corp
         FROM stg_clients WHERE onboarded_on IS NULL OR onboarded_on <= :end`, { start: period.start, end: period.end });
    const tx = await query(
      `SELECT t.*, c.name AS client, c.client_type FROM stg_aml_transactions t LEFT JOIN stg_clients c ON c.id=t.client_id
        WHERE t.txn_date BETWEEN ? AND ?`, [period.start, period.end]);
    const thresholdFor = (t) => (t.client_type === 'individual' ? comp.cashCtrThreshold : comp.corporateCtrThreshold);
    const ctrDue = tx.filter((t) => t.is_cash && t.amount >= thresholdFor(t));
    const ctrMissing = ctrDue.filter((t) => !t.ctr_filed);
    const strs = tx.filter((t) => t.str_filed);
    if (ctrMissing.length) v.error(`${ctrMissing.length} cash transaction(s) at or above the CTR threshold have no CTR filed.`);
    if (Number(k.new_no_kyc)) v.error(`${k.new_no_kyc} client(s) onboarded in the period without completed KYC.`);
    const kycPct = pct(Number(k.kyc), Number(k.total));
    if (kycPct < 100) v.warn(`KYC completion is ${kycPct}% of the client base.`);
    const pepList = await query(
      `SELECT name, client_type, sector, risk_rating, IF(is_pep=1,'Yes','No') AS pep, IF(kyc_complete=1,'Yes','No') AS kyc, onboarded_on
         FROM stg_clients WHERE (is_pep=1 OR risk_rating='high') AND (onboarded_on IS NULL OR onboarded_on <= ?) ORDER BY name`, [period.end]);
    return {
      sections: [
        kv('kyc', 'Client due diligence summary', [
          { label: 'Total clients at period end', value: Number(k.total), type: 'number' },
          { label: 'Individual clients', value: Number(k.indiv), type: 'number' },
          { label: 'Corporate / government clients', value: Number(k.corp), type: 'number' },
          { label: 'Clients onboarded in period', value: Number(k.new_clients), type: 'number' },
          { label: 'Clients with completed KYC', value: Number(k.kyc), type: 'number' },
          { label: 'KYC completion rate (%)', value: kycPct, type: 'pct' },
          { label: 'High-risk clients', value: Number(k.high), type: 'number' },
          { label: 'Politically exposed persons (PEPs)', value: Number(k.pep), type: 'number' },
        ]),
        kv('tx', 'Transaction monitoring summary', [
          { label: 'Monitored transactions in period', value: tx.length, type: 'number' },
          { label: 'Cash transactions', value: tx.filter((t) => t.is_cash).length, type: 'number' },
          { label: 'Cash transactions at/above CTR threshold', value: ctrDue.length, type: 'number' },
          { label: 'Value of CTR-reportable transactions (₦)', value: ctrDue.reduce((s, t) => s + t.amount, 0), type: 'money' },
          { label: 'CTRs filed with NFIU', value: ctrDue.filter((t) => t.ctr_filed).length, type: 'number' },
          { label: 'Suspicious transaction reports (STRs) filed', value: strs.length, type: 'number' },
          { label: 'Value of STRs (₦)', value: strs.reduce((s, t) => s + t.amount, 0), type: 'money' },
        ], { note: `CTR thresholds: individual ₦${Number(comp.cashCtrThreshold).toLocaleString()}, corporate ₦${Number(comp.corporateCtrThreshold).toLocaleString()}` }),
        table('str', 'Suspicious transaction reports filed', [C.text('str_ref', 'STR ref.'), C.date('str_filed_date', 'Date filed'), C.text('client', 'Client'),
          C.date('txn_date', 'Txn date'), C.money('amount', 'Amount (₦)'), C.text('txn_type', 'Type'), C.text('notes', 'Grounds')], strs),
        table('ctr_missing', 'Cash transactions above threshold without CTR', [C.text('client', 'Client'), C.text('client_type', 'Client type'),
          C.date('txn_date', 'Date'), C.money('amount', 'Amount (₦)'), C.text('channel', 'Channel')], ctrMissing),
        table('pep', 'High-risk and PEP clients', [C.text('name', 'Client'), C.text('client_type', 'Type'), C.text('sector', 'Sector'),
          C.text('risk_rating', 'Risk'), C.text('pep', 'PEP'), C.text('kyc', 'KYC complete'), C.date('onboarded_on', 'Onboarded')], pepList, { totals: false }),
      ],
      validations: v.items,
    };
  },
};

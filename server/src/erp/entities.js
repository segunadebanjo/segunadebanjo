// Canonical entities the add-on needs from the ERP. Used by all three
// integration channels (direct DB pull, push API, CSV upload) so that
// validation and upsert behave identically whichever channel is used.
//
// type: s=string, d=date (YYYY-MM-DD), n=number, b=boolean(0/1)

const E = (table, label, columns, required, opts = {}) => ({ table, label, columns, required, ...opts });

const ENTITIES = {
  branches: E('stg_branches', 'Branches',
    { id: 's', code: 's', name: 's', state: 's', address: 's', opened_on: 'd', closed_on: 'd' }, ['id', 'name']),
  insurers: E('stg_insurers', 'Insurers / Underwriters',
    { id: 's', code: 's', name: 's', naicom_reg_no: 's', insurer_type: 's' }, ['id', 'name']),
  classes: E('stg_classes', 'Classes of Business',
    { id: 's', code: 's', name: 's', naicom_class: 's' }, ['id', 'name', 'naicom_class']),
  clients: E('stg_clients', 'Clients',
    { id: 's', code: 's', name: 's', client_type: 's', sector: 's', state: 's', id_number: 's', tin: 's',
      risk_rating: 's', is_pep: 'b', kyc_complete: 'b', onboarded_on: 'd' }, ['id', 'name']),
  bank_accounts: E('stg_bank_accounts', 'Bank Accounts',
    { id: 's', bank_name: 's', account_no: 's', account_name: 's', account_type: 's', currency: 's' }, ['id', 'bank_name', 'account_no']),
  bank_balances: E('stg_bank_balances', 'Bank Balances (reconciliation)',
    { id: 's', bank_account_id: 's', as_at: 'd', ledger_balance: 'n', bank_balance: 'n' }, ['bank_account_id', 'as_at'],
    { keyFrom: (r) => `${r.bank_account_id}|${r.as_at}` }),
  placements: E('stg_placements', 'Placements / Debit Notes',
    { id: 's', debit_note_no: 's', policy_no: 's', client_id: 's', insurer_id: 's', class_id: 's', branch_id: 's',
      business_type: 's', placement_date: 'd', inception_date: 'd', expiry_date: 'd', sum_insured: 'n',
      gross_premium: 'n', commission_rate: 'n', commission_amount: 'n', vat_on_commission: 'n', currency: 's',
      is_coinsurance: 'b' }, ['id', 'client_id', 'insurer_id', 'class_id', 'placement_date']),
  premium_receipts: E('stg_premium_receipts', 'Premium Receipts (from clients)',
    { id: 's', receipt_no: 's', placement_id: 's', client_id: 's', receipt_date: 'd', amount: 'n', payment_mode: 's',
      bank_account_id: 's' }, ['id', 'placement_id', 'receipt_date', 'amount']),
  premium_remittances: E('stg_premium_remittances', 'Premium Remittances (to insurers)',
    { id: 's', remittance_ref: 's', placement_id: 's', insurer_id: 's', remittance_date: 'd', gross_amount: 'n',
      commission_deducted: 'n', net_amount: 'n' }, ['id', 'placement_id', 'remittance_date', 'gross_amount', 'net_amount']),
  claims: E('stg_claims', 'Claims',
    { id: 's', claim_no: 's', placement_id: 's', client_id: 's', insurer_id: 's', class_id: 's', loss_date: 'd',
      notified_date: 'd', submitted_to_insurer_date: 'd', amount_claimed: 'n', amount_settled: 'n', settled_date: 'd',
      status: 's', remarks: 's' }, ['id', 'client_id', 'insurer_id', 'class_id', 'notified_date']),
  complaints: E('stg_complaints', 'Complaints',
    { id: 's', ref_no: 's', received_date: 'd', complainant: 's', client_id: 's', insurer_id: 's', category: 's',
      channel: 's', description: 's', status: 's', resolved_date: 'd', resolution: 's' }, ['id', 'received_date']),
  gl_accounts: E('stg_gl_accounts', 'GL Accounts (chart of accounts)',
    { id: 's', code: 's', name: 's', account_type: 's', fs_line: 's' }, ['id', 'code', 'name', 'account_type'],
    { preserveOnUpdate: ['fs_line'] }),
  gl_balances: E('stg_gl_balances', 'GL Balances (month-end trial balance)',
    { id: 's', gl_account_id: 's', period_end: 'd', closing_balance: 'n', period_movement: 'n' }, ['gl_account_id', 'period_end'],
    { keyFrom: (r) => `${r.gl_account_id}|${r.period_end}` }),
  staff: E('stg_staff', 'Staff',
    { id: 's', staff_no: 's', name: 's', gender: 's', designation: 's', department: 's', branch_id: 's',
      qualification: 's', professional_cert: 's', is_key_officer: 'b', date_joined: 'd', date_exited: 'd' }, ['id', 'name']),
  directors: E('stg_directors', 'Directors & Shareholders',
    { id: 's', name: 's', role: 's', designation: 's', nationality: 's', shares_held: 'n', pct_holding: 'n',
      appointed_on: 'd', ceased_on: 'd' }, ['id', 'name']),
  aml_transactions: E('stg_aml_transactions', 'AML/CFT Transactions',
    { id: 's', client_id: 's', txn_date: 'd', amount: 'n', txn_type: 's', channel: 's', is_cash: 'b', ctr_filed: 'b',
      str_filed: 'b', str_ref: 's', str_filed_date: 'd', notes: 's' }, ['id', 'client_id', 'txn_date', 'amount']),
};

// Load order matters only for humans reading sync logs; there are no FK constraints.
const ENTITY_ORDER = Object.keys(ENTITIES);

module.exports = { ENTITIES, ENTITY_ORDER };

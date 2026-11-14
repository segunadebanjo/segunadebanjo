/**
 * ERP -> add-on data mapping (direct database pull).
 *
 * Copy this file to `erp-mapping.js` (same folder) and edit the SQL so that each
 * query returns the canonical column names listed in src/erp/entities.js.
 * Use column aliases (AS) to rename your ERP's columns. Columns you cannot supply
 * may be omitted. `:since` is bound to the last successful sync timestamp when
 * `incremental: true`, so filter on your ERP's "last modified" column if it has one.
 *
 * The table / column names below are ILLUSTRATIVE for a typical brokerage ERP -
 * replace them with your ERP's real schema. Use a read-only DB user.
 */
module.exports = {
  branches: {
    sql: `SELECT b.branch_id AS id, b.branch_code AS code, b.branch_name AS name, b.state, b.address,
                 b.date_opened AS opened_on, b.date_closed AS closed_on
            FROM branches b`,
  },
  insurers: {
    sql: `SELECT u.underwriter_id AS id, u.code, u.name, u.naicom_reg_no,
                 CASE u.category WHEN 'L' THEN 'life' WHEN 'C' THEN 'composite' WHEN 'R' THEN 'reinsurer' ELSE 'non-life' END AS insurer_type
            FROM underwriters u`,
  },
  classes: {
    // naicom_class must be one of: FIRE, MOTOR, GEN_ACCIDENT, ENGINEERING, MARINE_CARGO, MARINE_HULL,
    // AVIATION, OIL_GAS, BOND, AGRIC, MISC, LIFE_GROUP, LIFE_INDIVIDUAL, HEALTH
    sql: `SELECT c.class_id AS id, c.class_code AS code, c.class_name AS name, c.naicom_category AS naicom_class
            FROM insurance_classes c`,
  },
  clients: {
    incremental: true,
    sql: `SELECT c.client_id AS id, c.client_code AS code, c.client_name AS name,
                 LOWER(c.client_type) AS client_type, c.industry AS sector, c.state, c.bvn_or_rc AS id_number, c.tin,
                 LOWER(c.risk_level) AS risk_rating, c.pep_flag AS is_pep, c.kyc_done AS kyc_complete,
                 DATE(c.created_at) AS onboarded_on
            FROM clients c WHERE c.updated_at >= :since`,
  },
  bank_accounts: {
    sql: `SELECT a.account_id AS id, a.bank_name, a.account_number AS account_no, a.account_name,
                 CASE WHEN a.is_premium_account = 1 THEN 'premium' ELSE 'operating' END AS account_type, a.currency
            FROM bank_accounts a`,
  },
  bank_balances: {
    incremental: true,
    sql: `SELECT r.account_id AS bank_account_id, r.statement_date AS as_at,
                 r.cashbook_balance AS ledger_balance, r.statement_balance AS bank_balance
            FROM bank_reconciliations r WHERE r.updated_at >= :since`,
  },
  placements: {
    incremental: true,
    sql: `SELECT d.debit_note_id AS id, d.debit_note_no, d.policy_no, d.client_id, d.underwriter_id AS insurer_id,
                 d.class_id, d.branch_id, LOWER(d.transaction_type) AS business_type,
                 d.debit_note_date AS placement_date, d.period_from AS inception_date, d.period_to AS expiry_date,
                 d.sum_insured * d.exchange_rate AS sum_insured, d.premium * d.exchange_rate AS gross_premium,
                 d.commission_rate, d.commission * d.exchange_rate AS commission_amount,
                 d.vat_on_commission * d.exchange_rate AS vat_on_commission, d.currency, d.is_coinsurance
            FROM debit_notes d WHERE d.status <> 'VOID' AND d.updated_at >= :since`,
  },
  premium_receipts: {
    incremental: true,
    sql: `SELECT r.receipt_id AS id, r.receipt_no, r.debit_note_id AS placement_id, r.client_id,
                 r.receipt_date, r.amount_ngn AS amount, LOWER(r.payment_method) AS payment_mode,
                 r.bank_account_id
            FROM premium_receipts r WHERE r.updated_at >= :since`,
  },
  premium_remittances: {
    incremental: true,
    sql: `SELECT p.payment_id AS id, p.payment_ref AS remittance_ref, p.debit_note_id AS placement_id,
                 p.underwriter_id AS insurer_id, p.payment_date AS remittance_date,
                 p.gross_premium AS gross_amount, p.commission_withheld AS commission_deducted,
                 p.amount_paid AS net_amount
            FROM underwriter_payments p WHERE p.updated_at >= :since`,
  },
  claims: {
    incremental: true,
    sql: `SELECT c.claim_id AS id, c.claim_no, c.debit_note_id AS placement_id, c.client_id,
                 c.underwriter_id AS insurer_id, c.class_id, c.date_of_loss AS loss_date,
                 c.date_reported AS notified_date, c.date_sent_to_insurer AS submitted_to_insurer_date,
                 c.amount_claimed, c.amount_paid AS amount_settled, c.date_paid AS settled_date,
                 LOWER(c.status) AS status, c.remarks
            FROM claims c WHERE c.updated_at >= :since`,
  },
  complaints: {
    incremental: true,
    sql: `SELECT k.complaint_id AS id, k.ref_no, k.date_received AS received_date, k.complainant_name AS complainant,
                 k.client_id, k.underwriter_id AS insurer_id, k.category, k.channel, k.details AS description,
                 LOWER(k.status) AS status, k.date_resolved AS resolved_date, k.resolution
            FROM complaints k WHERE k.updated_at >= :since`,
  },
  gl_accounts: {
    sql: `SELECT g.account_id AS id, g.account_code AS code, g.account_name AS name, LOWER(g.account_class) AS account_type
            FROM gl_accounts g`,
  },
  gl_balances: {
    incremental: true,
    // Month-end trial balance. Debit = positive, credit = negative.
    sql: `SELECT t.account_id AS gl_account_id, LAST_DAY(t.period_date) AS period_end,
                 t.closing_debit - t.closing_credit AS closing_balance,
                 t.period_debit - t.period_credit AS period_movement
            FROM gl_period_balances t WHERE t.updated_at >= :since`,
  },
  staff: {
    incremental: true,
    sql: `SELECT e.employee_id AS id, e.staff_no, CONCAT(e.first_name,' ',e.last_name) AS name, e.gender,
                 e.job_title AS designation, e.department, e.branch_id, e.highest_qualification AS qualification,
                 e.professional_body AS professional_cert, e.is_key_officer, e.hire_date AS date_joined,
                 e.exit_date AS date_exited
            FROM employees e WHERE e.updated_at >= :since`,
  },
  directors: {
    sql: `SELECT d.id, d.full_name AS name, d.role, d.designation, d.nationality, d.shares AS shares_held,
                 d.percentage AS pct_holding, d.appointment_date AS appointed_on, d.cessation_date AS ceased_on
            FROM board_and_shareholders d`,
  },
  aml_transactions: {
    incremental: true,
    sql: `SELECT a.txn_id AS id, a.client_id, a.txn_date, a.amount, a.txn_type, a.channel, a.is_cash,
                 a.ctr_filed, a.str_filed, a.str_reference AS str_ref, a.str_date AS str_filed_date, a.notes
            FROM aml_monitoring a WHERE a.updated_at >= :since`,
  },
};

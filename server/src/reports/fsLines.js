// Lines of the broker's financial statements as presented on the NAICOM returns.
// GL accounts are mapped to these codes (stg_gl_accounts.fs_line) from Settings > GL Mapping.
// sign: +1 => debit-natured (shown as positive when debit), -1 => credit-natured.
const FS_LINES = [
  // Statement of financial position
  { code: 'CASH', name: 'Cash and cash equivalents (operating)', statement: 'SOFP', group: 'Assets', sign: 1 },
  { code: 'CLIENT_CASH', name: 'Cash held in premium (client) accounts', statement: 'SOFP', group: 'Assets', sign: 1 },
  { code: 'INVESTMENTS', name: 'Financial assets / investments', statement: 'SOFP', group: 'Assets', sign: 1 },
  { code: 'PREMIUM_RECEIVABLE', name: 'Premium receivable from clients', statement: 'SOFP', group: 'Assets', sign: 1 },
  { code: 'COMMISSION_RECEIVABLE', name: 'Commission receivable', statement: 'SOFP', group: 'Assets', sign: 1 },
  { code: 'OTHER_RECEIVABLES', name: 'Other receivables and prepayments', statement: 'SOFP', group: 'Assets', sign: 1 },
  { code: 'INTANGIBLES', name: 'Intangible assets', statement: 'SOFP', group: 'Assets', sign: 1 },
  { code: 'PPE', name: 'Property, plant and equipment', statement: 'SOFP', group: 'Assets', sign: 1 },
  { code: 'DEFERRED_TAX_ASSET', name: 'Deferred tax asset', statement: 'SOFP', group: 'Assets', sign: 1 },
  { code: 'PREMIUM_PAYABLE', name: 'Premium payable to insurers', statement: 'SOFP', group: 'Liabilities', sign: -1 },
  { code: 'OTHER_PAYABLES', name: 'Other payables and accruals', statement: 'SOFP', group: 'Liabilities', sign: -1 },
  { code: 'BORROWINGS', name: 'Borrowings', statement: 'SOFP', group: 'Liabilities', sign: -1 },
  { code: 'CURRENT_TAX', name: 'Current income tax liability', statement: 'SOFP', group: 'Liabilities', sign: -1 },
  { code: 'DEFERRED_TAX_LIAB', name: 'Deferred tax liability', statement: 'SOFP', group: 'Liabilities', sign: -1 },
  { code: 'SHARE_CAPITAL', name: 'Issued and paid-up share capital', statement: 'SOFP', group: 'Equity', sign: -1 },
  { code: 'SHARE_PREMIUM', name: 'Share premium', statement: 'SOFP', group: 'Equity', sign: -1 },
  { code: 'RETAINED_EARNINGS', name: 'Retained earnings (brought forward)', statement: 'SOFP', group: 'Equity', sign: -1 },
  { code: 'OTHER_RESERVES', name: 'Other reserves', statement: 'SOFP', group: 'Equity', sign: -1 },
  // Statement of profit or loss
  { code: 'COMMISSION_INCOME', name: 'Brokerage commission income', statement: 'PL', group: 'Income', sign: -1 },
  { code: 'FEE_INCOME', name: 'Consultancy / advisory fee income', statement: 'PL', group: 'Income', sign: -1 },
  { code: 'INVESTMENT_INCOME', name: 'Investment income', statement: 'PL', group: 'Income', sign: -1 },
  { code: 'OTHER_INCOME', name: 'Other operating income', statement: 'PL', group: 'Income', sign: -1 },
  { code: 'STAFF_COSTS', name: 'Staff costs', statement: 'PL', group: 'Expenses', sign: 1 },
  { code: 'DEPRECIATION', name: 'Depreciation and amortisation', statement: 'PL', group: 'Expenses', sign: 1 },
  { code: 'IMPAIRMENT', name: 'Impairment charges', statement: 'PL', group: 'Expenses', sign: 1 },
  { code: 'ADMIN_EXPENSES', name: 'Management and administrative expenses', statement: 'PL', group: 'Expenses', sign: 1 },
  { code: 'FINANCE_COSTS', name: 'Finance costs', statement: 'PL', group: 'Expenses', sign: 1 },
  { code: 'INCOME_TAX', name: 'Income tax expense', statement: 'PL', group: 'Tax', sign: 1 },
];
const FS_BY_CODE = Object.fromEntries(FS_LINES.map((l) => [l.code, l]));
module.exports = { FS_LINES, FS_BY_CODE };

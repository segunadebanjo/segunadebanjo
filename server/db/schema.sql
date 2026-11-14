-- =====================================================================
-- NAICOM Broker Statutory Returns add-on : reporting database schema
-- MySQL 8.0+ / MariaDB 10.6+
--
-- Two groups of tables:
--   1. "stg_" staging tables  - a canonical copy of the ERP data the
--      returns need. Primary keys are the ERP's own record IDs so that
--      the ERP stays the system of record and re-syncs are idempotent.
--   2. application tables     - users, settings, report runs, audit.
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- Staging / canonical ERP data
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stg_branches (
  id            VARCHAR(64) PRIMARY KEY,
  code          VARCHAR(32),
  name          VARCHAR(150) NOT NULL,
  state         VARCHAR(60),
  address       VARCHAR(255),
  opened_on     DATE,
  closed_on     DATE,
  synced_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stg_insurers (
  id            VARCHAR(64) PRIMARY KEY,
  code          VARCHAR(32),
  name          VARCHAR(150) NOT NULL,
  naicom_reg_no VARCHAR(64),
  insurer_type  VARCHAR(20) DEFAULT 'non-life',   -- non-life | life | composite | reinsurer | takaful
  synced_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- naicom_class must be one of the codes in src/reports/classes.js
CREATE TABLE IF NOT EXISTS stg_classes (
  id            VARCHAR(64) PRIMARY KEY,
  code          VARCHAR(32),
  name          VARCHAR(150) NOT NULL,
  naicom_class  VARCHAR(40) NOT NULL,
  synced_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stg_clients (
  id            VARCHAR(64) PRIMARY KEY,
  code          VARCHAR(32),
  name          VARCHAR(200) NOT NULL,
  client_type   VARCHAR(20) DEFAULT 'corporate',  -- individual | corporate | government
  sector        VARCHAR(80),
  state         VARCHAR(60),
  id_number     VARCHAR(64),                      -- BVN / NIN / RC number
  tin           VARCHAR(32),
  risk_rating   VARCHAR(10) DEFAULT 'low',        -- low | medium | high
  is_pep        TINYINT(1) DEFAULT 0,
  kyc_complete  TINYINT(1) DEFAULT 0,
  onboarded_on  DATE,
  synced_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stg_bank_accounts (
  id            VARCHAR(64) PRIMARY KEY,
  bank_name     VARCHAR(120) NOT NULL,
  account_no    VARCHAR(32) NOT NULL,
  account_name  VARCHAR(150),
  account_type  VARCHAR(20) DEFAULT 'operating',  -- premium (client/trust) | operating | investment
  currency      VARCHAR(3) DEFAULT 'NGN',
  synced_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stg_bank_balances (
  id              VARCHAR(100) PRIMARY KEY,
  bank_account_id VARCHAR(64) NOT NULL,
  as_at           DATE NOT NULL,
  ledger_balance  DECIMAL(18,2) DEFAULT 0,       -- cash book balance per ERP
  bank_balance    DECIMAL(18,2) DEFAULT 0,       -- balance per bank statement
  synced_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_bank_bal (bank_account_id, as_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per debit note / placement. All amounts in NGN equivalent.
CREATE TABLE IF NOT EXISTS stg_placements (
  id                 VARCHAR(64) PRIMARY KEY,
  debit_note_no      VARCHAR(64),
  policy_no          VARCHAR(64),
  client_id          VARCHAR(64) NOT NULL,
  insurer_id         VARCHAR(64) NOT NULL,
  class_id           VARCHAR(64) NOT NULL,
  branch_id          VARCHAR(64),
  business_type      VARCHAR(20) DEFAULT 'new',  -- new | renewal | endorsement | cancellation
  placement_date     DATE NOT NULL,
  inception_date     DATE,
  expiry_date        DATE,
  sum_insured        DECIMAL(20,2) DEFAULT 0,
  gross_premium      DECIMAL(18,2) DEFAULT 0,    -- negative for cancellations / refunds
  commission_rate    DECIMAL(7,4) DEFAULT 0,     -- percentage e.g. 12.5
  commission_amount  DECIMAL(18,2) DEFAULT 0,
  vat_on_commission  DECIMAL(18,2) DEFAULT 0,
  currency           VARCHAR(3) DEFAULT 'NGN',
  is_coinsurance     TINYINT(1) DEFAULT 0,
  synced_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_pl_date (placement_date),
  KEY ix_pl_insurer (insurer_id),
  KEY ix_pl_class (class_id),
  KEY ix_pl_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stg_premium_receipts (
  id               VARCHAR(64) PRIMARY KEY,
  receipt_no       VARCHAR(64),
  placement_id     VARCHAR(64) NOT NULL,
  client_id        VARCHAR(64),
  receipt_date     DATE NOT NULL,
  amount           DECIMAL(18,2) NOT NULL,
  payment_mode     VARCHAR(30),                 -- transfer | cheque | cash | pos | direct-to-insurer
  bank_account_id  VARCHAR(64),
  synced_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_rc_date (receipt_date),
  KEY ix_rc_pl (placement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stg_premium_remittances (
  id                   VARCHAR(64) PRIMARY KEY,
  remittance_ref       VARCHAR(64),
  placement_id         VARCHAR(64) NOT NULL,
  insurer_id           VARCHAR(64),
  remittance_date      DATE NOT NULL,
  gross_amount         DECIMAL(18,2) NOT NULL,   -- premium settled to insurer
  commission_deducted  DECIMAL(18,2) DEFAULT 0,
  net_amount           DECIMAL(18,2) NOT NULL,   -- cash actually paid
  synced_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_rm_date (remittance_date),
  KEY ix_rm_pl (placement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stg_claims (
  id                         VARCHAR(64) PRIMARY KEY,
  claim_no                   VARCHAR(64),
  placement_id               VARCHAR(64),
  client_id                  VARCHAR(64) NOT NULL,
  insurer_id                 VARCHAR(64) NOT NULL,
  class_id                   VARCHAR(64) NOT NULL,
  loss_date                  DATE,
  notified_date              DATE NOT NULL,     -- date client notified the broker
  submitted_to_insurer_date  DATE,
  amount_claimed             DECIMAL(18,2) DEFAULT 0,
  amount_settled             DECIMAL(18,2) DEFAULT 0,
  settled_date               DATE,
  status                     VARCHAR(20) DEFAULT 'open',  -- open | settled | repudiated | withdrawn
  remarks                    VARCHAR(255),
  synced_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_cl_notified (notified_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stg_complaints (
  id             VARCHAR(64) PRIMARY KEY,
  ref_no         VARCHAR(64),
  received_date  DATE NOT NULL,
  complainant    VARCHAR(200),
  client_id      VARCHAR(64),
  insurer_id     VARCHAR(64),
  category       VARCHAR(60),   -- claims | premium | policy-docs | service | misconduct | other
  channel        VARCHAR(30),
  description    VARCHAR(500),
  status         VARCHAR(20) DEFAULT 'open',  -- open | resolved | escalated
  resolved_date  DATE,
  resolution     VARCHAR(500),
  synced_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- fs_line: maps an ERP GL account to a line on the NAICOM financial statements
-- (codes defined in src/reports/fsLines.js). Can be set here or via the UI.
CREATE TABLE IF NOT EXISTS stg_gl_accounts (
  id          VARCHAR(64) PRIMARY KEY,
  code        VARCHAR(32) NOT NULL,
  name        VARCHAR(150) NOT NULL,
  account_type VARCHAR(20) NOT NULL,           -- asset | liability | equity | income | expense
  fs_line     VARCHAR(40),
  synced_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sign convention: debit balances positive, credit balances negative (as in most ERPs).
CREATE TABLE IF NOT EXISTS stg_gl_balances (
  id               VARCHAR(100) PRIMARY KEY,
  gl_account_id    VARCHAR(64) NOT NULL,
  period_end       DATE NOT NULL,              -- month end
  closing_balance  DECIMAL(18,2) DEFAULT 0,    -- cumulative balance at period_end
  period_movement  DECIMAL(18,2) DEFAULT 0,    -- movement within the month
  synced_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_glb (gl_account_id, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stg_staff (
  id                 VARCHAR(64) PRIMARY KEY,
  staff_no           VARCHAR(32),
  name               VARCHAR(150) NOT NULL,
  gender             VARCHAR(10),
  designation        VARCHAR(100),
  department         VARCHAR(100),
  branch_id          VARCHAR(64),
  qualification      VARCHAR(150),   -- academic e.g. B.Sc Insurance
  professional_cert  VARCHAR(60),    -- e.g. ACIIN, FCIIN, ACII
  is_key_officer     TINYINT(1) DEFAULT 0,
  date_joined        DATE,
  date_exited        DATE,
  synced_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stg_directors (
  id            VARCHAR(64) PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  role          VARCHAR(20) DEFAULT 'director',  -- director | shareholder | both
  designation   VARCHAR(100),                    -- e.g. Chairman, MD/CEO, Non-Executive
  nationality   VARCHAR(60),
  shares_held   DECIMAL(20,0) DEFAULT 0,
  pct_holding   DECIMAL(7,4) DEFAULT 0,
  appointed_on  DATE,
  ceased_on     DATE,
  synced_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stg_aml_transactions (
  id              VARCHAR(64) PRIMARY KEY,
  client_id       VARCHAR(64) NOT NULL,
  txn_date        DATE NOT NULL,
  amount          DECIMAL(18,2) NOT NULL,
  txn_type        VARCHAR(30),   -- premium | refund | claim-payment
  channel         VARCHAR(30),
  is_cash         TINYINT(1) DEFAULT 0,
  ctr_filed       TINYINT(1) DEFAULT 0,
  str_filed       TINYINT(1) DEFAULT 0,
  str_ref         VARCHAR(64),
  str_filed_date  DATE,
  notes           VARCHAR(255),
  synced_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_aml_date (txn_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Application tables
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(120) NOT NULL,
  email          VARCHAR(150) NOT NULL UNIQUE,
  password_hash  VARCHAR(100),
  role           VARCHAR(20) NOT NULL DEFAULT 'preparer', -- admin | preparer | reviewer | approver | viewer
  active         TINYINT(1) DEFAULT 1,
  last_login_at  DATETIME,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
  `key`       VARCHAR(64) PRIMARY KEY,
  `value`     LONGTEXT NOT NULL,             -- JSON
  updated_by  INT,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS report_runs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  report_code     VARCHAR(20) NOT NULL,
  report_name     VARCHAR(200) NOT NULL,
  frequency       VARCHAR(12) NOT NULL,
  period_label    VARCHAR(40) NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  version         INT NOT NULL DEFAULT 1,
  status          VARCHAR(12) NOT NULL DEFAULT 'draft', -- draft | reviewed | approved | submitted | rejected
  output          LONGTEXT NOT NULL,                    -- JSON snapshot of the generated return
  error_count     INT DEFAULT 0,
  warning_count   INT DEFAULT 0,
  notes           TEXT,
  generated_by    INT,
  generated_at    DATETIME NOT NULL,
  reviewed_by     INT,
  reviewed_at     DATETIME,
  approved_by     INT,
  approved_at     DATETIME,
  submitted_by    INT,
  submitted_at    DATETIME,
  submission_ref  VARCHAR(100),
  KEY ix_rr (report_code, period_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sync_logs (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  source           VARCHAR(10) NOT NULL,          -- erp_db | api | csv
  entity           VARCHAR(40) NOT NULL,
  status           VARCHAR(10) NOT NULL,          -- running | success | failed
  records_in       INT DEFAULT 0,
  records_upserted INT DEFAULT 0,
  rejected         INT DEFAULT 0,
  message          TEXT,
  started_at       DATETIME NOT NULL,
  finished_at      DATETIME,
  user_id          INT,
  KEY ix_sync (entity, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT,
  user_email  VARCHAR(150),
  action      VARCHAR(60) NOT NULL,
  entity      VARCHAR(60),
  entity_id   VARCHAR(64),
  details     TEXT,
  ip          VARCHAR(64),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY ix_audit_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

# NAICOM Statutory Returns – Insurance Broker ERP Add-on

A standalone **React + Node.js + MySQL** application that plugs into an existing insurance-brokerage ERP and prepares the statutory returns a NAICOM-registered insurance broker has to file. It keeps its own copy of the ERP data it needs, checks it, produces the returns in Excel and PDF, routes them through a maker-checker approval, and tracks each submission to NAICOM.

> **Regulatory note.** The return layouts, thresholds and due dates in this app are configurable starting points, built from the usual content of broker returns under the Insurance Act / NIIRA 2025 and NAICOM guidelines. Before you file anything, your compliance officer should check each template, threshold (minimum capital, commission caps, CTR limits, remittance window) and deadline against the latest NAICOM circulars and portal templates, then adjust them under **Settings**.

---

## What it produces

| Code | Return | Frequencies | Key checks |
|---|---|---|---|
| QR-01 | Statement of Financial Position | Q / H / A / M | TB balances, every GL account mapped, statement balances, premium payable vs client cash |
| QR-02 | Statement of Profit or Loss (period + YTD) | Q / H / A / M | Loss-making flag |
| QR-03 | Premium generated & commission earned by class of business (new vs renewal, sum insured, YTD) | Q / M / H / A | Commission above NAICOM cap per class; commission > premium |
| QR-04 | Premium placement by insurer (placed, collected, remitted, concentration) | Q / M / H / A | Insurer concentration > 50%, missing NAICOM registration numbers |
| QR-05 | Premium remittance compliance – "No Premium, No Cover" | Q / M / H / A | Premium not remitted within N days (error), late remittances, compliance % |
| QR-06 | Outstanding premium (premium debtors) age analysis by class/insurer | Q / M / H / A | Debit notes > 90 days |
| QR-07 | Claims returns – movement by class, settlement by insurer, outstanding register | Q / H / A / M | Claims forwarded late to insurer, claims > 90 days |
| QR-08 | Complaints management returns + complaints register | Q / M / H / A | Complaints past resolution target |
| QR-09 | AML/CFT/CPF returns – KYC, high-risk/PEP clients, CTRs, STRs | Q / M / H / A | Cash transactions over threshold with no CTR, clients onboarded without KYC |
| QR-10 | Premium (client) account reconciliation & client money position | Q / M / H / A | Unreconciled differences, client money shortfall |
| AR-01 | Annual returns – corporate info, licence, PII & fidelity cover, board, shareholders, key officers, branches | A / H / Q | Licence/PII expiry, PII below minimum, shareholding ≠ 100%, missing details |
| AR-02 | Annual business review – premium by class per quarter, top 10 insurers/clients, branches | A / H | — |
| AR-03 | Capital adequacy, liquidity & solvency | A / H / Q | Paid-up capital / shareholders' funds below minimum, current ratio < 1 |
| AR-04 | Staff strength, movement & professional qualifications | A / H / Q | — |

Every return:
- Can be **previewed** for any period, then exported to **Excel** (cover sheet plus one sheet per schedule) or **PDF** (with signature block).
- Can be **saved as a versioned snapshot** that goes through **draft → reviewed → approved → submitted**. The maker-checker rule stops the preparer from reviewing or approving their own return. A return with validation errors can only be approved with a written justification. "Submitted" records the NAICOM portal acknowledgement reference.
- Appears on the **compliance calendar**, which shows overdue, due, upcoming and submitted obligations for the year.
- Leaves an **audit trail**: every sign-in, data load, generation, approval, export and settings change is logged.

## Architecture

```
┌──────────────────────┐     1. direct DB pull (read-only SQL, scheduled)    ┌───────────────────────────┐
│  Existing broker ERP │ ──────────────────────────────────────────────────▶ │  Node.js API (Express)    │
│  (any DB / stack)    │     2. push API  POST /api/ingest/:entity           │  ├ ERP connector & ingest │
│                      │ ──────────────────────────────────────────────────▶ │  ├ Report engine (14)     │
│  "NAICOM Returns"    │     3. CSV upload from the UI                       │  ├ Excel / PDF exporters  │
│  menu item ──────────┼──── SSO: /sso?token=<JWT signed by ERP> ──────────▶ │  └ Workflow, audit, auth  │
└──────────────────────┘                                                     └────────────┬──────────────┘
                                                                                          │
                                                React UI (Vite) ◀─────────────────────────┤
                                                                                          ▼
                                                                         MySQL: naicom_returns
                                                                         stg_* (ERP copy) + app tables
```

The add-on **never writes to the ERP**. It keeps a canonical copy of the ERP data in `stg_*` tables, keyed by the ERP's own record IDs, so re-syncing is idempotent and the ERP stays the system of record.

```
server/
  db/schema.sql               MySQL schema (staging + application tables)
  config/erp-mapping.example.js   SQL that maps YOUR ERP tables to the canonical entities
  scripts/migrate.js | seed.js | sync.js
  src/
    erp/entities.js           canonical entity definitions (shared by all 3 channels)
    erp/upsert.js             validation + idempotent bulk upsert
    erp/connector.js          direct ERP database pull
    reports/definitions/*.js  one file per return – add a file to add a return
    reports/financials.js     builds the financial statements from the trial balance
    export/excel.js, pdf.js
    routes/*.js               REST API
client/                       React app (Vite)
```

## Getting started

### Option A – Docker

```bash
docker compose up -d --build
docker compose exec app node scripts/seed.js     # optional demo data
# open http://localhost:4000   →  admin@broker.local / Admin@123
```

### Option B – Manual (Node 18+ and MySQL 8 / MariaDB 10.6+)

```bash
# 1. database user
mysql -uroot -e "CREATE DATABASE naicom_returns; CREATE USER 'naicom'@'%' IDENTIFIED BY 'naicom'; GRANT ALL ON naicom_returns.* TO 'naicom'@'%';"

# 2. API
cd server
cp .env.example .env          # edit DB, secrets, ERP connection
npm install
npm run migrate               # creates tables + the admin user from .env
npm run seed                  # optional: ~2 years of realistic demo data
npm run dev                   # http://localhost:4000

# 3. UI (development)
cd ../client
npm install
npm run dev                   # http://localhost:5173 (proxies /api to :4000)

# Production: `npm run build` in client/ – the API then serves client/dist itself.
```

**Change the default admin password and all secrets in `.env` before going live.**

## Connecting your ERP

The add-on needs 16 entities: `branches, insurers, classes, clients, bank_accounts, bank_balances, placements, premium_receipts, premium_remittances, claims, complaints, gl_accounts, gl_balances, staff, directors, aml_transactions`. The **ERP data** page lists each entity's fields and required columns, and offers a CSV template for each. The full definitions are in `server/src/erp/entities.js`.

Conventions:
- Every record carries the ERP's own `id`. References (`client_id`, `insurer_id`, …) use those ERP IDs.
- Amounts are in **NGN equivalent**. Convert foreign-currency debit notes in the mapping SQL.
- `gl_balances`: month-end trial balance, **debit positive / credit negative**. `closing_balance` is cumulative and `period_movement` is the month's movement.
- `claims.settled_date` is the date the claim was **closed**, whether it was settled, repudiated or withdrawn.
- `classes.naicom_class` must be one of: `FIRE, GEN_ACCIDENT, MOTOR, MARINE_CARGO, MARINE_HULL, AVIATION, OIL_GAS, ENGINEERING, BOND, AGRIC, MISC, HEALTH, LIFE_GROUP, LIFE_INDIVIDUAL`. You can also map these later in Settings › Class mapping.
- Dates can be `YYYY-MM-DD` or `DD/MM/YYYY`.

### Channel 1 – Direct database pull (recommended if the ERP runs on MySQL/MariaDB)
1. Create a **read-only** MySQL user on the ERP database.
2. Set `ERP_DB_HOST/PORT/USER/PASSWORD/NAME` in `server/.env`.
3. `cp server/config/erp-mapping.example.js server/config/erp-mapping.js` and change each `SELECT` to match your ERP tables, using `AS` aliases to produce the canonical column names. Entities marked `incremental: true` get `:since` (the last successful sync time) so only changed rows are pulled.
4. Click **ERP data › Sync changes**, run `npm run sync` (add `-- --full` for a full reload), or let `ERP_SYNC_CRON` run it nightly.

### Channel 2 – Push API (any ERP stack)
```http
POST /api/ingest/placements
x-api-key: <INGEST_API_KEY>
Content-Type: application/json

{ "records": [ { "id": "DN-1001", "debit_note_no": "DN/2026/1001", "client_id": "C-77", "insurer_id": "INS-3",
                 "class_id": "MOT-COMP", "placement_date": "2026-07-14", "gross_premium": 250000,
                 "commission_rate": 12.5, "commission_amount": 31250, "business_type": "new" } ] }
```
The response lists `received`, `upserted` and any `rejected` rows with the reason. Send up to 10,000 records per call. Re-sending a record updates it.

### Channel 3 – CSV upload
On **ERP data**, download the entity's template, fill it from an ERP export, then click **Upload CSV**.

### Launching from inside the ERP (single sign-on)
Add a menu item to the ERP that signs a short-lived HS256 JWT with `ERP_SSO_SECRET` and opens the add-on:

```js
// in the ERP backend (Node example – any language with a JWT library works)
const token = jwt.sign({ email: user.email, name: user.fullName, role: 'preparer' }, process.env.ERP_SSO_SECRET, { expiresIn: '2m' });
redirect(`https://returns.yourbroker.ng/sso?token=${token}&next=/reports`);
```
Roles: `viewer`, `preparer`, `reviewer`, `approver`, `admin`. Users are created on first launch. The app hides its own sidebar when it is opened in an iframe or with `?embed=1`, so it can sit inside an ERP screen.

## After installing

1. **Settings › Company / PII & fidelity**: enter the licence number, RC, address, MD/CEO, compliance officer and the PII and fidelity guarantee policies.
2. **Settings › Thresholds / Commission caps / Due dates**: confirm against current NAICOM rules.
3. Sync the ERP data, then use **Settings › GL mapping** to map every GL account to a NAICOM financial-statement line. Accounts that carry a balance but have no mapping are flagged, and QR-01/QR-02 report them as errors.
4. Create users with distinct preparer, reviewer and approver roles for maker-checker.

## Adding or changing a return

Each return is one file in `server/src/reports/definitions/`. It exports `{ code, name, category, frequencies, description, run({ period, settings }) }`, and `run` returns `{ sections, validations }`. Sections are either tables (`table(...)`) or key/value lists (`kv(...)`). The UI, Excel/PDF export, workflow and calendar pick up a new file automatically.

## Security

- JWT auth, bcrypt passwords, rate-limited login, helmet headers, role-based access on every endpoint.
- The push API is protected by a constant-time API-key check. ERP SSO tokens are limited to 5 minutes.
- Use a read-only database user for the ERP connection.
- Snapshots are stored as immutable JSON per version, so what was approved is exactly what is exported.

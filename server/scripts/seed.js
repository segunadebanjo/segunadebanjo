// Loads realistic DEMO data (Jan 2025 - today) through the same ingest pipeline the ERP uses,
// so every return can be tried end-to-end before connecting a real ERP.
// Usage: npm run seed            (adds/updates demo data)
//        npm run seed -- --reset (clears all staging data first)
const { pool, query } = require('../src/db');
const { ingest } = require('../src/erp/upsert');
const { ENTITIES } = require('../src/erp/entities');
const { saveSetting, getSetting } = require('../src/lib/settings');
const { addDays, today } = require('../src/lib/periods');

let seed = 20250101;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const ri = (a, b) => Math.floor(a + rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const r2 = (n) => Math.round(n * 100) / 100;
const TODAY = today();
const START = '2025-01-01';
const pad = (n, w = 4) => String(n).padStart(w, '0');
const monthEnd = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

async function main() {
  if (process.argv.includes('--reset')) {
    for (const e of Object.values(ENTITIES)) await query(`DELETE FROM ${e.table}`);
    console.log('Staging tables cleared.');
  }

  // ---------- Reference data ----------
  const states = ['Lagos', 'FCT', 'Rivers', 'Kano', 'Oyo'];
  const branches = [
    { id: 'BR01', code: 'HO', name: 'Head Office - Victoria Island', state: 'Lagos', address: '12 Adeola Odeku Street, Victoria Island, Lagos', opened_on: '2010-03-01' },
    { id: 'BR02', code: 'ABJ', name: 'Abuja Branch', state: 'FCT', address: '5 Aminu Kano Crescent, Wuse II, Abuja', opened_on: '2014-06-01' },
    { id: 'BR03', code: 'PHC', name: 'Port Harcourt Branch', state: 'Rivers', address: '22 Aba Road, Port Harcourt', opened_on: '2017-09-01' },
  ];
  const insurers = [
    ['INS01', 'Alpha General Insurance Plc', 'non-life'], ['INS02', 'Crestline Assurance Ltd', 'composite'],
    ['INS03', 'Eko Mutual Insurance Plc', 'non-life'], ['INS04', 'Niger Delta Energy Insurance Ltd', 'non-life'],
    ['INS05', 'Harmony Life Assurance Ltd', 'life'], ['INS06', 'Sahel Insurance Company Plc', 'composite'],
    ['INS07', 'Atlantic Marine & General Ltd', 'non-life'], ['INS08', 'Unity Shield Insurance Plc', 'non-life'],
    ['INS09', 'Zenith Crown Life Ltd', 'life'], ['INS10', 'Kanem Takaful Insurance Ltd', 'takaful'],
  ].map(([id, name, insurer_type], i) => ({ id, code: id, name, insurer_type, naicom_reg_no: i === 9 ? '' : `RIC-${pad(100 + i * 7, 4)}` }));
  const classes = [
    ['CL01', 'Fire & Special Perils', 'FIRE', 20], ['CL02', 'Industrial All Risks', 'FIRE', 20], ['CL03', 'Motor Comprehensive', 'MOTOR', 12.5],
    ['CL04', 'Motor Third Party', 'MOTOR', 12.5], ['CL05', 'Burglary', 'GEN_ACCIDENT', 20], ['CL06', 'Goods in Transit', 'GEN_ACCIDENT', 20],
    ['CL07', 'Money Insurance', 'GEN_ACCIDENT', 20], ['CL08', 'Marine Cargo (Open Cover)', 'MARINE_CARGO', 20], ['CL09', 'Marine Hull', 'MARINE_HULL', 15],
    ['CL10', 'Contractors All Risks', 'ENGINEERING', 20], ['CL11', 'Plant All Risks', 'ENGINEERING', 20], ['CL12', 'Oil & Gas Package', 'OIL_GAS', 10],
    ['CL13', 'Advance Payment Bond', 'BOND', 20], ['CL14', 'Group Life Assurance', 'LIFE_GROUP', 9], ['CL15', 'Aviation Hull & Liability', 'AVIATION', 10],
    ['CL16', 'Employers Liability', 'GEN_ACCIDENT', 20], ['CL17', 'Health Insurance (HMO)', 'HEALTH', 10], ['CL18', 'Farm Produce Insurance', 'AGRIC', 20],
  ];
  const classRows = classes.map(([id, name, naicom_class]) => ({ id, code: id, name, naicom_class }));
  const classInfo = Object.fromEntries(classes.map(([id, , cls, rate]) => [id, { cls, rate }]));
  const classWeights = ['CL01', 'CL01', 'CL02', 'CL03', 'CL03', 'CL03', 'CL03', 'CL04', 'CL05', 'CL06', 'CL07', 'CL08', 'CL08', 'CL09', 'CL10', 'CL11', 'CL12', 'CL13', 'CL14', 'CL14', 'CL15', 'CL16', 'CL17', 'CL18'];
  const premRange = { FIRE: [300e3, 25e6], MOTOR: [40e3, 3e6], GEN_ACCIDENT: [80e3, 5e6], MARINE_CARGO: [150e3, 12e6], MARINE_HULL: [2e6, 40e6], ENGINEERING: [500e3, 20e6], OIL_GAS: [5e6, 90e6], BOND: [200e3, 8e6], LIFE_GROUP: [500e3, 15e6], AVIATION: [10e6, 60e6], HEALTH: [400e3, 10e6], AGRIC: [100e3, 3e6] };
  const insurerFor = (cls) => (cls.startsWith('LIFE') ? pick(['INS05', 'INS09', 'INS02', 'INS06']) : cls === 'OIL_GAS' ? pick(['INS04', 'INS01', 'INS07']) : pick(['INS01', 'INS01', 'INS02', 'INS03', 'INS03', 'INS04', 'INS06', 'INS07', 'INS08', 'INS08', 'INS10']));

  const sectors = ['Manufacturing', 'Oil & Gas', 'Banking & Finance', 'Telecoms', 'Retail', 'Construction', 'Agriculture', 'Logistics', 'Education', 'Hospitality', 'Public Sector', 'Healthcare'];
  const corpPrefix = ['Lekki', 'Ikeja', 'Benue', 'Ogun', 'Delta', 'Savannah', 'Coastal', 'Plateau', 'Sunrise', 'Greenfield', 'Bright', 'Royal', 'Prime', 'Kogi', 'Eagle', 'Palm', 'Cedar', 'Unity'];
  const corpSuffix = ['Industries Ltd', 'Foods Plc', 'Logistics Ltd', 'Petroleum Ltd', 'Hotels Ltd', 'Construction Co.', 'Pharma Ltd', 'Agro Allied Ltd', 'Microfinance Bank', 'Schools Ltd', 'Telecom Services Ltd', 'Steel Ltd'];
  const first = ['Adebayo', 'Chinedu', 'Fatima', 'Ngozi', 'Ibrahim', 'Oluwaseun', 'Aisha', 'Emeka', 'Funmilayo', 'Yusuf', 'Kemi', 'Tunde', 'Halima', 'Obinna', 'Bisi', 'Musa', 'Chiamaka', 'Segun'];
  const last = ['Okafor', 'Adeyemi', 'Bello', 'Eze', 'Abubakar', 'Olawale', 'Nwosu', 'Danjuma', 'Ogunleye', 'Ibekwe', 'Lawal', 'Okonkwo', 'Usman', 'Akinola'];
  const clients = [];
  for (let i = 1; i <= 160; i++) {
    const corp = rnd() < 0.7;
    const name = corp ? `${pick(corpPrefix)} ${pick(corpSuffix)}` + (rnd() < 0.3 ? ` ${i}` : '') : `${pick(first)} ${pick(last)}`;
    clients.push({ id: `C${pad(i)}`, code: `CL/${pad(i)}`, name, client_type: corp ? (rnd() < 0.08 ? 'government' : 'corporate') : 'individual',
      sector: corp ? pick(sectors) : 'Individual', state: pick(states), id_number: corp ? `RC${ri(100000, 1999999)}` : `${ri(22100000000, 22299999999)}`,
      tin: corp ? `${ri(10000000, 39999999)}-0001` : '', risk_rating: rnd() < 0.07 ? 'high' : rnd() < 0.25 ? 'medium' : 'low',
      is_pep: rnd() < 0.03 ? 1 : 0, kyc_complete: rnd() < 0.93 ? 1 : 0,
      onboarded_on: i <= 100 ? addDays('2018-01-01', ri(0, 2500)) : addDays(START, ri(0, 640)) });
  }
  const bankAccounts = [
    { id: 'BA1', bank_name: 'First Bank of Nigeria', account_no: '2034567891', account_name: 'Demo Brokers - Premium Collection', account_type: 'premium' },
    { id: 'BA2', bank_name: 'Zenith Bank', account_no: '1012345678', account_name: 'Demo Brokers - Premium Collection', account_type: 'premium' },
    { id: 'BA3', bank_name: 'Guaranty Trust Bank', account_no: '0123456789', account_name: 'Demo Brokers - Operations', account_type: 'operating' },
    { id: 'BA4', bank_name: 'Access Bank', account_no: '0698765432', account_name: 'Demo Brokers - Investment', account_type: 'investment' },
  ];

  // ---------- Placements, receipts, remittances ----------
  const placements = [], receipts = [], remittances = [];
  let dn = 1;
  for (let d = START; d <= addDays(TODAY, -3); d = addDays(d, 1)) {
    const dow = new Date(d + 'T00:00:00Z').getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const n = ri(1, 5);
    for (let k = 0; k < n; k++) {
      const clsId = pick(classWeights);
      const { cls, rate: cap } = classInfo[clsId];
      const [lo, hi] = premRange[cls];
      const gp = r2(lo + (hi - lo) * Math.pow(rnd(), 2.5));
      const rate = rnd() < 0.03 ? cap + pick([2.5, 5]) : rnd() < 0.7 ? cap : r2(cap * pick([0.5, 0.75, 0.8]));
      const comm = r2((gp * rate) / 100);
      const id = `DN${pad(dn, 6)}`;
      const inception = addDays(d, ri(-10, 20));
      const client = pick(clients);
      placements.push({ id, debit_note_no: `DN/${d.slice(0, 4)}/${pad(dn, 6)}`, policy_no: `P/${clsId}/${ri(100000, 999999)}`, client_id: client.id,
        insurer_id: insurerFor(cls), class_id: clsId, branch_id: pick(['BR01', 'BR01', 'BR01', 'BR02', 'BR03']),
        business_type: rnd() < 0.55 ? 'renewal' : 'new', placement_date: d, inception_date: inception, expiry_date: addDays(inception, 364),
        sum_insured: r2(gp * ri(40, 400)), gross_premium: gp, commission_rate: rate, commission_amount: comm, vat_on_commission: r2(comm * 0.075),
        currency: rnd() < 0.08 ? 'USD' : 'NGN', is_coinsurance: rnd() < 0.1 ? 1 : 0 });
      dn++;
      // Collection behaviour
      const u = rnd();
      const paid = u < 0.84 ? gp : u < 0.9 ? r2(gp * 0.5) : 0;
      if (!paid) continue;
      const rd = addDays(d, ri(0, 40));
      if (rd > TODAY) continue;
      receipts.push({ id: `RC-${id}`, receipt_no: `RCT/${pad(receipts.length + 1, 6)}`, placement_id: id, client_id: client.id, receipt_date: rd, amount: paid,
        payment_mode: pick(['transfer', 'transfer', 'transfer', 'cheque', 'pos', 'cash']), bank_account_id: pick(['BA1', 'BA1', 'BA2']) });
      const v = rnd();
      const delay = v < 0.84 ? ri(2, 26) : v < 0.94 ? ri(31, 75) : null; // ~6% never remitted
      if (delay === null) continue;
      const remDate = addDays(rd, delay);
      if (remDate > TODAY) continue;
      const commDed = r2((paid / gp) * comm);
      remittances.push({ id: `RM-${id}`, remittance_ref: `PAY/${pad(remittances.length + 1, 6)}`, placement_id: id, insurer_id: placements[placements.length - 1].insurer_id,
        remittance_date: remDate, gross_amount: paid, commission_deducted: commDed, net_amount: r2(paid - commDed) });
    }
  }

  // ---------- Claims ----------
  const claims = [];
  for (const p of placements) {
    if (rnd() > 0.07 || !['FIRE', 'MOTOR', 'GEN_ACCIDENT', 'MARINE_CARGO', 'ENGINEERING', 'LIFE_GROUP', 'HEALTH'].includes(classInfo[p.class_id].cls)) continue;
    const loss = addDays(p.inception_date, ri(5, 300));
    const notified = addDays(loss, ri(0, 12));
    if (notified > TODAY) continue;
    const claimed = r2(p.gross_premium * (0.3 + rnd() * 6));
    const age = (new Date(TODAY) - new Date(notified)) / 86400000;
    const u = rnd();
    let status = 'open', settled = null, amt = 0;
    if (age > 30) {
      if (u < (age > 150 ? 0.75 : 0.45)) { status = 'settled'; settled = addDays(notified, ri(20, Math.min(160, Math.floor(age)))); amt = r2(claimed * (0.6 + rnd() * 0.4)); }
      else if (u < (age > 150 ? 0.86 : 0.52)) { status = 'repudiated'; settled = addDays(notified, ri(15, Math.min(90, Math.floor(age)))); }
      else if (u < (age > 150 ? 0.9 : 0.55)) { status = 'withdrawn'; settled = addDays(notified, ri(10, Math.min(60, Math.floor(age)))); }
    }
    claims.push({ id: `CLM-${p.id}`, claim_no: `CLM/${notified.slice(0, 4)}/${pad(claims.length + 1, 5)}`, placement_id: p.id, client_id: p.client_id, insurer_id: p.insurer_id,
      class_id: p.class_id, loss_date: loss, notified_date: notified, submitted_to_insurer_date: rnd() < 0.05 ? null : addDays(notified, rnd() < 0.85 ? ri(0, 3) : ri(4, 10)),
      amount_claimed: claimed, amount_settled: amt, settled_date: settled, status, remarks: status === 'open' ? pick(['Awaiting adjuster report', 'Documents outstanding from insured', 'Under review by insurer', 'Discharge voucher issued']) : status === 'repudiated' ? 'Excluded peril' : '' });
  }

  // ---------- Complaints ----------
  const complaints = [];
  for (let i = 1; i <= 55; i++) {
    const rd = addDays(START, ri(0, Math.floor((new Date(TODAY) - new Date(START)) / 86400000)));
    const resolved = rnd() < 0.85 ? addDays(rd, ri(1, 30)) : null;
    const ok = resolved && resolved <= TODAY;
    complaints.push({ id: `CMP${pad(i)}`, ref_no: `CMP/${rd.slice(0, 4)}/${pad(i)}`, received_date: rd, complainant: pick(clients).name, client_id: pick(clients).id,
      insurer_id: pick(insurers).id, category: pick(['claims', 'claims', 'claims', 'premium', 'policy-docs', 'service', 'misconduct']), channel: pick(['email', 'walk-in', 'phone', 'letter', 'NAICOM referral']),
      description: pick(['Delay in claim settlement', 'Policy document not received', 'Premium refund on cancellation outstanding', 'Disagreement on claim quantum', 'Poor communication from account officer', 'Wrong sum insured on schedule']),
      status: ok ? 'resolved' : rnd() < 0.2 ? 'escalated' : 'open', resolved_date: ok ? resolved : null, resolution: ok ? 'Resolved with insurer; complainant satisfied' : '' });
  }

  // ---------- Staff & board ----------
  const designations = [['Managing Director/CEO', 'Executive', 1, 'FCIIN'], ['Executive Director, Technical', 'Technical', 1, 'FCIIN'], ['Head, Finance', 'Finance', 1, 'ACA'],
    ['Compliance Officer', 'Compliance', 1, 'ACIIN'], ['Head, Claims', 'Claims', 1, 'ACIIN'], ['Head, Marketing', 'Business Development', 1, 'ACIIN'],
    ['Internal Auditor', 'Audit', 1, 'ACA'], ['Branch Manager', 'Business Development', 1, 'ACIIN'], ['Branch Manager', 'Business Development', 1, 'ACIIN']];
  const staff = [];
  for (let i = 1; i <= 42; i++) {
    const d = designations[i - 1] || [pick(['Account Officer', 'Claims Officer', 'Underwriting Officer', 'Accountant', 'Customer Service Officer', 'Driver', 'IT Officer', 'Marketing Executive']),
      pick(['Technical', 'Claims', 'Finance', 'Business Development', 'Customer Service', 'Admin', 'IT']), 0, rnd() < 0.35 ? pick(['ACIIN', 'ACIIN', 'Dip CII', 'ACII']) : ''];
    const joined = addDays('2011-01-01', ri(0, 5300));
    staff.push({ id: `EMP${pad(i)}`, staff_no: `DIB/${pad(i, 3)}`, name: `${pick(first)} ${pick(last)}`, gender: rnd() < 0.5 ? 'Male' : 'Female', designation: d[0], department: d[1],
      branch_id: i === 8 ? 'BR02' : i === 9 ? 'BR03' : pick(['BR01', 'BR01', 'BR02', 'BR03']), qualification: pick(['B.Sc Insurance', 'B.Sc Accounting', 'HND Marketing', 'MBA', 'B.Sc Actuarial Science', 'OND']),
      professional_cert: d[3], is_key_officer: d[2], date_joined: joined > TODAY ? START : joined, date_exited: i > 9 && rnd() < 0.12 ? addDays(START, ri(30, 600)) : null });
  }
  const directors = [
    { id: 'D1', name: 'Chief Babatunde Alakija', role: 'both', designation: 'Chairman', nationality: 'Nigerian', shares_held: 18000000, pct_holding: 36, appointed_on: '2010-03-01' },
    { id: 'D2', name: staff[0].name, role: 'both', designation: 'Managing Director/CEO', nationality: 'Nigerian', shares_held: 12500000, pct_holding: 25, appointed_on: '2015-01-15' },
    { id: 'D3', name: staff[1].name, role: 'director', designation: 'Executive Director', nationality: 'Nigerian', appointed_on: '2019-07-01' },
    { id: 'D4', name: 'Mrs. Hadiza Abdullahi', role: 'director', designation: 'Independent Non-Executive Director', nationality: 'Nigerian', appointed_on: '2025-04-10' },
    { id: 'D5', name: 'Mr. Richard Mensah', role: 'director', designation: 'Non-Executive Director', nationality: 'Ghanaian', appointed_on: '2016-02-01', ceased_on: '2025-09-30' },
    { id: 'D6', name: 'Coastline Investments Ltd', role: 'shareholder', nationality: 'Nigerian', shares_held: 14500000, pct_holding: 29 },
    { id: 'D7', name: 'Staff Investment Trust', role: 'shareholder', nationality: 'Nigerian', shares_held: 5000000, pct_holding: 10 },
  ];

  // ---------- AML transactions ----------
  const aml = [];
  const byId = Object.fromEntries(clients.map((c) => [c.id, c]));
  for (const r of receipts) {
    const c = byId[r.client_id];
    const cash = r.payment_mode === 'cash';
    if (!cash && r.amount < 5e6 && c.risk_rating !== 'high') continue;
    const thr = c.client_type === 'individual' ? 5e6 : 10e6;
    const str = (c.risk_rating === 'high' || c.is_pep) && rnd() < 0.15;
    aml.push({ id: `AML-${r.id}`, client_id: r.client_id, txn_date: r.receipt_date, amount: r.amount, txn_type: 'premium', channel: r.payment_mode, is_cash: cash ? 1 : 0,
      ctr_filed: cash && r.amount >= thr && rnd() < 0.9 ? 1 : 0, str_filed: str ? 1 : 0, str_ref: str ? `NFIU/STR/${ri(10000, 99999)}` : '', str_filed_date: str ? addDays(r.receipt_date, ri(1, 5)) : null,
      notes: str ? pick(['Premium paid by unrelated third party', 'Unusual early cancellation with refund request', 'Inconsistent with client profile']) : '' });
  }

  // ---------- GL: chart of accounts and balanced month-end trial balances ----------
  const gl = [
    ['GL1001', '1001', 'Cash at bank - GTB operations', 'asset', 'CASH'], ['GL1002', '1002', 'Cash at bank - premium collection accounts', 'asset', 'CLIENT_CASH'],
    ['GL1101', '1101', 'Fixed deposits / treasury bills', 'asset', 'INVESTMENTS'], ['GL1201', '1201', 'Commission receivable', 'asset', 'COMMISSION_RECEIVABLE'],
    ['GL1301', '1301', 'Prepayments and staff loans', 'asset', 'OTHER_RECEIVABLES'], ['GL1501', '1501', 'Property, plant & equipment (NBV)', 'asset', 'PPE'],
    ['GL2001', '2001', 'Premium payable to underwriters', 'liability', 'PREMIUM_PAYABLE'], ['GL2101', '2101', 'Accruals and other payables', 'liability', 'OTHER_PAYABLES'],
    ['GL2201', '2201', 'Company income tax payable', 'liability', 'CURRENT_TAX'], ['GL3001', '3001', 'Ordinary share capital', 'equity', 'SHARE_CAPITAL'],
    ['GL3101', '3101', 'Retained earnings', 'equity', 'RETAINED_EARNINGS'], ['GL4001', '4001', 'Brokerage commission', 'income', 'COMMISSION_INCOME'],
    ['GL4101', '4101', 'Risk management & consultancy fees', 'income', 'FEE_INCOME'], ['GL4201', '4201', 'Interest on fixed deposits', 'income', 'INVESTMENT_INCOME'],
    ['GL5001', '5001', 'Salaries and wages', 'expense', 'STAFF_COSTS'], ['GL5101', '5101', 'Depreciation', 'expense', 'DEPRECIATION'],
    ['GL5201', '5201', 'Rent, utilities and office expenses', 'expense', 'ADMIN_EXPENSES'], ['GL5202', '5202', 'NAICOM levy & professional fees', 'expense', 'ADMIN_EXPENSES'],
    ['GL5301', '5301', 'Income tax expense', 'expense', 'INCOME_TAX'], ['GL5901', '5901', 'Suspense account', 'expense', null],
  ];
  const glAccounts = gl.map(([id, code, name, account_type, fs_line]) => ({ id, code, name, account_type, ...(fs_line ? { fs_line } : {}) }));
  const bal = { GL1001: 55e6, GL1002: 5e6, GL1101: 30e6, GL1501: 25e6, GL2101: -25e6, GL3001: -50e6, GL3101: -40e6 };
  const plAcc = gl.filter((g) => ['income', 'expense'].includes(g[3])).map((g) => g[0]);
  const glBalances = [], bankBalances = [];
  const monthKey = (d) => d.slice(0, 7);
  const sumBy = (arr, dateKey, valFn) => arr.reduce((m, x) => { const k = monthKey(x[dateKey]); m[k] = (m[k] || 0) + valFn(x); return m; }, {});
  const commM = sumBy(placements, 'placement_date', (p) => p.commission_amount);
  const recM = sumBy(receipts, 'receipt_date', (r) => r.amount);
  const remM = sumBy(remittances, 'remittance_date', (r) => r.gross_amount);
  const remCommM = sumBy(remittances, 'remittance_date', (r) => r.commission_deducted);
  const [ty, tm] = TODAY.split('-').map(Number);
  for (let y = 2025; y <= ty; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === ty && m >= tm) break; // only closed months
      if (m === 1 && y > 2025) { // close prior year P&L to retained earnings
        const profit = plAcc.reduce((s, a) => s + (bal[a] || 0), 0);
        bal.GL3101 = r2((bal.GL3101 || 0) + profit);
        plAcc.forEach((a) => { bal[a] = 0; });
      }
      const k = `${y}-${String(m).padStart(2, '0')}`;
      const mv = {};
      const post = (dr, cr, amt) => { amt = r2(amt); if (!amt) return; mv[dr] = (mv[dr] || 0) + amt; mv[cr] = (mv[cr] || 0) - amt; };
      post('GL1201', 'GL4001', commM[k] || 0);                 // commission earned
      post('GL1002', 'GL2001', recM[k] || 0);                  // premium received into client account
      post('GL2001', 'GL1002', remM[k] || 0);                  // premium settled to insurers
      post('GL1001', 'GL1201', remCommM[k] || 0);              // commission retained -> operating account
      post('GL1001', 'GL4101', ri(3, 9) * 1e5);                // fee income
      post('GL1001', 'GL4201', 0.009 * 30e6 + ri(0, 50000));   // interest
      post('GL5001', 'GL1001', 7.2e6 + ri(0, 9e5));            // salaries
      post('GL5101', 'GL1501', 4.2e5);                         // depreciation
      post('GL5201', 'GL1001', 2.6e6 + ri(0, 1.2e6));          // admin
      post('GL5202', 'GL2101', 3.5e5);                         // levy accrual
      if (m % 3 === 0) post('GL2101', 'GL1001', 1.05e6);       // pay accruals quarterly
      const pbt = -['GL4001', 'GL4101', 'GL4201'].reduce((s, a) => s + (mv[a] || 0), 0) - ['GL5001', 'GL5101', 'GL5201', 'GL5202'].reduce((s, a) => s + (mv[a] || 0), 0);
      if (pbt > 0) post('GL5301', 'GL2201', pbt * 0.3);       // tax provision
      if (m === 6) post('GL2201', 'GL1001', Math.max(0, -(bal.GL2201 || 0) * 0.8)); // pay CIT
      for (const a of Object.keys(mv)) bal[a] = r2((bal[a] || 0) + mv[a]);
      const pe = monthEnd(y, m);
      for (const g of gl) glBalances.push({ gl_account_id: g[0], period_end: pe, closing_balance: bal[g[0]] || 0, period_movement: mv[g[0]] || 0 });
      // Bank reconciliations
      const cc = bal.GL1002 || 0;
      const diff = rnd() < 0.12 ? ri(-250000, 250000) : 0;
      bankBalances.push({ bank_account_id: 'BA1', as_at: pe, ledger_balance: r2(cc * 0.65), bank_balance: r2(cc * 0.65 + diff) });
      bankBalances.push({ bank_account_id: 'BA2', as_at: pe, ledger_balance: r2(cc * 0.35), bank_balance: r2(cc * 0.35) });
      bankBalances.push({ bank_account_id: 'BA3', as_at: pe, ledger_balance: bal.GL1001, bank_balance: bal.GL1001 });
      bankBalances.push({ bank_account_id: 'BA4', as_at: pe, ledger_balance: bal.GL1101, bank_balance: bal.GL1101 });
    }
  }

  // ---------- Push through the ingest pipeline ----------
  const load = async (entity, rows) => {
    const r = await ingest('api', entity, rows, null);
    console.log(`${entity.padEnd(20)} received ${String(r.received).padStart(6)}  upserted ${String(r.upserted).padStart(6)}  rejected ${r.rejected.length}`);
  };
  await load('branches', branches);
  await load('insurers', insurers);
  await load('classes', classRows);
  await load('clients', clients);
  await load('bank_accounts', bankAccounts);
  await load('placements', placements);
  await load('premium_receipts', receipts);
  await load('premium_remittances', remittances);
  await load('claims', claims);
  await load('complaints', complaints);
  await load('staff', staff);
  await load('directors', directors);
  await load('aml_transactions', aml);
  await load('gl_accounts', glAccounts);
  await load('gl_balances', glBalances);
  await load('bank_balances', bankBalances);

  const company = await getSetting('company');
  if (!company.naicomLicenseNo) {
    await saveSetting('company', { ...company, name: 'Demo Insurance Brokers Ltd', naicomLicenseNo: 'NAICOM/IB/0000-DEMO', licenseExpiry: '2026-12-31',
      rcNumber: 'RC 000000', tin: '00000000-0001', address: '12 Adeola Odeku Street, Victoria Island, Lagos', email: 'compliance@demo-brokers.example',
      phone: '+234 1 000 0000', complianceOfficer: staff[3].name, mdCeo: staff[0].name });
    await saveSetting('insurance', { piiInsurer: 'Alpha General Insurance Plc', piiPolicyNo: 'PI/2026/00123', piiLimit: 50000000, piiExpiry: '2026-12-31',
      fidelityInsurer: 'Eko Mutual Insurance Plc', fidelityPolicyNo: 'FG/2026/00456', fidelityLimit: 20000000, fidelityExpiry: '2026-12-31' });
  }
  console.log('Demo data loaded.');
}

main().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });

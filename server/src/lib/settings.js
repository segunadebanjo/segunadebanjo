const { query } = require('../db');

// Defaults. Every value can be changed from Settings in the UI.
// IMPORTANT: regulatory thresholds below are configurable defaults and must be
// confirmed against the current NAICOM guidelines / NIIRA 2025 by the compliance officer.
const DEFAULTS = {
  company: {
    name: 'Demo Insurance Brokers Ltd',
    naicomLicenseNo: '',
    licenseExpiry: '',
    rcNumber: '',
    tin: '',
    address: '',
    email: '',
    phone: '',
    complianceOfficer: '',
    mdCeo: '',
    financialYearEndMonth: 12,
  },
  compliance: {
    remittanceDays: 30,               // max days between receipt from client and remittance to insurer
    minimumCapital: 5000000,          // NGN - minimum paid-up capital for brokers (verify current figure)
    piiMinimumCover: 0,               // NGN - minimum professional indemnity cover (0 = not checked)
    cashCtrThreshold: 5000000,        // NGN - cash transaction reporting threshold (individual)
    corporateCtrThreshold: 10000000,  // NGN - cash transaction reporting threshold (corporate)
    complaintResolutionDays: 14,
    claimsSubmissionDays: 3,          // days for broker to forward a claim notice to the insurer
  },
  // Max brokerage commission (%) per NAICOM class. Verify against current NAICOM market guidelines.
  commissionCaps: {
    FIRE: 20, MOTOR: 12.5, GEN_ACCIDENT: 20, ENGINEERING: 20, MARINE_CARGO: 20, MARINE_HULL: 15,
    AVIATION: 10, OIL_GAS: 10, BOND: 20, AGRIC: 20, MISC: 20, LIFE_GROUP: 9, LIFE_INDIVIDUAL: 9, HEALTH: 10,
  },
  insurance: {
    piiInsurer: '', piiPolicyNo: '', piiLimit: 0, piiExpiry: '',
    fidelityInsurer: '', fidelityPolicyNo: '', fidelityLimit: 0, fidelityExpiry: '',
  },
  // Days after period end that a return is due. Override per report code.
  dueDays: { quarterly: 30, 'half-yearly': 45, monthly: 15, annual: 181 },
  reportDueOverrides: {},
};

async function getSetting(key) {
  const rows = await query('SELECT `value` FROM settings WHERE `key`=?', [key]);
  const def = DEFAULTS[key];
  if (!rows.length) return def;
  const val = JSON.parse(rows[0].value);
  return def && typeof def === 'object' && !Array.isArray(def) ? { ...def, ...val } : val;
}

async function getAllSettings() {
  const out = {};
  for (const k of Object.keys(DEFAULTS)) out[k] = await getSetting(k);
  return out;
}

async function saveSetting(key, value, userId) {
  if (!(key in DEFAULTS)) throw Object.assign(new Error(`Unknown setting ${key}`), { status: 400 });
  await query(
    'INSERT INTO settings (`key`,`value`,updated_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), updated_by=VALUES(updated_by)',
    [key, JSON.stringify(value), userId || null]
  );
}

module.exports = { DEFAULTS, getSetting, getAllSettings, saveSetting };

const fs = require('fs');
const path = require('path');
const { getAllSettings } = require('../lib/settings');
const { resolvePeriod, addDays } = require('../lib/periods');

const dir = path.join(__dirname, 'definitions');
const REPORTS = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort()
  .map((f) => require(path.join(dir, f)))
  .sort((a, b) => a.code.localeCompare(b.code));
const BY_CODE = Object.fromEntries(REPORTS.map((r) => [r.code, r]));

function catalog() {
  return REPORTS.map(({ code, name, category, frequencies, description }) => ({ code, name, category, frequencies, description }));
}

function dueDate(report, period, settings) {
  const days = settings.reportDueOverrides?.[report.code]?.[period.frequency] ?? settings.dueDays?.[period.frequency] ?? 30;
  return addDays(period.end, Number(days));
}

async function generate(code, { frequency, year, index }) {
  const report = BY_CODE[code];
  if (!report) throw Object.assign(new Error(`Unknown report ${code}`), { status: 404 });
  const freq = frequency || report.frequencies[0];
  if (!report.frequencies.includes(freq)) throw Object.assign(new Error(`${code} is not available ${freq}`), { status: 400 });
  const period = resolvePeriod(freq, year, index);
  const settings = await getAllSettings();
  const result = await report.run({ period, settings });
  const counts = { error: 0, warning: 0, info: 0 };
  result.validations.forEach((x) => { counts[x.level]++; });
  return {
    code: report.code, name: report.name, category: report.category,
    period, dueDate: dueDate(report, period, settings),
    company: { name: settings.company.name, naicomLicenseNo: settings.company.naicomLicenseNo, rcNumber: settings.company.rcNumber, address: settings.company.address },
    generatedAt: new Date().toISOString(),
    sections: result.sections,
    validations: result.validations,
    counts,
  };
}

module.exports = { REPORTS, BY_CODE, catalog, generate, dueDate };

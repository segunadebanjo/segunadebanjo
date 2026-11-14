// Period helpers. All dates handled as 'YYYY-MM-DD' strings in UTC to avoid TZ drift.
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-based

function resolvePeriod(frequency, year, index) {
  year = Number(year);
  index = Number(index || 1);
  if (!year || year < 2000 || year > 2100) throw Object.assign(new Error('Invalid year'), { status: 400 });
  if (frequency === 'quarterly') {
    if (index < 1 || index > 4) throw Object.assign(new Error('Quarter must be 1-4'), { status: 400 });
    const m1 = (index - 1) * 3 + 1, m3 = m1 + 2;
    return { frequency, year, index, label: `Q${index} ${year}`,
      start: `${year}-${pad(m1)}-01`, end: `${year}-${pad(m3)}-${lastDay(year, m3)}` };
  }
  if (frequency === 'monthly') {
    if (index < 1 || index > 12) throw Object.assign(new Error('Month must be 1-12'), { status: 400 });
    const name = new Date(Date.UTC(year, index - 1, 1)).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
    return { frequency, year, index, label: `${name} ${year}`,
      start: `${year}-${pad(index)}-01`, end: `${year}-${pad(index)}-${lastDay(year, index)}` };
  }
  if (frequency === 'half-yearly') {
    if (index < 1 || index > 2) throw Object.assign(new Error('Half must be 1-2'), { status: 400 });
    return { frequency, year, index, label: `H${index} ${year}`,
      start: index === 1 ? `${year}-01-01` : `${year}-07-01`, end: index === 1 ? `${year}-06-30` : `${year}-12-31` };
  }
  if (frequency === 'annual') {
    return { frequency, year, index: 1, label: `FY ${year}`, start: `${year}-01-01`, end: `${year}-12-31` };
  }
  throw Object.assign(new Error(`Unknown frequency ${frequency}`), { status: 400 });
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}
function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}
function today() { return iso(new Date()); }
function startOfYear(dateStr) { return dateStr.slice(0, 4) + '-01-01'; }

module.exports = { resolvePeriod, addDays, daysBetween, today, iso, startOfYear };

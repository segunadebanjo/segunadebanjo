const { pool, query } = require('../db');
const { ENTITIES } = require('./entities');

function normDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // DD/MM/YYYY (Nigerian convention)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return undefined; // invalid
}
function normValue(type, v) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  switch (type) {
    case 'n': { const n = Number(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : undefined; }
    case 'b': return ['1', 'true', 'yes', 'y', 't'].includes(String(v).toLowerCase()) ? 1 : 0;
    case 'd': return normDate(v);
    default: return String(v).trim();
  }
}

/** Validate + normalise raw records. Returns { valid, rejected:[{row, error}] } */
function prepare(entityName, records) {
  const spec = ENTITIES[entityName];
  if (!spec) throw Object.assign(new Error(`Unknown entity '${entityName}'`), { status: 400 });
  const valid = [], rejected = [];
  records.forEach((raw, i) => {
    const row = {};
    let error = null;
    for (const [col, type] of Object.entries(spec.columns)) {
      const v = normValue(type, raw[col]);
      if (v === undefined && raw[col] !== undefined) { error = `Invalid ${type === 'd' ? 'date' : 'number'} in '${col}'`; break; }
      if (v !== undefined) row[col] = v;
    }
    if (!error && spec.keyFrom && !row.id) row.id = spec.keyFrom(row);
    if (!error) {
      const missing = spec.required.filter((c) => row[c] === undefined || row[c] === null || row[c] === '');
      if (missing.length) error = `Missing required: ${missing.join(', ')}`;
    }
    if (error) rejected.push({ row: i + 1, id: raw.id, error });
    else valid.push(row);
  });
  return { valid, rejected };
}

/** Bulk upsert in chunks. Columns absent from the payload keep their stored values. */
async function upsert(entityName, rows) {
  const spec = ENTITIES[entityName];
  let count = 0;
  // Group rows by their column set so partial payloads don't null out other columns.
  const groups = new Map();
  for (const r of rows) {
    const key = Object.keys(r).sort().join(',');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  for (const [key, grp] of groups) {
    const cols = key.split(',');
    const updates = cols.filter((c) => c !== 'id').map((c) =>
      (spec.preserveOnUpdate || []).includes(c)
        ? `\`${c}\`=COALESCE(\`${c}\`, VALUES(\`${c}\`))`
        : `\`${c}\`=VALUES(\`${c}\`)`);
    for (let i = 0; i < grp.length; i += 500) {
      const chunk = grp.slice(i, i + 500);
      const sql = `INSERT INTO ${spec.table} (${cols.map((c) => `\`${c}\``).join(',')}) VALUES ?` +
        (updates.length ? ` ON DUPLICATE KEY UPDATE ${updates.join(',')}` : ' ON DUPLICATE KEY UPDATE id=id');
      await pool.query(sql, [chunk.map((r) => cols.map((c) => r[c]))]);
      count += chunk.length;
    }
  }
  return count;
}

async function logSync(source, entity, userId) {
  const r = await query("INSERT INTO sync_logs (source, entity, status, started_at, user_id) VALUES (?,?,'running',NOW(),?)",
    [source, entity, userId || null]);
  return r.insertId;
}
async function finishSync(id, status, stats, message) {
  await query('UPDATE sync_logs SET status=?, records_in=?, records_upserted=?, rejected=?, message=?, finished_at=NOW() WHERE id=?',
    [status, stats.records_in || 0, stats.upserted || 0, stats.rejected || 0, message ? String(message).slice(0, 4000) : null, id]);
}

/** Full pipeline used by API and CSV channels. */
async function ingest(source, entityName, records, userId) {
  const logId = await logSync(source, entityName, userId);
  try {
    const { valid, rejected } = prepare(entityName, records);
    const upserted = valid.length ? await upsert(entityName, valid) : 0;
    const msg = rejected.length ? JSON.stringify(rejected.slice(0, 50)) : null;
    await finishSync(logId, rejected.length && !valid.length ? 'failed' : 'success',
      { records_in: records.length, upserted, rejected: rejected.length }, msg);
    return { entity: entityName, received: records.length, upserted, rejected };
  } catch (e) {
    await finishSync(logId, 'failed', { records_in: records.length }, e.message);
    throw e;
  }
}

module.exports = { prepare, upsert, ingest, logSync, finishSync };

// Direct database pull from the existing ERP.
// The SQL for each entity lives in server/config/erp-mapping.js so that it can be
// adapted to any ERP schema without touching application code.
const path = require('path');
const fs = require('fs');
const { getErpPool, query } = require('../db');
const { ENTITY_ORDER } = require('./entities');
const { prepare, upsert, logSync, finishSync } = require('./upsert');

function loadMapping() {
  const custom = path.join(__dirname, '..', '..', 'config', 'erp-mapping.js');
  const example = path.join(__dirname, '..', '..', 'config', 'erp-mapping.example.js');
  const file = fs.existsSync(custom) ? custom : example;
  delete require.cache[require.resolve(file)];
  return { file: path.basename(file), mapping: require(file) };
}

async function lastSuccess(entity) {
  const r = await query("SELECT MAX(started_at) AS t FROM sync_logs WHERE entity=? AND source='erp_db' AND status='success'", [entity]);
  return r[0].t ? new Date(r[0].t.replace(' ', 'T') + 'Z') : null;
}

/**
 * Pull entities from the ERP database. Each mapping entry:
 *   { sql: 'SELECT ... WHERE updated_at >= :since', incremental: true }
 * ':since' receives the last successful sync time (minus a 1 day safety overlap)
 * or 1970-01-01 for a full load.
 */
async function syncFromErp({ entities, full = false, userId } = {}) {
  const erp = getErpPool();
  if (!erp) throw Object.assign(new Error('ERP database connection not configured (set ERP_DB_* in .env)'), { status: 400 });
  const { mapping } = loadMapping();
  const list = (entities && entities.length ? entities : ENTITY_ORDER).filter((e) => mapping[e]?.sql);
  const results = [];
  for (const entity of list) {
    const m = mapping[entity];
    const logId = await logSync('erp_db', entity, userId);
    try {
      let since = new Date('1970-01-01T00:00:00Z');
      if (!full && m.incremental) {
        const last = await lastSuccess(entity);
        if (last) since = new Date(last.getTime() - 86400000);
      }
      const [rows] = await erp.query(m.sql, { since: since.toISOString().slice(0, 19).replace('T', ' ') });
      const { valid, rejected } = prepare(entity, rows);
      const upserted = valid.length ? await upsert(entity, valid) : 0;
      await finishSync(logId, 'success', { records_in: rows.length, upserted, rejected: rejected.length },
        rejected.length ? JSON.stringify(rejected.slice(0, 50)) : null);
      results.push({ entity, received: rows.length, upserted, rejected: rejected.length });
    } catch (e) {
      await finishSync(logId, 'failed', {}, e.message);
      results.push({ entity, error: e.message });
    }
  }
  return results;
}

async function testErpConnection() {
  const erp = getErpPool();
  if (!erp) return { configured: false };
  try {
    await erp.query('SELECT 1');
    return { configured: true, ok: true, mappingFile: loadMapping().file };
  } catch (e) {
    return { configured: true, ok: false, error: e.message };
  }
}

module.exports = { syncFromErp, testErpConnection, loadMapping };

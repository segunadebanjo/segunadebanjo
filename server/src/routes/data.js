// ERP data integration: status, direct DB pull, CSV upload, browsing synced data.
const router = require('express').Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { ENTITIES, ENTITY_ORDER } = require('../erp/entities');
const { ingest } = require('../erp/upsert');
const { syncFromErp, testErpConnection } = require('../erp/connector');
const { audit } = require('../lib/audit');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.get('/entities', (req, res) => res.json(ENTITY_ORDER.map((k) => ({
  key: k, label: ENTITIES[k].label, columns: Object.keys(ENTITIES[k].columns), required: ENTITIES[k].required,
}))));

router.get('/status', async (req, res) => {
  const out = [];
  for (const k of ENTITY_ORDER) {
    const [{ n }] = await query(`SELECT COUNT(*) n FROM ${ENTITIES[k].table}`);
    const [last] = await query(`SELECT source, status, finished_at, records_upserted, rejected FROM sync_logs WHERE entity=? ORDER BY id DESC LIMIT 1`, [k]);
    out.push({ key: k, label: ENTITIES[k].label, records: n, last: last || null });
  }
  res.json({ entities: out, erp: await testErpConnection() });
});

router.get('/logs', async (req, res) => {
  res.json(await query(`SELECT l.*, u.name AS user_name FROM sync_logs l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.id DESC LIMIT 200`));
});

router.post('/sync', requireRole('preparer'), async (req, res) => {
  const results = await syncFromErp({ entities: req.body?.entities, full: !!req.body?.full, userId: req.user.id });
  await audit(req, 'erp_sync', 'erp', null, { results });
  res.json({ results });
});

router.get('/template/:entity', (req, res) => {
  const spec = ENTITIES[req.params.entity];
  if (!spec) return res.status(404).json({ error: 'Unknown entity' });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.entity}_template.csv"`);
  res.send(Object.keys(spec.columns).join(',') + '\n');
});

router.post('/upload/:entity', requireRole('preparer'), upload.single('file'), async (req, res) => {
  if (!ENTITIES[req.params.entity]) return res.status(404).json({ error: 'Unknown entity' });
  if (!req.file) return res.status(400).json({ error: 'Attach a CSV file in field "file"' });
  let records;
  try {
    records = parse(req.file.buffer.toString('utf8').replace(/^﻿/, ''), { columns: (h) => h.map((x) => x.trim().toLowerCase()), skip_empty_lines: true, trim: true });
  } catch (e) {
    return res.status(400).json({ error: `CSV parse error: ${e.message}` });
  }
  const result = await ingest('csv', req.params.entity, records, req.user.id);
  await audit(req, 'csv_upload', 'entity', req.params.entity, { file: req.file.originalname, received: result.received, upserted: result.upserted, rejected: result.rejected.length });
  res.json(result);
});

router.get('/browse/:entity', async (req, res) => {
  const spec = ENTITIES[req.params.entity];
  if (!spec) return res.status(404).json({ error: 'Unknown entity' });
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const cols = Object.keys(spec.columns);
  let where = '', p = [];
  if (req.query.q) {
    const textCols = cols.filter((c) => spec.columns[c] === 's').slice(0, 6);
    where = 'WHERE ' + textCols.map((c) => `\`${c}\` LIKE ?`).join(' OR ');
    p = textCols.map(() => `%${req.query.q}%`);
  }
  const [{ n }] = await query(`SELECT COUNT(*) n FROM ${spec.table} ${where}`, p);
  const rows = await query(`SELECT ${cols.map((c) => `\`${c}\``).join(',')} FROM ${spec.table} ${where} ORDER BY synced_at DESC, id LIMIT ${limit} OFFSET ${offset}`, p);
  res.json({ total: n, columns: cols, rows });
});

module.exports = router;

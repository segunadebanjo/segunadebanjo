// Push API for the host ERP: POST /api/ingest/:entity with header x-api-key.
// Body: { "records": [ {...}, ... ] } or a bare array. Max 10,000 records per call.
const router = require('express').Router();
const { ingest } = require('../erp/upsert');
const { ENTITIES } = require('../erp/entities');

router.post('/:entity', async (req, res) => {
  if (!ENTITIES[req.params.entity]) return res.status(404).json({ error: `Unknown entity. Valid: ${Object.keys(ENTITIES).join(', ')}` });
  const records = Array.isArray(req.body) ? req.body : req.body?.records;
  if (!Array.isArray(records)) return res.status(400).json({ error: 'Body must be an array or { records: [...] }' });
  if (records.length > 10000) return res.status(413).json({ error: 'Max 10,000 records per request' });
  const result = await ingest('api', req.params.entity, records, null);
  res.status(result.rejected.length && !result.upserted ? 422 : 200).json(result);
});

module.exports = router;

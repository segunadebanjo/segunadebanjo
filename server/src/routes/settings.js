const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { getAllSettings, saveSetting, DEFAULTS } = require('../lib/settings');
const { FS_LINES } = require('../reports/fsLines');
const { NAICOM_CLASSES } = require('../reports/classes');
const { audit } = require('../lib/audit');

router.get('/', async (req, res) => res.json(await getAllSettings()));
router.get('/meta', (req, res) => res.json({ fsLines: FS_LINES, naicomClasses: NAICOM_CLASSES, keys: Object.keys(DEFAULTS) }));

router.put('/:key', requireRole('admin'), async (req, res) => {
  await saveSetting(req.params.key, req.body, req.user.id);
  await audit(req, 'settings_updated', 'settings', req.params.key, req.body);
  res.json({ ok: true });
});

router.get('/gl-mapping', async (req, res) => {
  res.json(await query(`SELECT a.id, a.code, a.name, a.account_type, a.fs_line,
      (SELECT b.closing_balance FROM stg_gl_balances b WHERE b.gl_account_id=a.id ORDER BY b.period_end DESC LIMIT 1) AS latest_balance
    FROM stg_gl_accounts a ORDER BY a.code`));
});

router.put('/gl-mapping', requireRole('admin'), async (req, res) => {
  const valid = new Set(FS_LINES.map((l) => l.code));
  const maps = Array.isArray(req.body?.mappings) ? req.body.mappings : [];
  for (const m of maps) {
    if (m.fs_line && !valid.has(m.fs_line)) return res.status(400).json({ error: `Invalid line ${m.fs_line}` });
    await query('UPDATE stg_gl_accounts SET fs_line=? WHERE id=?', [m.fs_line || null, m.id]);
  }
  await audit(req, 'gl_mapping_updated', 'gl_accounts', null, { count: maps.length });
  res.json({ ok: true, updated: maps.length });
});

// Classes of business -> NAICOM class mapping
router.get('/class-mapping', async (req, res) => res.json(await query('SELECT id, code, name, naicom_class FROM stg_classes ORDER BY name')));
router.put('/class-mapping', requireRole('admin'), async (req, res) => {
  const valid = new Set(NAICOM_CLASSES.map((c) => c.code));
  const maps = Array.isArray(req.body?.mappings) ? req.body.mappings : [];
  for (const m of maps) {
    if (!valid.has(m.naicom_class)) return res.status(400).json({ error: `Invalid NAICOM class ${m.naicom_class}` });
    await query('UPDATE stg_classes SET naicom_class=? WHERE id=?', [m.naicom_class, m.id]);
  }
  await audit(req, 'class_mapping_updated', 'classes', null, { count: maps.length });
  res.json({ ok: true });
});

module.exports = router;

const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { catalog, generate } = require('../reports/registry');
const { toExcel } = require('../export/excel');
const { toPdf } = require('../export/pdf');
const { audit } = require('../lib/audit');

const periodArgs = (src) => ({ frequency: src.frequency, year: src.year, index: src.index });

router.get('/catalog', (req, res) => res.json(catalog()));

// Preview without saving
router.post('/:code/preview', async (req, res) => {
  res.json(await generate(req.params.code, periodArgs(req.body || {})));
});

async function sendExport(res, out, run, format) {
  const base = `${out.code}_${out.period.label.replace(/\s+/g, '_')}${run ? `_v${run.version}` : '_preview'}`;
  if (format === 'xlsx') {
    const buf = await toExcel(out, run);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.xlsx"`);
    return res.send(Buffer.from(buf));
  }
  if (format === 'pdf') {
    const buf = await toPdf(out, run);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.pdf"`);
    return res.send(buf);
  }
  if (format === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="${base}.json"`);
    return res.json(out);
  }
  res.status(400).json({ error: 'Format must be xlsx, pdf or json' });
}

router.get('/:code/export/:format', async (req, res) => {
  const out = await generate(req.params.code, periodArgs(req.query));
  await audit(req, 'report_exported_preview', 'report', req.params.code, { period: out.period.label, format: req.params.format });
  await sendExport(res, out, null, req.params.format);
});

// Generate and save a versioned run (maker step)
router.post('/:code/runs', requireRole('preparer'), async (req, res) => {
  const out = await generate(req.params.code, periodArgs(req.body || {}));
  const [{ v }] = await query('SELECT COALESCE(MAX(version),0)+1 AS v FROM report_runs WHERE report_code=? AND period_start=? AND period_end=?',
    [out.code, out.period.start, out.period.end]);
  const r = await query(
    `INSERT INTO report_runs (report_code, report_name, frequency, period_label, period_start, period_end, version, status, output,
       error_count, warning_count, notes, generated_by, generated_at) VALUES (?,?,?,?,?,?,?, 'draft', ?,?,?,?,?, NOW())`,
    [out.code, out.name, out.period.frequency, out.period.label, out.period.start, out.period.end, v, JSON.stringify(out),
      out.counts.error, out.counts.warning, req.body?.notes || null, req.user.id]);
  await audit(req, 'report_generated', 'report_run', r.insertId, { code: out.code, period: out.period.label, version: v });
  res.status(201).json({ id: r.insertId, version: v });
});

const RUN_SELECT = `SELECT r.id, r.report_code, r.report_name, r.frequency, r.period_label, r.period_start, r.period_end, r.version, r.status,
  r.error_count, r.warning_count, r.notes, r.generated_at, r.reviewed_at, r.approved_at, r.submitted_at, r.submission_ref,
  r.generated_by, r.reviewed_by, r.approved_by, r.submitted_by,
  g.name AS generated_by_name, rv.name AS reviewed_by_name, ap.name AS approved_by_name, sb.name AS submitted_by_name
  FROM report_runs r LEFT JOIN users g ON g.id=r.generated_by LEFT JOIN users rv ON rv.id=r.reviewed_by
  LEFT JOIN users ap ON ap.id=r.approved_by LEFT JOIN users sb ON sb.id=r.submitted_by`;

router.get('/runs', async (req, res) => {
  const where = [], p = [];
  if (req.query.code) { where.push('r.report_code=?'); p.push(req.query.code); }
  if (req.query.status) { where.push('r.status=?'); p.push(req.query.status); }
  if (req.query.year) { where.push('YEAR(r.period_end)=?'); p.push(Number(req.query.year)); }
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  res.json(await query(`${RUN_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.generated_at DESC, r.id DESC LIMIT ${limit}`, p));
});

async function loadRun(id) {
  const [run] = await query(`${RUN_SELECT.replace('SELECT r.id,', 'SELECT r.output, r.id,')} WHERE r.id=?`, [id]);
  if (!run) throw Object.assign(new Error('Report run not found'), { status: 404 });
  run.output = JSON.parse(run.output);
  return run;
}

router.get('/runs/:id', async (req, res) => res.json(await loadRun(req.params.id)));

router.get('/runs/:id/export/:format', async (req, res) => {
  const run = await loadRun(req.params.id);
  await audit(req, 'report_exported', 'report_run', run.id, { format: req.params.format });
  await sendExport(res, run.output, run, req.params.format);
});

// Maker-checker workflow: draft -> reviewed -> approved -> submitted (or rejected back)
const TRANSITIONS = {
  review: { from: ['draft'], to: 'reviewed', role: 'reviewer', set: 'reviewed_by=?, reviewed_at=NOW()' },
  approve: { from: ['reviewed'], to: 'approved', role: 'approver', set: 'approved_by=?, approved_at=NOW()' },
  submit: { from: ['approved'], to: 'submitted', role: 'approver', set: 'submitted_by=?, submitted_at=NOW()' },
  reject: { from: ['draft', 'reviewed', 'approved'], to: 'rejected', role: 'reviewer', set: 'reviewed_by=?, reviewed_at=NOW()' },
};
const RANK = require('../middleware/auth').ROLE_RANK;

router.post('/runs/:id/:action(review|approve|submit|reject)', async (req, res) => {
  const t = TRANSITIONS[req.params.action];
  if (RANK[req.user.role] < RANK[t.role]) return res.status(403).json({ error: `Requires ${t.role} role or higher` });
  const run = await loadRun(req.params.id);
  if (!t.from.includes(run.status)) return res.status(409).json({ error: `Cannot ${req.params.action} a report in status '${run.status}'` });
  const notes = (req.body?.notes || '').trim();
  if (['review', 'approve'].includes(req.params.action) && run.generated_by === req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Maker-checker: you cannot review or approve a return you generated' });
  if (req.params.action === 'approve' && run.error_count > 0 && !notes)
    return res.status(400).json({ error: `This return has ${run.error_count} validation error(s). Enter a justification note to approve it anyway.` });
  if (req.params.action === 'reject' && !notes) return res.status(400).json({ error: 'A reason is required to reject' });
  const ref = (req.body?.submission_ref || '').trim();
  if (req.params.action === 'submit' && !ref) return res.status(400).json({ error: 'Enter the NAICOM portal / acknowledgement reference' });
  const newNotes = notes ? [run.notes, `[${new Date().toISOString().slice(0, 16).replace('T', ' ')} ${req.user.name} - ${req.params.action}] ${notes}`].filter(Boolean).join('\n') : run.notes;
  await query(`UPDATE report_runs SET status=?, ${t.set}, notes=?${req.params.action === 'submit' ? ', submission_ref=?' : ''} WHERE id=?`,
    [t.to, req.user.id, newNotes, ...(req.params.action === 'submit' ? [ref] : []), run.id]);
  await audit(req, `report_${req.params.action}`, 'report_run', run.id, { notes, submission_ref: ref || undefined });
  res.json({ ok: true, status: t.to });
});

router.delete('/runs/:id', requireRole('preparer'), async (req, res) => {
  const run = await loadRun(req.params.id);
  if (!['draft', 'rejected'].includes(run.status)) return res.status(409).json({ error: 'Only draft or rejected runs can be deleted' });
  await query('DELETE FROM report_runs WHERE id=?', [run.id]);
  await audit(req, 'report_deleted', 'report_run', run.id, { code: run.report_code, period: run.period_label });
  res.json({ ok: true });
});

module.exports = router;

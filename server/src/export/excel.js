const ExcelJS = require('exceljs');

const NUM_FMT = { money: '#,##0.00;[Red](#,##0.00)', number: '#,##0', pct: '0.00' };
const sheetName = (s, used) => {
  let base = s.replace(/[\\/*?:[\]]/g, ' ').slice(0, 28) || 'Sheet';
  let n = base, i = 2;
  while (used.has(n.toLowerCase())) n = `${base.slice(0, 26)}-${i++}`;
  used.add(n.toLowerCase());
  return n;
};

/** Build an .xlsx workbook for a generated return (cover + one sheet per section). */
async function toExcel(out, run) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NAICOM Returns Add-on';
  wb.created = new Date();
  const used = new Set();
  const head = { bold: true, color: { argb: 'FFFFFFFF' } };
  const fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };

  const cover = wb.addWorksheet(sheetName('Cover', used));
  cover.columns = [{ width: 34 }, { width: 70 }];
  cover.addRow([out.company.name]).font = { bold: true, size: 14 };
  cover.addRow([`${out.code} - ${out.name}`]).font = { bold: true, size: 12 };
  cover.addRow([]);
  const meta = [
    ['NAICOM licence no.', out.company.naicomLicenseNo || ''], ['RC number', out.company.rcNumber || ''],
    ['Reporting period', `${out.period.label} (${out.period.start} to ${out.period.end})`], ['Due date', out.dueDate],
    ['Generated at', out.generatedAt], ['Status', run ? `${run.status} (v${run.version})` : 'preview'],
  ];
  if (run?.submission_ref) meta.push(['NAICOM submission ref.', run.submission_ref]);
  meta.forEach((m) => { const r = cover.addRow(m); r.getCell(1).font = { bold: true }; });
  if (out.validations.length) {
    cover.addRow([]);
    cover.addRow(['Validation results']).font = { bold: true };
    out.validations.forEach((x) => cover.addRow([x.level.toUpperCase(), x.message]));
  }
  cover.addRow([]);
  cover.addRow(['Amounts are in Nigerian Naira (₦) unless otherwise stated.']).font = { italic: true };

  for (const sec of out.sections) {
    const ws = wb.addWorksheet(sheetName(sec.title, used));
    ws.addRow([sec.title]).font = { bold: true, size: 12 };
    ws.addRow([`${out.company.name} - ${out.period.label}`]).font = { italic: true };
    if (sec.note) ws.addRow([sec.note]).font = { italic: true };
    ws.addRow([]);
    if (sec.type === 'kv') {
      ws.columns = [{ width: 50 }, { width: 40 }];
      const h = ws.addRow(['Item', 'Value']); h.eachCell((c) => { c.font = head; c.fill = fill; });
      sec.items.forEach((it) => {
        const r = ws.addRow([it.label, it.value ?? '']);
        if (NUM_FMT[it.type]) r.getCell(2).numFmt = NUM_FMT[it.type];
      });
      continue;
    }
    const h = ws.addRow(sec.columns.map((c) => c.label));
    h.eachCell((c) => { c.font = head; c.fill = fill; c.alignment = { wrapText: true, vertical: 'middle' }; });
    h.height = 32;
    sec.columns.forEach((c, i) => { ws.getColumn(i + 1).width = c.type === 'text' ? 28 : 18; });
    const write = (row, bold) => {
      const r = ws.addRow(sec.columns.map((c) => row[c.key] ?? ''));
      sec.columns.forEach((c, i) => { if (NUM_FMT[c.type]) r.getCell(i + 1).numFmt = NUM_FMT[c.type]; });
      if (bold) r.font = { bold: true };
    };
    if (!sec.rows.length) ws.addRow(['No records for this period']).font = { italic: true };
    sec.rows.forEach((row) => write(row));
    if (sec.totals) write(sec.totals, true);
    ws.views = [{ state: 'frozen', ySplit: h.number }];
  }
  return wb.xlsx.writeBuffer();
}

module.exports = { toExcel };

const PDFDocument = require('pdfkit');

const fmt = (v, type) => {
  if (v === null || v === undefined || v === '') return '';
  if (type === 'money') return Number(v).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (type === 'number') return Number(v).toLocaleString('en-NG');
  if (type === 'pct') return Number(v).toFixed(2);
  return String(v);
};
// pdfkit's built-in Helvetica has no Naira glyph.
const clean = (s) => String(s).replace(/₦/g, 'N');

/** Render a generated return as a landscape A4 PDF. Returns a Promise<Buffer>. */
function toPdf(out, run) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const W = doc.page.width - 72;

    doc.font('Helvetica-Bold').fontSize(14).text(clean(out.company.name));
    doc.fontSize(12).text(clean(`${out.code} - ${out.name}`));
    doc.font('Helvetica').fontSize(9).fillColor('#333')
      .text(`NAICOM licence: ${out.company.naicomLicenseNo || '-'}    RC: ${out.company.rcNumber || '-'}    Period: ${out.period.label} (${out.period.start} to ${out.period.end})    Due: ${out.dueDate}`)
      .text(`Status: ${run ? `${run.status.toUpperCase()} v${run.version}` : 'PREVIEW'}${run?.submission_ref ? `    Submission ref: ${run.submission_ref}` : ''}    Generated: ${out.generatedAt}    Amounts in Naira (N)`);
    doc.fillColor('black').moveDown(0.6);

    const ensure = (h) => { if (doc.y + h > doc.page.height - 50) doc.addPage(); };

    for (const sec of out.sections) {
      ensure(60);
      doc.font('Helvetica-Bold').fontSize(10.5).text(clean(sec.title), 36);
      if (sec.note) doc.font('Helvetica-Oblique').fontSize(8).text(clean(sec.note));
      doc.moveDown(0.3);
      if (sec.type === 'kv') {
        doc.fontSize(8.5);
        for (const it of sec.items) {
          ensure(14);
          const y = doc.y;
          doc.font('Helvetica').text(clean(it.label), 36, y, { width: 300 });
          doc.font('Helvetica-Bold').text(clean(fmt(it.value, it.type)), 340, y, { width: 300 });
          doc.y = Math.max(doc.y, y + 12);
        }
        doc.moveDown(0.8);
        continue;
      }
      const cols = sec.columns;
      const textCols = cols.filter((c) => c.type === 'text').length;
      const unit = W / (cols.length + textCols * 0.8);
      const widths = cols.map((c) => (c.type === 'text' ? unit * 1.8 : unit));
      const fs = cols.length > 11 ? 6.2 : cols.length > 8 ? 7 : 8;
      const drawRow = (vals, opts = {}) => {
        doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fs);
        const hs = vals.map((v, i) => doc.heightOfString(clean(v), { width: widths[i] - 4 }));
        const h = Math.max(...hs) + 4;
        ensure(h);
        const y = doc.y;
        if (opts.fill) doc.rect(36, y, W, h).fill(opts.fill).fillColor(opts.color || 'black');
        let x = 36;
        vals.forEach((v, i) => {
          const right = cols[i].type !== 'text' && cols[i].type !== 'date' && !opts.header;
          doc.text(clean(v), x + 2, y + 2, { width: widths[i] - 4, align: right ? 'right' : 'left' });
          x += widths[i];
        });
        doc.fillColor('black');
        doc.moveTo(36, y + h).lineTo(36 + W, y + h).lineWidth(0.3).strokeColor('#bbb').stroke();
        doc.y = y + h;
      };
      drawRow(cols.map((c) => c.label), { bold: true, header: true, fill: '#1F4E79', color: 'white' });
      if (!sec.rows.length) drawRow(cols.map((c, i) => (i === 0 ? 'No records for this period' : '')));
      sec.rows.forEach((r) => drawRow(cols.map((c) => fmt(r[c.key], c.type))));
      if (sec.totals) drawRow(cols.map((c) => fmt(sec.totals[c.key], c.type)), { bold: true, fill: '#E8EEF5' });
      doc.moveDown(0.8);
    }

    if (out.validations.length) {
      ensure(40);
      doc.font('Helvetica-Bold').fontSize(10.5).text('Validation results', 36);
      doc.font('Helvetica').fontSize(8.5);
      out.validations.forEach((x) => { ensure(12); doc.text(clean(`[${x.level.toUpperCase()}] ${x.message}`), 36, doc.y, { width: W }); });
    }
    ensure(70);
    doc.moveDown(1.5).font('Helvetica').fontSize(9);
    const y = doc.y;
    doc.text('Prepared by: ____________________', 36, y).text('Reviewed by: ____________________', 290, y).text('Approved by (MD/CEO): ____________________', 540, y);

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(7).fillColor('#666')
        .text(`${clean(out.company.name)} - ${out.code} ${out.period.label} - page ${i + 1} of ${range.count}`, 36, doc.page.height - 30, { width: W, align: 'center', lineBreak: false });
    }
    doc.end();
  });
}

module.exports = { toPdf };

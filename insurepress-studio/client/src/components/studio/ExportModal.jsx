import { useEffect, useState } from 'react';
import { FileDown, BookOpen, FileText, Magnet, Download, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../lib/api.js';
import { Modal, Spinner, useToast } from '../ui.jsx';
import { THEMES } from '@shared/themes.js';
import { TRIM_SIZES } from '@shared/constants.js';

const FORMATS = [
  { id: 'pdf', icon: FileDown, title: 'Print-Ready PDF', desc: 'Exact trim size, cover, page-numbered contents, running heads & folios. For KDP Print and Nigerian printers.' },
  { id: 'epub', icon: BookOpen, title: 'Reflowable EPUB 3.0', desc: 'Cover image, NAV/NCX contents, styled callouts. For Selar, Amazon KDP, Apple Books & Kobo.' },
  { id: 'docx', icon: FileText, title: 'Editable DOCX', desc: 'Full manuscript with styled blocks for editors and print houses.' },
  { id: 'lead_magnet_pdf', icon: Magnet, title: 'Lead-Magnet Mini-PDF', desc: 'Selected worksheets/checklists + branded cover + offer QR — for WhatsApp & landing pages.' },
];

export function LeadMagnetFields({ chapters, ctas, value, onChange }) {
  const candidates = chapters.filter((c) => c.section_type === 'workbook' || ['checklist', 'worksheet', 'claims_directory'].includes(c.matter_subtype));
  const others = chapters.filter((c) => !candidates.includes(c) && c.matter_subtype !== 'title_page');
  const toggle = (id) => onChange({ ...value, chapterIds: value.chapterIds.includes(id) ? value.chapterIds.filter((x) => x !== id) : [...value.chapterIds, id] });
  const Row = (c) => (
    <label key={c.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
      <input type="checkbox" checked={value.chapterIds.includes(c.id)} onChange={() => toggle(c.id)} />{c.title}
    </label>
  );
  return (
    <div className="space-y-3">
      <div>
        <span className="label">Sections to include</span>
        <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-1">
          {candidates.map(Row)}
          {others.length > 0 && <div className="px-2 pt-2 text-[10px] font-bold uppercase text-slate-400">Other sections</div>}
          {others.map(Row)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label><span className="label">Headline</span><input className="input" value={value.headline} onChange={(e) => onChange({ ...value, headline: e.target.value })} placeholder="Your Free Insurance Readiness Toolkit" /></label>
        <label><span className="label">Upsell offer (QR)</span>
          <select className="input" value={value.ctaId || ''} onChange={(e) => onChange({ ...value, ctaId: Number(e.target.value) || null })}>
            <option value="">Auto (Selar/Paystack first)</option>
            {ctas.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

export function useExportRunner(bookId) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);
  const run = async (body) => {
    setBusy(true);
    setLast(null);
    try {
      const out = await api.post(`/books/${bookId}/exports`, body);
      setLast(out);
      toast(`${out.format.toUpperCase().replace('_', ' ')} ready${out.pages ? ` · ${out.pages} pages` : ''}`);
      return out;
    } catch (e) { toast(e.message, 'error'); setLast({ error: e.message }); return null; } finally { setBusy(false); }
  };
  return { busy, last, run };
}

export default function ExportModal({ open, onClose, book, chapters, ctas }) {
  const [format, setFormat] = useState('pdf');
  const [theme, setTheme] = useState(book.theme_preset);
  const [trim, setTrim] = useState(book.trim_size);
  const [lm, setLm] = useState({ chapterIds: [], headline: '', ctaId: null });
  const [history, setHistory] = useState([]);
  const { busy, last, run } = useExportRunner(book.id);

  const loadHistory = () => api.get(`/books/${book.id}/exports`).then(setHistory).catch(() => {});
  useEffect(() => {
    if (open) {
      setTheme(book.theme_preset); setTrim(book.trim_size); loadHistory();
      setLm((x) => ({ ...x, chapterIds: chapters.filter((c) => c.section_type === 'workbook').map((c) => c.id) }));
    }
  }, [open]);

  const go = async () => {
    const body = { format, theme };
    if (format === 'pdf') body.trim = trim;
    if (format === 'lead_magnet_pdf') Object.assign(body, lm, { trim: 'A4' });
    await run(body);
    loadHistory();
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Publish & Export" subtitle="Files are generated on the server and saved to /exports."
      footer={<><button className="btn-ghost" onClick={onClose}>Close</button><button className="btn-gold" onClick={go} disabled={busy || (format === 'lead_magnet_pdf' && !lm.chapterIds.length)}>{busy ? <Spinner /> : <Download size={15} />}{busy ? 'Generating…' : 'Generate file'}</button></>}>
      <div className="grid gap-2 sm:grid-cols-2">
        {FORMATS.map((f) => (
          <button key={f.id} onClick={() => setFormat(f.id)} className={`flex gap-3 rounded-xl border p-3 text-left ${format === f.id ? 'border-gold-500 bg-gold-50 ring-2 ring-gold-100' : 'border-slate-200 hover:border-slate-300'}`}>
            <f.icon size={20} className={format === f.id ? 'text-gold-600' : 'text-slate-400'} />
            <span><span className="block text-sm font-bold text-navy-800">{f.title}</span><span className="block text-xs text-slate-500">{f.desc}</span></span>
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {format !== 'docx' && (
          <label><span className="label">Theme</span><select className="input" value={theme} onChange={(e) => setTheme(e.target.value)}>{Object.values(THEMES).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        )}
        {format === 'pdf' && (
          <label><span className="label">Trim size</span><select className="input" value={trim} onChange={(e) => setTrim(e.target.value)}>{Object.values(TRIM_SIZES).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        )}
      </div>
      {format === 'lead_magnet_pdf' && <div className="mt-4"><LeadMagnetFields chapters={chapters} ctas={ctas} value={lm} onChange={setLm} /></div>}
      {busy && <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Spinner />Typesetting with headless Chromium — a full PDF takes around 20–40 seconds.</p>}
      {last && !last.error && (
        <a href={last.url} className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
          <CheckCircle2 size={16} />Download {last.file_path}<span className="ml-auto text-xs font-normal">{(last.bytes / 1024).toFixed(0)} KB{last.pages ? ` · ${last.pages} pages` : ''}</span>
        </a>
      )}
      {last?.error && <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><XCircle size={16} />{last.error}</div>}
      {history.length > 0 && (
        <div className="mt-5">
          <div className="label">Recent exports</div>
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-xs">
            {history.slice(0, 8).map((j) => (
              <div key={j.id} className="flex items-center gap-2 px-3 py-1.5">
                <span className="chip bg-slate-100 uppercase text-slate-600">{j.format.replace('_', ' ')}</span>
                <span className="text-slate-400">{new Date(j.created_at).toLocaleString('en-GB')}</span>
                <span className="ml-auto">{j.url ? <a className="font-semibold text-gold-600 hover:underline" href={j.url}>Download</a> : <span className="text-slate-400">{j.status}</span>}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

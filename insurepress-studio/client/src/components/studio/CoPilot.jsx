import { useState } from 'react';
import { PenLine, Flame, FileSpreadsheet, BookA, ListChecks, ShieldCheck, CornerDownLeft, ArrowDownToLine, Replace, AlertOctagon, AlertTriangle, Info, CheckCircle2, Sparkles } from 'lucide-react';
import { api } from '../../lib/api.js';
import { Spinner, useToast } from '../ui.jsx';
import { docToHtml, P } from '@shared/render.js';

const ACTIONS = [
  { id: 'draft_chapter', label: 'Draft Chapter from Outline Notes', icon: PenLine, hint: 'Writes a full first draft with visual blocks.' },
  { id: 'pain_hook', label: 'Inject Relatable Pain-Point Hook', icon: Flame, hint: 'A vivid opening that makes the risk personal.' },
  { id: 'claim_scenario', label: 'Generate Anonymized Claim Scenario', icon: FileSpreadsheet, hint: 'Uninsured vs insured outcome with ₦ figures.' },
  { id: 'simplify_jargon', label: 'Simplify Insurance Jargon', icon: BookA, hint: 'Turns clauses into plain-English callouts. Select text first to focus it.' },
  { id: 'summary_checklist', label: 'Create Chapter Summary & Action Checklist', icon: ListChecks, hint: 'Key takeaways + a printable checklist.' },
  { id: 'compliance_check', label: 'NAICOM & NIIRA 2025 Compliance Check', icon: ShieldCheck, hint: 'Flags misleading or non-compliant claims.' },
];
const SEV = {
  high: { icon: AlertOctagon, cls: 'border-red-200 bg-red-50 text-red-700' },
  medium: { icon: AlertTriangle, cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  low: { icon: Info, cls: 'border-sky-200 bg-sky-50 text-sky-700' },
};

export default function CoPilot({ book, chapter, editor, liveDoc }) {
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);

  const run = async (action) => {
    if (!chapter) return;
    setBusy(action);
    setResult(null);
    try {
      const { from, to } = editor?.state.selection || {};
      const selection = editor && from !== to ? editor.state.doc.textBetween(from, to, '\n') : '';
      const out = await api.post('/ai/copilot', { action, bookId: book.id, chapterId: chapter.id, doc: liveDoc || chapter.content_json, selection, notes });
      setResult({ action, ...out });
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(null); }
  };

  const apply = (mode) => {
    if (!editor || !result?.doc) return;
    const content = result.doc.content;
    if (mode === 'replace') {
      if (!confirm('Replace the whole section with this draft? Save a version snapshot first if you want to keep the current text.')) return;
      editor.chain().focus().setContent(result.doc, true).run();
    } else if (mode === 'end') {
      editor.chain().focus().insertContentAt(editor.state.doc.content.size, content).run();
    } else if (mode === 'start') {
      editor.chain().focus().insertContentAt(0, content).run();
    } else {
      editor.chain().focus().insertContent(content).run();
    }
    toast('Inserted into the manuscript');
  };

  const insertDisclaimer = (text) => {
    editor?.chain().focus().insertContentAt(editor.state.doc.content.size, [P(`*${text}*`)]).run();
    toast('Disclaimer added to the end of the section');
  };

  const report = result?.kind === 'compliance' ? result.report : null;
  const scoreColor = report ? (report.score >= 85 ? 'text-emerald-600' : report.score >= 60 ? 'text-amber-600' : 'text-red-600') : '';

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <label className="label">Outline notes / instructions for this section</label>
        <textarea className="input mb-3 text-xs" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Focus on pharmacies in Kano; mention flood extension; keep it under 1,500 words" />
        <div className="space-y-1.5">
          {ACTIONS.map((a) => (
            <button key={a.id} onClick={() => run(a.id)} disabled={!!busy || !chapter}
              className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition hover:border-gold-500 hover:bg-gold-50 disabled:opacity-60 ${a.id === 'compliance_check' ? 'border-navy-200 bg-navy-50/50' : 'border-slate-200 bg-white'}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${a.id === 'compliance_check' ? 'bg-navy-800 text-gold-400' : 'bg-gold-50 text-gold-600'}`}>{busy === a.id ? <Spinner size={14} /> : <a.icon size={15} />}</span>
              <span><span className="block text-xs font-bold text-slate-700">{a.label}</span><span className="block text-[11px] text-slate-500">{a.hint}</span></span>
            </button>
          ))}
        </div>

        {result && !report && (
          <div className="mt-4 rounded-xl border border-gold-100 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
              <Sparkles size={13} className="text-gold-500" />{result.message}
              {result.mode === 'mock' && <span className="chip ml-auto bg-slate-100 text-slate-500">mock</span>}
            </div>
            <div className="ip-scope max-h-[45vh] overflow-y-auto px-3 py-2 font-serif text-[13px] leading-relaxed [&_h2]:mt-3 [&_h2]:font-bold [&_h2]:text-navy-800 [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2"
              dangerouslySetInnerHTML={{ __html: docToHtml(result.doc, { currency: book.currency }) }} />
            <div className="flex flex-wrap gap-1 border-t border-slate-100 p-2">
              <button className="btn-primary btn-sm" onClick={() => apply('cursor')}><CornerDownLeft size={12} />Insert at cursor</button>
              {result.action === 'pain_hook'
                ? <button className="btn-outline btn-sm" onClick={() => apply('start')}><ArrowDownToLine size={12} className="rotate-180" />Insert at top</button>
                : <button className="btn-outline btn-sm" onClick={() => apply('end')}><ArrowDownToLine size={12} />Append</button>}
              {result.action === 'draft_chapter' && <button className="btn-outline btn-sm" onClick={() => apply('replace')}><Replace size={12} />Replace section</button>}
            </div>
          </div>
        )}

        {report && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className={`text-3xl font-black ${scoreColor}`}>{report.score}</div>
              <div className="text-xs"><div className="font-bold text-slate-700">Compliance score</div><div className="text-slate-500">{report.verdict}</div><div className="mt-0.5 text-[10px] text-slate-400">{report.framework}</div></div>
            </div>
            {report.flags.length === 0 && <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700"><CheckCircle2 size={14} />No issues flagged.</div>}
            {report.flags.map((f, i) => {
              const S = SEV[f.severity] || SEV.low;
              return (
                <div key={i} className={`rounded-lg border p-2.5 text-xs ${S.cls}`}>
                  <div className="flex items-center gap-1.5 font-bold"><S.icon size={13} /><span className="capitalize">{f.severity}</span> · {f.issue}</div>
                  {f.excerpt && <div className="mt-1 rounded bg-white/70 p-1.5 font-serif italic text-slate-700">“{f.excerpt}”</div>}
                  {f.rule && <div className="mt-1 text-[11px] opacity-80">Rule: {f.rule}</div>}
                  {f.suggestion && <div className="mt-1 text-slate-700"><b>Fix:</b> {f.suggestion}</div>}
                </div>
              );
            })}
            {report.checks?.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                <div className="mb-1 font-bold text-slate-600">Checks &amp; verification notes</div>
                <ul className="space-y-1 text-slate-600">{report.checks.map((c) => <li key={c} className="flex gap-1.5"><CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-500" />{c}</li>)}</ul>
              </div>
            )}
            <div className="rounded-lg border border-navy-100 bg-navy-50 p-2.5 text-xs">
              <div className="mb-1 font-bold text-navy-800">Recommended disclaimer</div>
              <p className="text-slate-600">{report.recommendedDisclaimer}</p>
              <button className="btn-primary btn-sm mt-2" onClick={() => insertDisclaimer(report.recommendedDisclaimer)}>Add to this section</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

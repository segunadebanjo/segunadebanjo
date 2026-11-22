import { useEffect, useState } from 'react';
import { X, History, Save, RotateCcw, Trash2, Eye } from 'lucide-react';
import { api } from '../../lib/api.js';
import { Spinner, useToast, Empty } from '../ui.jsx';
import { docToHtml } from '@shared/render.js';

export default function VersionDrawer({ open, onClose, chapter, onRestored, flushSave }) {
  const toast = useToast();
  const [list, setList] = useState(null);
  const [label, setLabel] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => chapter && api.get(`/chapters/${chapter.id}/versions`).then(setList).catch((e) => toast(e.message, 'error'));
  useEffect(() => { if (open) { setList(null); setPreview(null); load(); } }, [open, chapter?.id]);
  if (!open) return null;

  const save = async () => {
    setBusy(true);
    try {
      await flushSave?.();
      await api.post(`/chapters/${chapter.id}/versions`, { label });
      setLabel('');
      toast('Snapshot saved');
      load();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const restore = async (v) => {
    if (!confirm(`Restore “${v.version_label}”? Your current text is backed up automatically first.`)) return;
    await flushSave?.();
    const ch = await api.post(`/versions/${v.id}/restore`);
    toast('Version restored');
    onRestored(ch);
    load();
  };
  const remove = async (v) => { await api.del(`/versions/${v.id}`); load(); };
  const show = async (v) => setPreview(await api.get(`/versions/${v.id}`));

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-[420px] max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <History size={16} className="text-gold-500" />
        <div className="flex-1"><div className="font-serif font-bold text-navy-800">Version History</div><div className="truncate text-xs text-slate-500">{chapter?.title}</div></div>
        <button className="btn-ghost p-1" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="flex gap-2 border-b border-slate-100 p-3">
        <input className="input py-1.5" placeholder="Snapshot name, e.g. “Before editor review”" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner /> : <Save size={14} />}Save</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!list ? <Spinner /> : list.length === 0 ? <Empty icon={History} title="No snapshots yet">Save a named snapshot before big rewrites so you can always go back.</Empty> : (
          <div className="space-y-2">
            {list.map((v) => (
              <div key={v.id} className={`rounded-lg border p-2.5 ${preview?.id === v.id ? 'border-gold-500 bg-gold-50' : 'border-slate-200'}`}>
                <div className="text-sm font-semibold text-slate-700">{v.version_label}</div>
                <div className="text-[11px] text-slate-400">{new Date(v.created_at).toLocaleString('en-GB')} · {v.word_count.toLocaleString()} words</div>
                <div className="mt-2 flex gap-1">
                  <button className="btn-outline btn-sm" onClick={() => show(v)}><Eye size={12} />View</button>
                  <button className="btn-outline btn-sm" onClick={() => restore(v)}><RotateCcw size={12} />Restore</button>
                  <button className="btn-ghost btn-sm ml-auto text-slate-400 hover:text-red-600" onClick={() => remove(v)}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        {preview && (
          <div className="mt-4 rounded-lg border border-slate-200">
            <div className="border-b border-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">Preview: {preview.version_label}</div>
            <div className="ip-scope max-h-[40vh] overflow-y-auto p-3 font-serif text-xs leading-relaxed [&_p]:mb-2" dangerouslySetInnerHTML={{ __html: docToHtml(preview.content_json) }} />
          </div>
        )}
      </div>
    </div>
  );
}

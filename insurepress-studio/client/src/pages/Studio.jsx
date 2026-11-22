import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Eye, Bot, History, Settings, Download, Image, BadgeDollarSign, Check, CloudUpload, AlertCircle, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api.js';
import { Modal, Field, Spinner, Tabs, useToast } from '../components/ui.jsx';
import Navigator from '../components/studio/Navigator.jsx';
import Editor from '../components/studio/Editor.jsx';
import Preview from '../components/studio/Preview.jsx';
import CoPilot from '../components/studio/CoPilot.jsx';
import VersionDrawer from '../components/studio/VersionDrawer.jsx';
import ExportModal from '../components/studio/ExportModal.jsx';
import BlueprintWizard from '../components/BlueprintWizard.jsx';
import { StudioCtx } from '../components/blocks/extensions.jsx';
import { chapterLabels, orderChapters, scopedBlockCss, THEMES } from '@shared/themes.js';
import { TRIM_SIZES } from '@shared/constants.js';

function SettingsModal({ open, onClose, full, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(full.book);
  const [kits, setKits] = useState([]);
  useEffect(() => { if (open) { setF(full.book); api.get('/brand-kits').then(setKits); } }, [open]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    try {
      const fields = ['title', 'subtitle', 'author_name', 'target_persona', 'core_pain_point', 'monetization_goal', 'currency', 'trim_size', 'theme_preset', 'status'];
      const body = Object.fromEntries(fields.map((k) => [k, f[k]]));
      body.price_amount = Number(f.price_amount); body.target_word_count = Number(f.target_word_count); body.brand_kit_id = Number(f.brand_kit_id) || null;
      await api.put(`/books/${f.id}`, body);
      toast('Book settings saved');
      onSaved();
      onClose();
    } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Book Settings" size="lg" footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}>Save settings</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Title" className="col-span-2"><input className="input" value={f.title || ''} onChange={set('title')} /></Field>
        <Field label="Subtitle" className="col-span-2"><input className="input" value={f.subtitle || ''} onChange={set('subtitle')} /></Field>
        <Field label="Author"><input className="input" value={f.author_name || ''} onChange={set('author_name')} /></Field>
        <Field label="Target persona"><input className="input" value={f.target_persona || ''} onChange={set('target_persona')} /></Field>
        <Field label="Core pain point" className="col-span-2"><textarea className="input" rows={2} value={f.core_pain_point || ''} onChange={set('core_pain_point')} /></Field>
        <Field label="Currency"><select className="input" value={f.currency} onChange={set('currency')}><option value="NGN">₦ Naira (NGN)</option><option value="USD">$ US Dollar (USD)</option></select></Field>
        <Field label="Price"><input className="input" type="number" value={f.price_amount} onChange={set('price_amount')} /></Field>
        <Field label="Trim size"><select className="input" value={f.trim_size} onChange={set('trim_size')}>{Object.values(TRIM_SIZES).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
        <Field label="Theme"><select className="input" value={f.theme_preset} onChange={set('theme_preset')}>{Object.values(THEMES).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="Monetization goal"><select className="input" value={f.monetization_goal} onChange={set('monetization_goal')}><option value="direct_sales">Direct sales</option><option value="lead_generation">Lead generation</option><option value="hybrid">Hybrid</option></select></Field>
        <Field label="Status"><select className="input" value={f.status} onChange={set('status')}><option value="draft">Draft</option><option value="review">Review</option><option value="published">Published</option></select></Field>
        <Field label="Target word count"><input className="input" type="number" value={f.target_word_count} onChange={set('target_word_count')} /></Field>
        <Field label="Brand kit"><select className="input" value={f.brand_kit_id || ''} onChange={set('brand_kit_id')}>{kits.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></Field>
      </div>
    </Modal>
  );
}

export default function Studio() {
  const { id } = useParams();
  const toast = useToast();
  const [full, setFull] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [liveDoc, setLiveDoc] = useState(null);
  const [editor, setEditor] = useState(null);
  const [editorKey, setEditorKey] = useState(0);
  const [save, setSave] = useState('saved');
  const [left, setLeft] = useState(true);
  const [right, setRight] = useState(true);
  const [tab, setTab] = useState('preview');
  const [modal, setModal] = useState(null);
  const pending = useRef(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    const f = await api.get(`/books/${id}/full`);
    setFull(f);
    return f;
  }, [id]);

  useEffect(() => {
    load().then((f) => {
      const first = orderChapters(f.chapters).find((c) => c.section_type === 'body') || f.chapters[0];
      setActiveId(first?.id || null);
    }).catch((e) => toast(e.message, 'error'));
  }, [id]);

  const chapters = useMemo(() => orderChapters(full?.chapters || []), [full]);
  const labels = useMemo(() => chapterLabels(chapters), [chapters]);
  const active = chapters.find((c) => c.id === activeId) || null;
  const patchChapter = (cid, patch) => setFull((f) => ({ ...f, chapters: f.chapters.map((c) => (c.id === cid ? { ...c, ...patch } : c)) }));

  const flushSave = useCallback(async () => {
    clearTimeout(timer.current);
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    setSave('saving');
    try {
      const ch = await api.put(`/chapters/${p.id}`, { content_json: p.doc });
      patchChapter(p.id, { content_json: ch.content_json, word_count: ch.word_count });
      setSave(pending.current ? 'unsaved' : 'saved');
    } catch (e) {
      setSave('error');
      toast(`Autosave failed: ${e.message}`, 'error');
    }
  }, []);

  useEffect(() => {
    const before = (e) => { if (pending.current) { flushSave(); e.preventDefault(); } };
    window.addEventListener('beforeunload', before);
    return () => { window.removeEventListener('beforeunload', before); flushSave(); };
  }, [flushSave]);

  const onDocChange = (doc) => {
    setLiveDoc(doc);
    pending.current = { id: activeId, doc };
    setSave('unsaved');
    clearTimeout(timer.current);
    timer.current = setTimeout(flushSave, 1200);
  };

  const select = async (cid) => {
    if (cid === activeId) return;
    await flushSave();
    setLiveDoc(null);
    setActiveId(cid);
  };

  const onMetaChange = async (fields, localOnly) => {
    patchChapter(activeId, fields);
    if (localOnly) return;
    try { await api.put(`/chapters/${activeId}`, fields); } catch (e) { toast(e.message, 'error'); }
  };

  const reorder = async (section, items) => {
    const updates = items.map((c, i) => ({ id: c.id, section_type: section, sort_order: i }));
    setFull((f) => ({ ...f, chapters: f.chapters.map((c) => ({ ...c, ...(updates.find((u) => u.id === c.id) || {}) })) }));
    try { await api.post(`/books/${id}/chapters/reorder`, { items: updates }); } catch (e) { toast(e.message, 'error'); load(); }
  };

  const move = async (ch, section) => {
    const end = chapters.filter((c) => c.section_type === section).length;
    await reorder(section, [...chapters.filter((c) => c.section_type === section), ch]);
    patchChapter(ch.id, { section_type: section, sort_order: end });
    toast(`Moved to ${section.replace('_', ' ')}`);
  };

  const add = async (section) => {
    const names = { front_matter: 'New Front Matter Page', body: `Chapter ${chapters.filter((c) => c.section_type === 'body').length + 1}`, workbook: 'New Worksheet', back_matter: 'New Back Matter Page' };
    const subtype = { front_matter: 'introduction', body: 'chapter', workbook: 'worksheet', back_matter: 'next_steps' }[section];
    const ch = await api.post(`/books/${id}/chapters`, { section_type: section, matter_subtype: subtype, title: names[section] });
    setFull((f) => ({ ...f, chapters: [...f.chapters, ch] }));
    await select(ch.id);
  };

  const genMatter = async (subtype) => {
    try {
      const ch = await api.post(`/books/${id}/matter`, { subtype });
      setFull((f) => ({ ...f, chapters: [...f.chapters, ch] }));
      await select(ch.id);
      toast(`${ch.title} generated`);
    } catch (e) { toast(e.message, 'error'); }
  };

  const remove = async (ch) => {
    if (!confirm(`Delete “${ch.title}”? Its version history is deleted too.`)) return;
    if (pending.current?.id === ch.id) pending.current = null;
    await api.del(`/chapters/${ch.id}`);
    setFull((f) => ({ ...f, chapters: f.chapters.filter((c) => c.id !== ch.id) }));
    if (ch.id === activeId) { setLiveDoc(null); setActiveId(chapters.find((c) => c.id !== ch.id)?.id || null); }
  };

  const onRestored = (ch) => {
    patchChapter(ch.id, ch);
    setLiveDoc(null);
    setEditorKey((k) => k + 1);
  };

  if (!full) return <div className="flex h-full items-center justify-center"><Spinner size={24} /></div>;
  const { book, brand, ctas } = full;
  const bodyCount = chapters.filter((c) => c.section_type === 'body').length || 1;
  const goal = active && active.section_type === 'body' ? Math.round(book.target_word_count / bodyCount / 50) * 50 : 0;
  const SaveIcon = { saved: Check, saving: CloudUpload, unsaved: CloudUpload, error: AlertCircle }[save];

  return (
    <StudioCtx.Provider value={{ ctas, currency: book.currency, bookId: book.id }}>
      <style>{scopedBlockCss('.ip-scope, .ip-editor', { themeId: book.theme_preset, brand })}</style>
      <div className="flex h-full flex-col">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3">
          <Link to="/" className="btn-ghost p-1.5" title="Library"><ArrowLeft size={16} /></Link>
          <button className="btn-ghost p-1.5" onClick={() => setLeft((v) => !v)} title="Toggle navigator">{left ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}</button>
          <div className="min-w-0">
            <div className="truncate font-serif text-sm font-bold text-navy-800">{book.title}</div>
          </div>
          <span className={`flex items-center gap-1 text-[11px] ${save === 'error' ? 'text-red-600' : 'text-slate-400'}`}><SaveIcon size={12} className={save === 'saving' ? 'animate-pulse' : ''} />{{ saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved', error: 'Save failed' }[save]}</span>
          <div className="ml-auto flex items-center gap-1">
            <button className="btn-ghost btn-sm" onClick={() => setModal('versions')} disabled={!active}><History size={14} />Versions</button>
            <button className="btn-ghost btn-sm" onClick={() => setModal('settings')}><Settings size={14} />Settings</button>
            <Link className="btn-ghost btn-sm" to={`/books/${id}/cover`}><Image size={14} />Cover Studio</Link>
            <Link className="btn-ghost btn-sm" to={`/books/${id}/monetize`}><BadgeDollarSign size={14} />Monetize</Link>
            <button className="btn-gold btn-sm" onClick={async () => { await flushSave(); setModal('export'); }}><Download size={14} />Publish &amp; Export</button>
            <button className="btn-ghost p-1.5" onClick={() => setRight((v) => !v)} title="Toggle preview & co-pilot">{right ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}</button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {left && (
            <aside className="w-72 shrink-0 border-r border-slate-200 bg-white">
              <Navigator book={book} chapters={chapters} labels={labels} activeId={activeId} onSelect={select} onReorder={reorder} onAdd={add}
                onGenerateMatter={genMatter} onDelete={remove} onMove={move} onWizard={() => setModal('wizard')} />
            </aside>
          )}
          <section className="ip-scope min-w-0 flex-1">
            {active ? (
              <Editor key={`${active.id}-${editorKey}`} chapter={active} label={labels[active.id]} goal={goal}
                onDocChange={onDocChange} onMetaChange={onMetaChange} onReady={setEditor} />
            ) : <div className="p-10 text-center text-slate-500">Add a section from the navigator to start writing.</div>}
          </section>
          {right && (
            <aside className="flex w-[440px] shrink-0 flex-col border-l border-slate-200 bg-white xl:w-[500px]">
              <div className="border-b border-slate-200 p-2">
                <Tabs value={tab} onChange={setTab} tabs={[{ id: 'preview', label: 'Live Preview', icon: Eye }, { id: 'copilot', label: 'AI Co-Pilot', icon: Bot }]} />
              </div>
              <div className="min-h-0 flex-1">
                {tab === 'preview'
                  ? <Preview book={book} brand={brand} chapters={chapters} activeChapter={active} liveDoc={liveDoc} labels={labels} />
                  : <CoPilot book={book} chapter={active} editor={editor} liveDoc={liveDoc} />}
              </div>
            </aside>
          )}
        </div>
      </div>
      <VersionDrawer open={modal === 'versions'} onClose={() => setModal(null)} chapter={active} onRestored={onRestored} flushSave={flushSave} />
      {modal === 'export' && <ExportModal open onClose={() => setModal(null)} book={book} chapters={chapters} ctas={ctas} />}
      {modal === 'settings' && <SettingsModal open onClose={() => setModal(null)} full={full} onSaved={load} />}
      <BlueprintWizard open={modal === 'wizard'} onClose={() => setModal(null)} bookId={book.id}
        onPopulated={async () => { const f = await load(); setActiveId(orderChapters(f.chapters).find((c) => c.section_type === 'body')?.id || null); setEditorKey((k) => k + 1); }} />
    </StudioCtx.Provider>
  );
}

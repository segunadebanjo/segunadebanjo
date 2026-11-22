import { useEffect, useState } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import {
  Bold, Italic, Underline as U, Strikethrough, Highlighter, Heading2, Heading3, List, ListOrdered, Quote, Undo2, Redo2,
  AlignLeft, AlignCenter, Plus, Target,
} from 'lucide-react';
import { blockNodes, SlashCommand, insertBlock, BLOCK_ICONS } from '../blocks/extensions.jsx';
import { BLOCK_TYPES, countWords } from '@shared/render.js';
import { CHAPTER_STATUSES, MATTER_SUBTYPES } from '@shared/constants.js';
import { Progress } from '../ui.jsx';

const Btn = ({ on, active, title, children }) => (
  <button type="button" title={title} onMouseDown={(e) => { e.preventDefault(); on(); }}
    className={`rounded p-1.5 ${active ? 'bg-navy-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{children}</button>
);

export default function Editor({ chapter, label, goal, onDocChange, onMetaChange, onReady }) {
  const [words, setWords] = useState(chapter.word_count || 0);
  const [menu, setMenu] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Underline, Highlight, TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Start writing… type “/” to insert headings, lists or insurance visual blocks' }),
      Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
      ...blockNodes, SlashCommand,
    ],
    content: chapter.content_json || { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON();
      setWords(countWords(json));
      onDocChange(json);
    },
  });

  useEffect(() => { if (editor) onReady?.(editor); }, [editor]);

  if (!editor) return null;
  const pct = goal ? (words / goal) * 100 : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-white px-3 py-1.5">
        <Btn title="Undo" on={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></Btn>
        <Btn title="Redo" on={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></Btn>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Btn title="Heading" active={editor.isActive('heading', { level: 2 })} on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></Btn>
        <Btn title="Subheading" active={editor.isActive('heading', { level: 3 })} on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={15} /></Btn>
        <Btn title="Bold" active={editor.isActive('bold')} on={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></Btn>
        <Btn title="Italic" active={editor.isActive('italic')} on={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></Btn>
        <Btn title="Bullet list" active={editor.isActive('bulletList')} on={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></Btn>
        <Btn title="Numbered list" active={editor.isActive('orderedList')} on={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></Btn>
        <Btn title="Quote" active={editor.isActive('blockquote')} on={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={15} /></Btn>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <div className="relative">
          <button className="btn-gold btn-sm" onClick={() => setMenu((m) => !m)}><Plus size={13} />Visual block</button>
          {menu && (
            <div className="card absolute left-0 top-8 z-30 w-72 p-1" onMouseLeave={() => setMenu(false)}>
              {Object.entries(BLOCK_TYPES).map(([type, m]) => {
                const Icon = BLOCK_ICONS[type];
                return (
                  <button key={type} className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-gold-50" onClick={() => { insertBlock(editor, type); setMenu(false); }}>
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-navy-800 text-gold-400"><Icon size={13} /></span>
                    <span><span className="block text-sm font-semibold text-slate-700">{m.label}</span><span className="block text-[11px] text-slate-500">{m.description}</span></span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <span className="ml-auto text-[11px] text-slate-400">Tip: type <kbd className="rounded border bg-slate-50 px-1">/</kbd> for the block menu</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100/60">
        <div className="mx-auto my-6 max-w-[760px] rounded-xl bg-white px-12 py-10 shadow-card">
          {/* Chapter goal header */}
          <div className="mb-6 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-gold-600">
              {label || MATTER_SUBTYPES[chapter.matter_subtype] || 'Section'}
              <select className="ml-auto rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-slate-600" value={chapter.status}
                onChange={(e) => onMetaChange({ status: e.target.value })}>
                {CHAPTER_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <textarea rows={1} style={{ fieldSizing: 'content' }} className="mt-2 w-full resize-none bg-transparent font-serif text-3xl font-bold leading-tight text-navy-800 outline-none" value={chapter.title}
              onChange={(e) => onMetaChange({ title: e.target.value }, true)} onBlur={(e) => onMetaChange({ title: e.target.value.trim() || 'Untitled' })} />
            <input className="mt-1 w-full bg-transparent font-serif text-lg italic text-slate-500 outline-none placeholder:text-slate-300" placeholder="Add a subtitle…" value={chapter.subtitle || ''}
              onChange={(e) => onMetaChange({ subtitle: e.target.value }, true)} onBlur={(e) => onMetaChange({ subtitle: e.target.value })} />
            {goal > 0 && (
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                <Target size={13} className="text-gold-500" />
                <Progress value={pct} className="max-w-xs" color={pct >= 100 ? 'bg-emerald-500' : 'bg-gold-500'} />
                <span className="whitespace-nowrap">{words.toLocaleString()} / {goal.toLocaleString()} words</span>
              </div>
            )}
          </div>

          <BubbleMenu editor={editor} tippyOptions={{ duration: 120 }} shouldShow={({ editor: ed, state }) => !state.selection.empty && !ed.isActive('painPoint') && !Object.keys(BLOCK_TYPES).some((t) => ed.isActive(t))}>
            <div className="card flex items-center gap-0.5 p-1">
              <Btn title="Bold" active={editor.isActive('bold')} on={() => editor.chain().focus().toggleBold().run()}><Bold size={14} /></Btn>
              <Btn title="Italic" active={editor.isActive('italic')} on={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} /></Btn>
              <Btn title="Underline" active={editor.isActive('underline')} on={() => editor.chain().focus().toggleUnderline().run()}><U size={14} /></Btn>
              <Btn title="Strike" active={editor.isActive('strike')} on={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={14} /></Btn>
              <Btn title="Highlight" active={editor.isActive('highlight')} on={() => editor.chain().focus().toggleHighlight().run()}><Highlighter size={14} /></Btn>
              <span className="mx-0.5 h-4 w-px bg-slate-200" />
              <Btn title="Heading" active={editor.isActive('heading', { level: 2 })} on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={14} /></Btn>
              <Btn title="Quote" active={editor.isActive('blockquote')} on={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={14} /></Btn>
              <Btn title="Align left" active={editor.isActive({ textAlign: 'left' })} on={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={14} /></Btn>
              <Btn title="Centre" active={editor.isActive({ textAlign: 'center' })} on={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter size={14} /></Btn>
            </div>
          </BubbleMenu>
          <EditorContent editor={editor} className="ip-editor" />
        </div>
      </div>
    </div>
  );
}

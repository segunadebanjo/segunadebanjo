import { createPortal } from 'react-dom';
import { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Node, Extension, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import {
  GripVertical, Pencil, Copy, Trash2, AlertTriangle, FileSpreadsheet, BookA, Table2, Scale, ListChecks, QrCode,
  Heading2, Heading3, List, ListOrdered, Quote, Minus, Grid3x3, Pilcrow,
} from 'lucide-react';
import { BLOCK_TYPES, blockToHtml } from '@shared/render.js';
import { Modal } from '../ui.jsx';
import BlockForm from './BlockForms.jsx';

/** Book-level context for node views (CTAs for QR cards, currency, book id). */
export const StudioCtx = createContext({ ctas: [], currency: 'NGN', bookId: null });

export const BLOCK_ICONS = {
  painPoint: AlertTriangle, claimCase: FileSpreadsheet, jargon: BookA, comparison: Table2, mythFact: Scale, riskChecklist: ListChecks, ctaCard: QrCode,
};

function BlockNodeView({ node, updateAttributes, deleteNode, editor, getPos, selected }) {
  const type = node.type.name;
  const meta = BLOCK_TYPES[type];
  const ctx = useContext(StudioCtx);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.attrs.data);
  const html = useMemo(() => blockToHtml(type, node.attrs.data, { currency: ctx.currency }), [type, node.attrs.data, ctx.currency]);
  const Icon = BLOCK_ICONS[type];

  // Newly inserted blocks open their editor straight away.
  useEffect(() => {
    if (node.attrs.data?.__new) {
      const { __new, ...rest } = node.attrs.data;
      setDraft(rest);
      setEditing(true);
      updateAttributes({ data: rest });
    }
  }, []);

  const duplicate = () => {
    const pos = getPos() + node.nodeSize;
    editor.chain().focus().insertContentAt(pos, { type, attrs: { data: node.attrs.data } }).run();
  };

  return (
    <NodeViewWrapper className="group relative my-5" data-drag-handle="">
      <div className={`absolute -top-3 left-3 z-10 flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1 py-0.5 text-[11px] shadow-sm transition ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} contentEditable={false}>
        <span className="flex cursor-grab items-center gap-1 px-1 font-semibold text-slate-500" data-drag-handle=""><GripVertical size={12} />{Icon && <Icon size={12} />}{meta?.label}</span>
        <button className="rounded p-1 hover:bg-slate-100" title="Edit block" onClick={() => { setDraft(node.attrs.data); setEditing(true); }}><Pencil size={12} /></button>
        <button className="rounded p-1 hover:bg-slate-100" title="Duplicate" onClick={duplicate}><Copy size={12} /></button>
        <button className="rounded p-1 text-red-500 hover:bg-red-50" title="Delete" onClick={deleteNode}><Trash2 size={12} /></button>
      </div>
      <div className="ip-nodeview cursor-pointer" contentEditable={false} onDoubleClick={() => { setDraft(node.attrs.data); setEditing(true); }} dangerouslySetInnerHTML={{ __html: html }} />
      {editing && createPortal(<Modal open={editing} onClose={() => setEditing(false)} title={`Edit ${meta?.label}`} subtitle={meta?.description} size="lg"
        footer={<><button className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button><button className="btn-primary" onClick={() => { updateAttributes({ data: draft }); setEditing(false); }}>Save block</button></>}>
        <div className="grid gap-5 lg:grid-cols-2">
          <div><BlockForm type={type} data={draft} onChange={setDraft} ctas={ctx.ctas} bookId={ctx.bookId} currency={ctx.currency} /></div>
          <div>
            <div className="label">Live preview</div>
            <div className="ip-scope ip-nodeview rounded-lg bg-slate-50 p-3" dangerouslySetInnerHTML={{ __html: blockToHtml(type, draft, { currency: ctx.currency }) }} />
          </div>
        </div>
      </Modal>, document.body)}
    </NodeViewWrapper>
  );
}

function makeBlockNode(name) {
  return Node.create({
    name,
    group: 'block',
    atom: true,
    draggable: true,
    selectable: true,
    addAttributes() {
      return {
        data: {
          default: BLOCK_TYPES[name].defaults,
          parseHTML: (el) => { try { return JSON.parse(el.getAttribute('data-json') || '{}'); } catch { return {}; } },
          renderHTML: (attrs) => ({ 'data-json': JSON.stringify(attrs.data || {}) }),
        },
      };
    },
    parseHTML() { return [{ tag: `div[data-ip-block="${name}"]` }]; },
    renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-ip-block': name })]; },
    addNodeView() { return ReactNodeViewRenderer(BlockNodeView); },
  });
}

export const blockNodes = Object.keys(BLOCK_TYPES).map(makeBlockNode);

export const insertBlock = (editor, type, range) => {
  const chain = editor.chain().focus();
  if (range) chain.deleteRange(range);
  chain.insertContent({ type, attrs: { data: { ...BLOCK_TYPES[type].defaults, __new: true } } }).run();
};

// ---- Slash command menu -------------------------------------------------------------------

export const SLASH_ITEMS = [
  { group: 'Text', title: 'Paragraph', icon: Pilcrow, run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
  { group: 'Text', title: 'Heading', icon: Heading2, run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 2 }).run() },
  { group: 'Text', title: 'Subheading', icon: Heading3, run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 3 }).run() },
  { group: 'Text', title: 'Bullet list', icon: List, run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { group: 'Text', title: 'Numbered list', icon: ListOrdered, run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { group: 'Text', title: 'Quote', icon: Quote, run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { group: 'Text', title: 'Scene break', icon: Minus, run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
  { group: 'Text', title: 'Plain table', icon: Grid3x3, run: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  ...Object.entries(BLOCK_TYPES).map(([type, m]) => ({ group: 'Insurance visual blocks', title: m.label, description: m.description, icon: BLOCK_ICONS[type], run: (e, r) => insertBlock(e, type, r) })),
];

const SlashMenu = forwardRef(({ items, command }, ref) => {
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [items]);
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowDown') { setIdx((i) => (i + 1) % Math.max(items.length, 1)); return true; }
      if (event.key === 'ArrowUp') { setIdx((i) => (i - 1 + items.length) % Math.max(items.length, 1)); return true; }
      if (event.key === 'Enter') { if (items[idx]) command(items[idx]); return true; }
      return false;
    },
  }));
  if (!items.length) return <div className="card px-3 py-2 text-xs text-slate-500">No matching blocks</div>;
  let lastGroup = null;
  return (
    <div className="card max-h-80 w-72 overflow-y-auto p-1">
      {items.map((it, i) => {
        const header = it.group !== lastGroup ? (lastGroup = it.group) : null;
        return (
          <div key={it.title}>
            {header && <div className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{header}</div>}
            <button onMouseDown={(e) => { e.preventDefault(); command(it); }} onMouseEnter={() => setIdx(i)}
              className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left ${i === idx ? 'bg-gold-50' : ''}`}>
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded ${it.group === 'Text' ? 'bg-slate-100 text-slate-600' : 'bg-navy-800 text-gold-400'}`}>{it.icon && <it.icon size={13} />}</span>
              <span><span className="block text-sm font-semibold text-slate-700">{it.title}</span>{it.description && <span className="block text-[11px] text-slate-500">{it.description}</span>}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
});

export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        items: ({ query }) => SLASH_ITEMS.filter((i) => i.title.toLowerCase().includes(query.toLowerCase())).slice(0, 20),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let renderer;
          let el;
          const place = (rect) => {
            if (!rect || !el) return;
            const r = rect();
            if (!r) return;
            const below = r.bottom + 330 < window.innerHeight;
            el.style.left = `${Math.min(r.left, window.innerWidth - 300)}px`;
            el.style.top = below ? `${r.bottom + 6}px` : `${Math.max(8, r.top - 330)}px`;
          };
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashMenu, { props, editor: props.editor });
              el = document.createElement('div');
              el.style.position = 'fixed';
              el.style.zIndex = 70;
              el.appendChild(renderer.element);
              document.body.appendChild(el);
              place(props.clientRect);
            },
            onUpdate: (props) => { renderer?.updateProps(props); place(props.clientRect); },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') { el?.remove(); return true; }
              return renderer?.ref?.onKeyDown(props) || false;
            },
            onExit: () => { el?.remove(); renderer?.destroy(); el = null; },
          };
        },
      }),
    ];
  },
});

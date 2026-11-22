import { useState } from 'react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronDown, ChevronRight, Plus, MoreHorizontal, Trash2, FolderInput, Wand2, Sparkles } from 'lucide-react';
import { SECTION_TYPES, MATTER_SUBTYPES } from '@shared/constants.js';
import { Progress } from '../ui.jsx';

const STATUS_DOT = { outline: 'bg-slate-300', drafting: 'bg-sky-500', polishing: 'bg-amber-500', complete: 'bg-emerald-500' };
const FRONT_GEN = ['title_page', 'copyright', 'dedication', 'who_this_is_for'];
const BACK_GEN = ['glossary', 'claims_directory', 'about_author', 'next_steps'];

function Item({ ch, label, active, onSelect, onDelete, onMove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ch.id });
  const [menu, setMenu] = useState(false);
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative flex items-center gap-1 rounded-md py-1 pl-0.5 pr-1 text-sm ${isDragging ? 'z-10 bg-white shadow-lg' : ''} ${active ? 'bg-gold-50 text-navy-800' : 'text-slate-600 hover:bg-slate-100'}`}>
      <button className="cursor-grab p-0.5 text-slate-300 opacity-0 hover:text-slate-500 group-hover:opacity-100" {...attributes} {...listeners} aria-label="Drag to reorder"><GripVertical size={13} /></button>
      <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[ch.status]}`} title={ch.status} />
      <button className="min-w-0 flex-1 text-left" onClick={onSelect}>
        {label && <span className="block text-[10px] font-bold uppercase tracking-wider text-gold-600">{label}</span>}
        <span className={`block truncate ${active ? 'font-semibold' : ''}`}>{ch.title}</span>
      </button>
      <span className="text-[10px] tabular-nums text-slate-400">{ch.word_count ? ch.word_count.toLocaleString() : ''}</span>
      <button className="p-0.5 text-slate-400 opacity-0 hover:text-slate-700 group-hover:opacity-100" onClick={() => setMenu((m) => !m)}><MoreHorizontal size={14} /></button>
      {menu && (
        <div className="card absolute right-0 top-7 z-30 w-48 p-1 text-xs" onMouseLeave={() => setMenu(false)}>
          <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400"><FolderInput size={11} className="mr-1 inline" />Move to</div>
          {SECTION_TYPES.filter((s) => s.id !== ch.section_type).map((s) => (
            <button key={s.id} className="block w-full rounded px-2 py-1 text-left hover:bg-slate-100" onClick={() => { setMenu(false); onMove(s.id); }}>{s.label}</button>
          ))}
          <button className="mt-1 flex w-full items-center gap-1 rounded px-2 py-1 text-left text-red-600 hover:bg-red-50" onClick={() => { setMenu(false); onDelete(); }}><Trash2 size={12} />Delete section</button>
        </div>
      )}
    </div>
  );
}

export default function Navigator({ book, chapters, labels, activeId, onSelect, onReorder, onAdd, onGenerateMatter, onDelete, onMove, onWizard }) {
  const [collapsed, setCollapsed] = useState({});
  const [gen, setGen] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const total = chapters.reduce((a, c) => a + (c.word_count || 0), 0);
  const complete = chapters.filter((c) => c.status === 'complete').length;

  const dragEnd = (section) => ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const items = chapters.filter((c) => c.section_type === section);
    const from = items.findIndex((c) => c.id === active.id);
    const to = items.findIndex((c) => c.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(section, arrayMove(items, from, to));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Manuscript</div>
        <div className="mt-2 flex items-baseline justify-between text-xs text-slate-500">
          <span><b className="text-navy-800">{total.toLocaleString()}</b> / {Number(book.target_word_count || 0).toLocaleString()} words</span>
          <span>{complete}/{chapters.length} done</span>
        </div>
        <Progress className="mt-1.5" value={book.target_word_count ? (total / book.target_word_count) * 100 : 0} />
        <button className="btn-outline btn-sm mt-3 w-full" onClick={onWizard}><Sparkles size={13} className="text-gold-500" />AI Pain-Point Architect</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {SECTION_TYPES.map((s) => {
          const items = chapters.filter((c) => c.section_type === s.id);
          const isOpen = !collapsed[s.id];
          const genList = s.id === 'front_matter' ? FRONT_GEN : s.id === 'back_matter' ? BACK_GEN : null;
          return (
            <div key={s.id} className="mb-2">
              <div className="flex items-center gap-1 px-1 py-1">
                <button className="flex flex-1 items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500" onClick={() => setCollapsed((c) => ({ ...c, [s.id]: isOpen }))}>
                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}{s.label}<span className="font-normal text-slate-400">({items.length})</span>
                </button>
                {genList && (
                  <div className="relative">
                    <button className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-gold-600" title={`Generate ${s.label}`} onClick={() => setGen(gen === s.id ? null : s.id)}><Wand2 size={13} /></button>
                    {gen === s.id && (
                      <div className="card absolute right-0 top-6 z-30 w-60 p-1 text-xs" onMouseLeave={() => setGen(null)}>
                        <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">One-click generators</div>
                        {genList.map((g) => (
                          <button key={g} className="block w-full rounded px-2 py-1.5 text-left hover:bg-gold-50" onClick={() => { setGen(null); onGenerateMatter(g); }}>{MATTER_SUBTYPES[g]}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-navy-800" title={`Add to ${s.label}`} onClick={() => onAdd(s.id)}><Plus size={14} /></button>
              </div>
              {isOpen && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd(s.id)}>
                  <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    {items.map((c) => (
                      <Item key={c.id} ch={c} label={labels[c.id]} active={c.id === activeId} onSelect={() => onSelect(c.id)} onDelete={() => onDelete(c)} onMove={(to) => onMove(c, to)} />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
              {isOpen && !items.length && <div className="px-6 py-1 text-xs italic text-slate-400">Empty</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

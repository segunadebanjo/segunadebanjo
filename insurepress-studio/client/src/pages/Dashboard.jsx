import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Sparkles, PenLine, Image, BadgeDollarSign, Trash2, BookOpen, FileText } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Modal, Field, Spinner, StatusBadge, Progress, Empty, useToast } from '../components/ui.jsx';
import CoverThumb from '../components/CoverThumb.jsx';
import RevenuePlanner from '../components/RevenuePlanner.jsx';
import BlueprintWizard from '../components/BlueprintWizard.jsx';
import { fmtMoney, TRIM_SIZES } from '@shared/constants.js';
import { THEMES } from '@shared/themes.js';

function NewBookModal({ open, onClose, brands }) {
  const nav = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: '', subtitle: '', author_name: '', target_persona: '', currency: 'NGN', price_amount: 7500, trim_size: '6x9', theme_preset: 'executive-navy', monetization_goal: 'hybrid', target_word_count: 30000 });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const create = async () => {
    setBusy(true);
    try {
      const full = await api.post('/books', { ...f, brand_kit_id: brands[0]?.id, price_amount: Number(f.price_amount), target_word_count: Number(f.target_word_count) });
      toast('Book created with front & back matter');
      nav(`/books/${full.book.id}`);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Start a new book" subtitle="You can change everything later in Book Settings." size="md"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={create} disabled={busy || !f.title.trim()}>{busy && <Spinner />}Create book</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Title" className="col-span-2"><input className="input" value={f.title} onChange={set('title')} autoFocus /></Field>
        <Field label="Subtitle" className="col-span-2"><input className="input" value={f.subtitle} onChange={set('subtitle')} /></Field>
        <Field label="Author name"><input className="input" value={f.author_name} onChange={set('author_name')} /></Field>
        <Field label="Target reader"><input className="input" value={f.target_persona} onChange={set('target_persona')} placeholder="e.g. Lagos SME owners" /></Field>
        <Field label="Currency"><select className="input" value={f.currency} onChange={(e) => setF((x) => ({ ...x, currency: e.target.value, price_amount: e.target.value === 'USD' ? 15 : 7500 }))}><option value="NGN">₦ Naira (NGN)</option><option value="USD">$ US Dollar (USD)</option></select></Field>
        <Field label="Price"><input className="input" type="number" value={f.price_amount} onChange={set('price_amount')} /></Field>
        <Field label="Trim size"><select className="input" value={f.trim_size} onChange={set('trim_size')}>{Object.values(TRIM_SIZES).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
        <Field label="Theme"><select className="input" value={f.theme_preset} onChange={set('theme_preset')}>{Object.values(THEMES).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="Monetization goal"><select className="input" value={f.monetization_goal} onChange={set('monetization_goal')}><option value="direct_sales">Direct sales</option><option value="lead_generation">Lead generation</option><option value="hybrid">Hybrid</option></select></Field>
        <Field label="Target word count"><input className="input" type="number" value={f.target_word_count} onChange={set('target_word_count')} /></Field>
      </div>
    </Modal>
  );
}

export default function Dashboard() {
  const toast = useToast();
  const { user } = useAuth();
  const [books, setBooks] = useState(null);
  const [brands, setBrands] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [plannerBookId, setPlannerBookId] = useState(null);

  const load = () => Promise.all([api.get('/books'), api.get('/brand-kits')]).then(([b, k]) => { setBooks(b); setBrands(k); }).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); }, []);
  const brandFor = (b) => brands.find((k) => k.id === b.brand_kit_id) || brands[0];
  const plannerBook = useMemo(() => books?.find((b) => b.id === plannerBookId) || books?.[0], [books, plannerBookId]);

  const remove = async (b) => {
    if (!confirm(`Delete “${b.title}” and all its chapters? This cannot be undone.`)) return;
    await api.del(`/books/${b.id}`);
    toast('Book deleted');
    load();
  };

  const totals = useMemo(() => (books || []).reduce((a, b) => ({ words: a.words + b.word_count, chapters: a.chapters + b.chapter_count }), { words: 0, chapters: 0 }), [books]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="font-serif text-2xl font-black text-navy-800">Your Book Library</h1>
            <p className="text-sm text-slate-500">Research, write, design and publish insurance books that sell — and bring you qualified brokerage leads.</p>
          </div>
          <div className="ml-auto flex gap-2">
            <button className="btn-outline" onClick={() => setShowNew(true)}><Plus size={16} />Blank book</button>
            <button className="btn-gold" onClick={() => setShowWizard(true)}><Sparkles size={16} />AI Blueprint Wizard</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[['Books', books?.length ?? '–', BookOpen], ['Sections', totals.chapters, FileText], ['Words written', totals.words.toLocaleString(), PenLine]].map(([l, v, Icon]) => (
            <div key={l} className="card flex items-center gap-3 p-4"><Icon size={20} className="text-gold-500" /><div><div className="text-xl font-black text-navy-800">{v}</div><div className="text-xs text-slate-500">{l}</div></div></div>
          ))}
        </div>

        {!books ? <div className="flex justify-center py-16"><Spinner size={24} /></div> : books.length === 0 ? (
          <div className="card"><Empty icon={BookOpen} title="No books yet">Use the AI Blueprint Wizard to turn an audience’s pain points into a full outline, or start from a blank book.{user?.role === 'admin' && <> Run <code>npm run seed</code> on the server to load the “Sleep Soundly” sample.</>}</Empty></div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {books.map((b) => {
              const pct = b.target_word_count ? (b.word_count / b.target_word_count) * 100 : 0;
              return (
                <div key={b.id} className="card flex gap-4 p-4">
                  <Link to={`/books/${b.id}`} className="shrink-0"><CoverThumb book={b} brand={brandFor(b)} width={104} /></Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start gap-2">
                      <Link to={`/books/${b.id}`} className="line-clamp-2 font-serif font-bold leading-snug text-navy-800 hover:underline">{b.title}</Link>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{b.subtitle}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-bold text-gold-600">{fmtMoney(b.price_amount, b.currency)}</span>·<span>{b.chapter_count} sections</span>·<span>{b.complete_count} complete</span>
                    </div>
                    <div className="mt-2"><Progress value={pct} /><div className="mt-1 text-[11px] text-slate-400">{b.word_count.toLocaleString()} / {b.target_word_count.toLocaleString()} words</div></div>
                    <div className="mt-auto flex flex-wrap gap-1 pt-3">
                      <Link to={`/books/${b.id}`} className="btn-primary btn-sm"><PenLine size={13} />Write</Link>
                      <Link to={`/books/${b.id}/cover`} className="btn-outline btn-sm"><Image size={13} />Cover</Link>
                      <Link to={`/books/${b.id}/monetize`} className="btn-outline btn-sm"><BadgeDollarSign size={13} />Monetize</Link>
                      <button className="btn-ghost btn-sm ml-auto text-slate-400 hover:text-red-600" onClick={() => remove(b)} title="Delete book"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {books?.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            Planner book:
            <select className="input w-auto py-1" value={plannerBook?.id || ''} onChange={(e) => setPlannerBookId(Number(e.target.value))}>
              {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
          </div>
        )}
        <RevenuePlanner key={plannerBook?.id || 'none'} book={plannerBook} />
      </div>
      <NewBookModal open={showNew} onClose={() => setShowNew(false)} brands={brands} />
      <BlueprintWizard open={showWizard} onClose={() => setShowWizard(false)} />
    </div>
  );
}

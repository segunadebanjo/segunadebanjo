import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, FileText } from 'lucide-react';
import { THEMES, DEVICE_PREVIEWS, bookCss, htmlDocument, fontsHrefFor, renderChapterHtml, renderBookBody } from '@shared/themes.js';
import { TRIM_SIZES } from '@shared/constants.js';

// Client-side paginator injected into the print preview iframe: flows each chapter's elements into
// fixed-size pages (chapters start on a right-hand page), adds running heads and folios, and lays
// the pages out as two-page spreads.
const PAGINATE = (pageW, pageH, m, bookTitle) => `
(function(){
  const W=${pageW},H=${pageH},M=${JSON.stringify(m)},TITLE=${JSON.stringify(bookTitle)};
  const src=[...document.body.children];
  const book=document.createElement('div');book.id='ip-pages';
  let n=0;const pages=[];
  function newPage(sec,cont){
    n++;const recto=n%2===1;
    const p=document.createElement('div');p.className='ip-page '+(recto?'recto':'verso');
    p.style.cssText='width:'+W+'px;height:'+H+'px;padding:'+M.top+'px '+(recto?M.outside:M.inside)+'px '+M.bottom+'px '+(recto?M.inside:M.outside)+'px';
    const s=document.createElement('section');s.className=sec.className;
    const body=document.createElement('div');body.className='ip-ch-body'+(cont?' ip-cont':'');
    s.appendChild(body);p.appendChild(s);
    const folio=document.createElement('div');folio.className='ip-folio';folio.textContent=n;p.appendChild(folio);
    if(cont){const rh=document.createElement('div');rh.className='ip-rh '+(recto?'r':'v');rh.textContent=recto?(sec.dataset.title||''):TITLE;p.appendChild(rh);}
    book.appendChild(p);pages.push(p);return {page:p,body,section:s};
  }
  document.body.innerHTML='';document.body.appendChild(book);
  for(const sec of src){
    if(!sec.classList||!sec.classList.contains('ip-chapter')){continue;}
    if(n%2===1){const b=document.createElement('div');b.className='ip-page blank';b.style.cssText='width:'+W+'px;height:'+H+'px';book.appendChild(b);n++;}
    let cur=newPage(sec,false);
    const head=sec.querySelector(':scope > .ip-ch-head');
    if(head){cur.section.insertBefore(head,cur.body);}
    const bodySrc=sec.querySelector(':scope > .ip-ch-body');
    const kids=bodySrc?[...bodySrc.children]:[...sec.children].filter(k=>k!==head);
    for(const k of kids){
      cur.body.appendChild(k);
      if(cur.page.scrollHeight>H+1 && cur.body.children.length>1 || (cur.section.offsetHeight > H-M.top-M.bottom+1 && cur.body.children.length>1)){
        cur.body.removeChild(k);cur=newPage(sec,true);cur.body.appendChild(k);
      }
    }
  }
  // Spreads: first page alone on the right, then pairs.
  const all=[...book.children];book.innerHTML='';
  const first=document.createElement('div');first.className='ip-spread';const ph=document.createElement('div');ph.className='ip-page ghost';ph.style.cssText='width:'+W+'px;height:'+H+'px';first.appendChild(ph);if(all[0])first.appendChild(all[0]);book.appendChild(first);
  for(let i=1;i<all.length;i+=2){const s=document.createElement('div');s.className='ip-spread';s.appendChild(all[i]);if(all[i+1])s.appendChild(all[i+1]);book.appendChild(s);}
  parent.postMessage({ipPages:n},'*');
})();`;

const PRINT_SCREEN_CSS = `
html,body{background:#e2e8f0!important;margin:0}
#ip-pages{display:flex;flex-direction:column;align-items:center;gap:28px;padding:24px 0}
.ip-spread{display:flex;box-shadow:0 10px 30px rgba(15,23,42,.18)}
.ip-page{background:var(--paper,#fff);box-sizing:border-box;position:relative;overflow:hidden}
.ip-page.ghost{background:transparent;box-shadow:none}
.ip-page.verso{border-right:1px solid #e5e7eb}
.ip-page .ip-chapter{break-before:auto}
.ip-folio{position:absolute;bottom:22px;left:0;right:0;text-align:center;font:600 10px Inter,sans-serif;color:#64748b}
.ip-rh{position:absolute;top:26px;font:9px Inter,sans-serif;color:#94a3b8;letter-spacing:.08em}
.ip-rh.v{left:48px;font-style:italic}.ip-rh.r{right:48px;text-transform:uppercase}
.ip-cont > p:first-child::first-letter{float:none!important;font-size:inherit!important;line-height:inherit!important;padding:0!important;color:inherit!important;font-weight:inherit!important;font-family:inherit!important}
.ip-page .ip-ch-head{margin-top:.35in}
`;

export default function Preview({ book, brand, chapters, activeChapter, liveDoc, labels }) {
  const [device, setDevice] = useState('print6x9');
  const [theme, setTheme] = useState(book.theme_preset || 'executive-navy');
  const [scope, setScope] = useState('chapter');
  const [html, setHtml] = useState('');
  const [pages, setPages] = useState(null);
  const [frameH, setFrameH] = useState(1200);
  const wrap = useRef(null);
  const [wrapW, setWrapW] = useState(400);
  const dev = DEVICE_PREVIEWS[device];

  useEffect(() => setTheme(book.theme_preset || 'executive-navy'), [book.theme_preset]);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWrapW(e.contentRect.width));
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const onMsg = (e) => { if (e.data && e.data.ipPages) setPages(e.data.ipPages); };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Debounced build of the preview document.
  useEffect(() => {
    const t = setTimeout(() => {
      const live = chapters.map((c) => (activeChapter && c.id === activeChapter.id ? { ...c, ...activeChapter, content_json: liveDoc || c.content_json } : c));
      const body = scope === 'book' || !activeChapter
        ? renderBookBody({ book, brand, chapters: live, theme })
        : renderChapterHtml(live.find((c) => c.id === activeChapter.id), { label: labels[activeChapter.id], book, brand, theme });
      const isPrint = dev.mode === 'print';
      const ts = TRIM_SIZES[dev.trim || '6x9'];
      let css = bookCss({ themeId: theme, brand, mode: isPrint ? 'screen' : 'ebook', trim: ts.id });
      let extra = '';
      if (isPrint) {
        const px = (v) => Math.round(v * 96);
        css += PRINT_SCREEN_CSS + (THEMES[theme]?.warm ? ':root{--paper:#fffaf3}' : '');
        extra = `<script>window.addEventListener('load',()=>setTimeout(()=>{${PAGINATE(px(ts.width), px(ts.height), { top: px(ts.margins.top), bottom: px(ts.margins.bottom), inside: px(ts.margins.inside), outside: px(ts.margins.outside) }, book.title)}},350));</script>`;
      } else {
        css += 'body{padding:18px 20px!important;font-size:' + (device === 'tablet' ? '12.5pt' : '11.5pt') + '}';
      }
      setPages(null);
      setHtml(htmlDocument({ title: book.title, css, body, fontsHref: fontsHrefFor(theme, brand), extraHead: extra }));
    }, 450);
    return () => clearTimeout(t);
  }, [book, brand, chapters, activeChapter, liveDoc, theme, scope, device]);

  const frame = useMemo(() => {
    if (dev.mode === 'print') {
      const ts = TRIM_SIZES[dev.trim];
      const spreadW = ts.width * 96 * 2 + 40;
      const scale = Math.min(1, wrapW / spreadW);
      return { width: spreadW, scale };
    }
    const scale = Math.min(1, (wrapW - 24) / (dev.width + 28));
    return { width: dev.width, height: dev.height, scale };
  }, [dev, wrapW]);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-slate-200 p-3">
        <div className="grid grid-cols-2 gap-2">
          <select className="input py-1 text-xs" value={device} onChange={(e) => setDevice(e.target.value)}>
            {Object.values(DEVICE_PREVIEWS).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <select className="input py-1 text-xs" value={theme} onChange={(e) => setTheme(e.target.value)}>
            {Object.values(THEMES).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
            <button className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1 ${scope === 'chapter' ? 'bg-white shadow' : 'text-slate-500'}`} onClick={() => setScope('chapter')}><FileText size={12} />This section</button>
            <button className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1 ${scope === 'book' ? 'bg-white shadow' : 'text-slate-500'}`} onClick={() => setScope('book')}><BookOpen size={12} />Full book</button>
          </div>
          {dev.mode === 'print' && pages && <span className="whitespace-nowrap text-[11px] text-slate-400">{pages} pp</span>}
        </div>
        <p className="text-[11px] leading-snug text-slate-400">{THEMES[theme]?.description}</p>
      </div>
      <div ref={wrap} className="min-h-0 flex-1 overflow-auto bg-slate-200">
        {dev.mode === 'print' ? (
          <div style={{ width: frame.width * frame.scale, height: frameH * frame.scale }}>
            <PrintFrame html={html} width={frame.width} scale={frame.scale} onHeight={setFrameH} />
          </div>
        ) : (
          <div className="flex justify-center p-3">
            <div className="rounded-[28px] bg-slate-900 p-3.5 shadow-xl" style={{ width: (dev.width + 28) * frame.scale }}>
              <iframe title="E-reader preview" srcDoc={html} className="block w-full rounded-lg bg-white" style={{ height: dev.height * frame.scale }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PrintFrame({ html, width, scale, onHeight }) {
  const ref = useRef(null);
  const [h, setH] = useState(1200);
  useEffect(() => onHeight?.(h), [h]);
  useEffect(() => {
    const id = setInterval(() => {
      const doc = ref.current?.contentDocument;
      if (doc?.body) setH(Math.max(600, doc.body.scrollHeight));
    }, 700);
    return () => clearInterval(id);
  }, []);
  return (
    <iframe ref={ref} title="Print preview" srcDoc={html} scrolling="no"
      style={{ width, height: h, border: 0, transform: `scale(${scale})`, transformOrigin: 'top left', display: 'block' }} />
  );
}

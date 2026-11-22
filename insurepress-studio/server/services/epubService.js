// Reflowable EPUB 3.0 export (Selar, Amazon KDP, Apple Books, Kobo).
import epubPkg from 'epub-gen-memory';
import { config } from '../config.js';
import { bookCss, orderChapters, chapterLabels, renderChapterHtml } from '../../shared/themes.js';
import { putAsset, dataUrlToBuffer } from './assetStore.js';
import { renderCoverPng } from './pdfService.js';

const epub = epubPkg.default || epubPkg;

// epub-gen-memory downloads images by URL, so swap inline data: URLs for short-lived local URLs.
function externaliseImages(html) {
  return html.replace(/src="(data:image\/[^"]+)"/g, (_, data) => {
    const a = dataUrlToBuffer(data.replace(/&amp;/g, '&'));
    if (!a) return 'src=""';
    const id = putAsset(a.buffer, a.mime);
    return `src="http://127.0.0.1:${config.port}/api/assets/tmp/${id}.png"`;
  });
}

// EPUB readers handle inline SVG icons inconsistently; they are decorative, so drop them.
const stripSvg = (html) => html.replace(/<svg[\s\S]*?<\/svg>/g, '');

export async function buildBookEpub({ book, brand = {}, chapters, coverConfig, theme }) {
  const themeId = theme || book.theme_preset || 'executive-navy';
  const ordered = orderChapters(chapters);
  const labels = chapterLabels(ordered);
  const css = bookCss({ themeId, brand, mode: 'ebook' }).replace(/@page[^{]*\{[^}]*\}/g, '');

  const content = ordered.map((c) => ({
    title: labels[c.id] ? `${labels[c.id]}: ${c.title}` : c.title,
    content: externaliseImages(stripSvg(renderChapterHtml(c, { label: labels[c.id], book, brand, theme: themeId }))),
    beforeToc: c.section_type === 'front_matter',
    excludeFromToc: c.matter_subtype === 'title_page',
  }));

  let cover;
  try {
    const png = await renderCoverPng(coverConfig, { trim: '6x9', widthPx: 1600, book });
    cover = new File([png], 'cover.png', { type: 'image/png' });
  } catch (e) {
    console.warn('EPUB cover render skipped:', e.message);
  }

  const buffer = await epub(
    {
      title: book.title,
      author: book.author_name || brand.name || 'InsurePress Author',
      publisher: brand.name || 'InsurePress Studio',
      description: book.subtitle || book.core_pain_point || '',
      cover,
      css,
      lang: 'en',
      tocTitle: 'Contents',
      prependChapterTitles: false,
      numberChaptersInTOC: false,
      version: 3,
      ignoreFailedDownloads: true,
      verbose: false,
    },
    content,
  );
  return buffer;
}


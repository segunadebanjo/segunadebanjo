// Shared headless Chromium for PDF/PNG rendering.
import puppeteer from 'puppeteer';
import { config } from '../config.js';

let browserPromise = null;

export function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        headless: true,
        executablePath: config.chromePath || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
      })
      .catch((e) => {
        browserPromise = null;
        throw new Error(`Could not start headless Chromium (${e.message}). Install Chrome or set PUPPETEER_EXECUTABLE_PATH.`);
      });
  }
  return browserPromise;
}

/** Open a page with the given HTML, waiting for web fonts/images (with a timeout so offline still works). */
export async function withPage(html, fn, { viewport } = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    if (viewport) await page.setViewport(viewport);
    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 12000 });
    } catch {
      await page.setContent(html, { waitUntil: 'load', timeout: 20000 });
    }
    await page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {});
    return await fn(page);
  } finally {
    await page.close().catch(() => {});
  }
}

export async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    if (b) await b.close();
  }
}

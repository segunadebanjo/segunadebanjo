// Short-lived in-memory assets (QR codes, cover images) served over HTTP so that
// exporters which can only fetch URLs (e.g. the EPUB builder) can embed them.
import crypto from 'node:crypto';

const store = new Map();
const TTL_MS = 10 * 60 * 1000;

export function putAsset(buffer, mime = 'image/png') {
  const id = crypto.randomBytes(10).toString('hex');
  store.set(id, { buffer, mime, at: Date.now() });
  for (const [k, v] of store) if (Date.now() - v.at > TTL_MS) store.delete(k);
  return id;
}

export const getAsset = (id) => store.get(id) || null;

export function dataUrlToBuffer(dataUrl) {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl || '');
  if (!m) return null;
  return { mime: m[1], buffer: m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3])) };
}

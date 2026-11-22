export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`);
export const int = (v) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) ? n : null; };

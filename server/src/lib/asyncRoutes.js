// Make Express 4 forward rejected promises from async route handlers to the error middleware.
const Layer = require('express/lib/router/layer');
const orig = Layer.prototype.handle_request;
Layer.prototype.handle_request = function handle(req, res, next) {
  const fn = this.handle;
  if (fn.length > 3) return orig.call(this, req, res, next); // error handlers
  try {
    const r = fn(req, res, next);
    if (r && typeof r.catch === 'function') r.catch(next);
  } catch (e) {
    next(e);
  }
};

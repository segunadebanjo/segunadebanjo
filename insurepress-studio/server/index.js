import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { pool } from './db/pool.js';
import { requireAuth } from './lib/auth.js';
import { getAsset } from './services/assetStore.js';
import { aiStatus } from './services/aiService.js';
import { verifyMail } from './services/mailService.js';
import { closeBrowser } from './services/browser.js';
import booksRoutes from './routes/books.js';
import brandRoutes from './routes/brand.js';
import ctaRoutes from './routes/ctas.js';
import aiRoutes from './routes/ai.js';
import exportRoutes, { downloadExport } from './routes/exports.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind Caddy: honour X-Forwarded-Proto so session cookies are Secure on HTTPS
// The web app is served from the same origin; only allow cross-origin credentialed calls from listed origins.
if (config.corsOrigin !== '*') app.use(cors({ origin: config.corsOrigin.split(','), credentials: true }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', async (req, res) => {
  let db = 'ok';
  try { await pool.query('SELECT 1'); } catch (e) { db = `error: ${e.message}`; }
  res.json({ ok: db === 'ok', db, ai: aiStatus() });
});

// Public: sign-in endpoints, and short-lived random-ID images fetched by the EPUB builder.
app.use('/api', authRoutes);
app.get('/api/assets/tmp/:id', (req, res) => {
  const a = getAsset(String(req.params.id).replace(/\.\w+$/, ''));
  if (!a) return res.status(404).end();
  res.setHeader('Content-Type', a.mime);
  res.send(a.buffer);
});

// Everything else requires a signed-in user; all data is scoped to that user.
app.use('/api', requireAuth, booksRoutes, brandRoutes, ctaRoutes, aiRoutes, exportRoutes, userRoutes);

fs.mkdirSync(config.exportDir, { recursive: true });
app.get('/exports/:file', requireAuth, downloadExport);

if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist));
  app.get(/^\/(?!api|exports).*/, (req, res) => res.sendFile('index.html', { root: config.clientDist }));
}

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Server error' });
});

// Retry so the app can start before the database container is ready.
for (let attempt = 1; ; attempt++) {
  try { await migrate({ quiet: true }); break; } catch (e) {
    if (attempt >= 20) { console.error(`\u26A0 Auto-migration skipped: ${e.message}`); break; }
    console.log(`Waiting for database (${e.code || e.message})\u2026 retry ${attempt}/20`);
    await new Promise((r) => setTimeout(r, 3000));
  }
}
verifyMail();
const server = app.listen(config.port, () => {
  const ai = aiStatus();
  console.log(`InsurePress Studio API on http://localhost:${config.port}  (AI: ${ai.mode}${ai.mode === 'live' ? ` · ${ai.model}` : ''})`);
});

const shutdown = async () => { server.close(); await closeBrowser(); await pool.end().catch(() => {}); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

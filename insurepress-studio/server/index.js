import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { pool } from './db/pool.js';
import { currentUser } from './lib/repo.js';
import { aiStatus } from './services/aiService.js';
import { closeBrowser } from './services/browser.js';
import booksRoutes from './routes/books.js';
import brandRoutes from './routes/brand.js';
import ctaRoutes from './routes/ctas.js';
import aiRoutes from './routes/ai.js';
import exportRoutes from './routes/exports.js';

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', async (req, res) => {
  let db = 'ok';
  try { await pool.query('SELECT 1'); } catch (e) { db = `error: ${e.message}`; }
  res.json({ ok: db === 'ok', db, ai: aiStatus() });
});

app.use('/api', currentUser, booksRoutes, brandRoutes, ctaRoutes, aiRoutes, exportRoutes);

fs.mkdirSync(config.exportDir, { recursive: true });
app.use('/exports', express.static(config.exportDir, { setHeaders: (res) => res.setHeader('Content-Disposition', 'attachment') }));

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

await migrate({ quiet: true }).catch((e) => console.error(`⚠ Auto-migration skipped: ${e.message}`));
const server = app.listen(config.port, () => {
  const ai = aiStatus();
  console.log(`InsurePress Studio API on http://localhost:${config.port}  (AI: ${ai.mode}${ai.mode === 'live' ? ` · ${ai.model}` : ''})`);
});

const shutdown = async () => { server.close(); await closeBrowser(); await pool.end().catch(() => {}); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { prisma } from './db.js';
import { ah } from './lib/http.js';
import { errorHandler } from './middleware/errorHandler.js';
import { campaignsRouter } from './routes/campaigns.js';
import { complianceRouter } from './routes/compliance.js';
import { analyticsRouter, conversionsRouter, metricsRouter, optimizationRouter, platformsRouter } from './routes/misc.js';
import { productsRouter } from './routes/products.js';
import { webhooksRouter } from './routes/webhooks.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN.split(',').map((s) => s.trim()) }));
  app.use(express.json({ limit: '1mb' }));
  if (config.NODE_ENV !== 'test') app.use(morgan('dev'));

  app.get(
    '/api/health',
    ah(async (_req, res) => {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, sandboxMode: config.SANDBOX_MODE, time: new Date().toISOString() });
    }),
  );
  app.use('/api/products', productsRouter);
  app.use('/api/campaigns', campaignsRouter);
  app.use('/api/compliance', complianceRouter);
  app.use('/api/webhooks', webhooksRouter);
  app.use('/api/conversions', conversionsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/optimization', optimizationRouter);
  app.use('/api/metrics', metricsRouter);
  app.use('/api/platforms', platformsRouter);
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Serve the React app from the same origin when it has been built (npm run build),
  // so http://localhost:4100 opens the UI instead of a 404.
  const clientDist = config.CLIENT_DIST ?? fileURLToPath(new URL('../../client/dist', import.meta.url));
  if (existsSync(`${clientDist}/index.html`)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.sendFile('index.html', { root: clientDist });
    });
  } else {
    app.get('/', (_req, res) => {
      res.json({
        name: 'Insurance Ad Manager API',
        message: 'The UI is not built into this server. In development open the Vite app at http://localhost:5173, or run `npm run build` and restart to serve the UI here.',
        health: '/api/health',
      });
    });
  }
  app.use(errorHandler);
  return app;
}

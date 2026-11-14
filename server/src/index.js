require('./lib/asyncRoutes');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { requireAuth, requireApiKey } = require('./middleware/auth');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, frameguard: false })); // frameguard off: the add-on may be embedded in the ERP via iframe
app.use(cors({ origin: config.corsOrigin.split(',').map((s) => s.trim()), credentials: true }));
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ingest', requireApiKey, require('./routes/ingest'));
app.use('/api/reports', requireAuth, require('./routes/reports'));
app.use('/api/dashboard', requireAuth, require('./routes/dashboard'));
app.use('/api/data', requireAuth, require('./routes/data'));
app.use('/api/settings', requireAuth, require('./routes/settings'));
app.use('/api/users', requireAuth, require('./routes/users'));
app.use('/api/audit', requireAuth, require('./routes/audit'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React app in production (client/dist)
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || (err.code === 'ER_DUP_ENTRY' ? 409 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && config.isProd ? 'Internal server error' : err.message });
});

if (require.main === module) {
  app.listen(config.port, () => console.log(`NAICOM returns API listening on :${config.port}`));
  if (config.erpDb && config.erpSyncCron) {
    const cron = require('node-cron');
    const { syncFromErp } = require('./erp/connector');
    cron.schedule(config.erpSyncCron, () => {
      syncFromErp({}).then((r) => console.log('Scheduled ERP sync', JSON.stringify(r))).catch((e) => console.error('ERP sync failed', e.message));
    });
    console.log(`ERP sync scheduled: ${config.erpSyncCron}`);
  }
}

module.exports = app;

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const env = (k, d) => (process.env[k] === undefined || process.env[k] === '' ? d : process.env[k]);

module.exports = {
  port: Number(env('PORT', 4000)),
  isProd: env('NODE_ENV', 'development') === 'production',
  jwtSecret: env('JWT_SECRET', 'dev-secret-change-me'),
  corsOrigin: env('CORS_ORIGIN', 'http://localhost:5173'),
  db: {
    host: env('DB_HOST', '127.0.0.1'),
    port: Number(env('DB_PORT', 3306)),
    user: env('DB_USER', 'naicom'),
    password: env('DB_PASSWORD', 'naicom'),
    database: env('DB_NAME', 'naicom_returns'),
  },
  erpDb: env('ERP_DB_HOST', '')
    ? {
        host: env('ERP_DB_HOST'),
        port: Number(env('ERP_DB_PORT', 3306)),
        user: env('ERP_DB_USER'),
        password: env('ERP_DB_PASSWORD', ''),
        database: env('ERP_DB_NAME'),
      }
    : null,
  erpSyncCron: env('ERP_SYNC_CRON', ''),
  ingestApiKey: env('INGEST_API_KEY', ''),
  erpSsoSecret: env('ERP_SSO_SECRET', ''),
  admin: { email: env('ADMIN_EMAIL', 'admin@broker.local'), password: env('ADMIN_PASSWORD', 'Admin@123') },
};

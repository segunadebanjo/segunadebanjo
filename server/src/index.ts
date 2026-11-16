import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { startScheduler } from './jobs/scheduler.js';
import { mailTransport } from './services/mail/mailer.js';
import { ensureFirstAdmin } from './services/auth/firstAdmin.js';

// Hosts without a shell (e.g. Render free plan): create the first admin from env vars on an empty database.
await ensureFirstAdmin().catch((e) => console.error('[setup] Could not check for the first admin:', e));

const app = createApp();
const server = app.listen(config.PORT, () => {
  console.log(`Insurance Ad Manager API on http://localhost:${config.PORT} (SANDBOX_MODE=${config.SANDBOX_MODE})`);
  if (mailTransport() !== 'smtp') {
    const msg = 'SMTP_HOST is not set: password-reset emails are not delivered';
    console.warn(config.NODE_ENV === 'production' ? `[mail] WARNING: ${msg}. Configure SMTP so users can reset their passwords.` : `[mail] ${msg}; they are printed to this console instead.`);
  }
  startScheduler();
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

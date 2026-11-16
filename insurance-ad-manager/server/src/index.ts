import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { startScheduler } from './jobs/scheduler.js';

const app = createApp();
const server = app.listen(config.PORT, () => {
  console.log(`Insurance Ad Manager API on http://localhost:${config.PORT} (SANDBOX_MODE=${config.SANDBOX_MODE})`);
  startScheduler();
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

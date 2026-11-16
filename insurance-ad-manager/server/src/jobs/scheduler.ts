import cron from 'node-cron';
import { config } from '../config.js';
import { syncMetrics } from '../services/metrics/sync.js';
import { runOptimization } from '../services/optimization/service.js';

let running = { sync: false, optimize: false };

export function startScheduler() {
  if (config.DISABLE_CRON) {
    console.log('[cron] disabled (DISABLE_CRON=true)');
    return;
  }
  cron.schedule(config.METRICS_SYNC_CRON, async () => {
    if (running.sync) return;
    running.sync = true;
    try {
      const r = await syncMetrics();
      console.log(`[cron] metrics sync: ${r.rows} rows across ${r.deployments} deployments${r.errors.length ? `, ${r.errors.length} errors` : ''}`);
    } catch (err) {
      console.error('[cron] metrics sync failed', err);
    } finally {
      running = { ...running, sync: false };
    }
  });
  cron.schedule(config.OPTIMIZATION_CRON, async () => {
    if (running.optimize) return;
    running.optimize = true;
    try {
      const r = await runOptimization();
      console.log(`[cron] optimization: ${r.created} new recommendations, ${r.autoApplied} auto-applied`);
    } catch (err) {
      console.error('[cron] optimization failed', err);
    } finally {
      running = { ...running, optimize: false };
    }
  });
  console.log(`[cron] metrics sync "${config.METRICS_SYNC_CRON}", optimization "${config.OPTIMIZATION_CRON}"`);
}

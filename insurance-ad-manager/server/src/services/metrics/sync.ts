import { prisma } from '../../db.js';
import { dec, num } from '../../lib/money.js';
import { getAdapter } from '../platforms/index.js';

const utcDay = (offset = 0) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offset));
};

/**
 * Pull daily delivery metrics (impressions/clicks/spend) for published deployments.
 * - Live adapters: overwrite delivery columns; funnel columns (quotes/policies/revenue) stay owned
 *   by the conversion webhook so nothing is double counted.
 * - Sandbox: only ACTIVE deployments accrue spend; synthetic funnel numbers are written too so the
 *   dashboard is meaningful without a real ERP feed (webhook events still add on top).
 */
export async function syncMetrics(opts: { days?: number } = {}) {
  const days = opts.days ?? 2;
  const since = utcDay(-(days - 1));
  const until = utcDay(0);
  const deployments = await prisma.platformDeployment.findMany({
    where: { externalCampaignId: { not: null }, status: { in: ['ACTIVE', 'PAUSED'] } },
    include: { campaign: { include: { product: true } } },
  });
  let rows = 0;
  const errors: { deploymentId: number; error: string }[] = [];
  for (const d of deployments) {
    const adapter = getAdapter(d.platform);
    if (adapter.mode === 'sandbox' && d.status !== 'ACTIVE') continue; // paused = no spend
    try {
      const metrics = await adapter.fetchDailyMetrics(d, since, until, {
        insuranceClass: d.campaign.product.insuranceClass,
        dailyBudget: num(d.dailyBudget),
        startingPremium: num(d.campaign.product.startingPremium),
        deploymentId: d.id,
      });
      for (const m of metrics) {
        const metricDate = new Date(`${m.date}T00:00:00Z`);
        const delivery = { impressions: m.impressions, clicks: m.clicks, spend: dec(m.spend) };
        const funnel =
          adapter.mode === 'sandbox'
            ? { quotesStarted: m.quotesStarted ?? 0, policiesSold: m.policiesSold ?? 0, revenueGenerated: dec(m.revenue ?? 0) }
            : {};
        const existing = await prisma.performanceMetric.findUnique({ where: { deploymentId_metricDate: { deploymentId: d.id, metricDate } } });
        if (existing) {
          // sandbox: keep the max of synthetic vs webhook-incremented funnel numbers
          const update =
            adapter.mode === 'sandbox'
              ? {
                  ...delivery,
                  quotesStarted: Math.max(existing.quotesStarted, funnel.quotesStarted ?? 0),
                  policiesSold: Math.max(existing.policiesSold, funnel.policiesSold ?? 0),
                  revenueGenerated: dec(Math.max(num(existing.revenueGenerated), num(funnel.revenueGenerated))),
                }
              : delivery;
          await prisma.performanceMetric.update({ where: { id: existing.id }, data: update });
        } else {
          await prisma.performanceMetric.create({ data: { deploymentId: d.id, metricDate, ...delivery, ...funnel } });
        }
        rows++;
      }
      await prisma.platformDeployment.update({ where: { id: d.id }, data: { lastSyncedAt: new Date() } });
    } catch (err) {
      errors.push({ deploymentId: d.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { deployments: deployments.length, rows, errors };
}

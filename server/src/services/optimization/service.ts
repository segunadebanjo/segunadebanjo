import { Prisma, type OptimizationRecommendation } from '@prisma/client';
import { prisma } from '../../db.js';
import { HttpError } from '../../lib/http.js';
import { dec, num } from '../../lib/money.js';
import { getAdapter } from '../platforms/index.js';
import { evaluateRule, type DeploymentWindow } from './evaluate.js';

const ngn = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;

async function windowFor(deploymentId: number, days: number, dailyBudget: number): Promise<DeploymentWindow> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const agg = await prisma.performanceMetric.aggregate({
    where: { deploymentId, metricDate: { gte: since } },
    _sum: { spend: true, clicks: true, impressions: true, quotesStarted: true, policiesSold: true, revenueGenerated: true },
  });
  return {
    spend: num(agg._sum.spend),
    clicks: agg._sum.clicks ?? 0,
    impressions: agg._sum.impressions ?? 0,
    quotesStarted: agg._sum.quotesStarted ?? 0,
    policiesSold: agg._sum.policiesSold ?? 0,
    revenue: num(agg._sum.revenueGenerated),
    dailyBudget,
  };
}

export async function runOptimization() {
  const rules = await prisma.optimizationRule.findMany({ where: { isEnabled: true } });
  const deployments = await prisma.platformDeployment.findMany({ where: { status: 'ACTIVE' } });
  const created: OptimizationRecommendation[] = [];
  const applied: number[] = [];
  for (const rule of rules) {
    for (const d of deployments) {
      const w = await windowFor(d.id, rule.lookbackDays, num(d.dailyBudget));
      const decision = evaluateRule(
        { ruleType: rule.ruleType, spendThreshold: rule.spendThreshold ? num(rule.spendThreshold) : null, targetRoas: rule.targetRoas ? num(rule.targetRoas) : null, maxCostPerPolicy: rule.maxCostPerPolicy ? num(rule.maxCostPerPolicy) : null, budgetIncreasePct: rule.budgetIncreasePct },
        w,
        ngn,
      );
      if (!decision) continue;
      const open = await prisma.optimizationRecommendation.findFirst({ where: { ruleId: rule.id, deploymentId: d.id, status: 'OPEN' } });
      if (open) continue;
      const rec = await prisma.optimizationRecommendation.create({
        data: {
          ruleId: rule.id,
          deploymentId: d.id,
          action: decision.action,
          reason: decision.reason,
          suggestedBudget: decision.suggestedBudget !== null ? dec(decision.suggestedBudget) : null,
          metricsSnapshot: { ...w, lookbackDays: rule.lookbackDays } as unknown as Prisma.InputJsonValue,
        },
      });
      created.push(rec);
      if (rule.mode === 'AUTO_APPLY') {
        await applyRecommendation(rec.id);
        applied.push(rec.id);
      }
    }
  }
  return { rulesEvaluated: rules.length, deploymentsEvaluated: deployments.length, created: created.length, autoApplied: applied.length };
}

export async function applyRecommendation(id: number) {
  const rec = await prisma.optimizationRecommendation.findUnique({ where: { id }, include: { deployment: true } });
  if (!rec) throw new HttpError(404, 'Recommendation not found');
  if (rec.status !== 'OPEN') throw new HttpError(409, `Recommendation is already ${rec.status}`);
  const d = rec.deployment;
  const adapter = getAdapter(d.platform);
  if (rec.action === 'PAUSE') {
    await adapter.setStatus(d, 'PAUSED');
    await prisma.platformDeployment.update({ where: { id: d.id }, data: { status: 'PAUSED' } });
  } else if (rec.action === 'INCREASE_BUDGET' && rec.suggestedBudget) {
    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: d.campaignId } });
    await adapter.updateBudget(d, num(rec.suggestedBudget), campaign.currency);
    await prisma.$transaction(async (tx) => {
      await tx.platformDeployment.update({ where: { id: d.id }, data: { dailyBudget: rec.suggestedBudget! } });
      const all = await tx.platformDeployment.findMany({ where: { campaignId: d.campaignId } });
      await tx.campaign.update({ where: { id: d.campaignId }, data: { totalDailyBudget: dec(all.reduce((s, x) => s + num(x.dailyBudget), 0)) } });
    });
  }
  return prisma.optimizationRecommendation.update({ where: { id }, data: { status: 'APPLIED', resolvedAt: new Date() } });
}

export async function dismissRecommendation(id: number) {
  const rec = await prisma.optimizationRecommendation.findUnique({ where: { id } });
  if (!rec) throw new HttpError(404, 'Recommendation not found');
  if (rec.status !== 'OPEN') throw new HttpError(409, `Recommendation is already ${rec.status}`);
  return prisma.optimizationRecommendation.update({ where: { id }, data: { status: 'DISMISSED', resolvedAt: new Date() } });
}

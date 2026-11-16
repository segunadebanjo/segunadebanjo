import type { InsuranceClass, Platform, Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { num, ratio, round2 } from '../lib/money.js';

interface Acc {
  spend: number;
  impressions: number;
  clicks: number;
  quotesStarted: number;
  policiesSold: number;
  revenue: number;
}
const empty = (): Acc => ({ spend: 0, impressions: 0, clicks: 0, quotesStarted: 0, policiesSold: 0, revenue: 0 });

export function kpis(a: Acc) {
  return {
    spend: round2(a.spend),
    impressions: a.impressions,
    clicks: a.clicks,
    ctr: ratio(a.clicks, a.impressions),
    cpc: ratio(a.spend, a.clicks),
    quotesStarted: a.quotesStarted,
    costPerQuote: ratio(a.spend, a.quotesStarted),
    policiesSold: a.policiesSold,
    costPerPolicy: ratio(a.spend, a.policiesSold),
    revenue: round2(a.revenue),
    roas: ratio(a.revenue, a.spend),
    quoteToPolicyRate: ratio(a.policiesSold, a.quotesStarted),
  };
}

export async function analyticsOverview(filters: { insuranceClass?: InsuranceClass; platform?: Platform; days: number }) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (filters.days - 1));
  const deploymentWhere: Prisma.PlatformDeploymentWhereInput = {
    ...(filters.platform ? { platform: filters.platform } : {}),
    ...(filters.insuranceClass ? { campaign: { product: { insuranceClass: filters.insuranceClass } } } : {}),
  };
  const rows = await prisma.performanceMetric.findMany({
    where: { metricDate: { gte: since }, deployment: deploymentWhere },
    include: { deployment: { select: { id: true, platform: true, campaignId: true, campaign: { select: { name: true, product: { select: { insuranceClass: true } } } } } } },
    orderBy: { metricDate: 'asc' },
  });

  const total = empty();
  const byDay = new Map<string, Acc>();
  const byPlatform = new Map<string, Acc>();
  const byClass = new Map<string, Acc>();
  const byCampaign = new Map<number, Acc & { name: string }>();
  for (let d = new Date(since); d <= new Date(); d.setUTCDate(d.getUTCDate() + 1)) byDay.set(d.toISOString().slice(0, 10), empty());

  for (const r of rows) {
    const add = (a: Acc) => {
      a.spend += num(r.spend);
      a.impressions += r.impressions;
      a.clicks += r.clicks;
      a.quotesStarted += r.quotesStarted;
      a.policiesSold += r.policiesSold;
      a.revenue += num(r.revenueGenerated);
    };
    add(total);
    const day = r.metricDate.toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, empty());
    add(byDay.get(day)!);
    const p = r.deployment.platform;
    if (!byPlatform.has(p)) byPlatform.set(p, empty());
    add(byPlatform.get(p)!);
    const c = r.deployment.campaign.product.insuranceClass;
    if (!byClass.has(c)) byClass.set(c, empty());
    add(byClass.get(c)!);
    if (!byCampaign.has(r.deployment.campaignId)) byCampaign.set(r.deployment.campaignId, { ...empty(), name: r.deployment.campaign.name });
    add(byCampaign.get(r.deployment.campaignId)!);
  }

  const applications = await prisma.conversionEvent.count({
    where: {
      eventType: 'APPLICATION_SUBMITTED',
      createdAt: { gte: since },
      ...(filters.platform ? { platform: filters.platform } : {}),
      ...(filters.insuranceClass ? { campaign: { product: { insuranceClass: filters.insuranceClass } } } : {}),
    },
  });

  const [activeCampaigns, openRecommendations] = await Promise.all([
    prisma.campaign.count({ where: { status: 'ACTIVE' } }),
    prisma.optimizationRecommendation.count({ where: { status: 'OPEN' } }),
  ]);

  return {
    filters: { ...filters, since: since.toISOString().slice(0, 10) },
    totals: kpis(total),
    daily: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, a]) => ({ date, spend: round2(a.spend), revenue: round2(a.revenue), roas: ratio(a.revenue, a.spend), quotesStarted: a.quotesStarted, policiesSold: a.policiesSold, clicks: a.clicks })),
    byPlatform: [...byPlatform.entries()].map(([platform, a]) => ({ platform, ...kpis(a) })).sort((a, b) => b.spend - a.spend),
    byClass: [...byClass.entries()].map(([insuranceClass, a]) => ({ insuranceClass, ...kpis(a) })).sort((a, b) => b.spend - a.spend),
    topCampaigns: [...byCampaign.entries()].map(([id, a]) => ({ campaignId: id, name: a.name, ...kpis(a) })).sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0)).slice(0, 8),
    funnel: [
      { stage: 'Impressions', value: total.impressions },
      { stage: 'Clicks', value: total.clicks },
      { stage: 'Quotes started', value: total.quotesStarted },
      { stage: 'Applications', value: applications },
      { stage: 'Policies sold', value: total.policiesSold },
    ],
    activeCampaigns,
    openRecommendations,
  };
}

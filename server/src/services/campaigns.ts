import { Prisma, type AdCreativeVariant, type Platform } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { HttpError } from '../lib/http.js';
import { dec, num, round2 } from '../lib/money.js';
import { appendQuery, buildUtmCampaign } from '../lib/strings.js';
import { asStringArray, PLATFORMS, type CreativeContent, type TargetLocations } from '../types.js';
import { generateCreatives } from './ai/creativeGenerator.js';
import { autoFixTargeting, checkCreative, checkTargeting, resolveSpecialAdCategory, type ComplianceFinding } from './compliance/engine.js';
import { getAdapter } from './platforms/index.js';

export const TargetLocationsSchema = z.object({
  countries: z.array(z.string().length(2)).min(1).default(['NG']),
  regions: z.array(z.string().min(1)).optional(),
  cities: z.array(z.object({ name: z.string().min(1), radiusKm: z.number().positive().optional() })).optional(),
  postalCodes: z.array(z.string()).optional(),
  ageMin: z.number().int().min(13).max(65).optional(),
  ageMax: z.number().int().min(13).max(65).optional(),
  genders: z.array(z.enum(['male', 'female'])).optional(),
});

const PlatformEnum = z.enum(['FACEBOOK', 'INSTAGRAM', 'GOOGLE_SEARCH', 'GOOGLE_DISPLAY', 'LINKEDIN']);

export const CampaignInput = z.object({
  productId: z.number().int().positive(),
  name: z.string().min(3).max(160),
  objective: z.enum(['TRAFFIC', 'QUOTE_LEADS', 'POLICY_PURCHASE']),
  totalDailyBudget: z.number().positive().max(9_999_999_999),
  currency: z.string().length(3).optional(),
  targetLocations: TargetLocationsSchema,
  /** Percentage split per platform; must sum to 100. Platforms omitted / 0% are not deployed. */
  budgetSplit: z.partialRecord(PlatformEnum, z.number().min(0).max(100)),
});
export type CampaignInputT = z.infer<typeof CampaignInput>;

/** Convert a % split into DECIMAL(12,2) budgets that sum exactly to the total. */
export function splitBudget(total: number, split: Partial<Record<Platform, number>>): { platform: Platform; amount: number }[] {
  const entries = PLATFORMS.map((p) => ({ platform: p, pct: split[p] ?? 0 })).filter((e) => e.pct > 0);
  const sumPct = entries.reduce((s, e) => s + e.pct, 0);
  if (entries.length === 0) throw new HttpError(400, 'Allocate budget to at least one platform');
  if (Math.abs(sumPct - 100) > 0.01) throw new HttpError(400, `Budget split must total 100% (got ${sumPct}%)`);
  const totalCents = Math.round(total * 100);
  let allocated = 0;
  const out = entries.map((e, i) => {
    const cents = i === entries.length - 1 ? totalCents - allocated : Math.floor((totalCents * e.pct) / 100);
    allocated += cents;
    return { platform: e.platform, amount: cents / 100 };
  });
  return out;
}

export const campaignInclude = {
  product: true,
  deployments: { orderBy: { id: 'asc' } },
  variants: { orderBy: [{ platform: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.CampaignInclude;

export async function createCampaign(input: CampaignInputT) {
  const product = await prisma.insuranceProduct.findUnique({ where: { id: input.productId } });
  if (!product) throw new HttpError(400, 'Product not found');
  if (!product.isActive) throw new HttpError(400, 'Product is inactive');
  const allocations = splitBudget(input.totalDailyBudget, input.budgetSplit);
  const sac = resolveSpecialAdCategory(product.insuranceClass, allocations.map((a) => a.platform));

  return prisma.$transaction(async (tx) => {
    const c = await tx.campaign.create({
      data: {
        productId: product.id,
        name: input.name,
        objective: input.objective,
        totalDailyBudget: dec(input.totalDailyBudget),
        currency: input.currency ?? product.currency,
        targetLocations: input.targetLocations as Prisma.InputJsonValue,
        specialAdCategory: sac,
        deployments: { create: allocations.map((a) => ({ platform: a.platform, dailyBudget: dec(a.amount) })) },
      },
    });
    return tx.campaign.update({ where: { id: c.id }, data: { utmCampaign: buildUtmCampaign(c.id, c.name) }, include: campaignInclude });
  });
}

export async function updateCampaign(id: number, input: Partial<CampaignInputT>) {
  const existing = await prisma.campaign.findUnique({ where: { id }, include: { product: true, deployments: true } });
  if (!existing) throw new HttpError(404, 'Campaign not found');
  if (!['DRAFT', 'PENDING_REVIEW'].includes(existing.status) && (input.budgetSplit || input.productId))
    throw new HttpError(409, 'Budget split and product can only be changed before publishing');
  const productId = input.productId ?? existing.productId;
  const product = productId === existing.productId ? existing.product : await prisma.insuranceProduct.findUnique({ where: { id: productId } });
  if (!product) throw new HttpError(400, 'Product not found');

  return prisma.$transaction(async (tx) => {
    let platforms = existing.deployments.map((d) => d.platform);
    if (input.budgetSplit) {
      const total = input.totalDailyBudget ?? num(existing.totalDailyBudget);
      const allocations = splitBudget(total, input.budgetSplit);
      platforms = allocations.map((a) => a.platform);
      await tx.platformDeployment.deleteMany({ where: { campaignId: id, platform: { notIn: platforms } } });
      for (const a of allocations)
        await tx.platformDeployment.upsert({
          where: { campaignId_platform: { campaignId: id, platform: a.platform } },
          create: { campaignId: id, platform: a.platform, dailyBudget: dec(a.amount) },
          update: { dailyBudget: dec(a.amount) },
        });
    }
    return tx.campaign.update({
      where: { id },
      data: {
        productId,
        name: input.name,
        objective: input.objective,
        totalDailyBudget: input.totalDailyBudget !== undefined ? dec(input.totalDailyBudget) : undefined,
        targetLocations: input.targetLocations as Prisma.InputJsonValue | undefined,
        specialAdCategory: resolveSpecialAdCategory(product.insuranceClass, platforms),
      },
      include: campaignInclude,
    });
  });
}

export const variantToContent = (v: AdCreativeVariant): CreativeContent => ({
  platform: v.platform,
  hookAngle: v.hookAngle,
  headlines: asStringArray(v.headlines),
  primaryTexts: asStringArray(v.primaryTexts),
  descriptions: asStringArray(v.descriptions),
  callToAction: v.callToAction,
  mediaBriefOrUrl: v.mediaBriefOrUrl,
  keywords: v.keywords ? asStringArray(v.keywords) : null,
  targetingSuggestions: (v.targetingSuggestions as CreativeContent['targetingSuggestions']) ?? null,
});

const contentToData = (c: CreativeContent) => ({
  hookAngle: c.hookAngle.slice(0, 160),
  headlines: c.headlines,
  primaryTexts: c.primaryTexts,
  descriptions: c.descriptions,
  callToAction: c.callToAction.slice(0, 40),
  mediaBriefOrUrl: c.mediaBriefOrUrl ?? null,
  keywords: c.keywords ? (c.keywords as Prisma.InputJsonValue) : Prisma.JsonNull,
  targetingSuggestions: c.targetingSuggestions ? (c.targetingSuggestions as Prisma.InputJsonValue) : Prisma.JsonNull,
});

/** Generate creatives for every platform in the campaign, run compliance, replace existing variants. */
export async function generateForCampaign(campaignId: number, extraInstructions?: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { product: true, deployments: true } });
  if (!campaign) throw new HttpError(404, 'Campaign not found');
  if (!['DRAFT', 'PENDING_REVIEW'].includes(campaign.status)) throw new HttpError(409, 'Creatives can only be regenerated before publishing');
  const platforms = campaign.deployments.map((d) => d.platform);
  const result = await generateCreatives({
    product: campaign.product,
    objective: campaign.objective,
    platforms,
    targetLocations: campaign.targetLocations as unknown as TargetLocations,
    extraInstructions,
  });

  const checked = await Promise.all(result.creatives.map((c) => checkCreative(c, campaign.product)));
  await prisma.$transaction(async (tx) => {
    await tx.platformDeployment.updateMany({ where: { campaignId }, data: { variantId: null } });
    await tx.adCreativeVariant.deleteMany({ where: { campaignId } });
    const firstPerPlatform = new Set<Platform>();
    for (const r of checked) {
      const isSelected = !firstPerPlatform.has(r.content.platform);
      firstPerPlatform.add(r.content.platform);
      await tx.adCreativeVariant.create({
        data: {
          campaignId,
          platform: r.content.platform,
          ...contentToData(r.content),
          complianceStatus: r.status,
          complianceNotes: r.findings as unknown as Prisma.InputJsonValue,
          isSelected,
        },
      });
    }
    await tx.campaign.update({ where: { id: campaignId }, data: { status: 'PENDING_REVIEW' } });
  });
  const updated = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId }, include: campaignInclude });
  return { campaign: updated, source: result.source, note: result.note };
}

export const VariantUpdate = z.object({
  hookAngle: z.string().min(1).max(160).optional(),
  headlines: z.array(z.string()).min(1).max(15).optional(),
  primaryTexts: z.array(z.string()).max(5).optional(),
  descriptions: z.array(z.string()).max(5).optional(),
  callToAction: z.string().min(1).max(40).optional(),
  mediaBriefOrUrl: z.string().nullable().optional(),
  keywords: z.array(z.string()).nullable().optional(),
  isSelected: z.boolean().optional(),
});

export async function updateVariant(campaignId: number, variantId: number, patch: z.infer<typeof VariantUpdate>) {
  const v = await prisma.adCreativeVariant.findFirst({ where: { id: variantId, campaignId }, include: { campaign: { include: { product: true } } } });
  if (!v) throw new HttpError(404, 'Variant not found');
  const content: CreativeContent = { ...variantToContent(v), ...stripUndefined(patch) } as CreativeContent;
  const r = await checkCreative(content, v.campaign.product);
  return prisma.$transaction(async (tx) => {
    if (patch.isSelected) await tx.adCreativeVariant.updateMany({ where: { campaignId, platform: v.platform, id: { not: v.id } }, data: { isSelected: false } });
    return tx.adCreativeVariant.update({
      where: { id: v.id },
      data: { ...contentToData(r.content), complianceStatus: r.status, complianceNotes: r.findings as unknown as Prisma.InputJsonValue, isSelected: patch.isSelected ?? v.isSelected },
    });
  });
}

const stripUndefined = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/** Re-run compliance on all stored variants (optionally auto-fixing and using the AI pre-flight). */
export async function validateCampaign(campaignId: number, opts: { autoFix?: boolean; useAi?: boolean }) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { product: true, variants: true, deployments: true } });
  if (!campaign) throw new HttpError(404, 'Campaign not found');
  const sac = resolveSpecialAdCategory(campaign.product.insuranceClass, campaign.deployments.map((d) => d.platform));
  let targeting = campaign.targetLocations as unknown as TargetLocations;
  if (opts.autoFix && sac) targeting = autoFixTargeting(targeting);
  const targetingResult = checkTargeting(targeting, sac);

  const variants = [];
  let aiError: string | undefined;
  for (const v of campaign.variants) {
    const r = await checkCreative(variantToContent(v), campaign.product, opts);
    if (r.aiError) aiError = r.aiError;
    variants.push(
      await prisma.adCreativeVariant.update({
        where: { id: v.id },
        data: { ...(opts.autoFix ? contentToData(r.content) : {}), complianceStatus: r.status, complianceNotes: r.findings as unknown as Prisma.InputJsonValue },
      }),
    );
  }
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { specialAdCategory: sac, targetLocations: targeting as unknown as Prisma.InputJsonValue },
  });
  const selected = variants.filter((v) => v.isSelected);
  const blocked = selected.filter((v) => v.complianceStatus === 'BLOCKED').length + (targetingResult.status === 'BLOCKED' ? 1 : 0);
  return {
    campaignId,
    specialAdCategory: sac,
    targeting: targetingResult,
    variants: variants.map((v) => ({ id: v.id, platform: v.platform, hookAngle: v.hookAngle, isSelected: v.isSelected, status: v.complianceStatus, findings: v.complianceNotes as unknown as ComplianceFinding[] })),
    readyToPublish: blocked === 0 && selected.length > 0,
    aiError,
  };
}

/** Publish every deployment's selected variant through its adapter. Always lands PAUSED. */
export async function publishCampaign(campaignId: number) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { product: true, deployments: true, variants: true } });
  if (!campaign) throw new HttpError(404, 'Campaign not found');
  if (campaign.status === 'ARCHIVED') throw new HttpError(409, 'Campaign is archived');
  const targeting = campaign.targetLocations as unknown as TargetLocations;
  const sac = resolveSpecialAdCategory(campaign.product.insuranceClass, campaign.deployments.map((d) => d.platform));
  const t = checkTargeting(targeting, sac);
  if (t.status === 'BLOCKED') throw new HttpError(409, 'Targeting violates Special Ad Category rules', t.findings);

  const problems: string[] = [];
  const plan = campaign.deployments.map((d) => {
    const variant = campaign.variants.find((v) => v.platform === d.platform && v.isSelected);
    if (!variant) problems.push(`${d.platform}: no selected creative`);
    else if (variant.complianceStatus === 'BLOCKED') problems.push(`${d.platform}: selected creative "${variant.hookAngle}" is BLOCKED by compliance`);
    return { d, variant };
  });
  if (problems.length) throw new HttpError(409, 'Campaign is not ready to publish', problems);

  const results = [];
  for (const { d, variant } of plan) {
    if (d.externalCampaignId) {
      results.push({ platform: d.platform, status: 'ALREADY_PUBLISHED' });
      continue;
    }
    const adapter = getAdapter(d.platform);
    const landingUrl = appendQuery(campaign.product.landingPageUrl, {
      utm_source: d.platform.toLowerCase(),
      utm_medium: 'paid',
      utm_campaign: campaign.utmCampaign ?? buildUtmCampaign(campaign.id, campaign.name),
      utm_content: `v${variant!.id}`,
    });
    try {
      const res = await adapter.publish({
        platform: d.platform,
        campaignName: campaign.name,
        objective: campaign.objective,
        insuranceClass: campaign.product.insuranceClass,
        dailyBudget: num(d.dailyBudget),
        currency: campaign.currency,
        landingUrl,
        targeting,
        specialAdCategory: sac,
        creative: variantToContent(variant!),
      });
      await prisma.platformDeployment.update({
        where: { id: d.id },
        data: { variantId: variant!.id, externalCampaignId: res.externalCampaignId, externalAdsetId: res.externalAdsetId, externalAdId: res.externalAdId, status: 'PAUSED', lastError: null },
      });
      results.push({ platform: d.platform, status: 'PAUSED', mode: adapter.mode, externalCampaignId: res.externalCampaignId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.platformDeployment.update({ where: { id: d.id }, data: { status: 'ERROR', lastError: msg } });
      results.push({ platform: d.platform, status: 'ERROR', error: msg });
    }
  }
  const anyOk = results.some((r) => r.status === 'PAUSED' || r.status === 'ALREADY_PUBLISHED');
  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: anyOk ? 'PAUSED' : campaign.status, specialAdCategory: sac },
    include: campaignInclude,
  });
  return { campaign: updated, results };
}

export async function setCampaignStatus(campaignId: number, status: 'ACTIVE' | 'PAUSED') {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { deployments: true } });
  if (!campaign) throw new HttpError(404, 'Campaign not found');
  if (campaign.status === 'ARCHIVED') throw new HttpError(409, 'Campaign is archived');
  const published = campaign.deployments.filter((d) => d.externalCampaignId);
  if (published.length === 0) throw new HttpError(409, 'Publish the campaign first');
  const results = [];
  for (const d of published) {
    try {
      await getAdapter(d.platform).setStatus(d, status);
      await prisma.platformDeployment.update({ where: { id: d.id }, data: { status, lastError: null } });
      results.push({ platform: d.platform, status });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.platformDeployment.update({ where: { id: d.id }, data: { lastError: msg } });
      results.push({ platform: d.platform, status: 'ERROR', error: msg });
    }
  }
  const updated = await prisma.campaign.update({ where: { id: campaignId }, data: { status }, include: campaignInclude });
  return { campaign: updated, results };
}

/** 30-day totals per deployment for the campaign detail view. */
export async function campaignPerformance(campaignId: number, days = 30) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const rows = await prisma.performanceMetric.groupBy({
    by: ['deploymentId'],
    where: { deployment: { campaignId }, metricDate: { gte: since } },
    _sum: { spend: true, impressions: true, clicks: true, quotesStarted: true, policiesSold: true, revenueGenerated: true },
  });
  return rows.map((r) => {
    const spend = num(r._sum.spend);
    const revenue = num(r._sum.revenueGenerated);
    return {
      deploymentId: r.deploymentId,
      spend,
      impressions: r._sum.impressions ?? 0,
      clicks: r._sum.clicks ?? 0,
      quotesStarted: r._sum.quotesStarted ?? 0,
      policiesSold: r._sum.policiesSold ?? 0,
      revenue,
      roas: spend > 0 ? round2(revenue / spend) : null,
    };
  });
}

import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { dec } from '../../lib/money.js';
import { resolveAttribution, type AttributionLookup, type AttributionResult } from './attribution.js';
import { dispatchConversion, normaliseEmail, normalisePhone, sha256, type DispatchResult } from './dispatchers.js';

export const ConversionPayload = z
  .object({
    eventId: z.string().min(1).max(128).optional(),
    clickId: z.string().max(255).optional().nullable(),
    clickIdType: z.enum(['fbclid', 'gclid', 'li_fat_id']).optional().nullable(),
    fbclid: z.string().max(255).optional().nullable(),
    gclid: z.string().max(255).optional().nullable(),
    li_fat_id: z.string().max(255).optional().nullable(),
    utm_campaign: z.string().max(191).optional().nullable(),
    utm_source: z.string().max(100).optional().nullable(),
    utm_medium: z.string().max(100).optional().nullable(),
    eventType: z.enum(['QUOTE_STARTED', 'APPLICATION_SUBMITTED', 'POLICY_PURCHASED']),
    policyPremiumValue: z.coerce.number().min(0).max(9_999_999_999.99).default(0),
    currency: z.string().length(3).default('NGN'),
    email: z.string().email().optional().nullable(),
    phone: z.string().max(32).optional().nullable(),
    occurredAt: z.coerce.date().optional(),
    landingUrl: z.string().url().optional().nullable(),
  })
  .refine((p) => p.eventType !== 'POLICY_PURCHASED' || p.policyPremiumValue > 0, { message: 'policyPremiumValue is required for POLICY_PURCHASED', path: ['policyPremiumValue'] });

export type ConversionPayloadT = z.infer<typeof ConversionPayload>;

export const prismaAttributionLookup: AttributionLookup = {
  findCampaignById: (id) => prisma.campaign.findUnique({ where: { id }, select: { id: true } }),
  findCampaignByUtm: (utm) => prisma.campaign.findFirst({ where: { utmCampaign: utm }, select: { id: true } }),
  findPriorEventByClickId: (clickId) =>
    prisma.conversionEvent.findFirst({ where: { clickId, campaignId: { not: null } }, orderBy: { createdAt: 'asc' }, select: { campaignId: true, platform: true } }),
  findDeployments: (campaignId) => prisma.platformDeployment.findMany({ where: { campaignId }, select: { id: true, platform: true } }),
};

export interface ProcessResult {
  duplicate: boolean;
  eventId: number;
  attribution: AttributionResult | null;
  dispatch: DispatchResult[];
}

const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Persist → attribute → roll into daily metrics → dispatch server-side conversions. */
export async function processConversion(p: ConversionPayloadT, meta: { ip?: string; userAgent?: string } = {}): Promise<ProcessResult> {
  if (p.eventId) {
    const existing = await prisma.conversionEvent.findUnique({ where: { externalEventId: p.eventId } });
    if (existing) return { duplicate: true, eventId: existing.id, attribution: null, dispatch: [] };
  }

  const attribution = await resolveAttribution(p, prismaAttributionLookup);
  const hashedEmail = p.email ? sha256(normaliseEmail(p.email)) : null;
  const hashedPhone = p.phone ? sha256(normalisePhone(p.phone)) : null;
  const occurredAt = p.occurredAt ?? new Date();
  const value = p.policyPremiumValue;

  let event;
  try {
    event = await prisma.$transaction(async (tx) => {
      const created = await tx.conversionEvent.create({
        data: {
          externalEventId: p.eventId ?? null,
          clickId: attribution.clickId,
          clickIdType: attribution.clickIdType,
          utmCampaign: p.utm_campaign ?? null,
          campaignId: attribution.campaignId,
          deploymentId: attribution.deploymentId,
          platform: attribution.platform,
          eventType: p.eventType,
          policyPremiumValue: dec(value),
          currency: p.currency,
          hashedEmail,
          createdAt: occurredAt,
        },
      });
      if (attribution.deploymentId && p.eventType !== 'APPLICATION_SUBMITTED') {
        const day = startOfUtcDay(occurredAt);
        const inc =
          p.eventType === 'QUOTE_STARTED'
            ? { quotesStarted: { increment: 1 } }
            : { policiesSold: { increment: 1 }, revenueGenerated: { increment: dec(value) } };
        await tx.performanceMetric.upsert({
          where: { deploymentId_metricDate: { deploymentId: attribution.deploymentId, metricDate: day } },
          create: {
            deploymentId: attribution.deploymentId,
            metricDate: day,
            quotesStarted: p.eventType === 'QUOTE_STARTED' ? 1 : 0,
            policiesSold: p.eventType === 'POLICY_PURCHASED' ? 1 : 0,
            revenueGenerated: p.eventType === 'POLICY_PURCHASED' ? dec(value) : dec(0),
          },
          update: inc,
        });
      }
      return created;
    });
  } catch (err) {
    // Race on the unique external_event_id → treat as duplicate.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && p.eventId) {
      const existing = await prisma.conversionEvent.findUniqueOrThrow({ where: { externalEventId: p.eventId } });
      return { duplicate: true, eventId: existing.id, attribution: null, dispatch: [] };
    }
    throw err;
  }

  const dispatch = await dispatchConversion({
    eventId: p.eventId ?? `evt_${event.id}_${randomUUID().slice(0, 8)}`,
    eventType: p.eventType,
    occurredAt,
    value,
    currency: p.currency,
    clickId: attribution.clickId,
    clickIdType: attribution.clickIdType,
    hashedEmail,
    hashedPhone,
    landingUrl: p.landingUrl ?? null,
    clientIp: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
  });
  await prisma.conversionEvent.update({
    where: { id: event.id },
    data: {
      dispatchedToPlatforms: dispatch.some((d) => d.status === 'sent' || d.status === 'simulated'),
      dispatchResults: dispatch as unknown as Prisma.InputJsonValue,
    },
  });
  return { duplicate: false, eventId: event.id, attribution, dispatch };
}

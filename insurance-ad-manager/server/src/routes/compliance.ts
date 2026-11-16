import { Router } from 'express';
import { z } from 'zod';
import { ah, parseBody } from '../lib/http.js';
import { validateCampaign, TargetLocationsSchema } from '../services/campaigns.js';
import { RULE_CATALOGUE, checkCreative, checkTargeting, resolveSpecialAdCategory } from '../services/compliance/engine.js';
import type { TargetLocations } from '../types.js';

const PlatformEnum = z.enum(['FACEBOOK', 'INSTAGRAM', 'GOOGLE_SEARCH', 'GOOGLE_DISPLAY', 'LINKEDIN']);
const ClassEnum = z.enum(['AUTO_MOTOR', 'HEALTH_HMO', 'LIFE', 'PROPERTY', 'COMMERCIAL_SME', 'TRAVEL']);

const ByCampaign = z.object({ campaignId: z.number().int().positive(), autoFix: z.boolean().optional(), useAi: z.boolean().optional() });
const Stateless = z.object({
  platform: PlatformEnum,
  variant: z.object({
    hookAngle: z.string().default('Ad hoc'),
    headlines: z.array(z.string()).default([]),
    primaryTexts: z.array(z.string()).default([]),
    descriptions: z.array(z.string()).default([]),
    callToAction: z.string().default('LEARN_MORE'),
  }),
  product: z.object({ insuranceClass: ClassEnum, name: z.string(), regulatoryLicenseNumber: z.string() }),
  targeting: TargetLocationsSchema.optional(),
  autoFix: z.boolean().optional(),
  useAi: z.boolean().optional(),
});

export const complianceRouter = Router();

complianceRouter.get('/rules', (_req, res) => {
  res.json(RULE_CATALOGUE);
});

complianceRouter.post(
  '/validate',
  ah(async (req, res) => {
    if (req.body && typeof req.body === 'object' && 'campaignId' in req.body) {
      const input = parseBody(ByCampaign, req.body);
      res.json(await validateCampaign(input.campaignId, { autoFix: input.autoFix, useAi: input.useAi }));
      return;
    }
    const input = parseBody(Stateless, req.body);
    const product = {
      ...input.product,
      targetAudienceSummary: '',
      keyBenefits: [],
      startingPremium: 0,
      currency: 'NGN',
      landingPageUrl: 'https://example.com',
    };
    const r = await checkCreative({ platform: input.platform, ...input.variant }, product, { autoFix: input.autoFix, useAi: input.useAi });
    const sac = resolveSpecialAdCategory(input.product.insuranceClass, [input.platform]);
    res.json({
      status: r.status,
      findings: r.findings,
      fixedContent: input.autoFix ? r.content : undefined,
      specialAdCategory: sac,
      targeting: input.targeting ? checkTargeting(input.targeting as TargetLocations, sac) : undefined,
      aiReviewed: r.aiReviewed,
    });
  }),
);

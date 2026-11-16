import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, notFound, parseBody, parseId } from '../lib/http.js';
import {
  CampaignInput,
  VariantUpdate,
  campaignInclude,
  campaignPerformance,
  createCampaign,
  generateForCampaign,
  publishCampaign,
  setCampaignStatus,
  updateCampaign,
  updateVariant,
} from '../services/campaigns.js';

export const campaignsRouter = Router();

campaignsRouter.get(
  '/',
  ah(async (req, res) => {
    const status = z.enum(['DRAFT', 'PENDING_REVIEW', 'PAUSED', 'ACTIVE', 'ARCHIVED']).safeParse(req.query.status);
    const cls = z.enum(['AUTO_MOTOR', 'HEALTH_HMO', 'LIFE', 'PROPERTY', 'COMMERCIAL_SME', 'TRAVEL']).safeParse(req.query.class);
    const campaigns = await prisma.campaign.findMany({
      where: { ...(status.success ? { status: status.data } : { status: { not: 'ARCHIVED' } }), ...(cls.success ? { product: { insuranceClass: cls.data } } : {}) },
      include: { product: { select: { id: true, name: true, insuranceClass: true } }, deployments: { select: { id: true, platform: true, status: true, dailyBudget: true } }, _count: { select: { variants: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(campaigns);
  }),
);

// Must be declared before "/:id" routes.
campaignsRouter.post(
  '/generate-creatives',
  ah(async (req, res) => {
    const { campaignId, extraInstructions } = parseBody(z.object({ campaignId: z.number().int().positive(), extraInstructions: z.string().max(2000).optional() }), req.body);
    res.json(await generateForCampaign(campaignId, extraInstructions));
  }),
);

campaignsRouter.get(
  '/:id',
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    const campaign = await prisma.campaign.findUnique({ where: { id }, include: campaignInclude });
    if (!campaign) throw notFound('Campaign');
    res.json({ ...campaign, performance: await campaignPerformance(id) });
  }),
);

campaignsRouter.post(
  '/',
  ah(async (req, res) => {
    res.status(201).json(await createCampaign(parseBody(CampaignInput, req.body)));
  }),
);

campaignsRouter.put(
  '/:id',
  ah(async (req, res) => {
    res.json(await updateCampaign(parseId(req.params.id), parseBody(CampaignInput.partial(), req.body)));
  }),
);

campaignsRouter.delete(
  '/:id',
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    const c = await prisma.campaign.findUnique({ where: { id }, include: { deployments: true } });
    if (!c) throw notFound('Campaign');
    if (c.status === 'ACTIVE') await setCampaignStatus(id, 'PAUSED');
    res.json(await prisma.campaign.update({ where: { id }, data: { status: 'ARCHIVED' } }));
  }),
);

campaignsRouter.put(
  '/:id/variants/:variantId',
  ah(async (req, res) => {
    res.json(await updateVariant(parseId(req.params.id), parseId(req.params.variantId, 'variantId'), parseBody(VariantUpdate, req.body)));
  }),
);

campaignsRouter.post('/:id/publish', ah(async (req, res) => res.json(await publishCampaign(parseId(req.params.id)))));
campaignsRouter.post('/:id/activate', ah(async (req, res) => res.json(await setCampaignStatus(parseId(req.params.id), 'ACTIVE'))));
campaignsRouter.post('/:id/pause', ah(async (req, res) => res.json(await setCampaignStatus(parseId(req.params.id), 'PAUSED'))));

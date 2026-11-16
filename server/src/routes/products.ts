import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError, notFound, parseBody, parseId } from '../lib/http.js';
import { dec } from '../lib/money.js';
import { requireRole } from '../middleware/auth.js';

const ClassEnum = z.enum(['AUTO_MOTOR', 'HEALTH_HMO', 'LIFE', 'PROPERTY', 'COMMERCIAL_SME', 'TRAVEL']);

const ProductInput = z.object({
  insuranceClass: ClassEnum,
  name: z.string().min(2).max(160),
  targetAudienceSummary: z.string().min(5).max(5000),
  keyBenefits: z.array(z.string().min(1).max(200)).min(1).max(20),
  startingPremium: z.coerce.number().min(0).max(9_999_999_999.99),
  currency: z.string().length(3).default('NGN'),
  landingPageUrl: z.string().url().max(500),
  regulatoryLicenseNumber: z.string().min(3).max(80),
  isActive: z.boolean().default(true),
});

export const productsRouter = Router();

productsRouter.get(
  '/',
  ah(async (req, res) => {
    const cls = ClassEnum.safeParse(req.query.class);
    const active = req.query.active === undefined ? undefined : req.query.active === 'true';
    const products = await prisma.insuranceProduct.findMany({
      where: { ...(cls.success ? { insuranceClass: cls.data } : {}), ...(active !== undefined ? { isActive: active } : {}) },
      orderBy: [{ insuranceClass: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { campaigns: true } } },
    });
    res.json(products);
  }),
);

productsRouter.get(
  '/:id',
  ah(async (req, res) => {
    const p = await prisma.insuranceProduct.findUnique({ where: { id: parseId(req.params.id) }, include: { _count: { select: { campaigns: true } } } });
    if (!p) throw notFound('Product');
    res.json(p);
  }),
);

productsRouter.post(
  '/',
  ah(async (req, res) => {
    const input = parseBody(ProductInput, req.body);
    const p = await prisma.insuranceProduct.create({ data: { ...input, startingPremium: dec(input.startingPremium) } });
    res.status(201).json(p);
  }),
);

productsRouter.put(
  '/:id',
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    const input = parseBody(ProductInput.partial(), req.body);
    const p = await prisma.insuranceProduct.update({
      where: { id },
      data: { ...input, startingPremium: input.startingPremium !== undefined ? dec(input.startingPremium) : undefined },
    });
    res.json(p);
  }),
);

productsRouter.delete(
  '/:id',
  requireRole('ADMIN'),
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    const used = await prisma.campaign.count({ where: { productId: id } });
    if (used > 0) throw new HttpError(409, `Product is used by ${used} campaign(s). Deactivate it instead.`);
    await prisma.insuranceProduct.delete({ where: { id } });
    res.status(204).end();
  }),
);

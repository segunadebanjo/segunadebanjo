import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { ah, HttpError, parseBody, parseId } from '../lib/http.js';
import { dec } from '../lib/money.js';
import { analyticsOverview } from '../services/analytics.js';
import { ConversionPayload, processConversion } from '../services/conversions/pipeline.js';
import { syncMetrics } from '../services/metrics/sync.js';
import { applyRecommendation, dismissRecommendation, runOptimization } from '../services/optimization/service.js';
import { platformStatus } from '../services/platforms/index.js';

// ---- analytics ----
export const analyticsRouter = Router();
analyticsRouter.get(
  '/overview',
  ah(async (req, res) => {
    const q = z
      .object({
        insuranceClass: z.enum(['AUTO_MOTOR', 'HEALTH_HMO', 'LIFE', 'PROPERTY', 'COMMERCIAL_SME', 'TRAVEL']).optional().catch(undefined),
        platform: z.enum(['FACEBOOK', 'INSTAGRAM', 'GOOGLE_SEARCH', 'GOOGLE_DISPLAY', 'LINKEDIN']).optional().catch(undefined),
        days: z.coerce.number().int().min(1).max(365).default(30).catch(30),
      })
      .parse(req.query);
    res.json(await analyticsOverview(q));
  }),
);

// ---- conversions (internal) ----
export const conversionsRouter = Router();
conversionsRouter.get(
  '/',
  ah(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 500);
    const events = await prisma.conversionEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { campaign: { select: { id: true, name: true } } },
    });
    res.json(events);
  }),
);
conversionsRouter.post(
  '/simulate',
  ah(async (req, res) => {
    if (!config.SANDBOX_MODE) throw new HttpError(403, 'Simulation is only available in SANDBOX_MODE');
    const result = await processConversion(parseBody(ConversionPayload, req.body), { ip: req.ip, userAgent: req.header('user-agent') ?? undefined });
    res.status(201).json(result);
  }),
);

// ---- optimization ----
const RuleInput = z.object({
  name: z.string().min(2).max(160),
  ruleType: z.enum(['PAUSE_ZERO_QUOTES', 'SCALE_HIGH_ROAS', 'FLAG_HIGH_CPA']),
  spendThreshold: z.number().min(0).nullable().optional(),
  targetRoas: z.number().min(0).max(999999).nullable().optional(),
  maxCostPerPolicy: z.number().min(0).nullable().optional(),
  budgetIncreasePct: z.number().int().min(1).max(100).optional(),
  lookbackDays: z.number().int().min(1).max(90).optional(),
  mode: z.enum(['RECOMMEND', 'AUTO_APPLY']).optional(),
  isEnabled: z.boolean().optional(),
});
const toRuleData = (r: Partial<z.infer<typeof RuleInput>>) => ({
  ...r,
  spendThreshold: r.spendThreshold === undefined ? undefined : r.spendThreshold === null ? null : dec(r.spendThreshold),
  targetRoas: r.targetRoas === undefined ? undefined : r.targetRoas === null ? null : dec(r.targetRoas),
  maxCostPerPolicy: r.maxCostPerPolicy === undefined ? undefined : r.maxCostPerPolicy === null ? null : dec(r.maxCostPerPolicy),
});

export const optimizationRouter = Router();
optimizationRouter.get('/rules', ah(async (_req, res) => res.json(await prisma.optimizationRule.findMany({ orderBy: { id: 'asc' } }))));
optimizationRouter.post(
  '/rules',
  ah(async (req, res) => {
    const input = parseBody(RuleInput, req.body);
    res.status(201).json(await prisma.optimizationRule.create({ data: { ...toRuleData(input), name: input.name, ruleType: input.ruleType } }));
  }),
);
optimizationRouter.put(
  '/rules/:id',
  ah(async (req, res) => {
    res.json(await prisma.optimizationRule.update({ where: { id: parseId(req.params.id) }, data: toRuleData(parseBody(RuleInput.partial(), req.body)) }));
  }),
);
optimizationRouter.delete(
  '/rules/:id',
  ah(async (req, res) => {
    await prisma.optimizationRule.delete({ where: { id: parseId(req.params.id) } });
    res.status(204).end();
  }),
);
optimizationRouter.post('/run', ah(async (_req, res) => res.json(await runOptimization())));
optimizationRouter.get(
  '/recommendations',
  ah(async (req, res) => {
    const status = z.enum(['OPEN', 'APPLIED', 'DISMISSED']).optional().catch(undefined).parse(req.query.status);
    res.json(
      await prisma.optimizationRecommendation.findMany({
        where: status ? { status } : {},
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { rule: { select: { name: true, ruleType: true, mode: true } }, deployment: { select: { id: true, platform: true, dailyBudget: true, status: true, campaign: { select: { id: true, name: true } } } } },
      }),
    );
  }),
);
optimizationRouter.post('/recommendations/:id/apply', ah(async (req, res) => res.json(await applyRecommendation(parseId(req.params.id)))));
optimizationRouter.post('/recommendations/:id/dismiss', ah(async (req, res) => res.json(await dismissRecommendation(parseId(req.params.id)))));

// ---- metrics & platforms ----
export const metricsRouter = Router();
metricsRouter.post('/sync', ah(async (req, res) => res.json(await syncMetrics({ days: Number(req.body?.days) || 2 }))));

export const platformsRouter = Router();
platformsRouter.get('/status', (_req, res) => {
  res.json({ sandboxMode: config.SANDBOX_MODE, aiEnabled: Boolean(config.ANTHROPIC_API_KEY), aiModel: config.ANTHROPIC_MODEL, platforms: platformStatus() });
});

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ah, parseBody } from '../lib/http.js';
import { webhookAuth } from '../middleware/webhookAuth.js';
import { ConversionPayload, processConversion } from '../services/conversions/pipeline.js';

export const webhooksRouter = Router();

webhooksRouter.post(
  '/conversions',
  rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false }),
  webhookAuth,
  ah(async (req, res) => {
    const payload = parseBody(ConversionPayload, req.body);
    const result = await processConversion(payload, { ip: req.ip, userAgent: req.header('user-agent') ?? undefined });
    res.status(result.duplicate ? 200 : 201).json(result);
  }),
);

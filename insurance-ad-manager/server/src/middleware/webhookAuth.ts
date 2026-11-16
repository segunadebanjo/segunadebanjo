import { timingSafeEqual, createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { config } from '../config.js';

const digest = (s: string) => createHash('sha256').update(s).digest();

/** Requires `x-api-key: <WEBHOOK_SECRET_KEY>` (or `Authorization: Bearer <key>`), compared in constant time. */
export const webhookAuth: RequestHandler = (req, res, next) => {
  const expected = config.WEBHOOK_SECRET_KEY;
  if (!expected) {
    res.status(503).json({ error: 'Webhook disabled: WEBHOOK_SECRET_KEY is not configured' });
    return;
  }
  const header = req.header('x-api-key') ?? req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!header || !timingSafeEqual(digest(header), digest(expected))) {
    res.status(401).json({ error: 'Invalid or missing API key' });
    return;
  }
  next();
};

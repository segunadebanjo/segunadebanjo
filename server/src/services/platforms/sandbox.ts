import type { InsuranceClass, Platform } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import type { AdPlatformAdapter, DailyMetric, ExternalRefs, PublishInput, PublishResult } from './types.js';
import { ymd } from './types.js';

/** Typical performance profile per platform (CPM in NGN, CTR, click→quote, quote→policy). */
const PROFILE: Record<Platform, { cpm: number; ctr: number; quoteRate: number; closeRate: number }> = {
  FACEBOOK: { cpm: 1800, ctr: 0.012, quoteRate: 0.03, closeRate: 0.12 },
  INSTAGRAM: { cpm: 2200, ctr: 0.009, quoteRate: 0.025, closeRate: 0.11 },
  GOOGLE_SEARCH: { cpm: 30000, ctr: 0.06, quoteRate: 0.08, closeRate: 0.18 },
  GOOGLE_DISPLAY: { cpm: 900, ctr: 0.004, quoteRate: 0.015, closeRate: 0.08 },
  LINKEDIN: { cpm: 14000, ctr: 0.007, quoteRate: 0.06, closeRate: 0.2 },
};
const CLASS_FACTOR: Record<InsuranceClass, number> = { AUTO_MOTOR: 1.1, HEALTH_HMO: 1.0, LIFE: 0.8, PROPERTY: 0.85, COMMERCIAL_SME: 0.9, TRAVEL: 1.2 };

/** Deterministic PRNG so the same deployment/day always produces the same numbers. */
function seeded(seed: string) {
  let h = createHash('sha256').update(seed).digest().readUInt32LE(0);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1_000_000) / 1_000_000;
  };
}

/** Synthetic but realistic daily metrics for a deployment. Exported for the seeder. */
export function simulateDay(platform: Platform, cls: InsuranceClass, dailyBudget: number, startingPremium: number, date: string, salt: string | number): Required<DailyMetric> {
  const rnd = seeded(`${salt}:${platform}:${date}`);
  const p = PROFILE[platform];
  const f = CLASS_FACTOR[cls];
  // salt-level "quality" so some deployments under-perform (gives the optimizer something to do)
  const quality = 0.35 + seeded(`q:${salt}:${platform}`)() * 1.3;
  const spend = Math.round(dailyBudget * (0.82 + rnd() * 0.18) * 100) / 100;
  const impressions = Math.round((spend / p.cpm) * 1000 * (0.9 + rnd() * 0.2));
  const clicks = Math.round(impressions * p.ctr * f * (0.8 + rnd() * 0.4));
  const expectedQuotes = clicks * p.quoteRate * quality;
  const quotesStarted = Math.max(0, Math.round(expectedQuotes + (rnd() - 0.5) * Math.sqrt(expectedQuotes + 1)));
  const policiesSold = Math.max(0, Math.round(quotesStarted * p.closeRate * quality + (rnd() - 0.5)));
  const avgPremium = startingPremium * (1.1 + rnd() * 1.4);
  const revenue = Math.round(policiesSold * avgPremium * 100) / 100;
  return { date, impressions, clicks, spend, quotesStarted, policiesSold, revenue };
}

export class SandboxAdapter implements AdPlatformAdapter {
  readonly mode = 'sandbox' as const;
  constructor(readonly platform: Platform) {}

  async publish(input: PublishInput): Promise<PublishResult> {
    const prefix = { FACEBOOK: 'fb', INSTAGRAM: 'ig', GOOGLE_SEARCH: 'gs', GOOGLE_DISPLAY: 'gd', LINKEDIN: 'li' }[this.platform];
    const id = () => `sbx_${prefix}_${randomUUID().slice(0, 8)}`;
    await new Promise((r) => setTimeout(r, 25));
    return {
      externalCampaignId: id(),
      externalAdsetId: id(),
      externalAdId: id(),
      status: 'PAUSED',
      raw: { simulated: true, specialAdCategory: input.specialAdCategory, dailyBudget: input.dailyBudget, landingUrl: input.landingUrl },
    };
  }

  async setStatus(): Promise<void> {}
  async updateBudget(): Promise<void> {}

  async fetchDailyMetrics(ref: ExternalRefs, since: Date, until: Date, ctx?: { insuranceClass: InsuranceClass; dailyBudget: number; startingPremium: number; deploymentId: number }): Promise<DailyMetric[]> {
    if (!ctx) return [];
    const out: DailyMetric[] = [];
    for (let d = new Date(since); d <= until; d.setUTCDate(d.getUTCDate() + 1)) {
      out.push(simulateDay(this.platform, ctx.insuranceClass, ctx.dailyBudget, ctx.startingPremium, ymd(d), ref.externalCampaignId ?? ctx.deploymentId));
    }
    return out;
  }
}

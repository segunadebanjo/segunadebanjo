import type { CampaignObjective, InsuranceClass, Platform } from '@prisma/client';
import type { CreativeContent, TargetLocations } from '../../types.js';

export interface ExternalRefs {
  externalCampaignId: string | null;
  externalAdsetId: string | null;
  externalAdId: string | null;
}

export interface PublishInput {
  platform: Platform;
  campaignName: string;
  objective: CampaignObjective;
  insuranceClass: InsuranceClass;
  dailyBudget: number; // major units (e.g. NGN)
  currency: string;
  landingUrl: string; // already UTM-tagged
  targeting: TargetLocations;
  specialAdCategory: string | null;
  creative: CreativeContent;
}

export interface PublishResult extends ExternalRefs {
  status: 'PAUSED';
  raw?: unknown;
}

export interface DailyMetric {
  date: string; // YYYY-MM-DD
  impressions: number;
  clicks: number;
  spend: number;
  /** Platform-reported conversions (only used in sandbox; live funnel numbers come from our webhook). */
  quotesStarted?: number;
  policiesSold?: number;
  revenue?: number;
}

/** Unified contract every ad platform implements. Publishing ALWAYS creates paused objects. */
export interface AdPlatformAdapter {
  readonly platform: Platform;
  readonly mode: 'live' | 'sandbox';
  publish(input: PublishInput): Promise<PublishResult>;
  setStatus(ref: ExternalRefs, status: 'ACTIVE' | 'PAUSED'): Promise<void>;
  updateBudget(ref: ExternalRefs, dailyBudget: number, currency: string): Promise<void>;
  fetchDailyMetrics(ref: ExternalRefs, since: Date, until: Date, ctx?: { insuranceClass: InsuranceClass; dailyBudget: number; startingPremium: number; deploymentId: number }): Promise<DailyMetric[]>;
}

export class PlatformApiError extends Error {
  constructor(
    public readonly platform: Platform | string,
    message: string,
    public readonly status?: number,
    public readonly body?: unknown,
  ) {
    super(`[${platform}] ${message}`);
  }
}

export const ymd = (d: Date) => d.toISOString().slice(0, 10);

export async function httpJson<T = unknown>(platform: string, url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers as Record<string, string>) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    /* keep text */
  }
  if (!res.ok) throw new PlatformApiError(platform, `HTTP ${res.status}: ${typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 500)}`, res.status, body);
  return body as T;
}

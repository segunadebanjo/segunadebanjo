import { config } from '../../config.js';
import type { AdPlatformAdapter, DailyMetric, ExternalRefs, PublishInput, PublishResult } from './types.js';
import { PlatformApiError } from './types.js';

const GEO_URNS: Record<string, string> = { NG: 'urn:li:geo:105365761', GH: 'urn:li:geo:105769538', KE: 'urn:li:geo:100710459', ZA: 'urn:li:geo:104035573', GB: 'urn:li:geo:101165590', US: 'urn:li:geo:103644278' };
const OBJECTIVE = { TRAFFIC: 'WEBSITE_VISIT', QUOTE_LEADS: 'WEBSITE_CONVERSION', POLICY_PURCHASE: 'WEBSITE_CONVERSION' } as const;

/**
 * LinkedIn Marketing API (versioned REST). Creates campaign group → campaign → dark post → creative,
 * all PAUSED. LinkedIn ad accounts can't be billed in NGN, so budgets are sent in the account currency
 * (LINKEDIN_ACCOUNT_CURRENCY, default USD) converted with FX_NGN_PER_USD.
 */
export class LinkedInAdapter implements AdPlatformAdapter {
  readonly mode = 'live' as const;
  readonly platform = 'LINKEDIN' as const;

  private get account() {
    return config.LINKEDIN_AD_ACCOUNT_ID!;
  }
  private headers(extra: Record<string, string> = {}) {
    return {
      Authorization: `Bearer ${config.LINKEDIN_ACCESS_TOKEN}`,
      'LinkedIn-Version': config.LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  /** POST that returns the created entity id from the x-restli-id / x-linkedin-id header. */
  private async create(path: string, body: unknown): Promise<string> {
    const res = await fetch(`https://api.linkedin.com/rest/${path}`, { method: 'POST', headers: this.headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new PlatformApiError(this.platform, `HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`, res.status);
    const id = res.headers.get('x-restli-id') ?? res.headers.get('x-linkedin-id');
    if (!id) throw new PlatformApiError(this.platform, `No id returned for ${path}`);
    return id;
  }
  private async patch(path: string, set: Record<string, unknown>) {
    const res = await fetch(`https://api.linkedin.com/rest/${path}`, { method: 'POST', headers: this.headers({ 'X-RestLi-Method': 'PARTIAL_UPDATE' }), body: JSON.stringify({ patch: { $set: set } }), signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new PlatformApiError(this.platform, `HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`, res.status);
  }

  private money(amount: number, currency: string) {
    const target = config.LINKEDIN_ACCOUNT_CURRENCY;
    const value = currency === target ? amount : currency === 'NGN' && target === 'USD' ? amount / config.FX_NGN_PER_USD : amount;
    return { amount: Math.max(10, value).toFixed(2), currencyCode: target };
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const accountUrn = `urn:li:sponsoredAccount:${this.account}`;
    const groupId = await this.create(`adAccounts/${this.account}/adCampaignGroups`, {
      account: accountUrn,
      name: `${input.campaignName} · LinkedIn`,
      status: 'PAUSED',
      runSchedule: { start: Date.now() },
    });
    const geos = (input.targeting.countries.length ? input.targeting.countries : ['NG']).map((c) => GEO_URNS[c]).filter(Boolean);
    const campaignId = await this.create(`adAccounts/${this.account}/adCampaigns`, {
      account: accountUrn,
      campaignGroup: `urn:li:sponsoredCampaignGroup:${groupId}`,
      name: `${input.campaignName} · ${input.creative.hookAngle}`,
      type: 'SPONSORED_UPDATES',
      costType: 'CPM',
      objectiveType: OBJECTIVE[input.objective],
      dailyBudget: this.money(input.dailyBudget, input.currency),
      locale: { country: 'US', language: 'en' },
      offsiteDeliveryEnabled: false,
      politicalIntent: 'NOT_POLITICAL',
      status: 'PAUSED',
      targetingCriteria: { include: { and: [{ or: { 'urn:li:adTargetingFacet:locations': geos } }] } },
    });
    const c = input.creative;
    const postUrn = await this.create('posts', {
      author: `urn:li:organization:${config.LINKEDIN_ORGANIZATION_ID}`,
      commentary: c.primaryTexts[0],
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'NONE', targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { article: { source: input.landingUrl, title: c.headlines[0], description: c.descriptions[0] } },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
      adContext: { dscAdAccount: accountUrn, dscStatus: 'ACTIVE' },
    });
    const creativeId = await this.create(`adAccounts/${this.account}/creatives`, {
      campaign: `urn:li:sponsoredCampaign:${campaignId}`,
      content: { reference: postUrn },
      intendedStatus: 'PAUSED',
    });
    return { externalCampaignId: campaignId, externalAdsetId: groupId, externalAdId: creativeId, status: 'PAUSED' };
  }

  async setStatus(ref: ExternalRefs, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
    if (ref.externalAdsetId) await this.patch(`adAccounts/${this.account}/adCampaignGroups/${ref.externalAdsetId}`, { status });
    if (ref.externalCampaignId) await this.patch(`adAccounts/${this.account}/adCampaigns/${ref.externalCampaignId}`, { status });
    if (ref.externalAdId) await this.patch(`adAccounts/${this.account}/creatives/${encodeURIComponent(ref.externalAdId)}`, { intendedStatus: status });
  }

  async updateBudget(ref: ExternalRefs, dailyBudget: number, currency: string): Promise<void> {
    if (!ref.externalCampaignId) throw new PlatformApiError(this.platform, 'No campaign id');
    await this.patch(`adAccounts/${this.account}/adCampaigns/${ref.externalCampaignId}`, { dailyBudget: this.money(dailyBudget, currency) });
  }

  async fetchDailyMetrics(ref: ExternalRefs, since: Date, until: Date): Promise<DailyMetric[]> {
    if (!ref.externalCampaignId) return [];
    const d = (x: Date) => `(year:${x.getUTCFullYear()},month:${x.getUTCMonth() + 1},day:${x.getUTCDate()})`;
    const qs = `q=analytics&pivot=CAMPAIGN&timeGranularity=DAILY&dateRange=(start:${d(since)},end:${d(until)})&campaigns=List(${encodeURIComponent(`urn:li:sponsoredCampaign:${ref.externalCampaignId}`)})&fields=impressions,clicks,costInLocalCurrency,dateRange`;
    const res = await fetch(`https://api.linkedin.com/rest/adAnalytics?${qs}`, { headers: this.headers(), signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new PlatformApiError(this.platform, `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status);
    const body = (await res.json()) as { elements: { impressions: number; clicks: number; costInLocalCurrency: string; dateRange: { start: { year: number; month: number; day: number } } }[] };
    const toNgn = config.LINKEDIN_ACCOUNT_CURRENCY === 'USD' ? config.FX_NGN_PER_USD : 1;
    return body.elements.map((e) => ({
      date: `${e.dateRange.start.year}-${String(e.dateRange.start.month).padStart(2, '0')}-${String(e.dateRange.start.day).padStart(2, '0')}`,
      impressions: e.impressions,
      clicks: e.clicks,
      spend: Number(e.costInLocalCurrency) * toNgn,
    }));
  }
}

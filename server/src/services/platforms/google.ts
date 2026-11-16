import type { Platform } from '@prisma/client';
import { config } from '../../config.js';
import type { AdPlatformAdapter, DailyMetric, ExternalRefs, PublishInput, PublishResult } from './types.js';
import { httpJson, PlatformApiError, ymd } from './types.js';

/** Google Ads geo target constants for common markets. */
const GEO_TARGETS: Record<string, string> = { NG: '2566', GH: '2288', KE: '2404', ZA: '2710', GB: '2826', US: '2840' };

let tokenCache: { token: string; expiresAt: number } | null = null;

/** Exchange the long-lived refresh token for an OAuth access token (cached until ~1 min before expiry). */
export async function googleAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.GOOGLE_ADS_CLIENT_ID!,
    client_secret: config.GOOGLE_ADS_CLIENT_SECRET!,
    refresh_token: config.GOOGLE_ADS_REFRESH_TOKEN!,
  });
  const res = await httpJson<{ access_token: string; expires_in: number }>('GOOGLE', 'https://oauth2.googleapis.com/token', { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  tokenCache = { token: res.access_token, expiresAt: Date.now() + res.expires_in * 1000 };
  return res.access_token;
}

export async function googleHeaders(): Promise<Record<string, string>> {
  return {
    Authorization: `Bearer ${await googleAccessToken()}`,
    'developer-token': config.GOOGLE_ADS_DEVELOPER_TOKEN!,
    ...(config.GOOGLE_ADS_LOGIN_CUSTOMER_ID ? { 'login-customer-id': config.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, '') } : {}),
  };
}

export const googleCustomerId = () => config.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, '');
export const googleBase = () => `https://googleads.googleapis.com/${config.GOOGLE_ADS_API_VERSION}/customers/${googleCustomerId()}`;

/**
 * Google Ads API (REST). SEARCH deployments get a Responsive Search Ad + phrase-match keywords;
 * DISPLAY deployments get campaign + ad group (image assets must be uploaded before an RSA-equivalent
 * responsive display ad can be attached). Campaigns are created PAUSED.
 */
export class GoogleAdsAdapter implements AdPlatformAdapter {
  readonly mode = 'live' as const;
  constructor(readonly platform: Extract<Platform, 'GOOGLE_SEARCH' | 'GOOGLE_DISPLAY'>) {}

  private async mutate<T = { results: { resourceName: string }[] }>(resource: string, operations: unknown[]): Promise<T> {
    return httpJson<T>(this.platform, `${googleBase()}/${resource}:mutate`, { method: 'POST', headers: await googleHeaders(), json: { operations } });
  }
  private async search<T>(query: string): Promise<T[]> {
    const res = await httpJson<{ results?: T[] }>(this.platform, `${googleBase()}/googleAds:search`, { method: 'POST', headers: await googleHeaders(), json: { query } });
    return res.results ?? [];
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const search = this.platform === 'GOOGLE_SEARCH';
    const budget = await this.mutate('campaignBudgets', [
      { create: { name: `${input.campaignName} · ${this.platform} budget · ${Date.now()}`, amountMicros: String(Math.round(input.dailyBudget * 1_000_000)), deliveryMethod: 'STANDARD', explicitlyShared: false } },
    ]);
    const campaign = await this.mutate('campaigns', [
      {
        create: {
          name: `${input.campaignName} · ${this.platform} · ${Date.now()}`,
          status: 'PAUSED',
          advertisingChannelType: search ? 'SEARCH' : 'DISPLAY',
          campaignBudget: budget.results[0].resourceName,
          targetSpend: {},
          ...(search ? { networkSettings: { targetGoogleSearch: true, targetSearchNetwork: true, targetContentNetwork: false } } : {}),
        },
      },
    ]);
    const campaignRn = campaign.results[0].resourceName;
    const geos = (input.targeting.countries.length ? input.targeting.countries : ['NG']).map((c) => GEO_TARGETS[c]).filter(Boolean);
    if (geos.length) await this.mutate('campaignCriteria', geos.map((g) => ({ create: { campaign: campaignRn, location: { geoTargetConstant: `geoTargetConstants/${g}` } } })));

    const adGroup = await this.mutate('adGroups', [
      { create: { name: `${input.creative.hookAngle}`, campaign: campaignRn, status: 'ENABLED', type: search ? 'SEARCH_STANDARD' : 'DISPLAY_STANDARD' } },
    ]);
    const adGroupRn = adGroup.results[0].resourceName;

    let adRn: string | null = null;
    if (search) {
      const ad = await this.mutate('adGroupAds', [
        {
          create: {
            adGroup: adGroupRn,
            status: 'ENABLED', // the parent campaign is PAUSED, so nothing serves
            ad: {
              finalUrls: [input.landingUrl],
              responsiveSearchAd: {
                headlines: input.creative.headlines.slice(0, 15).map((text) => ({ text })),
                descriptions: input.creative.descriptions.slice(0, 4).map((text) => ({ text })),
              },
            },
          },
        },
      ]);
      adRn = ad.results[0].resourceName;
      const keywords = input.creative.keywords ?? [];
      if (keywords.length)
        await this.mutate('adGroupCriteria', keywords.slice(0, 50).map((text) => ({ create: { adGroup: adGroupRn, status: 'ENABLED', keyword: { text, matchType: 'PHRASE' } } })));
    }
    return { externalCampaignId: campaignRn, externalAdsetId: adGroupRn, externalAdId: adRn, status: 'PAUSED' };
  }

  async setStatus(ref: ExternalRefs, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
    if (!ref.externalCampaignId) throw new PlatformApiError(this.platform, 'No campaign resource name');
    await this.mutate('campaigns', [{ update: { resourceName: ref.externalCampaignId, status: status === 'ACTIVE' ? 'ENABLED' : 'PAUSED' }, updateMask: 'status' }]);
  }

  async updateBudget(ref: ExternalRefs, dailyBudget: number): Promise<void> {
    const rows = await this.search<{ campaign: { campaignBudget: string } }>(`SELECT campaign.campaign_budget FROM campaign WHERE campaign.resource_name = '${ref.externalCampaignId}'`);
    const budgetRn = rows[0]?.campaign.campaignBudget;
    if (!budgetRn) throw new PlatformApiError(this.platform, 'Campaign budget not found');
    await this.mutate('campaignBudgets', [{ update: { resourceName: budgetRn, amountMicros: String(Math.round(dailyBudget * 1_000_000)) }, updateMask: 'amount_micros' }]);
  }

  async fetchDailyMetrics(ref: ExternalRefs, since: Date, until: Date): Promise<DailyMetric[]> {
    if (!ref.externalCampaignId) return [];
    const rows = await this.search<{ segments: { date: string }; metrics: { impressions?: string; clicks?: string; costMicros?: string } }>(
      `SELECT segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros FROM campaign WHERE campaign.resource_name = '${ref.externalCampaignId}' AND segments.date BETWEEN '${ymd(since)}' AND '${ymd(until)}'`,
    );
    return rows.map((r) => ({ date: r.segments.date, impressions: Number(r.metrics.impressions ?? 0), clicks: Number(r.metrics.clicks ?? 0), spend: Number(r.metrics.costMicros ?? 0) / 1_000_000 }));
  }
}

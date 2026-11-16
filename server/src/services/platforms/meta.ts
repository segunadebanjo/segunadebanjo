import type { Platform } from '@prisma/client';
import { config } from '../../config.js';
import type { AdPlatformAdapter, DailyMetric, ExternalRefs, PublishInput, PublishResult } from './types.js';
import { httpJson, PlatformApiError, ymd } from './types.js';

const OBJECTIVE = { TRAFFIC: 'OUTCOME_TRAFFIC', QUOTE_LEADS: 'OUTCOME_LEADS', POLICY_PURCHASE: 'OUTCOME_SALES' } as const;
const OPT_GOAL = { TRAFFIC: 'LANDING_PAGE_VIEWS', QUOTE_LEADS: 'LANDING_PAGE_VIEWS', POLICY_PURCHASE: 'LANDING_PAGE_VIEWS' } as const;

/**
 * Facebook & Instagram via the Meta Marketing API (Graph API).
 * Every object is created with status=PAUSED; insurance campaigns always carry a Special Ad Category
 * (FINANCIAL_PRODUCTS_SERVICES, or HOUSING for property) and only geo targeting is sent — never age,
 * gender, ZIP or detailed demographic targeting.
 */
export class MetaAdapter implements AdPlatformAdapter {
  readonly mode = 'live' as const;
  constructor(readonly platform: Extract<Platform, 'FACEBOOK' | 'INSTAGRAM'>) {}

  private get base() {
    return `https://graph.facebook.com/${config.META_API_VERSION}`;
  }
  private get account() {
    const id = config.META_AD_ACCOUNT_ID!;
    return id.startsWith('act_') ? id : `act_${id}`;
  }

  private post<T>(path: string, params: Record<string, unknown>) {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) body.set(k, typeof v === 'string' ? v : JSON.stringify(v));
    body.set('access_token', config.META_ACCESS_TOKEN!);
    return httpJson<T>(this.platform, `${this.base}/${path}`, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  }
  private get<T>(path: string, params: Record<string, string>) {
    const qs = new URLSearchParams({ ...params, access_token: config.META_ACCESS_TOKEN! });
    return httpJson<T>(this.platform, `${this.base}/${path}?${qs}`);
  }

  /** Resolve region/city names to Meta geo keys (Special Ad Category: cities need radius ≥ 15mi). */
  private async geo(input: PublishInput) {
    const t = input.targeting;
    const geo: Record<string, unknown> = { countries: t.countries.length ? t.countries : ['NG'] };
    const country = t.countries[0] ?? 'NG';
    if (t.regions?.length) {
      const regions = [];
      for (const r of t.regions) {
        const res = await this.get<{ data: { key: string; name: string }[] }>('search', { type: 'adgeolocation', location_types: '["region"]', q: r, country_code: country, limit: '1' });
        if (res.data[0]) regions.push({ key: res.data[0].key });
      }
      if (regions.length) {
        delete geo.countries;
        geo.regions = regions;
      }
    }
    if (t.cities?.length) {
      const cities = [];
      for (const c of t.cities) {
        const res = await this.get<{ data: { key: string }[] }>('search', { type: 'adgeolocation', location_types: '["city"]', q: c.name, country_code: country, limit: '1' });
        if (res.data[0]) cities.push({ key: res.data[0].key, radius: Math.max(15, Math.round((c.radiusKm ?? 25) / 1.609)), distance_unit: 'mile' });
      }
      if (cities.length) {
        delete geo.countries;
        geo.cities = cities;
      }
    }
    return geo;
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    if (!config.META_PAGE_ID) throw new PlatformApiError(this.platform, 'META_PAGE_ID is required to publish');
    const sac = input.specialAdCategory ? [input.specialAdCategory] : [];
    const campaign = await this.post<{ id: string }>(`${this.account}/campaigns`, {
      name: `${input.campaignName} · ${this.platform}`,
      objective: OBJECTIVE[input.objective],
      status: 'PAUSED',
      buying_type: 'AUCTION',
      special_ad_categories: sac,
      special_ad_category_country: sac.length ? (input.targeting.countries.length ? input.targeting.countries : ['NG']) : undefined,
      is_adset_budget_sharing_enabled: false,
    });

    const targeting = {
      geo_locations: await this.geo(input),
      publisher_platforms: [this.platform === 'INSTAGRAM' ? 'instagram' : 'facebook'],
      ...(this.platform === 'INSTAGRAM' ? { instagram_positions: ['stream', 'story', 'reels'] } : { facebook_positions: ['feed', 'story', 'facebook_reels'] }),
      // Special Ad Category: age must be 18–65+, no gender filter.
      age_min: 18,
      age_max: 65,
    };
    const adset = await this.post<{ id: string }>(`${this.account}/adsets`, {
      name: `${input.campaignName} · ${this.platform} · ad set`,
      campaign_id: campaign.id,
      daily_budget: Math.round(input.dailyBudget * 100), // minor units (kobo)
      billing_event: 'IMPRESSIONS',
      optimization_goal: OPT_GOAL[input.objective],
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting,
      status: 'PAUSED',
    });

    const c = input.creative;
    const creative = await this.post<{ id: string }>(`${this.account}/adcreatives`, {
      name: `${input.campaignName} · ${c.hookAngle}`,
      object_story_spec: {
        page_id: config.META_PAGE_ID,
        ...(this.platform === 'INSTAGRAM' && config.META_INSTAGRAM_ACTOR_ID ? { instagram_user_id: config.META_INSTAGRAM_ACTOR_ID } : {}),
        link_data: {
          link: input.landingUrl,
          message: c.primaryTexts[0],
          name: c.headlines[0],
          description: c.descriptions[0],
          call_to_action: { type: c.callToAction, value: { link: input.landingUrl } },
        },
      },
    });
    const ad = await this.post<{ id: string }>(`${this.account}/ads`, {
      name: `${input.campaignName} · ${c.hookAngle}`,
      adset_id: adset.id,
      creative: { creative_id: creative.id },
      status: 'PAUSED',
    });
    return { externalCampaignId: campaign.id, externalAdsetId: adset.id, externalAdId: ad.id, status: 'PAUSED' };
  }

  async setStatus(ref: ExternalRefs, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
    for (const id of [ref.externalCampaignId, ref.externalAdsetId, ref.externalAdId]) if (id) await this.post(id, { status });
  }

  async updateBudget(ref: ExternalRefs, dailyBudget: number): Promise<void> {
    if (!ref.externalAdsetId) throw new PlatformApiError(this.platform, 'No ad set id');
    await this.post(ref.externalAdsetId, { daily_budget: Math.round(dailyBudget * 100) });
  }

  async fetchDailyMetrics(ref: ExternalRefs, since: Date, until: Date): Promise<DailyMetric[]> {
    if (!ref.externalCampaignId) return [];
    const res = await this.get<{ data: { date_start: string; impressions?: string; clicks?: string; spend?: string }[] }>(`${ref.externalCampaignId}/insights`, {
      time_increment: '1',
      time_range: JSON.stringify({ since: ymd(since), until: ymd(until) }),
      fields: 'impressions,clicks,spend,date_start',
      level: 'campaign',
    });
    return res.data.map((r) => ({ date: r.date_start, impressions: Number(r.impressions ?? 0), clicks: Number(r.clicks ?? 0), spend: Number(r.spend ?? 0) }));
  }
}

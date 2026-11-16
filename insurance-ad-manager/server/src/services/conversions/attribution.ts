import type { Platform } from '@prisma/client';
import { platformFamily, type PlatformFamily } from '../../types.js';

export type ClickIdType = 'fbclid' | 'gclid' | 'li_fat_id';

export interface ConversionInput {
  clickId?: string | null;
  clickIdType?: ClickIdType | null;
  fbclid?: string | null;
  gclid?: string | null;
  li_fat_id?: string | null;
  utm_campaign?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
}

/** Data access needed by the attribution logic (DB-backed in prod, in-memory in tests). */
export interface AttributionLookup {
  findCampaignById(id: number): Promise<{ id: number } | null>;
  findCampaignByUtm(utm: string): Promise<{ id: number } | null>;
  findPriorEventByClickId(clickId: string): Promise<{ campaignId: number | null; platform: Platform | null } | null>;
  findDeployments(campaignId: number): Promise<{ id: number; platform: Platform }[]>;
}

export interface AttributionResult {
  clickId: string | null;
  clickIdType: ClickIdType | null;
  family: PlatformFamily | null;
  platform: Platform | null;
  campaignId: number | null;
  deploymentId: number | null;
  method: string[]; // audit trail of how each piece was resolved
}

const FAMILY_BY_CLICK: Record<ClickIdType, PlatformFamily> = { fbclid: 'META', gclid: 'GOOGLE', li_fat_id: 'LINKEDIN' };

/** Pick the click id and its type from either explicit fields or a generic clickId (+ optional type). */
export function extractClickId(input: ConversionInput): { clickId: string | null; clickIdType: ClickIdType | null } {
  if (input.fbclid) return { clickId: input.fbclid, clickIdType: 'fbclid' };
  if (input.gclid) return { clickId: input.gclid, clickIdType: 'gclid' };
  if (input.li_fat_id) return { clickId: input.li_fat_id, clickIdType: 'li_fat_id' };
  if (!input.clickId) return { clickId: null, clickIdType: null };
  const raw = input.clickId.trim();
  // Accept "gclid=XYZ" style values
  const kv = raw.match(/^(fbclid|gclid|li_fat_id)[=:](.+)$/i);
  if (kv) return { clickId: kv[2], clickIdType: kv[1].toLowerCase() as ClickIdType };
  if (input.clickIdType) return { clickId: raw, clickIdType: input.clickIdType };
  // Heuristics: Meta fbclids start with "IwAR"/"IwY"/"IwZ"; LinkedIn ids are UUID-like; gclids start with "Cj"/"EAIa".
  if (/^Iw[A-Za-z0-9]/.test(raw)) return { clickId: raw, clickIdType: 'fbclid' };
  if (/^(Cj|EAIa|CL[A-Za-z0-9])/.test(raw)) return { clickId: raw, clickIdType: 'gclid' };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return { clickId: raw, clickIdType: 'li_fat_id' };
  return { clickId: raw, clickIdType: null };
}

/** Refine the platform inside a family using utm_source / utm_medium. */
export function refinePlatform(family: PlatformFamily | null, utmSource?: string | null, utmMedium?: string | null): Platform | null {
  const src = (utmSource ?? '').toLowerCase();
  const med = (utmMedium ?? '').toLowerCase();
  if (!family) {
    if (/instagram|^ig$/.test(src)) return 'INSTAGRAM';
    if (/facebook|^fb$|meta/.test(src)) return 'FACEBOOK';
    if (/linkedin/.test(src)) return 'LINKEDIN';
    if (/google/.test(src)) return /display|gdn/.test(src + med) ? 'GOOGLE_DISPLAY' : 'GOOGLE_SEARCH';
    return null;
  }
  if (family === 'META') return /instagram|^ig$/.test(src) ? 'INSTAGRAM' : 'FACEBOOK';
  if (family === 'GOOGLE') return /display|gdn/.test(src + med) ? 'GOOGLE_DISPLAY' : 'GOOGLE_SEARCH';
  return 'LINKEDIN';
}

/** Our generated utm_campaign format is "ins-<campaignId>-<slug>". */
export const parseCampaignIdFromUtm = (utm: string): number | null => {
  const m = utm.trim().match(/^ins-(\d+)(?:-|$)/i);
  return m ? Number(m[1]) : null;
};

export async function resolveAttribution(input: ConversionInput, lookup: AttributionLookup): Promise<AttributionResult> {
  const method: string[] = [];
  const { clickId, clickIdType } = extractClickId(input);
  let family: PlatformFamily | null = clickIdType ? FAMILY_BY_CLICK[clickIdType] : null;
  if (clickIdType) method.push(`platform family from ${clickIdType}`);
  let platform = refinePlatform(family, input.utm_source, input.utm_medium);
  if (platform && !family) {
    family = platformFamily(platform);
    method.push('platform from utm_source');
  }

  let campaignId: number | null = null;
  if (input.utm_campaign) {
    const parsed = parseCampaignIdFromUtm(input.utm_campaign);
    if (parsed !== null && (await lookup.findCampaignById(parsed))) {
      campaignId = parsed;
      method.push('campaign from utm_campaign id');
    } else {
      const byUtm = await lookup.findCampaignByUtm(input.utm_campaign);
      if (byUtm) {
        campaignId = byUtm.id;
        method.push('campaign from utm_campaign match');
      }
    }
  }

  if (clickId && (campaignId === null || platform === null)) {
    const prior = await lookup.findPriorEventByClickId(clickId);
    if (prior) {
      if (campaignId === null && prior.campaignId !== null) {
        campaignId = prior.campaignId;
        method.push('campaign inherited from earlier event with same click id');
      }
      if (platform === null && prior.platform) {
        platform = prior.platform;
        family = platformFamily(prior.platform);
        method.push('platform inherited from earlier event');
      }
    }
  }

  let deploymentId: number | null = null;
  if (campaignId !== null) {
    const deployments = await lookup.findDeployments(campaignId);
    let match = platform ? deployments.find((d) => d.platform === platform) : undefined;
    if (!match && family) {
      const inFamily = deployments.filter((d) => platformFamily(d.platform) === family);
      if (inFamily.length === 1) match = inFamily[0];
      else if (inFamily.length > 1 && !platform) match = inFamily[0];
    }
    if (!match && !family && deployments.length === 1) match = deployments[0];
    if (match) {
      deploymentId = match.id;
      platform = match.platform;
      method.push(`deployment #${match.id} (${match.platform})`);
    }
  }

  return { clickId, clickIdType, family, platform, campaignId, deploymentId, method };
}

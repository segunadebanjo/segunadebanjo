import { describe, expect, it } from 'vitest';
import type { Platform } from '@prisma/client';
import { extractClickId, parseCampaignIdFromUtm, refinePlatform, resolveAttribution, type AttributionLookup } from '../src/services/conversions/attribution.js';
import { normalisePhone, sha256, normaliseEmail } from '../src/services/conversions/dispatchers.js';
import { buildUtmCampaign } from '../src/lib/strings.js';

/** In-memory stand-in for the MySQL-backed lookup (same interface as prismaAttributionLookup). */
function memoryLookup(): AttributionLookup & { events: { clickId: string; campaignId: number | null; platform: Platform | null }[] } {
  const campaigns = [
    { id: 7, utm: 'ins-7-motor-q4-lagos-abuja' },
    { id: 9, utm: 'legacy-hmo-campaign' },
    { id: 12, utm: 'ins-12-sme-package' },
  ];
  const deployments: Record<number, { id: number; platform: Platform }[]> = {
    7: [
      { id: 70, platform: 'FACEBOOK' },
      { id: 71, platform: 'INSTAGRAM' },
      { id: 72, platform: 'GOOGLE_SEARCH' },
    ],
    9: [{ id: 90, platform: 'GOOGLE_SEARCH' }],
    12: [
      { id: 120, platform: 'LINKEDIN' },
      { id: 121, platform: 'GOOGLE_SEARCH' },
      { id: 122, platform: 'GOOGLE_DISPLAY' },
    ],
  };
  const events: { clickId: string; campaignId: number | null; platform: Platform | null }[] = [];
  return {
    events,
    findCampaignById: async (id) => campaigns.find((c) => c.id === id) ?? null,
    findCampaignByUtm: async (utm) => campaigns.find((c) => c.utm === utm) ?? null,
    findPriorEventByClickId: async (clickId) => events.find((e) => e.clickId === clickId && e.campaignId !== null) ?? null,
    findDeployments: async (id) => deployments[id] ?? [],
  };
}

describe('click id extraction', () => {
  it('prefers explicit fbclid/gclid/li_fat_id fields', () => {
    expect(extractClickId({ gclid: 'Cj0KCQabc' })).toEqual({ clickId: 'Cj0KCQabc', clickIdType: 'gclid' });
    expect(extractClickId({ fbclid: 'IwAR123' })).toEqual({ clickId: 'IwAR123', clickIdType: 'fbclid' });
    expect(extractClickId({ li_fat_id: 'abc' })).toEqual({ clickId: 'abc', clickIdType: 'li_fat_id' });
  });
  it('parses "type=value" and respects clickIdType', () => {
    expect(extractClickId({ clickId: 'gclid=XYZ' })).toEqual({ clickId: 'XYZ', clickIdType: 'gclid' });
    expect(extractClickId({ clickId: 'opaque', clickIdType: 'li_fat_id' })).toEqual({ clickId: 'opaque', clickIdType: 'li_fat_id' });
  });
  it('infers the type from well-known prefixes / formats', () => {
    expect(extractClickId({ clickId: 'IwAR0abc' }).clickIdType).toBe('fbclid');
    expect(extractClickId({ clickId: 'Cj0KCQiA' }).clickIdType).toBe('gclid');
    expect(extractClickId({ clickId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' }).clickIdType).toBe('li_fat_id');
    expect(extractClickId({ clickId: 'unknown123' }).clickIdType).toBeNull();
  });
});

describe('utm helpers', () => {
  it('round-trips the generated utm_campaign', () => {
    const utm = buildUtmCampaign(42, 'Motor Q4 – Lagos & Abuja!');
    expect(utm).toBe('ins-42-motor-q4-lagos-abuja');
    expect(parseCampaignIdFromUtm(utm)).toBe(42);
    expect(parseCampaignIdFromUtm('spring-sale')).toBeNull();
  });
  it('refines platform within family by utm_source', () => {
    expect(refinePlatform('META', 'instagram')).toBe('INSTAGRAM');
    expect(refinePlatform('META', 'facebook')).toBe('FACEBOOK');
    expect(refinePlatform('GOOGLE', 'google_display')).toBe('GOOGLE_DISPLAY');
    expect(refinePlatform('GOOGLE', 'google')).toBe('GOOGLE_SEARCH');
    expect(refinePlatform(null, 'linkedin')).toBe('LINKEDIN');
  });
});

describe('resolveAttribution', () => {
  it('fbclid + instagram utm_source → Instagram deployment of the utm campaign', async () => {
    const r = await resolveAttribution({ fbclid: 'IwAR1', utm_campaign: 'ins-7-motor-q4-lagos-abuja', utm_source: 'instagram' }, memoryLookup());
    expect(r).toMatchObject({ clickIdType: 'fbclid', family: 'META', platform: 'INSTAGRAM', campaignId: 7, deploymentId: 71 });
  });

  it('fbclid without utm_source defaults to Facebook', async () => {
    const r = await resolveAttribution({ clickId: 'IwAR2', utm_campaign: 'ins-7-x' }, memoryLookup());
    expect(r).toMatchObject({ platform: 'FACEBOOK', campaignId: 7, deploymentId: 70 });
  });

  it('gclid → Google Search deployment', async () => {
    const r = await resolveAttribution({ gclid: 'Cj0KCQ1', utm_campaign: 'ins-12-sme-package' }, memoryLookup());
    expect(r).toMatchObject({ platform: 'GOOGLE_SEARCH', campaignId: 12, deploymentId: 121 });
  });

  it('li_fat_id → LinkedIn deployment', async () => {
    const r = await resolveAttribution({ li_fat_id: 'abc', utm_campaign: 'ins-12-sme-package' }, memoryLookup());
    expect(r).toMatchObject({ platform: 'LINKEDIN', campaignId: 12, deploymentId: 120 });
  });

  it('matches non-generated utm_campaign values exactly', async () => {
    const r = await resolveAttribution({ gclid: 'Cj0K', utm_campaign: 'legacy-hmo-campaign' }, memoryLookup());
    expect(r).toMatchObject({ campaignId: 9, deploymentId: 90 });
  });

  it('ignores a utm id that does not exist', async () => {
    const r = await resolveAttribution({ gclid: 'Cj0K', utm_campaign: 'ins-999-nope' }, memoryLookup());
    expect(r).toMatchObject({ campaignId: null, deploymentId: null, platform: 'GOOGLE_SEARCH' });
  });

  it('stitches a later funnel event (no utm) to the campaign of an earlier event with the same click id', async () => {
    const lookup = memoryLookup();
    lookup.events.push({ clickId: 'IwAR-funnel', campaignId: 7, platform: 'INSTAGRAM' });
    const r = await resolveAttribution({ clickId: 'IwAR-funnel' }, lookup);
    expect(r).toMatchObject({ campaignId: 7, platform: 'FACEBOOK', deploymentId: 70 });
    expect(r.method.join(' ')).toContain('inherited');
  });

  it('inherits platform from the earlier event when the click id type is unknown', async () => {
    const lookup = memoryLookup();
    lookup.events.push({ clickId: 'opaque-1', campaignId: 7, platform: 'INSTAGRAM' });
    const r = await resolveAttribution({ clickId: 'opaque-1' }, lookup);
    expect(r).toMatchObject({ campaignId: 7, platform: 'INSTAGRAM', deploymentId: 71 });
  });

  it('returns an unattributed result when nothing matches', async () => {
    const r = await resolveAttribution({ clickId: 'opaque-2' }, memoryLookup());
    expect(r).toMatchObject({ campaignId: null, deploymentId: null, platform: null });
  });
});

describe('identifier hashing for CAPI', () => {
  it('normalises email and Nigerian phone numbers before hashing', () => {
    expect(normaliseEmail('  Ada@Example.COM ')).toBe('ada@example.com');
    expect(normalisePhone('0803 123 4567')).toBe('2348031234567');
    expect(normalisePhone('+234 803 123 4567')).toBe('2348031234567');
    expect(sha256('ada@example.com')).toMatch(/^[0-9a-f]{64}$/);
  });
});

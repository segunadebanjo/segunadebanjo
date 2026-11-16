import { describe, expect, it } from 'vitest';
import { trimToLimit } from '../src/lib/strings.js';
import { validateGoogleLimits, GOOGLE_DESCRIPTION_MAX, GOOGLE_HEADLINE_MAX } from '../src/services/compliance/rules.js';
import { autoFixCreative } from '../src/services/compliance/autofix.js';
import { normalise } from '../src/services/ai/creativeGenerator.js';
import type { CreativeContent, ProductLike } from '../src/types.js';

const h = (n: number) => Array.from({ length: n }, (_, i) => `Headline number ${i + 1}`);
const d = (n: number) => Array.from({ length: n }, (_, i) => `Description number ${i + 1} for the ad.`);

describe('Google RSA character limits', () => {
  it('accepts exactly 30-char headlines and 90-char descriptions', () => {
    const headline = 'x'.repeat(30);
    const description = 'y'.repeat(90);
    expect(validateGoogleLimits({ headlines: [headline, ...h(2)], descriptions: [description, ...d(1)] })).toEqual([]);
  });

  it('blocks a 31-char headline and a 91-char description', () => {
    const f = validateGoogleLimits({ headlines: ['x'.repeat(31), ...h(2)], descriptions: ['y'.repeat(91), ...d(1)] });
    expect(f.find((x) => x.code === 'GOOGLE_HEADLINE_LENGTH')).toMatchObject({ severity: 'BLOCK', field: 'headlines[0]' });
    expect(f.find((x) => x.code === 'GOOGLE_DESCRIPTION_LENGTH')).toMatchObject({ severity: 'BLOCK', field: 'descriptions[0]' });
  });

  it('counts multi-byte characters like ₦ as one character', () => {
    expect(validateGoogleLimits({ headlines: ['Car cover from ₦75,000 a year', ...h(2)], descriptions: d(2) })).toEqual([]);
  });

  it('enforces asset counts (3–15 headlines, 2–4 descriptions)', () => {
    expect(validateGoogleLimits({ headlines: h(2), descriptions: d(2) }).map((f) => f.code)).toContain('GOOGLE_ASSET_COUNT');
    expect(validateGoogleLimits({ headlines: h(16), descriptions: d(2) }).map((f) => f.code)).toContain('GOOGLE_ASSET_COUNT');
    expect(validateGoogleLimits({ headlines: h(3), descriptions: d(5) }).map((f) => f.code)).toContain('GOOGLE_ASSET_COUNT');
    expect(validateGoogleLimits({ headlines: h(15), descriptions: d(4) })).toEqual([]);
  });

  it('warns on exclamation marks, repeated punctuation and gimmicky caps but allows acronyms', () => {
    const f = validateGoogleLimits({ headlines: ['Get Covered Today!', 'FREE Quotes Now', 'Compare HMO Plans'], descriptions: ['Fast quotes..', 'SME and NAICOM licensed broker.'] });
    const msgs = f.filter((x) => x.code === 'GOOGLE_EDITORIAL').map((x) => x.field);
    expect(msgs).toEqual(expect.arrayContaining(['headlines[0]', 'headlines[1]', 'descriptions[0]']));
    expect(msgs).not.toContain('headlines[2]');
    expect(msgs).not.toContain('descriptions[1]');
  });
});

describe('trimToLimit', () => {
  it('trims at a word boundary without exceeding the limit', () => {
    const out = trimToLimit('Comprehensive Car Insurance For Every Driver In Lagos', 30);
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out).toBe('Comprehensive Car Insurance');
  });
  it('hard-cuts a single long word', () => {
    expect(trimToLimit('a'.repeat(40), 30)).toHaveLength(30);
  });
  it('leaves short text unchanged (apart from whitespace collapse)', () => {
    expect(trimToLimit('  Get a   Quote ', 30)).toBe('Get a Quote');
  });
});

describe('Google creative normalisation and auto-fix', () => {
  const product: ProductLike = {
    insuranceClass: 'AUTO_MOTOR',
    name: 'DriveSafe',
    targetAudienceSummary: '',
    keyBenefits: [],
    startingPremium: '75000',
    currency: 'NGN',
    landingPageUrl: 'https://example.com',
    regulatoryLicenseNumber: 'NAICOM/IB/2019/0457',
  };
  const tooLong: CreativeContent = {
    platform: 'GOOGLE_SEARCH',
    hookAngle: 'search',
    headlines: ['The Most Comprehensive Motor Insurance Policy Available!', 'Quote in 60s'],
    descriptions: ['z '.repeat(80)],
    primaryTexts: [],
    callToAction: 'GET_QUOTE',
  };

  it('normalise() trims, de-duplicates and back-fills to 10 headlines / 4 descriptions within limits', () => {
    const [c] = normalise([tooLong], { product });
    expect(c.headlines).toHaveLength(10);
    expect(c.descriptions).toHaveLength(4);
    expect(c.headlines.every((x) => x.length <= GOOGLE_HEADLINE_MAX && !x.includes('!'))).toBe(true);
    expect(c.descriptions.every((x) => x.length <= GOOGLE_DESCRIPTION_MAX)).toBe(true);
    expect(new Set(c.headlines.map((x) => x.toLowerCase())).size).toBe(10);
    expect(validateGoogleLimits(c).filter((f) => f.severity === 'BLOCK')).toEqual([]);
  });

  it('autoFixCreative() resolves every length BLOCK', () => {
    const withThree = { ...tooLong, headlines: [...tooLong.headlines, 'Licensed Insurance Broker'], descriptions: [...tooLong.descriptions, 'Short one.'] };
    expect(validateGoogleLimits(withThree).some((f) => f.severity === 'BLOCK')).toBe(true);
    const fixed = autoFixCreative(withThree, product.regulatoryLicenseNumber);
    expect(validateGoogleLimits(fixed).filter((f) => f.severity === 'BLOCK')).toEqual([]);
  });
});

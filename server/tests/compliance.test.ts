import { describe, expect, it } from 'vitest';
import type { InsuranceClass, Platform } from '@prisma/client';
import { autoFixCreative, autoFixTargeting } from '../src/services/compliance/autofix.js';
import { overallStatus, resolveSpecialAdCategory, validateCopy, validateTargeting, licenseDisclosure } from '../src/services/compliance/rules.js';
import { templateCreatives } from '../src/services/ai/templates.js';
import { normalise } from '../src/services/ai/creativeGenerator.js';
import type { CreativeContent, ProductLike } from '../src/types.js';

const LICENSE = 'NAICOM/IB/2019/0457';
const meta = (text: string, headline = 'Car insurance made simple'): CreativeContent => ({
  platform: 'FACEBOOK',
  hookAngle: 'test',
  headlines: [headline],
  primaryTexts: [text],
  descriptions: ['Plans from ₦75,000'],
  callToAction: 'GET_QUOTE',
});
const codes = (c: CreativeContent) => validateCopy(c, LICENSE).map((f) => f.code);
const withLicense = (t: string) => `${t}\n\n${licenseDisclosure(LICENSE)}`;

describe('personal attribute policy', () => {
  it.each([
    'Are you sick of paying hospital bills? Get HMO cover.',
    'Struggling with debt? Protect your family anyway.',
    'Managing your diabetes is expensive. Our plan helps.',
    "We know you're behind on rent, so here's cheap cover.",
    'Do you have high blood pressure? Get covered today.',
    'Your bad credit is no problem for our policy.',
    'You are in debt and need life cover.',
  ])('blocks: %s', (text) => {
    const findings = validateCopy(meta(withLicense(text)), LICENSE);
    expect(findings.some((f) => f.code === 'PERSONAL_ATTRIBUTE' && f.severity === 'BLOCK')).toBe(true);
    expect(overallStatus(findings)).toBe('BLOCKED');
  });

  it.each([
    'Protect your health with access to 1,200+ hospitals.',
    'Quality healthcare for the whole family from ₦120,000/year.',
    'Hospital bills add up fast. Compare HMO plans side by side.',
    'Cover your car against accident, theft and fire.',
  ])('allows neutral copy: %s', (text) => {
    expect(codes(meta(withLicense(text)))).not.toContain('PERSONAL_ATTRIBUTE');
  });
});

describe('guaranteed returns & unsubstantiated claims', () => {
  it.each(['Guaranteed returns of 20% every year', 'A risk-free way to grow wealth', 'Double your money with our savings plan', 'Earn 15% interest on your premiums', 'Zero risk investment-linked life plan'])(
    'blocks: %s',
    (text) => {
      const f = validateCopy(meta(withLicense(text)), LICENSE);
      expect(f.find((x) => x.code === 'GUARANTEED_RETURN')?.severity).toBe('BLOCK');
    },
  );

  it.each(['The cheapest car insurance in Lagos', 'Best insurance in Nigeria', 'Claims always paid within 24h', 'Guaranteed approval, no medicals', '#1 HMO for families'])('warns: %s', (text) => {
    const f = validateCopy(meta(withLicense(text)), LICENSE);
    expect(f.find((x) => x.code === 'UNSUBSTANTIATED_CLAIM')?.severity).toBe('WARN');
    expect(overallStatus(f)).toBe('WARNING');
  });

  it('warns on fear / pressure tactics', () => {
    expect(codes(meta(withLicense("Get life cover before it's too late.")))).toContain('FEAR_PRESSURE');
  });
});

describe('regulatory license disclosure', () => {
  it('blocks Meta/LinkedIn copy without the license number', () => {
    for (const platform of ['FACEBOOK', 'INSTAGRAM', 'LINKEDIN'] as Platform[]) {
      const f = validateCopy({ ...meta('Protect your car today.'), platform }, LICENSE);
      expect(f.find((x) => x.code === 'LICENSE_DISCLOSURE_MISSING')?.severity).toBe('BLOCK');
    }
  });

  it('passes when the disclosure is present, tolerating formatting differences', () => {
    expect(codes(meta(withLicense('Protect your car today.')))).toEqual([]);
    expect(codes(meta('Protect your car today. Reg no: naicom ib 2019 0457'))).toEqual([]);
  });

  it('only warns for Google (char limits) and auto-fix appends it where possible', () => {
    const google: CreativeContent = {
      platform: 'GOOGLE_SEARCH',
      hookAngle: 'search',
      headlines: ['Car Insurance Quotes', 'Get a Quote in 60s', 'Licensed Broker'],
      descriptions: ['Compare comprehensive motor cover.', 'Buy online today.'],
      primaryTexts: [],
      callToAction: 'GET_QUOTE',
    };
    expect(validateCopy(google, LICENSE).find((f) => f.code === 'LICENSE_DISCLOSURE_MISSING')?.severity).toBe('WARN');
    const fixed = autoFixCreative(google, LICENSE);
    expect(fixed.descriptions.some((d) => d.includes(LICENSE))).toBe(true);
    expect(validateCopy(fixed, LICENSE).find((f) => f.code === 'LICENSE_DISCLOSURE_MISSING')).toBeUndefined();
  });

  it('auto-fix appends the disclosure to Meta primary texts without touching other copy', () => {
    const fixed = autoFixCreative(meta('Protect your car today.'), LICENSE);
    expect(fixed.primaryTexts[0]).toBe(withLicense('Protect your car today.'));
    expect(overallStatus(validateCopy(fixed, LICENSE))).toBe('PASSED');
  });
});

describe('Meta Special Ad Categories', () => {
  it('tags FINANCIAL_PRODUCTS_SERVICES, or HOUSING for property, only when Meta placements exist', () => {
    expect(resolveSpecialAdCategory('AUTO_MOTOR', ['FACEBOOK'])).toBe('FINANCIAL_PRODUCTS_SERVICES');
    expect(resolveSpecialAdCategory('HEALTH_HMO', ['INSTAGRAM', 'GOOGLE_SEARCH'])).toBe('FINANCIAL_PRODUCTS_SERVICES');
    expect(resolveSpecialAdCategory('PROPERTY', ['FACEBOOK'])).toBe('HOUSING');
    expect(resolveSpecialAdCategory('PROPERTY', ['GOOGLE_SEARCH', 'LINKEDIN'])).toBeNull();
  });

  it('blocks ZIP, small-radius and demographic micro-targeting', () => {
    const f = validateTargeting(
      { countries: ['NG'], postalCodes: ['100001'], cities: [{ name: 'Ikeja', radiusKm: 5 }], ageMin: 30, genders: ['female'] },
      'FINANCIAL_PRODUCTS_SERVICES',
    );
    expect(f.map((x) => x.code).sort()).toEqual(['SAC_DEMOGRAPHIC_TARGETING', 'SAC_RADIUS_TOO_SMALL', 'SAC_ZIP_TARGETING']);
    expect(f.every((x) => x.severity === 'BLOCK')).toBe(true);
  });

  it('allows the same targeting when no special ad category applies, and auto-fix makes it compliant', () => {
    const t = { countries: ['NG'], postalCodes: ['100001'], cities: [{ name: 'Ikeja', radiusKm: 5 }], ageMin: 30 };
    expect(validateTargeting(t, null)).toEqual([]);
    expect(validateTargeting(autoFixTargeting(t), 'HOUSING')).toEqual([]);
  });
});

describe('built-in templates are compliant for every class and platform', () => {
  const classes: InsuranceClass[] = ['AUTO_MOTOR', 'HEALTH_HMO', 'LIFE', 'PROPERTY', 'COMMERCIAL_SME', 'TRAVEL'];
  const platforms: Platform[] = ['FACEBOOK', 'INSTAGRAM', 'GOOGLE_SEARCH', 'GOOGLE_DISPLAY', 'LINKEDIN'];
  it.each(classes)('%s', (insuranceClass) => {
    const product: ProductLike = {
      insuranceClass,
      name: 'Test Product',
      targetAudienceSummary: 'Adults in Lagos',
      keyBenefits: ['Benefit one', 'Benefit two'],
      startingPremium: '50000.00',
      currency: 'NGN',
      landingPageUrl: 'https://example.com',
      regulatoryLicenseNumber: LICENSE,
    };
    const creatives = normalise(templateCreatives(product, 'POLICY_PURCHASE', platforms), { product });
    expect(creatives.filter((c) => c.platform === 'FACEBOOK')).toHaveLength(3);
    expect(creatives.filter((c) => c.platform === 'INSTAGRAM')).toHaveLength(3);
    for (const c of creatives) {
      const findings = validateCopy(c, LICENSE);
      expect(findings.filter((f) => f.severity === 'BLOCK'), `${c.platform}/${c.hookAngle}`).toEqual([]);
    }
  });
});

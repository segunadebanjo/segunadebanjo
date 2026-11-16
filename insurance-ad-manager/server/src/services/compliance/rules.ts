import type { InsuranceClass, Platform } from '@prisma/client';
import { isGoogle, isMeta, type CreativeContent, type TargetLocations } from '../../types.js';

export type Severity = 'BLOCK' | 'WARN';

export interface ComplianceFinding {
  code: string;
  severity: Severity;
  field: string;
  message: string;
  autoFixable: boolean;
  source?: 'rules' | 'ai';
}

export const GOOGLE_HEADLINE_MAX = 30;
export const GOOGLE_DESCRIPTION_MAX = 90;
export const GOOGLE_HEADLINES_MIN = 3;
export const GOOGLE_HEADLINES_MAX = 15;
export const GOOGLE_DESCRIPTIONS_MIN = 2;
export const GOOGLE_DESCRIPTIONS_MAX = 4;
export const META_HEADLINE_SOFT_MAX = 40;
export const META_PRIMARY_SOFT_MAX = 500;
/** Meta Special Ad Category minimum location radius: 15 miles. */
export const SAC_MIN_RADIUS_KM = 24.14;

export const RULE_CATALOGUE: { code: string; severity: string; description: string }[] = [
  { code: 'PERSONAL_ATTRIBUTE', severity: 'BLOCK', description: "Copy implies knowledge of the viewer's health, medical, financial distress, debt/credit or other personal attributes." },
  { code: 'GUARANTEED_RETURN', severity: 'BLOCK', description: 'Unsubstantiated guaranteed returns/profit, "risk-free", "double your money".' },
  { code: 'UNSUBSTANTIATED_CLAIM', severity: 'WARN', description: 'Superlatives or absolute promises ("cheapest", "#1", "claims always paid", "guaranteed approval").' },
  { code: 'LICENSE_DISCLOSURE_MISSING', severity: 'BLOCK (Meta/LinkedIn) / WARN (Google)', description: 'Regulatory license number must be appended to the ad copy.' },
  { code: 'GOOGLE_HEADLINE_LENGTH', severity: 'BLOCK', description: `RSA headlines max ${GOOGLE_HEADLINE_MAX} characters.` },
  { code: 'GOOGLE_DESCRIPTION_LENGTH', severity: 'BLOCK', description: `RSA descriptions max ${GOOGLE_DESCRIPTION_MAX} characters.` },
  { code: 'GOOGLE_ASSET_COUNT', severity: 'BLOCK', description: 'RSA needs 3–15 headlines and 2–4 descriptions.' },
  { code: 'GOOGLE_EDITORIAL', severity: 'WARN', description: 'No "!" in headlines, no repeated punctuation, no gimmicky ALL-CAPS.' },
  { code: 'META_TEXT_LENGTH', severity: 'WARN', description: `Meta headline > ${META_HEADLINE_SOFT_MAX} chars or primary text > ${META_PRIMARY_SOFT_MAX} chars gets truncated.` },
  { code: 'FEAR_PRESSURE', severity: 'WARN', description: 'Fear or high-pressure tactics.' },
  { code: 'SAC_ZIP_TARGETING', severity: 'BLOCK', description: 'Meta Special Ad Category campaigns cannot target postal/ZIP codes.' },
  { code: 'SAC_RADIUS_TOO_SMALL', severity: 'BLOCK', description: 'Meta Special Ad Category location radius must be at least 15 miles (24 km).' },
  { code: 'SAC_DEMOGRAPHIC_TARGETING', severity: 'BLOCK', description: 'Meta Special Ad Category campaigns cannot restrict age or gender.' },
];

// ---------------------------------------------------------------------------
// Pattern libraries
// ---------------------------------------------------------------------------

/** Sensitive personal attributes (health, financial distress, etc.). */
const SENSITIVE =
  '(?:diabet\\w*|cancer|hiv|aids|hypertension|high blood pressure|illness(?:es)?|ill|sick(?:ness)?|disease|medical (?:condition|history)|pre-?existing condition|pregnan\\w*|disab\\w*|depress\\w*|anxiety|mental health|obes\\w*|overweight|addict\\w*|debts?|in debt|bankrupt\\w*|bad credit|poor credit|credit score|broke|poor|low income|financial (?:distress|trouble|hardship|problems?|struggles?)|struggl\\w*|can\'?t afford|cannot afford|overdue|behind on (?:rent|bills|payments)|unemployed|jobless|lost your job|divorc\\w*|widow\\w*|religio\\w*|sexual\\w*|ethnic\\w*|criminal record)';

const PERSONAL_ATTRIBUTE_PATTERNS: RegExp[] = [
  // "your diabetes", "your bad credit", "your medical bills"
  new RegExp(`\\byour\\s+(?:\\w+\\s+){0,2}${SENSITIVE}\\b`, 'i'),
  // "are you sick", "are you in debt", "are you struggling"
  new RegExp(`\\b(?:are|were)\\s+you\\s+(?:\\w+\\s+){0,2}${SENSITIVE}\\b`, 'i'),
  // "you're broke", "you are struggling with debt", "you have cancer"
  new RegExp(`\\b(?:you'?re|you\\s+are|you\\s+have|you'?ve\\s+(?:got|been)|you\\s+suffer(?:\\s+from)?)\\s+(?:\\w+\\s+){0,3}${SENSITIVE}\\b`, 'i'),
  // "do you have diabetes", "know you have", "we know you"
  new RegExp(`\\bdo\\s+you\\s+(?:have|suffer\\s+from)\\s+(?:\\w+\\s+){0,2}${SENSITIVE}\\b`, 'i'),
  /\bwe know (?:you|that you|your)\b/i,
  /\b(?:struggling|drowning|buried)\s+(?:in|with)\s+(?:debt|bills|medical bills)\b/i,
];

const GUARANTEED_RETURN_PATTERNS: RegExp[] = [
  /\bguaranteed\s+(?:returns?|profits?|income|yields?|interest|payouts?|gains?|growth|investment)\b/i,
  /\b(?:returns?|profits?|yields?|gains?)\s+(?:are\s+)?guaranteed\b/i,
  /\brisk[-\s]?free\b/i,
  /\bno\s+risk\b/i,
  /\bzero\s+risk\b/i,
  /\bdouble\s+your\s+(?:money|investment|savings)\b/i,
  /\b100\s?%\s+guaranteed\b/i,
  /\b(?:earn|get|make)\s+\d+\s?%\s+(?:returns?|interest|profit)\b/i,
];

const UNSUBSTANTIATED_PATTERNS: RegExp[] = [
  /\bcheapest\b/i,
  /\blowest\s+(?:price|premium|rate)s?\b/i,
  /\bbest\s+(?:insurance|insurer|cover|rates?|prices?|policy|hmo)\b/i,
  /\b(?:the\s+)?best\s+in\s+(?:nigeria|africa|the\s+world|town|lagos)\b/i,
  /#\s?1\b|\bnumber\s+one\b/i,
  /\bclaims?\s+(?:are\s+)?always\s+paid\b/i,
  /\b(?:100\s?%|all)\s+claims?\s+(?:paid|settled|approved)\b/i,
  /\bguaranteed\s+(?:approval|acceptance|cover(?:age)?|payout|claims?)\b/i,
  /\binstant\s+(?:approval|claims?\s+payment)\b/i,
  /\bno\s+questions\s+asked\b/i,
  /\bfree\s+insurance\b/i,
];

const FEAR_PATTERNS: RegExp[] = [
  /\bbefore\s+it'?s\s+too\s+late\b/i,
  /\b(?:you'?ll|you\s+will)\s+lose\s+everything\b/i,
  /\bdon'?t\s+let\s+your\s+(?:family|kids|children)\s+suffer\b/i,
  /\bwhat\s+if\s+you\s+die\s+tomorrow\b/i,
  /\bact\s+now\s+or\b/i,
];

const ACRONYMS = new Set(['HMO', 'SME', 'NAICOM', 'NGN', 'USD', 'GBP', 'FAQ', 'UK', 'USA', 'UAE', 'ECOWAS', 'LASG', 'FCT', 'NHIA', 'NIIRA', 'ATM', 'CEO', 'CFO', 'HR', 'B2B', 'ID', 'PA', 'OPD', 'ICU', 'COVID', 'SUV', 'RC', 'NIN', 'BVN', 'KYC', 'LLC', 'PLC', 'LTD', 'GIT', 'FIRE', 'ROI', 'GPS']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const firstMatch = (patterns: RegExp[], text: string) => {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return null;
};

const fieldTexts = (c: CreativeContent): { field: string; text: string }[] => [
  ...c.headlines.map((text, i) => ({ field: `headlines[${i}]`, text })),
  ...c.primaryTexts.map((text, i) => ({ field: `primaryTexts[${i}]`, text })),
  ...c.descriptions.map((text, i) => ({ field: `descriptions[${i}]`, text })),
];

const normalise = (s: string) => s.toLowerCase().replace(/[\s.\-/:]/g, '');

export const licenseDisclosure = (licenseNumber: string) => `Licensed by NAICOM. Reg. No: ${licenseNumber}.`;

export const containsLicense = (text: string, licenseNumber: string) =>
  licenseNumber.trim() !== '' && normalise(text).includes(normalise(licenseNumber));

export function overallStatus(findings: ComplianceFinding[]): 'PASSED' | 'WARNING' | 'BLOCKED' {
  if (findings.some((f) => f.severity === 'BLOCK')) return 'BLOCKED';
  if (findings.some((f) => f.severity === 'WARN')) return 'WARNING';
  return 'PASSED';
}

// ---------------------------------------------------------------------------
// Special Ad Category
// ---------------------------------------------------------------------------

export type SpecialAdCategory = 'FINANCIAL_PRODUCTS_SERVICES' | 'HOUSING';

/** Meta Special Ad Category for a campaign. Null if the campaign has no Meta placements. */
export function resolveSpecialAdCategory(insuranceClass: InsuranceClass, platforms: Platform[]): SpecialAdCategory | null {
  if (!platforms.some(isMeta)) return null;
  return insuranceClass === 'PROPERTY' ? 'HOUSING' : 'FINANCIAL_PRODUCTS_SERVICES';
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export function validateCopy(content: CreativeContent, licenseNumber: string): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];
  const texts = fieldTexts(content);

  for (const { field, text } of texts) {
    const pa = firstMatch(PERSONAL_ATTRIBUTE_PATTERNS, text);
    if (pa)
      findings.push({
        code: 'PERSONAL_ATTRIBUTE',
        severity: 'BLOCK',
        field,
        message: `"${pa}" asserts or implies knowledge of the viewer's personal attributes (health/financial situation). Rewrite in neutral, third-person terms.`,
        autoFixable: false,
      });

    const gr = firstMatch(GUARANTEED_RETURN_PATTERNS, text);
    if (gr)
      findings.push({
        code: 'GUARANTEED_RETURN',
        severity: 'BLOCK',
        field,
        message: `"${gr}" is an unsubstantiated guaranteed-return / no-risk claim, prohibited for financial products.`,
        autoFixable: false,
      });

    const un = firstMatch(UNSUBSTANTIATED_PATTERNS, text);
    if (un)
      findings.push({
        code: 'UNSUBSTANTIATED_CLAIM',
        severity: 'WARN',
        field,
        message: `"${un}" is an absolute or superlative claim. Keep only if you hold documented substantiation.`,
        autoFixable: false,
      });

    const fear = firstMatch(FEAR_PATTERNS, text);
    if (fear)
      findings.push({
        code: 'FEAR_PRESSURE',
        severity: 'WARN',
        field,
        message: `"${fear}" uses fear or pressure tactics that can be judged misleading by regulators.`,
        autoFixable: false,
      });
  }

  // License disclosure
  const google = isGoogle(content.platform);
  const allCopy = [...content.primaryTexts, ...content.descriptions].join(' ');
  if (google) {
    if (!containsLicense(allCopy, licenseNumber))
      findings.push({
        code: 'LICENSE_DISCLOSURE_MISSING',
        severity: 'WARN',
        field: 'descriptions',
        message: `Regulatory license number (${licenseNumber}) is not in any description. RSA character limits usually can't fit it, so make sure it is on the landing page.`,
        autoFixable: true,
      });
  } else {
    const missing = content.primaryTexts.map((t, i) => ({ t, i })).filter(({ t }) => !containsLicense(t, licenseNumber));
    if (content.primaryTexts.length === 0 || missing.length > 0)
      findings.push({
        code: 'LICENSE_DISCLOSURE_MISSING',
        severity: 'BLOCK',
        field: missing.length ? missing.map(({ i }) => `primaryTexts[${i}]`).join(', ') : 'primaryTexts',
        message: `Every primary text must end with the regulatory disclosure "${licenseDisclosure(licenseNumber)}".`,
        autoFixable: true,
      });
  }

  if (google) findings.push(...validateGoogleLimits(content));

  if (isMeta(content.platform)) {
    content.headlines.forEach((h, i) => {
      if (h.length > META_HEADLINE_SOFT_MAX)
        findings.push({ code: 'META_TEXT_LENGTH', severity: 'WARN', field: `headlines[${i}]`, message: `Headline is ${h.length} chars; Meta truncates after ~${META_HEADLINE_SOFT_MAX}.`, autoFixable: false });
    });
    content.primaryTexts.forEach((t, i) => {
      if (t.length > META_PRIMARY_SOFT_MAX)
        findings.push({ code: 'META_TEXT_LENGTH', severity: 'WARN', field: `primaryTexts[${i}]`, message: `Primary text is ${t.length} chars; keep under ${META_PRIMARY_SOFT_MAX}.`, autoFixable: false });
    });
  }

  return findings.map((f) => ({ ...f, source: 'rules' as const }));
}

/** Google Responsive Search Ad limits: 30-char headlines, 90-char descriptions, asset counts, editorial. */
export function validateGoogleLimits(content: Pick<CreativeContent, 'headlines' | 'descriptions'>): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];
  content.headlines.forEach((h, i) => {
    if (h.length > GOOGLE_HEADLINE_MAX)
      findings.push({ code: 'GOOGLE_HEADLINE_LENGTH', severity: 'BLOCK', field: `headlines[${i}]`, message: `Headline "${h}" is ${h.length} chars (max ${GOOGLE_HEADLINE_MAX}).`, autoFixable: true });
    if (h.includes('!'))
      findings.push({ code: 'GOOGLE_EDITORIAL', severity: 'WARN', field: `headlines[${i}]`, message: 'Google does not allow exclamation marks in headlines.', autoFixable: true });
  });
  content.descriptions.forEach((d, i) => {
    if (d.length > GOOGLE_DESCRIPTION_MAX)
      findings.push({ code: 'GOOGLE_DESCRIPTION_LENGTH', severity: 'BLOCK', field: `descriptions[${i}]`, message: `Description is ${d.length} chars (max ${GOOGLE_DESCRIPTION_MAX}).`, autoFixable: true });
  });
  [...content.headlines.map((t, i) => ({ t, f: `headlines[${i}]` })), ...content.descriptions.map((t, i) => ({ t, f: `descriptions[${i}]` }))].forEach(({ t, f }) => {
    if (/([!?.])\1/.test(t))
      findings.push({ code: 'GOOGLE_EDITORIAL', severity: 'WARN', field: f, message: 'Repeated punctuation is disapproved by Google editorial policy.', autoFixable: true });
    const caps = (t.match(/\b[A-Z]{4,}\b/g) ?? []).filter((w) => !ACRONYMS.has(w));
    if (caps.length)
      findings.push({ code: 'GOOGLE_EDITORIAL', severity: 'WARN', field: f, message: `Gimmicky capitalisation (${caps.join(', ')}) is disapproved by Google.`, autoFixable: false });
  });
  if (content.headlines.length < GOOGLE_HEADLINES_MIN || content.headlines.length > GOOGLE_HEADLINES_MAX)
    findings.push({ code: 'GOOGLE_ASSET_COUNT', severity: 'BLOCK', field: 'headlines', message: `RSA needs ${GOOGLE_HEADLINES_MIN}–${GOOGLE_HEADLINES_MAX} headlines (has ${content.headlines.length}).`, autoFixable: false });
  if (content.descriptions.length < GOOGLE_DESCRIPTIONS_MIN || content.descriptions.length > GOOGLE_DESCRIPTIONS_MAX)
    findings.push({ code: 'GOOGLE_ASSET_COUNT', severity: 'BLOCK', field: 'descriptions', message: `RSA needs ${GOOGLE_DESCRIPTIONS_MIN}–${GOOGLE_DESCRIPTIONS_MAX} descriptions (has ${content.descriptions.length}).`, autoFixable: false });
  return findings;
}

/** Targeting rules for Meta Special Ad Category campaigns. */
export function validateTargeting(targeting: TargetLocations, specialAdCategory: string | null): ComplianceFinding[] {
  if (!specialAdCategory) return [];
  const findings: ComplianceFinding[] = [];
  if (targeting.postalCodes && targeting.postalCodes.length > 0)
    findings.push({ code: 'SAC_ZIP_TARGETING', severity: 'BLOCK', field: 'targetLocations.postalCodes', message: `${specialAdCategory} campaigns cannot target postal/ZIP codes. Use states or cities (15+ mile radius).`, autoFixable: true });
  for (const c of targeting.cities ?? []) {
    if (c.radiusKm !== undefined && c.radiusKm < SAC_MIN_RADIUS_KM)
      findings.push({ code: 'SAC_RADIUS_TOO_SMALL', severity: 'BLOCK', field: `targetLocations.cities.${c.name}`, message: `Radius ${c.radiusKm} km around ${c.name} is below the 15-mile (24 km) minimum for ${specialAdCategory}.`, autoFixable: true });
  }
  const ageRestricted = (targeting.ageMin !== undefined && targeting.ageMin > 18) || (targeting.ageMax !== undefined && targeting.ageMax < 65);
  if (ageRestricted || (targeting.genders && targeting.genders.length === 1))
    findings.push({ code: 'SAC_DEMOGRAPHIC_TARGETING', severity: 'BLOCK', field: 'targetLocations', message: `${specialAdCategory} campaigns must target all ages 18–65+ and all genders.`, autoFixable: true });
  return findings.map((f) => ({ ...f, source: 'rules' as const }));
}

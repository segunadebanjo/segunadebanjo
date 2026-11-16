import type { CampaignObjective, Platform } from '@prisma/client';
import { z } from 'zod';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { config } from '../../config.js';
import { asStringArray, isGoogle, isMeta, type CreativeContent, type ProductLike, type TargetLocations } from '../../types.js';
import { trimToLimit } from '../../lib/strings.js';
import { GOOGLE_DESCRIPTION_MAX, GOOGLE_HEADLINE_MAX, licenseDisclosure, containsLicense } from '../compliance/rules.js';
import { getAnthropic } from './anthropicClient.js';
import { googleBackfill, templateCreatives } from './templates.js';

const MetaVariant = z.object({
  hookAngle: z.string().describe('Short name of the hook angle, e.g. "Vehicle protection"'),
  headline: z.string().describe('Max 40 characters'),
  primaryText: z.string().describe('2-4 sentences. Must end with the regulatory disclosure line given in the brief.'),
  description: z.string().describe('Link description, max 30 characters'),
  callToAction: z.enum(['LEARN_MORE', 'GET_QUOTE', 'APPLY_NOW', 'SIGN_UP', 'CONTACT_US']),
  visualBrief: z.string().describe('Reels (9:16) or carousel brief: shots, on-screen text, end card.'),
});

const GeneratedSchema = z.object({
  meta: z.array(MetaVariant).describe('Exactly 3 variants: asset protection, cost-savings calculator, life/business milestone'),
  googleSearch: z.object({
    headlines: z.array(z.string()).describe('Exactly 10 headlines, each max 30 characters, no exclamation marks'),
    descriptions: z.array(z.string()).describe('Exactly 4 descriptions, each max 90 characters'),
    keywords: z.array(z.string()).describe('10-15 high-intent buyer keywords (phrase match)'),
  }),
  linkedin: z.array(
    z.object({
      hookAngle: z.string(),
      headline: z.string().describe('Max 70 characters'),
      introText: z.string().describe('Sponsored Content intro text for B2B decision makers; must end with the regulatory disclosure line.'),
      callToAction: z.enum(['LEARN_MORE', 'REQUEST_DEMO', 'APPLY', 'DOWNLOAD', 'SIGN_UP']),
      jobTitles: z.array(z.string()),
      industries: z.array(z.string()),
      companySizes: z.array(z.string()),
      visualBrief: z.string(),
    }),
  ).describe('2 variants'),
});
type Generated = z.infer<typeof GeneratedSchema>;

const SYSTEM = `You write paid-media creative for a NAICOM-licensed insurance brokerage in Nigeria.
Write platform-native, plain-English copy that drives qualified quote requests and policy purchases.

Hard rules (ads that break them are rejected automatically):
- Never assert or imply knowledge of the reader's health, medical conditions, finances, debt, credit, or other personal attributes. No "Are you sick?", "your diabetes", "struggling with debt?". Speak about the product and outcomes, not the reader's circumstances.
- No guaranteed returns, "risk-free", "no risk", "double your money", or absolute claims ("cheapest", "best", "#1", "claims always paid", "guaranteed approval").
- No fear or pressure tactics.
- Meta and LinkedIn primary/intro text must END with the exact regulatory disclosure line provided.
- Google RSA: headlines ≤ 30 characters, descriptions ≤ 90 characters, no exclamation marks, no ALL-CAPS words except acronyms (HMO, SME, NAICOM).
- Quote prices only as "from <starting premium>" using the figure provided.`;

export interface GenerateInput {
  product: ProductLike;
  objective: CampaignObjective;
  platforms: Platform[];
  targetLocations: TargetLocations;
  extraInstructions?: string;
}

export interface GenerateResult {
  creatives: CreativeContent[];
  source: 'claude' | 'template';
  note?: string;
}

export async function generateCreatives(input: GenerateInput): Promise<GenerateResult> {
  const client = getAnthropic();
  if (!client) {
    return { creatives: normalise(templateCreatives(input.product, input.objective, input.platforms), input), source: 'template', note: 'ANTHROPIC_API_KEY not set; used built-in templates.' };
  }
  try {
    const { product } = input;
    const brief = {
      product: product.name,
      insuranceClass: product.insuranceClass,
      audience: product.targetAudienceSummary,
      keyBenefits: asStringArray(product.keyBenefits),
      startingPremium: `${product.currency} ${Number(String(product.startingPremium)).toLocaleString('en-NG')}`,
      objective: input.objective,
      locations: input.targetLocations,
      regulatoryDisclosureLine: licenseDisclosure(product.regulatoryLicenseNumber),
      platformsInCampaign: input.platforms,
      linkedinNote:
        product.insuranceClass === 'COMMERCIAL_SME' || product.insuranceClass === 'HEALTH_HMO'
          ? 'Target business owners and HR/finance decision makers (corporate plans).'
          : 'Target HR, finance and operations decision makers buying group or corporate versions of this product.',
      extraInstructions: input.extraInstructions ?? null,
    };
    const response = await client.beta.messages.parse({
      // Server-side refusal fallback: if the model declines, the API reroutes within the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      model: config.ANTHROPIC_MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium', format: betaZodOutputFormat(GeneratedSchema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: `Create the campaign creative pack for this brief:\n${JSON.stringify(brief, null, 2)}` }],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) throw new Error(`Claude returned no usable output (${response.stop_reason})`);
    return { creatives: normalise(fromGenerated(response.parsed_output, input), input), source: 'claude' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { creatives: normalise(templateCreatives(input.product, input.objective, input.platforms), input), source: 'template', note: `AI generation failed (${msg}); used built-in templates.` };
  }
}

function fromGenerated(g: Generated, input: GenerateInput): CreativeContent[] {
  const out: CreativeContent[] = [];
  for (const platform of input.platforms) {
    if (isMeta(platform)) {
      for (const v of g.meta.slice(0, 3))
        out.push({
          platform,
          hookAngle: v.hookAngle,
          headlines: [v.headline],
          primaryTexts: [v.primaryText],
          descriptions: [v.description],
          callToAction: v.callToAction,
          mediaBriefOrUrl: platform === 'INSTAGRAM' ? v.visualBrief : v.visualBrief,
        });
    } else if (platform === 'GOOGLE_SEARCH') {
      out.push({ platform, hookAngle: 'High-intent search', headlines: g.googleSearch.headlines, primaryTexts: [], descriptions: g.googleSearch.descriptions, callToAction: 'GET_QUOTE', keywords: g.googleSearch.keywords });
    } else if (platform === 'GOOGLE_DISPLAY') {
      out.push({
        platform,
        hookAngle: 'Remarketing display',
        headlines: g.googleSearch.headlines.slice(0, 5),
        primaryTexts: [],
        descriptions: g.googleSearch.descriptions,
        callToAction: 'GET_QUOTE',
        mediaBriefOrUrl: 'Responsive display assets: 1200x628 + 1200x1200 lifestyle images, square logo, brand colours.',
      });
    } else if (platform === 'LINKEDIN') {
      for (const v of g.linkedin.slice(0, 2))
        out.push({
          platform,
          hookAngle: v.hookAngle,
          headlines: [v.headline],
          primaryTexts: [v.introText],
          descriptions: ['Speak to a licensed broker today.'],
          callToAction: v.callToAction,
          targetingSuggestions: { jobTitles: v.jobTitles, industries: v.industries, companySizes: v.companySizes },
          mediaBriefOrUrl: v.visualBrief,
        });
    }
  }
  return out;
}

/**
 * Enforce hard platform constraints regardless of where copy came from:
 * Google: trim to 30/90 chars, de-duplicate, back-fill to 10 headlines / 4 descriptions;
 * Meta/LinkedIn: guarantee the regulatory disclosure is appended.
 */
export function normalise(creatives: CreativeContent[], input: Pick<GenerateInput, 'product'>): CreativeContent[] {
  const { product } = input;
  return creatives.map((c) => {
    if (isGoogle(c.platform)) {
      const backfill = googleBackfill(product.insuranceClass);
      const target = c.platform === 'GOOGLE_SEARCH' ? 10 : 5;
      const headlines = fill(
        c.headlines.map((h) => trimToLimit(h.replace(/!+/g, ''), GOOGLE_HEADLINE_MAX)),
        backfill.headlines,
        target,
      );
      const descriptions = fill(
        c.descriptions.map((d) => trimToLimit(d, GOOGLE_DESCRIPTION_MAX)),
        backfill.descriptions,
        4,
      );
      return { ...c, headlines, descriptions };
    }
    return {
      ...c,
      primaryTexts: c.primaryTexts.map((t) =>
        containsLicense(t, product.regulatoryLicenseNumber) ? t : `${t.trim()}\n\n${licenseDisclosure(product.regulatoryLicenseNumber)}`,
      ),
    };
  });
}

function fill(primary: string[], backfill: string[], target: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...primary, ...backfill]) {
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= target) break;
  }
  return out;
}

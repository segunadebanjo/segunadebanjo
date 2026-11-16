import { z } from 'zod';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { getAnthropic } from '../ai/anthropicClient.js';
import { config } from '../../config.js';
import type { CreativeContent, ProductLike } from '../../types.js';
import type { ComplianceFinding } from './rules.js';

const AiReview = z.object({
  findings: z.array(
    z.object({
      field: z.string().describe('e.g. headlines[2], primaryTexts[0], descriptions[1]'),
      issue: z.string().describe('One sentence: what is wrong and how to fix it.'),
      category: z.enum(['PERSONAL_ATTRIBUTE', 'MISLEADING_CLAIM', 'PRESSURE_TACTIC', 'REGULATORY_DISCLOSURE', 'OTHER']),
    }),
  ),
});

const SYSTEM = `You are a compliance reviewer for a NAICOM-licensed Nigerian insurance brokerage.
You pre-screen paid social and search ads before they go to Meta, Google and LinkedIn.
Flag only real problems, judged against:
- Meta personal-attributes policy: copy must not assert or imply knowledge of the viewer's health, medical condition, financial situation (debt, credit, hardship), or other personal characteristics, even indirectly.
- Financial-services ad policies: no unsubstantiated guarantees, returns, "risk-free" claims, or misleading statements about cover, price or claims.
- Insurance advertising norms: premiums and benefits must not be overstated; exclusions should not be hidden behind absolute language; no fear or pressure tactics.
Return an empty findings list when the copy is acceptable. Do not flag the license disclosure line itself.`;

/**
 * Optional AI pre-flight review. Findings are returned as WARN only; deterministic rules remain the
 * only source of BLOCK decisions. Returns [] when no API key is configured or the call fails.
 */
export async function aiPreflight(content: CreativeContent, product: ProductLike): Promise<{ findings: ComplianceFinding[]; ran: boolean; error?: string }> {
  const client = getAnthropic();
  if (!client) return { findings: [], ran: false };
  try {
    const response = await client.beta.messages.parse({
      // Server-side refusal fallback: if the model declines, the API reroutes within the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      model: config.ANTHROPIC_MODEL,
      max_tokens: 4000,
      output_config: { effort: 'low', format: betaZodOutputFormat(AiReview) },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Product: ${product.name} (${product.insuranceClass}). Platform: ${content.platform}.\n\nAd copy (JSON):\n${JSON.stringify(
            { headlines: content.headlines, primaryTexts: content.primaryTexts, descriptions: content.descriptions, callToAction: content.callToAction },
            null,
            2,
          )}`,
        },
      ],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) return { findings: [], ran: false, error: `AI review unavailable (${response.stop_reason})` };
    return {
      ran: true,
      findings: response.parsed_output.findings.map((f) => ({
        code: `AI_${f.category}`,
        severity: 'WARN' as const,
        field: f.field,
        message: f.issue,
        autoFixable: false,
        source: 'ai' as const,
      })),
    };
  } catch (err) {
    return { findings: [], ran: false, error: err instanceof Error ? err.message : String(err) };
  }
}

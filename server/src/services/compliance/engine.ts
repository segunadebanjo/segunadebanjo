import type { ComplianceStatus } from '@prisma/client';
import type { CreativeContent, ProductLike, TargetLocations } from '../../types.js';
import { aiPreflight } from './aiValidator.js';
import { autoFixCreative } from './autofix.js';
import { overallStatus, validateCopy, validateTargeting, type ComplianceFinding } from './rules.js';

export interface VariantCheckResult {
  content: CreativeContent;
  status: ComplianceStatus;
  findings: ComplianceFinding[];
  aiReviewed: boolean;
  aiError?: string;
}

export async function checkCreative(
  content: CreativeContent,
  product: ProductLike,
  opts: { autoFix?: boolean; useAi?: boolean } = {},
): Promise<VariantCheckResult> {
  const fixed = opts.autoFix ? autoFixCreative(content, product.regulatoryLicenseNumber) : content;
  const findings = validateCopy(fixed, product.regulatoryLicenseNumber);
  let aiReviewed = false;
  let aiError: string | undefined;
  if (opts.useAi) {
    const ai = await aiPreflight(fixed, product);
    findings.push(...ai.findings);
    aiReviewed = ai.ran;
    aiError = ai.error;
  }
  return { content: fixed, status: overallStatus(findings), findings, aiReviewed, aiError };
}

export function checkTargeting(targeting: TargetLocations, specialAdCategory: string | null) {
  const findings = validateTargeting(targeting, specialAdCategory);
  return { status: overallStatus(findings), findings };
}

export * from './rules.js';
export { autoFixCreative, autoFixTargeting } from './autofix.js';

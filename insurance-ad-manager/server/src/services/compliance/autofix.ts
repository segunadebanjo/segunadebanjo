import { isGoogle, type CreativeContent, type TargetLocations } from '../../types.js';
import { trimToLimit } from '../../lib/strings.js';
import {
  GOOGLE_DESCRIPTION_MAX,
  GOOGLE_HEADLINE_MAX,
  SAC_MIN_RADIUS_KM,
  containsLicense,
  licenseDisclosure,
} from './rules.js';

/**
 * Apply the deterministic, meaning-preserving fixes:
 * - append the regulatory disclosure to Meta/LinkedIn primary texts
 * - for Google: trim headlines/descriptions to 30/90 chars, strip "!" and repeated punctuation,
 *   and put the disclosure in the last description if it fits
 * Copy-level violations (personal attributes, guaranteed returns) are never auto-rewritten.
 */
export function autoFixCreative(content: CreativeContent, licenseNumber: string): CreativeContent {
  const disclosure = licenseDisclosure(licenseNumber);
  if (isGoogle(content.platform)) {
    const clean = (s: string) => s.replace(/!+/g, '').replace(/([?.])\1+/g, '$1').trim();
    const headlines = dedupe(content.headlines.map((h) => trimToLimit(clean(h), GOOGLE_HEADLINE_MAX)).filter(Boolean)).slice(0, 15);
    let descriptions = content.descriptions.map((d) => trimToLimit(d.replace(/([!?.])\1+/g, '$1'), GOOGLE_DESCRIPTION_MAX)).slice(0, 4);
    if (!descriptions.some((d) => containsLicense(d, licenseNumber))) {
      const short = `Licensed by NAICOM. Reg ${licenseNumber}.`;
      const idx = descriptions.length - 1;
      if (idx >= 0) {
        const candidate = `${descriptions[idx]} ${short}`;
        if (candidate.length <= GOOGLE_DESCRIPTION_MAX) descriptions[idx] = candidate;
        else if (descriptions.length < 4 && short.length <= GOOGLE_DESCRIPTION_MAX) descriptions = [...descriptions, short];
      }
    }
    return { ...content, headlines, descriptions };
  }
  return {
    ...content,
    primaryTexts: content.primaryTexts.map((t) => (containsLicense(t, licenseNumber) ? t : `${t.trim()}\n\n${disclosure}`)),
  };
}

/** Make targeting Special-Ad-Category safe: drop postal codes & demographics, widen small radii. */
export function autoFixTargeting(t: TargetLocations): TargetLocations {
  return {
    countries: t.countries,
    regions: t.regions,
    cities: t.cities?.map((c) => ({ ...c, radiusKm: c.radiusKm !== undefined && c.radiusKm < SAC_MIN_RADIUS_KM ? 25 : c.radiusKm })),
  };
}

const dedupe = (arr: string[]) => [...new Set(arr)];

import type { InsuranceClass, Platform } from '@prisma/client';

export const PLATFORMS: Platform[] = ['FACEBOOK', 'INSTAGRAM', 'GOOGLE_SEARCH', 'GOOGLE_DISPLAY', 'LINKEDIN'];
export const INSURANCE_CLASSES: InsuranceClass[] = ['AUTO_MOTOR', 'HEALTH_HMO', 'LIFE', 'PROPERTY', 'COMMERCIAL_SME', 'TRAVEL'];

export type PlatformFamily = 'META' | 'GOOGLE' | 'LINKEDIN';

export const platformFamily = (p: Platform): PlatformFamily =>
  p === 'FACEBOOK' || p === 'INSTAGRAM' ? 'META' : p === 'LINKEDIN' ? 'LINKEDIN' : 'GOOGLE';

export const isMeta = (p: Platform) => platformFamily(p) === 'META';
export const isGoogle = (p: Platform) => platformFamily(p) === 'GOOGLE';

/** Geographic targeting stored in campaigns.target_locations (JSON). */
export interface TargetLocations {
  countries: string[]; // ISO-3166 alpha-2, e.g. ["NG"]
  regions?: string[]; // states, e.g. ["Lagos", "FCT"]
  cities?: { name: string; radiusKm?: number }[];
  postalCodes?: string[]; // blocked for Meta Special Ad Category campaigns
  ageMin?: number; // blocked for Meta SAC
  ageMax?: number;
  genders?: ('male' | 'female')[];
}

export interface ProductLike {
  id?: number;
  insuranceClass: InsuranceClass;
  name: string;
  targetAudienceSummary: string;
  keyBenefits: unknown;
  startingPremium: unknown;
  currency: string;
  landingPageUrl: string;
  regulatoryLicenseNumber: string;
}

/** Normalised creative content (what the generator returns and the compliance engine checks). */
export interface CreativeContent {
  platform: Platform;
  hookAngle: string;
  headlines: string[];
  primaryTexts: string[];
  descriptions: string[];
  callToAction: string;
  mediaBriefOrUrl?: string | null;
  keywords?: string[] | null;
  targetingSuggestions?: { jobTitles?: string[]; industries?: string[]; companySizes?: string[] } | null;
}

export const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

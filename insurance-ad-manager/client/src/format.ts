import type { CampaignStatus, ComplianceStatus, Dec, InsuranceClass, Platform } from './types';

export const n = (v: Dec | null | undefined) => (v === null || v === undefined ? 0 : Number(v));

export const money = (v: Dec | null | undefined, currency = 'NGN', compact = false) => {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? 'compact' : 'standard',
  }).format(n(v));
};
export const int = (v: number | null | undefined) => (v === null || v === undefined ? '—' : new Intl.NumberFormat('en-NG').format(v));
export const compact = (v: number) => new Intl.NumberFormat('en-NG', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
export const pct = (v: number | null | undefined, digits = 2) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(digits)}%`);
export const roas = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v.toFixed(2)}x`);

export const CLASS_LABEL: Record<InsuranceClass, string> = {
  AUTO_MOTOR: 'Motor / Auto',
  HEALTH_HMO: 'Health / HMO',
  LIFE: 'Term Life',
  PROPERTY: 'Property / Home',
  COMMERCIAL_SME: 'Commercial / SME',
  TRAVEL: 'Travel',
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  GOOGLE_SEARCH: 'Google Search',
  GOOGLE_DISPLAY: 'Google Display',
  LINKEDIN: 'LinkedIn',
};

/** Categorical series colours (fixed per platform so charts stay consistent). */
export const PLATFORM_COLOR: Record<Platform, string> = {
  FACEBOOK: '#2563eb',
  INSTAGRAM: '#db2777',
  GOOGLE_SEARCH: '#16a34a',
  GOOGLE_DISPLAY: '#ca8a04',
  LINKEDIN: '#0e7490',
};

export const STATUS_STYLE: Record<CampaignStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  PENDING_REVIEW: 'bg-amber-100 text-amber-800',
  PAUSED: 'bg-sky-100 text-sky-800',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  ARCHIVED: 'bg-slate-200 text-slate-500',
};

export const COMPLIANCE_STYLE: Record<ComplianceStatus, string> = {
  PASSED: 'bg-emerald-100 text-emerald-800',
  WARNING: 'bg-amber-100 text-amber-800',
  BLOCKED: 'bg-rose-100 text-rose-800',
};

export const label = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

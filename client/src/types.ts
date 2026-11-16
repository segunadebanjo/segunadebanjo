export type InsuranceClass = 'AUTO_MOTOR' | 'HEALTH_HMO' | 'LIFE' | 'PROPERTY' | 'COMMERCIAL_SME' | 'TRAVEL';
export type Platform = 'FACEBOOK' | 'INSTAGRAM' | 'GOOGLE_SEARCH' | 'GOOGLE_DISPLAY' | 'LINKEDIN';
export type Objective = 'TRAFFIC' | 'QUOTE_LEADS' | 'POLICY_PURCHASE';
export type CampaignStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PAUSED' | 'ACTIVE' | 'ARCHIVED';
export type ComplianceStatus = 'PASSED' | 'WARNING' | 'BLOCKED';
/** DECIMAL(12,2) columns arrive as strings. */
export type Dec = string | number;

export const CLASSES: InsuranceClass[] = ['AUTO_MOTOR', 'HEALTH_HMO', 'LIFE', 'PROPERTY', 'COMMERCIAL_SME', 'TRAVEL'];
export const PLATFORMS: Platform[] = ['FACEBOOK', 'INSTAGRAM', 'GOOGLE_SEARCH', 'GOOGLE_DISPLAY', 'LINKEDIN'];

export interface Product {
  id: number;
  insuranceClass: InsuranceClass;
  name: string;
  targetAudienceSummary: string;
  keyBenefits: string[];
  startingPremium: Dec;
  currency: string;
  landingPageUrl: string;
  regulatoryLicenseNumber: string;
  isActive: boolean;
  _count?: { campaigns: number };
}

export interface TargetLocations {
  countries: string[];
  regions?: string[];
  cities?: { name: string; radiusKm?: number }[];
  postalCodes?: string[];
  ageMin?: number;
  ageMax?: number;
  genders?: ('male' | 'female')[];
}

export interface Finding {
  code: string;
  severity: 'BLOCK' | 'WARN';
  field: string;
  message: string;
  autoFixable: boolean;
  source?: 'rules' | 'ai';
}

export interface Variant {
  id: number;
  campaignId: number;
  platform: Platform;
  hookAngle: string;
  headlines: string[];
  primaryTexts: string[];
  descriptions: string[];
  callToAction: string;
  mediaBriefOrUrl: string | null;
  keywords: string[] | null;
  targetingSuggestions: { jobTitles?: string[]; industries?: string[]; companySizes?: string[] } | null;
  complianceStatus: ComplianceStatus;
  complianceNotes: Finding[];
  isSelected: boolean;
}

export interface Deployment {
  id: number;
  platform: Platform;
  variantId: number | null;
  externalCampaignId: string | null;
  externalAdsetId: string | null;
  externalAdId: string | null;
  dailyBudget: Dec;
  status: string;
  lastError: string | null;
  lastSyncedAt: string | null;
}

export interface Campaign {
  id: number;
  productId: number;
  name: string;
  objective: Objective;
  totalDailyBudget: Dec;
  currency: string;
  status: CampaignStatus;
  targetLocations: TargetLocations;
  specialAdCategory: string | null;
  utmCampaign: string | null;
  createdAt: string;
  updatedAt: string;
  product: Product;
  deployments: Deployment[];
  variants: Variant[];
  performance?: { deploymentId: number; spend: number; impressions: number; clicks: number; quotesStarted: number; policiesSold: number; revenue: number; roas: number | null }[];
}

export interface CampaignListItem extends Omit<Campaign, 'product' | 'variants' | 'deployments'> {
  product: Pick<Product, 'id' | 'name' | 'insuranceClass'>;
  deployments: Pick<Deployment, 'id' | 'platform' | 'status' | 'dailyBudget'>[];
  _count: { variants: number };
}

export interface Kpis {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  quotesStarted: number;
  costPerQuote: number | null;
  policiesSold: number;
  costPerPolicy: number | null;
  revenue: number;
  roas: number | null;
  quoteToPolicyRate: number | null;
}

export interface Overview {
  filters: { insuranceClass?: InsuranceClass; platform?: Platform; days: number; since: string };
  totals: Kpis;
  daily: { date: string; spend: number; revenue: number; roas: number | null; quotesStarted: number; policiesSold: number; clicks: number }[];
  byPlatform: (Kpis & { platform: Platform })[];
  byClass: (Kpis & { insuranceClass: InsuranceClass })[];
  topCampaigns: (Kpis & { campaignId: number; name: string })[];
  funnel: { stage: string; value: number }[];
  activeCampaigns: number;
  openRecommendations: number;
}

export interface OptimizationRule {
  id: number;
  name: string;
  ruleType: 'PAUSE_ZERO_QUOTES' | 'SCALE_HIGH_ROAS' | 'FLAG_HIGH_CPA';
  spendThreshold: Dec | null;
  targetRoas: Dec | null;
  maxCostPerPolicy: Dec | null;
  budgetIncreasePct: number;
  lookbackDays: number;
  mode: 'RECOMMEND' | 'AUTO_APPLY';
  isEnabled: boolean;
}

export interface Recommendation {
  id: number;
  action: 'PAUSE' | 'INCREASE_BUDGET' | 'FLAG';
  reason: string;
  suggestedBudget: Dec | null;
  status: 'OPEN' | 'APPLIED' | 'DISMISSED';
  createdAt: string;
  metricsSnapshot: { spend: number; quotesStarted: number; policiesSold: number; revenue: number; lookbackDays: number };
  rule: { name: string; ruleType: OptimizationRule['ruleType']; mode: OptimizationRule['mode'] };
  deployment: { id: number; platform: Platform; dailyBudget: Dec; status: string; campaign: { id: number; name: string } };
}

export interface ConversionEvent {
  id: number;
  externalEventId: string | null;
  clickId: string | null;
  clickIdType: string | null;
  utmCampaign: string | null;
  campaignId: number | null;
  platform: Platform | null;
  eventType: 'QUOTE_STARTED' | 'APPLICATION_SUBMITTED' | 'POLICY_PURCHASED';
  policyPremiumValue: Dec;
  currency: string;
  dispatchedToPlatforms: boolean;
  dispatchResults: { destination: string; status: string; detail: string }[] | null;
  createdAt: string;
  campaign: { id: number; name: string } | null;
}

export interface PlatformStatus {
  sandboxMode: boolean;
  aiEnabled: boolean;
  aiModel: string;
  platforms: { platform: Platform; mode: 'live' | 'sandbox'; credentialsConfigured: boolean; reason: string }[];
}

export interface ValidationReport {
  campaignId: number;
  specialAdCategory: string | null;
  targeting: { status: ComplianceStatus; findings: Finding[] };
  variants: { id: number; platform: Platform; hookAngle: string; isSelected: boolean; status: ComplianceStatus; findings: Finding[] }[];
  readyToPublish: boolean;
  aiError?: string;
}

export type UserRole = 'ADMIN' | 'MARKETER' | 'VIEWER';
export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  mustSetUpTwoFactor: boolean;
}

export interface TwoFactorStatus {
  enabled: boolean;
  enabledAt: string | null;
  required: boolean;
  recoveryCodesRemaining: number;
}

import type {
  Campaign,
  CampaignListItem,
  ConversionEvent,
  InsuranceClass,
  Objective,
  OptimizationRule,
  Overview,
  Platform,
  PlatformStatus,
  Product,
  Recommendation,
  TargetLocations,
  User,
  UserRole,
  ValidationReport,
  Variant,
} from './types';

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function req<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    credentials: 'include',
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Let the auth layer react to expired sessions / forced password changes anywhere in the app.
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('auth:unauthorized'));
    if (res.status === 403 && body.code === 'PASSWORD_CHANGE_REQUIRED') window.dispatchEvent(new Event('auth:password-change'));
    throw new ApiError(res.status, body.error ?? res.statusText, body.details);
  }
  return body as T;
}

const qs = (o: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export interface ManagedUser extends User {
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface ProductInput {
  insuranceClass: InsuranceClass;
  name: string;
  targetAudienceSummary: string;
  keyBenefits: string[];
  startingPremium: number;
  currency: string;
  landingPageUrl: string;
  regulatoryLicenseNumber: string;
  isActive: boolean;
}

export interface CampaignInput {
  productId: number;
  name: string;
  objective: Objective;
  totalDailyBudget: number;
  targetLocations: TargetLocations;
  budgetSplit: Partial<Record<Platform, number>>;
}

export const api = {
  me: () => req<{ user: User }>('/auth/me'),
  login: (email: string, password: string) => req<{ user: User }>('/auth/login', { method: 'POST', json: { email, password } }),
  logout: () => req<void>('/auth/logout', { method: 'POST' }),
  changePassword: (currentPassword: string, newPassword: string) => req<{ user: User }>('/auth/change-password', { method: 'POST', json: { currentPassword, newPassword } }),
  forgotPassword: (email: string) => req<{ message: string }>('/auth/forgot-password', { method: 'POST', json: { email } }),
  validateResetToken: (token: string) => req<{ valid: boolean }>('/auth/reset-password/validate', { method: 'POST', json: { token } }),
  resetPassword: (token: string, newPassword: string) => req<{ message: string }>('/auth/reset-password', { method: 'POST', json: { token, newPassword } }),
  users: () => req<ManagedUser[]>('/users'),
  createUser: (u: { email: string; name: string; role: UserRole; password: string }) => req<ManagedUser>('/users', { method: 'POST', json: u }),
  updateUser: (id: number, u: { name?: string; role?: UserRole; isActive?: boolean }) => req<ManagedUser>(`/users/${id}`, { method: 'PUT', json: u }),
  adminResetPassword: (id: number, password: string) => req<ManagedUser>(`/users/${id}/reset-password`, { method: 'POST', json: { password } }),
  deleteUser: (id: number) => req<void>(`/users/${id}`, { method: 'DELETE' }),

  platformStatus: () => req<PlatformStatus>('/platforms/status'),
  products: (q: { class?: InsuranceClass; active?: boolean } = {}) => req<Product[]>(`/products${qs({ class: q.class, active: q.active === undefined ? undefined : String(q.active) })}`),
  createProduct: (p: ProductInput) => req<Product>('/products', { method: 'POST', json: p }),
  updateProduct: (id: number, p: Partial<ProductInput>) => req<Product>(`/products/${id}`, { method: 'PUT', json: p }),
  deleteProduct: (id: number) => req<void>(`/products/${id}`, { method: 'DELETE' }),

  campaigns: (q: { status?: string; class?: string } = {}) => req<CampaignListItem[]>(`/campaigns${qs(q)}`),
  campaign: (id: number) => req<Campaign>(`/campaigns/${id}`),
  createCampaign: (c: CampaignInput) => req<Campaign>('/campaigns', { method: 'POST', json: c }),
  updateCampaign: (id: number, c: Partial<CampaignInput>) => req<Campaign>(`/campaigns/${id}`, { method: 'PUT', json: c }),
  archiveCampaign: (id: number) => req<Campaign>(`/campaigns/${id}`, { method: 'DELETE' }),
  generateCreatives: (campaignId: number, extraInstructions?: string) =>
    req<{ campaign: Campaign; source: 'claude' | 'template'; note?: string }>('/campaigns/generate-creatives', { method: 'POST', json: { campaignId, extraInstructions } }),
  updateVariant: (campaignId: number, variantId: number, patch: Partial<Variant>) => req<Variant>(`/campaigns/${campaignId}/variants/${variantId}`, { method: 'PUT', json: patch }),
  validate: (campaignId: number, opts: { autoFix?: boolean; useAi?: boolean } = {}) => req<ValidationReport>('/compliance/validate', { method: 'POST', json: { campaignId, ...opts } }),
  publish: (id: number) => req<{ campaign: Campaign; results: { platform: Platform; status: string; mode?: string; error?: string }[] }>(`/campaigns/${id}/publish`, { method: 'POST' }),
  activate: (id: number) => req<{ campaign: Campaign }>(`/campaigns/${id}/activate`, { method: 'POST' }),
  pause: (id: number) => req<{ campaign: Campaign }>(`/campaigns/${id}/pause`, { method: 'POST' }),

  overview: (q: { insuranceClass?: string; platform?: string; days?: number }) => req<Overview>(`/analytics/overview${qs(q)}`),

  rules: () => req<OptimizationRule[]>('/optimization/rules'),
  updateRule: (id: number, r: Partial<Omit<OptimizationRule, 'spendThreshold' | 'targetRoas' | 'maxCostPerPolicy'>> & { spendThreshold?: number | null; targetRoas?: number | null; maxCostPerPolicy?: number | null }) =>
    req<OptimizationRule>(`/optimization/rules/${id}`, { method: 'PUT', json: r }),
  runOptimization: () => req<{ created: number; autoApplied: number }>('/optimization/run', { method: 'POST' }),
  recommendations: (status?: string) => req<Recommendation[]>(`/optimization/recommendations${qs({ status })}`),
  applyRecommendation: (id: number) => req<Recommendation>(`/optimization/recommendations/${id}/apply`, { method: 'POST' }),
  dismissRecommendation: (id: number) => req<Recommendation>(`/optimization/recommendations/${id}/dismiss`, { method: 'POST' }),
  syncMetrics: () => req<{ rows: number; deployments: number }>('/metrics/sync', { method: 'POST', json: { days: 2 } }),

  conversions: () => req<ConversionEvent[]>('/conversions'),
  simulateConversion: (p: Record<string, unknown>) => req<unknown>('/conversions/simulate', { method: 'POST', json: p }),
};

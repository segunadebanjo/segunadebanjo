import 'dotenv/config';
import { z } from 'zod';

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const opt = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

const schema = z.object({
  PORT: z.coerce.number().int().default(4100),
  NODE_ENV: z.string().default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  /** Override where the built React app lives (defaults to ../client/dist). */
  CLIENT_DIST: opt,
  DATABASE_URL: z.string().default('mysql://adsuser:adspass@localhost:3307/insurance_ads'),
  SANDBOX_MODE: bool(true),
  WEBHOOK_SECRET_KEY: opt,
  ANTHROPIC_API_KEY: opt,
  ANTHROPIC_MODEL: z.string().default('claude-opus-5-5'),
  META_ACCESS_TOKEN: opt,
  META_AD_ACCOUNT_ID: opt,
  META_PAGE_ID: opt,
  META_INSTAGRAM_ACTOR_ID: opt,
  META_PIXEL_ID: opt,
  META_API_VERSION: z.string().default('v21.0'),
  GOOGLE_ADS_CLIENT_ID: opt,
  GOOGLE_ADS_CLIENT_SECRET: opt,
  GOOGLE_ADS_REFRESH_TOKEN: opt,
  GOOGLE_ADS_DEVELOPER_TOKEN: opt,
  GOOGLE_ADS_CUSTOMER_ID: opt,
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: opt,
  GOOGLE_ADS_CONVERSION_ACTION_ID: opt,
  GOOGLE_ADS_API_VERSION: z.string().default('v18'),
  LINKEDIN_ACCESS_TOKEN: opt,
  LINKEDIN_AD_ACCOUNT_ID: opt,
  LINKEDIN_ORGANIZATION_ID: opt,
  LINKEDIN_CONVERSION_RULE_ID: opt,
  LINKEDIN_API_VERSION: z.string().default('202410'),
  LINKEDIN_ACCOUNT_CURRENCY: z.string().default('USD'),
  FX_NGN_PER_USD: z.coerce.number().positive().default(1550),
  METRICS_SYNC_CRON: z.string().default('0 * * * *'),
  OPTIMIZATION_CRON: z.string().default('15 * * * *'),
  DISABLE_CRON: bool(false),
  AUTH_SECRET: opt,
  AUTH_SESSION_HOURS: z.coerce.number().positive().max(24 * 30).default(12),
  /** Public URL of the web app, used to build links in emails (never taken from request headers). */
  APP_URL: z.string().url().default('http://localhost:5173'),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(60),
  /** smtp | log | memory. Default: smtp when SMTP_HOST is set, otherwise log (dev) — see services/mail. */
  MAIL_TRANSPORT: z.enum(['smtp', 'log', 'memory']).optional(),
  SMTP_HOST: opt,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: bool(false),
  SMTP_USER: opt,
  SMTP_PASS: opt,
  MAIL_FROM: z.string().default('Insurance Ad Manager <no-reply@localhost>'),
  AUTH_COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()))),
});

const parsed = schema.parse(process.env);

const DEV_AUTH_SECRET = 'dev-only-insecure-secret-change-me';
if (!parsed.AUTH_SECRET && parsed.NODE_ENV === 'production') {
  throw new Error('AUTH_SECRET must be set in production (a long random string used to sign login sessions).');
}
if (parsed.AUTH_SECRET && parsed.AUTH_SECRET.length < 32 && parsed.NODE_ENV === 'production') {
  throw new Error('AUTH_SECRET must be at least 32 characters in production.');
}

export const config = {
  ...parsed,
  AUTH_SECRET: parsed.AUTH_SECRET ?? DEV_AUTH_SECRET,
  /** Secure cookies by default in production (requires HTTPS); override with AUTH_COOKIE_SECURE. */
  AUTH_COOKIE_SECURE: parsed.AUTH_COOKIE_SECURE ?? parsed.NODE_ENV === 'production',
};
export const usingDevAuthSecret = !parsed.AUTH_SECRET;
export type AppConfig = typeof config;

export const credentials = {
  meta: Boolean(config.META_ACCESS_TOKEN && config.META_AD_ACCOUNT_ID && config.META_PAGE_ID),
  metaCapi: Boolean(config.META_ACCESS_TOKEN && config.META_PIXEL_ID),
  google: Boolean(
    config.GOOGLE_ADS_CLIENT_ID &&
      config.GOOGLE_ADS_CLIENT_SECRET &&
      config.GOOGLE_ADS_REFRESH_TOKEN &&
      config.GOOGLE_ADS_DEVELOPER_TOKEN &&
      config.GOOGLE_ADS_CUSTOMER_ID,
  ),
  googleConversions: Boolean(config.GOOGLE_ADS_CONVERSION_ACTION_ID),
  linkedin: Boolean(config.LINKEDIN_ACCESS_TOKEN && config.LINKEDIN_AD_ACCOUNT_ID && config.LINKEDIN_ORGANIZATION_ID),
  linkedinCapi: Boolean(config.LINKEDIN_ACCESS_TOKEN && config.LINKEDIN_CONVERSION_RULE_ID),
  anthropic: Boolean(config.ANTHROPIC_API_KEY),
};

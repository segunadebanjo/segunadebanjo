import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..');
dotenv.config({ path: path.join(ROOT_DIR, '.env') });
dotenv.config({ path: path.join(here, '.env') });

const env = process.env;
export const config = {
  port: Number(env.PORT || 5050),
  publicBaseUrl: env.PUBLIC_BASE_URL || `http://localhost:${env.PORT || 5050}`,
  corsOrigin: env.CORS_ORIGIN || '*',
  db: {
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER || 'insurepress',
    password: env.DB_PASSWORD ?? 'insurepress',
    database: env.DB_NAME || 'insurepress_studio',
  },
  ai: {
    apiKey: env.ANTHROPIC_API_KEY || '',
    model: env.ANTHROPIC_MODEL || 'claude-opus-5-5',
    effort: env.ANTHROPIC_EFFORT || 'medium',
  },
  auth: {
    jwtSecret: env.JWT_SECRET || '',
    allowRegistration: String(env.ALLOW_REGISTRATION || 'false').toLowerCase() === 'true',
    sessionDays: Number(env.SESSION_DAYS || 7),
  },
  mail: {
    // MAIL_TRANSPORT=smtp (default when SMTP_HOST is set) or log (prints emails to the server console; development only)
    transport: env.MAIL_TRANSPORT || (env.SMTP_HOST ? 'smtp' : ''),
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT || 587),
    secure: String(env.SMTP_SECURE || '').toLowerCase() === 'true' || Number(env.SMTP_PORT) === 465,
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || '',
  },
  resetLinkMinutes: Number(env.RESET_LINK_MINUTES || 60),
  isProduction: env.NODE_ENV === 'production',
  chromePath: env.PUPPETEER_EXECUTABLE_PATH || '',
  exportDir: path.resolve(here, env.EXPORT_DIR || '../exports'),
  clientDist: path.join(ROOT_DIR, 'client', 'dist'),
  schemaFile: path.join(ROOT_DIR, 'database', 'schema.sql'),
};

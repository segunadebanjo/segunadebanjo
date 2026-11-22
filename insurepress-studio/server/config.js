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
  chromePath: env.PUPPETEER_EXECUTABLE_PATH || '',
  exportDir: path.resolve(here, env.EXPORT_DIR || '../exports'),
  clientDist: path.join(ROOT_DIR, 'client', 'dist'),
  schemaFile: path.join(ROOT_DIR, 'database', 'schema.sql'),
};

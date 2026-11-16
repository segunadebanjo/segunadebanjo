/**
 * Apply ../database/schema.sql with mysql2 (alternative to `prisma migrate deploy`, e.g. for DBAs
 * restoring the schema on a fresh server). Connects without a default database because the script
 * creates `insurance_ads` itself.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';

const url = new URL(process.env.DATABASE_URL ?? 'mysql://adsuser:adspass@localhost:3307/insurance_ads');
const sql = await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8');
const conn = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  multipleStatements: true,
});
await conn.query(sql);
await conn.end();
console.log('schema.sql applied');

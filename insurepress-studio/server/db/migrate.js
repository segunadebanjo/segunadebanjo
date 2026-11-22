import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { config } from '../config.js';

export async function migrate({ quiet = false } = {}) {
  const { database, ...conn } = config.db;
  const c = await mysql.createConnection({ ...conn, multipleStatements: true });
  await c.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await c.query(`USE \`${database}\``);
  await c.query(fs.readFileSync(config.schemaFile, 'utf8'));
  await c.end();
  if (!quiet) console.log(`✔ Schema applied to ${database}`);
}

if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  migrate().catch((e) => { console.error('Migration failed:', e.message); process.exit(1); });
}

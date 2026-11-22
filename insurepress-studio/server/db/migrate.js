import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { config } from '../config.js';

const ADDED_COLUMNS = [
  ['users', 'role', "ENUM('admin','author') NOT NULL DEFAULT 'author' AFTER naicom_license_no"],
  ['users', 'token_version', 'INT NOT NULL DEFAULT 0 AFTER role'],
  ['users', 'last_login_at', 'TIMESTAMP NULL AFTER token_version'],
];

export async function migrate({ quiet = false } = {}) {
  const { database, ...conn } = config.db;
  const c = await mysql.createConnection({ ...conn, multipleStatements: true });
  await c.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await c.query(`USE \`${database}\``);
  await c.query(fs.readFileSync(config.schemaFile, 'utf8'));
  // Columns added after the first release: add them to existing databases.
  for (const [table, col, def] of ADDED_COLUMNS) {
    const [rows] = await c.query('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?', [database, table, col]);
    if (!rows.length) await c.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`);
  }
  await c.end();
  if (!quiet) console.log(`✔ Schema applied to ${database}`);
}

if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  migrate().catch((e) => { console.error('Migration failed:', e.message); process.exit(1); });
}

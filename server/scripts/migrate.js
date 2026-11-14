// Creates/updates the schema and the initial admin user.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('../src/config');

(async () => {
  const conn = await mysql.createConnection({ ...config.db, database: undefined, multipleStatements: true });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${config.db.database}\``);
  await conn.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  const [u] = await conn.query('SELECT id FROM users WHERE email=?', [config.admin.email.toLowerCase()]);
  if (!u.length) {
    await conn.query("INSERT INTO users (name, email, password_hash, role) VALUES ('Administrator', ?, ?, 'admin')",
      [config.admin.email.toLowerCase(), await bcrypt.hash(config.admin.password, 10)]);
    console.log(`Created admin user ${config.admin.email}`);
  }
  console.log('Schema is up to date.');
  await conn.end();
})().catch((e) => { console.error(e.message); process.exit(1); });

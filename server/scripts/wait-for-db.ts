/** Wait until MySQL accepts connections (used after `docker compose up`). */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL ?? 'mysql://adsuser:adspass@localhost:3307/insurance_ads';
const deadline = Date.now() + 90_000;

for (;;) {
  try {
    const conn = await mysql.createConnection(url);
    const [rows] = await conn.query('SELECT VERSION() AS v');
    console.log(`MySQL ready: ${(rows as { v: string }[])[0].v}`);
    await conn.end();
    break;
  } catch (err) {
    if (Date.now() > deadline) {
      console.error('MySQL not reachable:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

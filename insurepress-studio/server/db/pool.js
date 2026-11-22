import mysql from 'mysql2/promise';
import { config } from '../config.js';

export const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  dateStrings: false,
});

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// JSON columns come back as objects on MySQL 8 and as strings on MariaDB; normalise.
export function parseJsonCols(row, cols) {
  if (!row) return row;
  for (const c of cols) {
    if (typeof row[c] === 'string') {
      try { row[c] = JSON.parse(row[c]); } catch { /* keep string */ }
    }
  }
  return row;
}

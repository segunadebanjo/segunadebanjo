const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
  ...config.db,
  connectionLimit: 10,
  dateStrings: true,          // keep DATE columns as 'YYYY-MM-DD' strings (no TZ shifts)
  decimalNumbers: true,       // DECIMAL -> JS number
  namedPlaceholders: true,
});

let erpPool = null;
function getErpPool() {
  if (!config.erpDb) return null;
  if (!erpPool) {
    erpPool = mysql.createPool({ ...config.erpDb, connectionLimit: 4, dateStrings: true, decimalNumbers: true, namedPlaceholders: true });
  }
  return erpPool;
}

async function query(sql, params) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

module.exports = { pool, query, getErpPool };

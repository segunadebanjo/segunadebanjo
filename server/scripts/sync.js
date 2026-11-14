// CLI: npm run sync [-- --full] [-- entity1 entity2]
const { syncFromErp } = require('../src/erp/connector');
const { pool } = require('../src/db');
const args = process.argv.slice(2);
syncFromErp({ full: args.includes('--full'), entities: args.filter((a) => !a.startsWith('--')) })
  .then((r) => { console.table(r); return pool.end(); })
  .catch((e) => { console.error(e.message); process.exit(1); });

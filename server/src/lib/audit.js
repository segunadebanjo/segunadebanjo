const { query } = require('../db');

async function audit(req, action, entity, entityId, details) {
  try {
    await query(
      'INSERT INTO audit_logs (user_id, user_email, action, entity, entity_id, details, ip) VALUES (?,?,?,?,?,?,?)',
      [req?.user?.id || null, req?.user?.email || null, action, entity || null,
       entityId == null ? null : String(entityId), details ? JSON.stringify(details) : null, req?.ip || null]
    );
  } catch (e) {
    console.error('audit log failed', e.message);
  }
}
module.exports = { audit };

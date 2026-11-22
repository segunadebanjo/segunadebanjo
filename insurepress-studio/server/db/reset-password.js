// Emergency password reset from the server shell (e.g. the only admin is locked out).
//   node server/db/reset-password.js <email> <new-password>
// Signs that user out on every device.
import { pool, one, query } from './pool.js';
import { hashPassword, validatePassword, normaliseEmail } from '../lib/auth.js';

const [emailArg, password] = process.argv.slice(2);
try {
  if (!emailArg || !password) throw new Error('Usage: node server/db/reset-password.js <email> <new-password>');
  const email = normaliseEmail(emailArg);
  validatePassword(password);
  const user = await one('SELECT id, role FROM users WHERE email=?', [email]);
  if (!user) throw new Error(`No account with email ${email}`);
  await query('UPDATE users SET password_hash=?, token_version=token_version+1 WHERE id=?', [await hashPassword(password), user.id]);
  console.log(`✔ Password reset for ${email} (${user.role}).`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

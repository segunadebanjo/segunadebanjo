// Admin-only user management.
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { config } from '../config.js';
import { query, one } from '../db/pool.js';
import { ah, int, HttpError } from '../lib/http.js';
import { USER_FIELDS, requireAdmin, hashPassword, validatePassword, normaliseEmail } from '../lib/auth.js';
import { createUser } from '../lib/users.js';

const r = Router();
r.use('/users', requireAdmin);

r.get('/users', ah(async (req, res) => {
  res.json(await query(
    `SELECT ${USER_FIELDS.split(', ').map((f) => `u.${f}`).join(', ')}, (u.password_hash IS NOT NULL) AS has_password,
            (SELECT COUNT(*) FROM books b WHERE b.user_id=u.id) AS book_count
       FROM users u ORDER BY u.id`));
}));

r.post('/users', ah(async (req, res) => {
  const b = req.body || {};
  const email = normaliseEmail(b.email);
  validatePassword(b.password);
  if (b.role && !['admin', 'author'].includes(b.role)) throw new HttpError(400, 'Role must be admin or author');
  const { token_version, ...user } = await createUser({ ...b, email, role: b.role || 'author' });
  res.status(201).json(user);
}));

r.put('/users/:id', ah(async (req, res) => {
  const id = int(req.params.id);
  const target = await one('SELECT id, role FROM users WHERE id=?', [id]);
  if (!target) throw new HttpError(404, 'User not found');
  const b = req.body || {};
  if (b.role) {
    if (!['admin', 'author'].includes(b.role)) throw new HttpError(400, 'Role must be admin or author');
    if (id === req.user.id && b.role !== 'admin') throw new HttpError(400, 'You can’t remove your own admin role');
    await query('UPDATE users SET role=? WHERE id=?', [b.role, id]);
  }
  if (b.password) {
    validatePassword(b.password);
    // Resetting a password signs the user out everywhere.
    await query('UPDATE users SET password_hash=?, token_version=token_version+1 WHERE id=?', [await hashPassword(b.password), id]);
  }
  res.json(await one(`SELECT ${USER_FIELDS} FROM users WHERE id=?`, [id]));
}));

r.delete('/users/:id', ah(async (req, res) => {
  const id = int(req.params.id);
  if (id === req.user.id) throw new HttpError(400, 'You can’t delete your own account');
  const target = await one('SELECT id FROM users WHERE id=?', [id]);
  if (!target) throw new HttpError(404, 'User not found');
  const files = await query('SELECT e.file_path FROM export_jobs e JOIN books b ON b.id=e.book_id WHERE b.user_id=? AND e.file_path IS NOT NULL', [id]);
  await query('DELETE FROM users WHERE id=?', [id]); // cascades to their books, brand kits, offers and export records
  await Promise.all(files.map((f) => fs.unlink(path.join(config.exportDir, path.basename(f.file_path))).catch(() => {})));
  res.json({ ok: true });
}));

export default r;

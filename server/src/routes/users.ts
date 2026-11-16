import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { ah, HttpError, parseBody, parseId } from '../lib/http.js';
import { hashPassword, passwordProblems } from '../services/auth/password.js';
import { clear as clearTwoFactor } from '../services/auth/twoFactor.js';

/** Admin-only user management (mounted behind requireRole('ADMIN')). */
export const usersRouter = Router();

const Role = z.enum(['ADMIN', 'MARKETER', 'VIEWER']);
const select = { id: true, email: true, name: true, role: true, isActive: true, mustChangePassword: true, twoFactorEnabledAt: true, lastLoginAt: true, createdAt: true } satisfies Prisma.UserSelect;

const checkPassword = (pw: string) => {
  const problem = passwordProblems(pw);
  if (problem) throw new HttpError(400, problem);
};

/** Refuse changes that would leave the system without an active admin. */
async function assertAnotherActiveAdmin(excludingId: number) {
  const others = await prisma.user.count({ where: { role: 'ADMIN', isActive: true, id: { not: excludingId } } });
  if (others === 0) throw new HttpError(409, 'At least one active ADMIN must remain');
}

usersRouter.get('/', ah(async (_req, res) => res.json(await prisma.user.findMany({ select, orderBy: [{ isActive: 'desc' }, { email: 'asc' }] }))));

usersRouter.post(
  '/',
  ah(async (req, res) => {
    const input = parseBody(
      z.object({ email: z.string().trim().toLowerCase().email().max(191), name: z.string().trim().min(1).max(120), role: Role, password: z.string().max(200) }),
      req.body,
    );
    checkPassword(input.password);
    const user = await prisma.user.create({
      data: { email: input.email, name: input.name, role: input.role, passwordHash: await hashPassword(input.password), mustChangePassword: true },
      select,
    });
    res.status(201).json(user);
  }),
);

usersRouter.put(
  '/:id',
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    const input = parseBody(z.object({ name: z.string().trim().min(1).max(120).optional(), role: Role.optional(), isActive: z.boolean().optional() }), req.body);
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new HttpError(404, 'User not found');
    if (id === req.user!.id && (input.isActive === false || (input.role && input.role !== 'ADMIN')))
      throw new HttpError(409, "You can't deactivate yourself or remove your own ADMIN role");
    const losesAdmin = target.role === 'ADMIN' && target.isActive && (input.isActive === false || (input.role !== undefined && input.role !== 'ADMIN'));
    if (losesAdmin) await assertAnotherActiveAdmin(id);
    res.json(
      await prisma.user.update({
        where: { id },
        data: { ...input, ...(input.isActive === false ? { tokenVersion: { increment: 1 } } : {}) },
        select,
      }),
    );
  }),
);

usersRouter.post(
  '/:id/reset-password',
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    const { password } = parseBody(z.object({ password: z.string().max(200) }), req.body);
    checkPassword(password);
    // Temporary password: the user must change it at next sign-in; existing sessions are revoked.
    res.json(
      await prisma.user.update({
        where: { id },
        data: { passwordHash: await hashPassword(password), mustChangePassword: true, tokenVersion: { increment: 1 } },
        select,
      }),
    );
  }),
);

/** For a user who lost their authenticator: removes their 2FA and signs them out everywhere. */
usersRouter.post(
  '/:id/reset-2fa',
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    if (!(await prisma.user.findUnique({ where: { id } }))) throw new HttpError(404, 'User not found');
    await clearTwoFactor(id, { revokeSessions: true });
    res.json(await prisma.user.findUniqueOrThrow({ where: { id }, select }));
  }),
);

usersRouter.delete(
  '/:id',
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === req.user!.id) throw new HttpError(409, "You can't delete your own account");
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new HttpError(404, 'User not found');
    if (target.role === 'ADMIN' && target.isActive) await assertAnotherActiveAdmin(id);
    await prisma.user.delete({ where: { id } });
    res.status(204).end();
  }),
);

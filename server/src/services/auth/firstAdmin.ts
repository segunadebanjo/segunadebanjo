import { prisma } from '../../db.js';
import { hashPassword, passwordProblems } from './password.js';

/**
 * Create the first ADMIN on a brand-new database from INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD
 * (optional INITIAL_ADMIN_NAME), for hosts without a shell such as Render's free plan.
 * Only acts while the users table is empty, so it can never overwrite or add accounts later.
 * The account must change its password at first sign-in, since the env value stays visible on the host.
 */
export type FirstAdminPlan =
  | { action: 'skip' }
  | { action: 'warn'; message: string }
  | { action: 'create'; email: string; name: string; password: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function planFirstAdmin(userCount: number, env: Record<string, string | undefined>): FirstAdminPlan {
  if (userCount > 0) return { action: 'skip' };
  const email = env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.INITIAL_ADMIN_PASSWORD;
  if (!email && !password) {
    return {
      action: 'warn',
      message: 'No users exist yet. Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD and restart to create the first admin (or run `npm run user:create`).',
    };
  }
  if (!email || !EMAIL_RE.test(email)) return { action: 'warn', message: 'INITIAL_ADMIN_EMAIL is missing or not a valid email address; no admin was created.' };
  if (!password) return { action: 'warn', message: 'INITIAL_ADMIN_PASSWORD is not set; no admin was created.' };
  const problem = passwordProblems(password);
  if (problem) return { action: 'warn', message: `INITIAL_ADMIN_PASSWORD is too weak (${problem}); no admin was created.` };
  return { action: 'create', email, name: env.INITIAL_ADMIN_NAME?.trim() || email.split('@')[0], password };
}

export async function ensureFirstAdmin(env: Record<string, string | undefined> = process.env): Promise<void> {
  const plan = planFirstAdmin(await prisma.user.count(), env);
  if (plan.action === 'skip') return;
  if (plan.action === 'warn') {
    console.warn(`[setup] ${plan.message}`);
    return;
  }
  await prisma.user.create({
    data: { email: plan.email, name: plan.name, role: 'ADMIN', passwordHash: await hashPassword(plan.password), mustChangePassword: true },
  });
  console.log(`[setup] Created the first admin, ${plan.email}. Sign in with INITIAL_ADMIN_PASSWORD; you'll be asked to choose a new password.`);
}

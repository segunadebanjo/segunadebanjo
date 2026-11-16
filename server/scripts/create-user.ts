/**
 * Create or update a user from the command line (e.g. the first ADMIN on a new server).
 *
 *   npm run user:create -- --email ada@broker.ng --name "Ada Obi" --role ADMIN --password 'S0me-long-passw0rd'
 *
 * Add --temporary to force a password change at first sign-in. If the email exists, the user's
 * name/role/password are updated, the account is re-activated and existing sessions are revoked.
 */
import 'dotenv/config';
import { parseArgs } from 'node:util';
import { PrismaClient, type UserRole } from '@prisma/client';
import { hashPassword, passwordProblems } from '../src/services/auth/password.js';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', default: 'ADMIN' },
    password: { type: 'string' },
    temporary: { type: 'boolean', default: false },
  },
});

const fail = (msg: string) => {
  console.error(msg);
  process.exit(1);
};
const email = values.email?.trim().toLowerCase();
const role = values.role?.toUpperCase() as UserRole;
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('--email is required');
if (!['ADMIN', 'MARKETER', 'VIEWER'].includes(role)) fail('--role must be ADMIN, MARKETER or VIEWER');
if (!values.password) fail('--password is required');
const problem = passwordProblems(values.password!);
if (problem) fail(problem);

const prisma = new PrismaClient();
const passwordHash = await hashPassword(values.password!);
const name = values.name?.trim() || email!.split('@')[0];
const user = await prisma.user.upsert({
  where: { email: email! },
  create: { email: email!, name, role, passwordHash, mustChangePassword: values.temporary },
  update: { name, role, passwordHash, mustChangePassword: values.temporary, isActive: true, tokenVersion: { increment: 1 } },
});
console.log(`User ${user.email} (${user.role}) is ready.${values.temporary ? ' They must change the password at first sign-in.' : ''}`);
await prisma.$disconnect();

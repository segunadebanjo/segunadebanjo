// Run before migrations on hosted deploys (see render.yaml). Prisma's own error for a bad
// DATABASE_URL is a terse "P1012 ... env("DATABASE_URL")"; this says what's actually wrong.
// Plain Node (no tsx/TypeScript) so it works before anything else. Never prints the password.

const raw = process.env.DATABASE_URL;

function fail(problem, fix) {
  console.error('\n✖ DATABASE_URL problem: ' + problem);
  console.error('  Fix: ' + fix);
  console.error('  Expected form: mysql://USER:PASSWORD@HOST:PORT/DATABASE?sslaccept=strict');
  console.error('  (On Render: your service → Environment → DATABASE_URL, then Save and deploy.)\n');
  process.exit(1);
}

if (raw === undefined || raw.trim() === '') {
  fail(
    'it is not set.',
    'add DATABASE_URL to the service\'s environment variables, set to your MySQL connection string.',
  );
}

const value = raw.trim();

if (/^["'].*["']$/.test(value)) {
  fail('the value is wrapped in quotes.', 'remove the quotes around the connection string.');
}
if (value !== raw) {
  fail('the value has spaces or line breaks before or after it.', 'delete the extra spaces around the connection string.');
}
if (/^postgres(ql)?:\/\//i.test(value)) {
  fail(
    'it is a PostgreSQL connection string, but this app uses MySQL.',
    'create a MySQL 8 database (e.g. on Aiven; Render only hosts PostgreSQL) and use its mysql:// connection string.',
  );
}
if (!value.startsWith('mysql://')) {
  const scheme = value.includes('://') ? value.slice(0, value.indexOf('://') + 3) : '(no "scheme://" at the start)';
  fail(`it must start with mysql:// but starts with ${scheme}.`, 'copy the MySQL connection string (URI) from your database provider.');
}

let url;
try {
  url = new URL(value);
} catch {
  fail(
    'it is not a valid URL.',
    'if the password contains special characters such as @ : / ? # %, URL-encode them (e.g. @ → %40).',
  );
}
if (!url.hostname) fail('it has no host name.', 'copy the full connection string from your database provider.');
if (!url.pathname || url.pathname === '/') {
  fail('it has no database name after the host.', 'add /DATABASE_NAME after HOST:PORT (e.g. /defaultdb).');
}

console.log(`✓ DATABASE_URL looks valid (MySQL at ${url.hostname}:${url.port || 3306}${url.pathname}).`);

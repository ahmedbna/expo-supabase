#!/usr/bin/env node
/**
 * scripts/check-rls.js
 *
 * Safety net that fails CI / local push if any table in the `public`
 * schema has Row Level Security disabled. The anon key is client-side
 * and a single un-RLSed table is a data leak. Run this before every
 * `supabase db push` — it's already wired into `npm run db:push:safe`.
 *
 * Usage: SUPABASE_DB_URL=... node scripts/check-rls.js
 */

const { execSync } = require('child_process');

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error(
    'SUPABASE_DB_URL not set. Add it to .env.local (see .env.example).',
  );
  process.exit(1);
}

const query = `
  select tablename
  from pg_tables
  where schemaname = 'public'
    and not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = pg_tables.tablename
        and c.relrowsecurity = true
    );
`;

try {
  const out = execSync(
    `psql "${dbUrl}" -tAc "${query.replace(/\n/g, ' ').trim()}"`,
    { encoding: 'utf8' },
  ).trim();

  if (out) {
    console.error('Tables without RLS enabled:');
    out.split('\n').forEach((t) => console.error(`   - public.${t}`));
    console.error(
      '\nEnable RLS on every public table before pushing. Add:\n' +
        '   alter table public.<tablename> enable row level security;\n' +
        'to a new migration, plus appropriate policies.',
    );
    process.exit(1);
  }

  console.log('All public tables have RLS enabled.');
} catch (err) {
  console.error('RLS check failed:', err.message);
  process.exit(1);
}

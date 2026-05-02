#!/usr/bin/env node
/**
 * scripts/check-rls.js
 *
 * Static analysis of supabase/migrations/*.sql to verify every
 * `public.<table>` has Row Level Security enabled in some migration.
 *
 * Why static, not live? Because we don't run a local DB. Reading the
 * intent from the files themselves is good enough to catch the common
 * mistake of forgetting `alter table … enable row level security`.
 *
 * The anon key ships with your app. A single un-RLSed table is a
 * public data leak. This guard runs as part of the dev push loop.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIG_DIR = path.join(ROOT, 'supabase', 'migrations');

if (!fs.existsSync(MIG_DIR)) {
  console.log('✓ No migrations to check.');
  process.exit(0);
}

const files = fs
  .readdirSync(MIG_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const combined = files
  .map((f) => fs.readFileSync(path.join(MIG_DIR, f), 'utf8'))
  .join('\n')
  // Strip line comments so commented-out CREATE TABLE doesn't trigger us.
  .replace(/--[^\n]*/g, '');

// Tables created.
const created = [
  ...combined.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi),
].map((m) => m[1]);

// Tables dropped (so we can ignore them).
const dropped = new Set(
  [...combined.matchAll(/\bdrop\s+table\s+(?:if\s+exists\s+)?public\.(\w+)/gi)].map(
    (m) => m[1],
  ),
);

// Tables that have RLS turned on somewhere.
const enabled = new Set(
  [
    ...combined.matchAll(
      /\balter\s+table\s+(?:only\s+)?public\.(\w+)\s+enable\s+row\s+level\s+security/gi,
    ),
  ].map((m) => m[1]),
);

const missing = [...new Set(created)].filter(
  (t) => !dropped.has(t) && !enabled.has(t),
);

if (missing.length === 0) {
  const checked = new Set(created);
  dropped.forEach((d) => checked.delete(d));
  console.log(`✓ RLS enabled on all ${checked.size} public table(s).`);
  process.exit(0);
}

console.error('✗ Tables without RLS enabled in any migration:');
missing.forEach((t) => console.error(`   - public.${t}`));
console.error(
  '\n  Add to a new migration:\n' +
    '    alter table public.<tablename> enable row level security;\n' +
    '  …plus appropriate policies. The anon key is client-side, so\n' +
    '  un-RLSed tables are a public data leak.',
);
process.exit(1);

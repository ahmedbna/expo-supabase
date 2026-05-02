#!/usr/bin/env node
/**
 * scripts/new-migration.js
 *
 * Create a new numbered migration file with a sensible template.
 * Numbered like 0005_my_feature.sql so files sort lexicographically
 * in the order they should be applied.
 *
 * Usage:
 *   npm run db:new add_posts_table
 *   npm run db:new "add posts table"   # spaces auto-converted
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIG_DIR = path.join(ROOT, 'supabase', 'migrations');

const raw = process.argv.slice(2).join(' ').trim();
if (!raw) {
  console.error('Usage: npm run db:new <name>');
  console.error('Example: npm run db:new add_posts_table');
  process.exit(1);
}

const slug = raw
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

if (!fs.existsSync(MIG_DIR)) fs.mkdirSync(MIG_DIR, { recursive: true });

const existing = fs
  .readdirSync(MIG_DIR)
  .filter((f) => /^\d+_.*\.sql$/.test(f))
  .map((f) => parseInt(f.split('_')[0], 10))
  .filter((n) => !Number.isNaN(n));

const next = existing.length ? Math.max(...existing) + 1 : 1;
const num = String(next).padStart(4, '0');
const filename = `${num}_${slug}.sql`;
const filepath = path.join(MIG_DIR, filename);

const template = `-- ${filename}
-- TODO: describe what this migration does in one sentence.
--
-- Reminder:
--   * Append-only — once pushed, do NOT edit. Add a new file instead.
--   * Every NEW table needs RLS enabled and at least one policy, or the
--     deploy guard will refuse to push.

-- Example pattern for a new table:
-- create table public.example (
--   id uuid primary key default extensions.uuid_generate_v4(),
--   owner_id uuid not null references public.users(id) on delete cascade,
--   created_at timestamptz not null default now(),
--   updated_at timestamptz not null default now()
-- );
--
-- alter table public.example enable row level security;
--
-- create policy "example_select_authed"
--   on public.example for select
--   using (auth.uid() is not null);
--
-- create policy "example_insert_own"
--   on public.example for insert
--   with check (auth.uid() = owner_id);
--
-- create policy "example_update_own"
--   on public.example for update
--   using (auth.uid() = owner_id)
--   with check (auth.uid() = owner_id);
--
-- create policy "example_delete_own"
--   on public.example for delete
--   using (auth.uid() = owner_id);
--
-- create trigger example_updated_at
--   before update on public.example
--   for each row execute function public.set_updated_at();
`;

fs.writeFileSync(filepath, template);
console.log(`✓ Created supabase/migrations/${filename}`);
console.log("  Save your edits — `npm run dev` will push them automatically.");

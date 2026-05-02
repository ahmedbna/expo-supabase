#!/usr/bin/env node
/**
 * scripts/dev.js
 *
 * The "npx convex dev" loop, but for Supabase. Watches your local
 * files and pushes changes to the linked hosted project on save.
 *
 * Watches:
 *   - supabase/migrations/*.sql  →  supabase db push  →  regen types
 *   - supabase/config.toml       →  supabase config push
 *
 * Run this in a terminal and leave it running while you code. Edit a
 * migration, save, and 5-15 seconds later your hosted DB has the
 * change and your TypeScript types are updated.
 *
 * No Docker required. Reads project ref + DB password from .env.local
 * (populated by `npm run init`).
 */

const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENV_LOCAL = path.join(ROOT, '.env.local');
const MIG_DIR = path.join(ROOT, 'supabase', 'migrations');
const CONFIG_TOML = path.join(ROOT, 'supabase', 'config.toml');

const c = {
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};
const log = (m) => console.log(`${c.cyan('→')} ${m}`);
const ok = (m) => console.log(`${c.green('✓')} ${m}`);
const warn = (m) => console.log(`${c.yellow('!')} ${m}`);

function loadDotenv() {
  if (!fs.existsSync(ENV_LOCAL)) return;
  for (const line of fs.readFileSync(ENV_LOCAL, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadDotenv();

const REF = process.env.SUPABASE_PROJECT_REF;
const PW = process.env.SUPABASE_DB_PASSWORD;

if (!REF || !PW) {
  console.error(
    `${c.red('✗')} .env.local is missing SUPABASE_PROJECT_REF or SUPABASE_DB_PASSWORD.\n` +
      `  Run:  npm run init\n` +
      `  (this is a one-time bootstrap that links your folder to a hosted project)`,
  );
  process.exit(1);
}

const env = { ...process.env, SUPABASE_DB_PASSWORD: PW };

// ─── ops ────────────────────────────────────────────────────────────
function checkRls() {
  const r = spawnSync('node', [path.join(__dirname, 'check-rls.js')], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  return r.status === 0;
}

function pushSchema() {
  if (!checkRls()) {
    warn('RLS check failed — refusing to push. Fix the migration above.');
    return false;
  }
  log('Pushing migrations…');
  const r = spawnSync('npx', ['supabase', 'db', 'push', '--yes'], {
    cwd: ROOT,
    stdio: 'inherit',
    env,
  });
  return r.status === 0;
}

function pushConfig() {
  log('Pushing config…');
  const r = spawnSync('npx', ['supabase', 'config', 'push'], {
    cwd: ROOT,
    stdio: 'inherit',
    env,
  });
  return r.status === 0;
}

function generateTypes() {
  log('Generating types from remote schema…');
  try {
    const types = execSync('npx supabase gen types typescript --linked', {
      cwd: ROOT,
      encoding: 'utf8',
      env,
    });
    const header =
      '// supabase/types.ts\n' +
      '//\n' +
      '// GENERATED — do not edit by hand.\n' +
      '// Regenerate with: npm run db:types\n' +
      '// Source: linked Supabase project\n\n';
    fs.writeFileSync(path.join(ROOT, 'supabase', 'types.ts'), header + types);
    ok('Types updated');
    return true;
  } catch (e) {
    warn('Types generation failed — fix the schema error and save again.');
    return false;
  }
}

// ─── debounced runner ───────────────────────────────────────────────
let debounce;
let running = false;
let pending = { migrations: false, config: false };

function schedule(kind) {
  pending[kind] = true;
  clearTimeout(debounce);
  debounce = setTimeout(run, 400);
}

async function run() {
  if (running) {
    setTimeout(run, 200);
    return;
  }
  running = true;
  const todo = { ...pending };
  pending = { migrations: false, config: false };

  console.log('');
  if (todo.migrations) {
    if (pushSchema()) generateTypes();
  }
  if (todo.config) pushConfig();
  ok('In sync. Watching for changes…');
  running = false;
}

// ─── main ───────────────────────────────────────────────────────────
console.log(c.bold('\nBNA Supabase — dev\n'));
console.log(c.dim(`  Project: ${REF}`));
console.log(c.dim(`  URL:     https://${REF}.supabase.co`));
console.log('');
log('Initial sync…');
const schemaOk = pushSchema();
if (schemaOk) generateTypes();
pushConfig();
ok('In sync. Watching for changes…');
console.log('');
console.log(c.dim('  • Edit a .sql file in supabase/migrations/ → schema + types update'));
console.log(c.dim('  • Edit supabase/config.toml → auth/settings update'));
console.log(c.dim('  • Press Ctrl+C to stop.'));
console.log('');

if (fs.existsSync(MIG_DIR)) {
  fs.watch(MIG_DIR, { persistent: true }, (event, filename) => {
    if (filename && filename.endsWith('.sql')) {
      log(`Migration changed: ${filename}`);
      schedule('migrations');
    }
  });
}

if (fs.existsSync(CONFIG_TOML)) {
  fs.watch(CONFIG_TOML, { persistent: true }, () => {
    log('config.toml changed');
    schedule('config');
  });
}

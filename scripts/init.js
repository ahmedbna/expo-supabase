#!/usr/bin/env node
/**
 * scripts/init.js
 *
 * One-time bootstrap. Run this after `npm install`.
 *
 * It will:
 *   1. Make sure you're logged into the Supabase CLI (`supabase login`).
 *   2. Ask which Supabase project to use (or help you create one).
 *   3. Link this folder to that project.
 *   4. Write `.env.local` with the URL, anon key, project ref, and DB password.
 *   5. Push every migration in `supabase/migrations/`.
 *   6. Push `supabase/config.toml` (so anonymous sign-ins, signup rules, etc.
 *      become live on the hosted project).
 *   7. Generate `supabase/types.ts` from the live schema.
 *
 * After this, you can use `npm run dev` to keep things in sync as you
 * edit migrations and api code.
 *
 * No Docker needed — everything talks directly to the hosted project.
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');
const ENV_LOCAL = path.join(ROOT, '.env.local');

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
const die = (m) => {
  console.error(`${c.red('✗')} ${m}`);
  process.exit(1);
};

function ask(q, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    if (hidden) {
      // Mask password input.
      const stdin = process.openStdin();
      process.stdin.on('data', () => {});
      rl.question(q, (a) => {
        rl.close();
        resolve(a.trim());
      });
      // Hide the typed characters.
      rl._writeToOutput = (s) => {
        if (s.includes('\n') || s.includes('\r')) rl.output.write(s);
      };
    } else {
      rl.question(q, (a) => {
        rl.close();
        resolve(a.trim());
      });
    }
  });
}

function sh(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', ...opts });
}

// ─── 1. Login ───────────────────────────────────────────────────────
async function ensureLoggedIn() {
  // `supabase projects list` requires login. Use it as a probe.
  const r = spawnSync('npx', ['supabase', 'projects', 'list'], {
    cwd: ROOT,
    stdio: 'pipe',
  });
  if (r.status === 0) {
    ok('Supabase CLI logged in');
    return;
  }
  log('You need to log into the Supabase CLI first.');
  console.log(c.dim('  This opens a browser to grant CLI access to your account.'));
  const r2 = spawnSync('npx', ['supabase', 'login'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (r2.status !== 0) die('Login failed.');
  ok('Logged in');
}

// ─── 2. Pick or create a project ────────────────────────────────────
async function pickProjectRef() {
  // Show the user their existing projects, then ask which to use.
  log('Fetching your Supabase projects…');
  const out = sh('npx supabase projects list');
  console.log('');
  console.log(out);

  let ref = await ask(
    'Project ref to use (or leave blank to create a new one): ',
  );

  if (!ref) {
    const orgsOut = sh('npx supabase orgs list');
    console.log('');
    console.log(orgsOut);
    const orgId = await ask('Organization ID to create the project in: ');
    if (!orgId) die('Organization ID required.');
    const name = await ask('Project name: ');
    const region = (await ask('Region (default: us-east-1): ')) || 'us-east-1';
    const password = await ask('Database password (save this!): ');
    if (!password) die('Database password required.');

    log(`Creating project "${name}"…`);
    const create = spawnSync(
      'npx',
      [
        'supabase',
        'projects',
        'create',
        name,
        '--org-id',
        orgId,
        '--region',
        region,
        '--db-password',
        password,
      ],
      { cwd: ROOT, stdio: 'inherit' },
    );
    if (create.status !== 0) die('Project creation failed.');

    // Re-list and grab the newest one. Easier than parsing creation output.
    const listed = sh('npx supabase projects list');
    const match = listed.match(/\b([a-z]{20})\b/g);
    if (!match || match.length === 0) die('Could not determine new project ref.');
    ref = match[match.length - 1];
    process.env.__INIT_DB_PASSWORD = password;
    ok(`Created project ${ref}`);
  }

  return ref;
}

// ─── 3. Link ────────────────────────────────────────────────────────
async function linkProject(ref) {
  let password = process.env.__INIT_DB_PASSWORD;
  if (!password) {
    password = await ask(
      `Database password for project ${ref} (you set this when creating it): `,
      true,
    );
    console.log('');
  }
  log(`Linking to ${ref}…`);
  const r = spawnSync('npx', ['supabase', 'link', '--project-ref', ref], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, SUPABASE_DB_PASSWORD: password },
  });
  if (r.status !== 0) die('Link failed.');
  ok('Linked');
  return password;
}

// ─── 4. Resolve URL + anon key, write .env.local ────────────────────
async function writeEnvLocal(ref, password) {
  log('Fetching API keys…');
  let anonKey;

  // Try JSON output first (newer CLI versions support this).
  try {
    const json = sh(
      `npx supabase projects api-keys --project-ref ${ref} -o json 2>/dev/null`,
    );
    const keys = JSON.parse(json);
    // Shape varies a bit across CLI versions. Look for both new
    // (sb_publishable_) and legacy (anon JWT) shapes.
    for (const k of Array.isArray(keys) ? keys : Object.values(keys)) {
      if (
        k?.name === 'anon' ||
        k?.type === 'publishable' ||
        /^sb_publishable_/.test(k?.api_key ?? '') ||
        /^eyJ/.test(k?.api_key ?? '')
      ) {
        anonKey = k.api_key ?? k.key ?? k.value;
        if (anonKey && /^(sb_publishable_|eyJ)/.test(anonKey)) break;
      }
    }
  } catch {
    /* Fallback to text parsing below */
  }

  // Fall back to scraping the table-formatted output.
  if (!anonKey) {
    const out = sh(`npx supabase projects api-keys --project-ref ${ref}`);
    const anonLine = out.split('\n').find((l) => /\banon\b|\bpublishable\b/i.test(l));
    anonKey = anonLine?.match(/\b(sb_publishable_[A-Za-z0-9_]+|eyJ[A-Za-z0-9_.\-]+)\b/)?.[1];
  }

  if (!anonKey) die('Could not parse anon/publishable key from CLI output.');

  const url = `https://${ref}.supabase.co`;
  const env = {
    EXPO_PUBLIC_SUPABASE_URL: url,
    EXPO_PUBLIC_SUPABASE_KEY: anonKey,
    SUPABASE_PROJECT_REF: ref,
    SUPABASE_DB_PASSWORD: password,
  };

  let existing = '';
  if (fs.existsSync(ENV_LOCAL)) existing = fs.readFileSync(ENV_LOCAL, 'utf8');
  const seen = new Set();
  const out2 = [];
  for (const line of existing.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=/);
    if (m && env[m[1]] !== undefined) {
      out2.push(`${m[1]}=${env[m[1]]}`);
      seen.add(m[1]);
    } else {
      out2.push(line);
    }
  }
  for (const [k, v] of Object.entries(env)) {
    if (!seen.has(k)) out2.push(`${k}=${v}`);
  }
  fs.writeFileSync(ENV_LOCAL, out2.join('\n').replace(/\n+$/, '') + '\n');
  ok(`.env.local written (${url})`);
}

// ─── 5 + 6. Push schema and config ──────────────────────────────────
function pushSchema(password) {
  log('Pushing migrations to remote database…');
  const r = spawnSync('npx', ['supabase', 'db', 'push', '--yes'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, SUPABASE_DB_PASSWORD: password },
  });
  if (r.status !== 0) die('Schema push failed.');
  ok('Schema deployed');
}

function pushConfig() {
  log('Pushing config (auth settings, anonymous sign-ins, etc.)…');
  const r = spawnSync('npx', ['supabase', 'config', 'push'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.warn(
      `${c.yellow('!')} Config push failed. You can retry with: npx supabase config push`,
    );
    return;
  }
  ok('Config deployed (anonymous sign-ins enabled)');
}

// ─── 7. Generate types ──────────────────────────────────────────────
function generateTypes() {
  log('Generating TypeScript types from remote schema…');
  try {
    const types = sh('npx supabase gen types typescript --linked');
    const header =
      '// supabase/types.ts\n' +
      '//\n' +
      '// GENERATED — do not edit by hand.\n' +
      '// Regenerate with: npm run db:types\n' +
      '// Source: linked Supabase project\n\n';
    fs.writeFileSync(path.join(ROOT, 'supabase', 'types.ts'), header + types);
    ok('Types generated');
  } catch {
    console.warn(`${c.yellow('!')} Types generation failed — fix and retry with: npm run db:types`);
  }
}

// ─── main ───────────────────────────────────────────────────────────
(async function main() {
  console.log(c.bold('\nBNA Supabase — first-time setup\n'));
  console.log(
    c.dim(
      "  No Docker needed. Everything you build will live in your hosted\n" +
        '  Supabase project, kept in sync from this folder.\n',
    ),
  );

  await ensureLoggedIn();
  const ref = await pickProjectRef();
  const password = await linkProject(ref);
  await writeEnvLocal(ref, password);
  pushSchema(password);
  pushConfig();
  generateTypes();

  console.log('');
  ok('Setup complete.');
  console.log(c.dim('  Next:  npm run dev   (watches files, syncs on save)'));
  console.log(c.dim('         npm run ios   (or: npm run android)'));
  console.log('');
})().catch((e) => die(String(e)));

#!/usr/bin/env node
/**
 * scripts/init.js
 *
 * One-time bootstrap. Run this after `npm install`.
 *
 * It will:
 *   1. Make sure you're logged into the Supabase CLI (`supabase login`).
 *   2. Ask whether to create a new project or connect to an existing one.
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
  inverse: (s) => `\x1b[7m${s}\x1b[0m`,
};
const log = (m) => console.log(`${c.cyan('→')} ${m}`);
const ok = (m) => console.log(`${c.green('✓')} ${m}`);
const die = (m) => {
  console.error(`${c.red('✗')} ${m}`);
  process.exit(1);
};

function ask(q, hidden = false) {
  // Plain (visible) input: stock readline behavior.
  if (!hidden) {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(q, (a) => {
        rl.close();
        resolve(a.trim());
      });
    });
  }

  // Hidden input: print the prompt, then echo each typed/pasted
  // character as a bullet so the user sees that input is registering.
  // (Pasting a password should produce a row of bullets, not silence.)
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    const isTTY = stdin.isTTY && stdout.isTTY;

    // Non-TTY fallback: just read a line normally. There's no terminal
    // to mask anyway (e.g. piped input in CI).
    if (!isTTY) {
      const rl = readline.createInterface({ input: stdin, output: stdout });
      rl.question(q, (a) => {
        rl.close();
        resolve(a.trim());
      });
      return;
    }

    stdout.write(q);

    let buf = '';
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    function cleanup() {
      stdin.removeListener('data', onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
    }

    function onData(chunk) {
      // A single chunk can contain many characters when the user pastes.
      // Iterate by code point so we handle that and reject control codes
      // we shouldn't echo (arrows, escape sequences, etc.).
      for (const ch of chunk) {
        // Ctrl+C
        if (ch === '\u0003') {
          cleanup();
          stdout.write('\n');
          process.exit(130);
        }
        // Enter / Return — submit
        if (ch === '\r' || ch === '\n') {
          cleanup();
          stdout.write('\n');
          return resolve(buf.trim());
        }
        // Backspace / Delete
        if (ch === '\u0008' || ch === '\u007f') {
          if (buf.length > 0) {
            buf = buf.slice(0, -1);
            // Erase one bullet visually.
            stdout.write('\b \b');
          }
          continue;
        }
        // Skip any other control characters (escape sequences from
        // arrow keys, function keys, bracketed-paste markers, etc.).
        if (ch < ' ') continue;

        buf += ch;
        stdout.write('•');
      }
    }

    stdin.on('data', onData);
  });
}

/**
 * Interactive arrow-key picker. Renders the list, lets the user move
 * with ↑/↓ (or j/k), confirms with Enter, cancels with Ctrl+C / Esc / q.
 *
 * Falls back to a numbered prompt if the terminal isn't a TTY (e.g.,
 * when this is run inside CI or piped output).
 *
 *   choices: [{ label: string, hint?: string, value: T }]
 *
 * Returns the selected `value` or null if the user cancelled.
 */
function selectFromList(title, choices) {
  if (!choices.length) return Promise.resolve(null);

  const isTTY = process.stdin.isTTY && process.stdout.isTTY;

  // Numbered fallback for non-TTY environments.
  if (!isTTY) {
    console.log(`\n${title}`);
    choices.forEach((ch, i) => {
      const hint = ch.hint ? c.dim(`  ${ch.hint}`) : '';
      console.log(`  ${i + 1}) ${ch.label}${hint}`);
    });
    return ask(`Enter number (1-${choices.length}): `).then((raw) => {
      const n = parseInt(raw, 10);
      if (!n || n < 1 || n > choices.length) return null;
      return choices[n - 1].value;
    });
  }

  return new Promise((resolve) => {
    let index = 0;
    const stdin = process.stdin;
    const stdout = process.stdout;

    function render(initial = false) {
      if (!initial) {
        // Move cursor up by (choices.length + 1) lines and clear.
        stdout.write(`\x1b[${choices.length + 1}A`);
      }
      stdout.write(`${title}\n`);
      choices.forEach((ch, i) => {
        const pointer = i === index ? c.cyan('❯ ') : '  ';
        const label = i === index ? c.cyan(ch.label) : ch.label;
        const hint = ch.hint ? c.dim(`  ${ch.hint}`) : '';
        // Clear the rest of the line before writing it.
        stdout.write(`\x1b[2K${pointer}${label}${hint}\n`);
      });
    }

    function cleanup() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      // Hide cursor reset; show cursor again.
      stdout.write('\x1b[?25h');
    }

    function onData(buf) {
      const key = buf.toString();

      // Ctrl+C
      if (key === '\u0003') {
        cleanup();
        stdout.write('\n');
        process.exit(130);
      }
      // Esc or q — cancel
      if (key === '\u001b' || key === 'q') {
        cleanup();
        stdout.write('\n');
        return resolve(null);
      }
      // Enter
      if (key === '\r' || key === '\n') {
        cleanup();
        // Re-render once with the selection highlighted in green to
        // confirm the choice, then move on.
        stdout.write(`\x1b[${choices.length + 1}A`);
        stdout.write(`${title}\n`);
        choices.forEach((ch, i) => {
          const pointer = i === index ? c.green('✓ ') : '  ';
          const label = i === index ? c.green(ch.label) : c.dim(ch.label);
          const hint = ch.hint ? c.dim(`  ${ch.hint}`) : '';
          stdout.write(`\x1b[2K${pointer}${label}${hint}\n`);
        });
        return resolve(choices[index].value);
      }
      // Arrow keys arrive as escape sequences: \x1b[A (up), \x1b[B (down)
      if (key === '\u001b[A' || key === 'k') {
        index = (index - 1 + choices.length) % choices.length;
        render();
        return;
      }
      if (key === '\u001b[B' || key === 'j') {
        index = (index + 1) % choices.length;
        render();
        return;
      }
      // Number keys 1-9 jump directly.
      const n = parseInt(key, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= choices.length) {
        index = n - 1;
        render();
      }
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
    // Hide cursor while picking.
    stdout.write('\x1b[?25l');
    render(true);
  });
}

function sh(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', ...opts });
}

function shQuiet(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...opts,
  });
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
  console.log(
    c.dim('  This opens a browser to grant CLI access to your account.'),
  );
  const r2 = spawnSync('npx', ['supabase', 'login'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (r2.status !== 0) die('Login failed.');
  ok('Logged in');
}

// ─── Helpers: list orgs and projects via CLI ────────────────────────
function listOrganizations() {
  // Try JSON first.
  try {
    const out = shQuiet('npx supabase orgs list -o json');
    const parsed = JSON.parse(out);
    if (Array.isArray(parsed)) {
      return parsed
        .map((o) => ({
          id: o.id ?? o.slug ?? o.organization_id ?? o.org_id,
          name: o.name ?? o.organization_name ?? '(unnamed)',
        }))
        .filter((o) => o.id);
    }
  } catch {
    /* fall through to text parsing */
  }

  // Fallback: parse the table-formatted output.
  // Typical shape:
  //       ID         |     NAME
  //   ----------------|---------------
  //    abcdefghijkl  |  My Org
  let raw;
  try {
    raw = shQuiet('npx supabase orgs list');
  } catch {
    return [];
  }
  const orgs = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^[-|+\s]+$/.test(trimmed)) continue; // separator row
    if (/^ID\b/i.test(trimmed)) continue; // header row
    const parts = trimmed.split('|').map((p) => p.trim());
    if (parts.length < 2) continue;
    const [id, name] = parts;
    if (!/^[a-z0-9-]{8,}$/i.test(id)) continue;
    orgs.push({ id, name: name || '(unnamed)' });
  }
  return orgs;
}

function listProjects() {
  try {
    const out = shQuiet('npx supabase projects list -o json');
    const parsed = JSON.parse(out);
    if (Array.isArray(parsed)) {
      return parsed
        .map((p) => ({
          ref: p.id ?? p.ref ?? p.project_ref,
          name: p.name ?? '(unnamed)',
          region: p.region ?? '',
          orgId: p.organization_id ?? p.org_id ?? '',
        }))
        .filter((p) => p.ref);
    }
  } catch {
    /* fall through */
  }

  let raw;
  try {
    raw = shQuiet('npx supabase projects list');
  } catch {
    return [];
  }
  const projects = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^[-|+\s]+$/.test(trimmed)) continue;
    if (/^(LINKED|ORG ID|REFERENCE ID|NAME|REGION|CREATED AT)/i.test(trimmed))
      continue;
    const parts = trimmed.split('|').map((p) => p.trim());
    // Find the first 20-char-ish slug as the project ref.
    const ref = parts.find((p) => /^[a-z]{20}$/.test(p));
    if (!ref) continue;
    // Best-effort name guess: pick the first non-id, non-region column.
    const name =
      parts.find(
        (p) =>
          p &&
          p !== ref &&
          !/^[a-z0-9-]{20,}$/.test(p) &&
          !/^(us|eu|ap|sa|af)-/i.test(p),
      ) ?? '(unnamed)';
    projects.push({ ref, name, region: '', orgId: '' });
  }
  return projects;
}

// ─── 2. Pick or create a project ────────────────────────────────────
async function pickProjectRef() {
  const mode = await selectFromList(
    'How do you want to set up your Supabase project?',
    [
      {
        label: 'Create a new project',
        hint: '(we will create one in your account)',
        value: 'create',
      },
      {
        label: 'Connect to an existing project',
        hint: '(pick from your projects, or paste a ref)',
        value: 'existing',
      },
    ],
  );

  if (mode === null) die('Cancelled.');

  if (mode === 'existing') {
    return await pickExistingProjectRef();
  }
  return await createNewProject();
}

async function pickExistingProjectRef() {
  log('Fetching your Supabase projects…');
  const projects = listProjects();

  if (projects.length === 0) {
    console.log(
      c.yellow(
        '  No projects found in your account. Falling back to manual ref entry.',
      ),
    );
    const ref = await ask('Project ref: ');
    if (!ref) die('Project ref required.');
    return ref;
  }

  const choices = projects.map((p) => ({
    label: p.name,
    hint: `(${p.ref})`,
    value: p.ref,
  }));
  // Always offer a "paste ref manually" escape hatch — useful if the
  // project belongs to an org the user just got invited to and the
  // listing hasn't refreshed.
  choices.push({
    label: 'Enter project ref manually',
    hint: '(paste a ref from the dashboard URL)',
    value: '__manual__',
  });

  const picked = await selectFromList('Pick a project to connect to:', choices);
  if (picked === null) die('Cancelled.');

  if (picked === '__manual__') {
    const ref = await ask('Project ref: ');
    if (!ref) die('Project ref required.');
    return ref;
  }

  const found = projects.find((p) => p.ref === picked);
  ok(`Selected ${found?.name ?? picked} (${picked})`);
  return picked;
}

async function createNewProject() {
  log('Fetching your organizations…');
  const orgs = listOrganizations();

  let orgId;
  if (orgs.length === 0) {
    console.log(
      c.yellow(
        '  Could not list organizations automatically. You can still enter one manually.',
      ),
    );
    orgId = await ask('Organization ID: ');
    if (!orgId) die('Organization ID required.');
  } else {
    const choices = orgs.map((o) => ({
      label: o.name,
      hint: `(${o.id})`,
      value: o.id,
    }));
    const picked = await selectFromList(
      'Which organization should own the new project?',
      choices,
    );
    if (picked === null) die('Cancelled.');
    orgId = picked;
    const found = orgs.find((o) => o.id === orgId);
    ok(`Selected ${found?.name ?? orgId}`);
  }

  const name = await ask('Project name: ');
  if (!name) die('Project name required.');

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
  const after = listProjects();
  // Prefer a project whose name matches what we just created.
  const created = after.find((p) => p.name === name) ?? after[after.length - 1];
  if (!created) die('Could not determine new project ref.');

  process.env.__INIT_DB_PASSWORD = password;
  ok(`Created project ${created.ref}`);
  return created.ref;
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
    const anonLine = out
      .split('\n')
      .find((l) => /\banon\b|\bpublishable\b/i.test(l));
    anonKey = anonLine?.match(
      /\b(sb_publishable_[A-Za-z0-9_]+|eyJ[A-Za-z0-9_.\-]+)\b/,
    )?.[1];
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
    console.warn(
      `${c.yellow('!')} Types generation failed — fix and retry with: npm run db:types`,
    );
  }
}

// ─── main ───────────────────────────────────────────────────────────
(async function main() {
  console.log(c.bold('\nBNA Supabase — first-time setup\n'));
  console.log(
    c.dim(
      '  No Docker needed. Everything you build will live in your hosted\n' +
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

#!/usr/bin/env node
/**
 * scripts/gen-types.js
 *
 * Regenerate supabase/types.ts from the live remote schema.
 * Wired into `npm run db:types` and called automatically by `npm run dev`.
 *
 * No Docker — uses the linked hosted project as the source of truth.
 */

const { execSync } = require('child_process');
const { writeFileSync } = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'supabase', 'types.ts');

console.log('→ Generating types from remote schema…');
let types;
try {
  types = execSync('npx supabase gen types typescript --linked', {
    cwd: ROOT,
    encoding: 'utf8',
  });
} catch {
  console.error(
    "✗ Could not generate types. Make sure your project is linked:\n" +
      '  npm run init',
  );
  process.exit(1);
}

const header =
  '// supabase/types.ts\n' +
  '//\n' +
  '// GENERATED — do not edit by hand.\n' +
  '// Regenerate with: npm run db:types\n' +
  '// Source: linked Supabase project\n\n';

writeFileSync(OUT, header + types);
console.log(`✓ Wrote ${OUT}`);

#!/usr/bin/env node
/**
 * scripts/gen-types.js
 *
 * Regenerate supabase/types.ts from the live local schema.
 * Equivalent to `npm run db:types`, but with nicer output and a
 * check that supabase is actually running first.
 */

const { execSync } = require('child_process');
const { writeFileSync } = require('fs');
const { join } = require('path');

const OUT = join(__dirname, '..', 'supabase', 'types.ts');

try {
  execSync('supabase status', { stdio: 'ignore' });
} catch {
  console.error(
    "Supabase isn't running locally. Start it first:\n   npm run db:start",
  );
  process.exit(1);
}

console.log('→ Generating types from local schema...');
const types = execSync('supabase gen types typescript --local', {
  encoding: 'utf8',
});

const header = `// supabase/types.ts
//
// GENERATED FILE — do not edit by hand.
// Regenerate with: npm run db:types
// Source: supabase/migrations/*.sql

`;

writeFileSync(OUT, header + types);
console.log(`Wrote ${OUT}`);

#!/usr/bin/env node
/* eslint-disable no-console */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function fail(msg) {
  console.error(`migrations_check_failed: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`migrations_check_ok: ${msg}`);
}

const repoRoot = process.cwd();
const dbDir = join(repoRoot, 'db', 'migrations');
const supaDir = join(repoRoot, 'supabase', 'migrations');

// 1) Enforce canonical location: db/migrations
try {
  const entries = readdirSync(supaDir, { withFileTypes: true })
    .filter((ent) => ent.isFile())
    .map((ent) => ent.name)
    .filter((name) => name.endsWith('.sql'));
  if (entries.length > 0) {
    fail(`found ${entries.length} SQL migrations in supabase/migrations. New migrations must live under db/migrations.`);
  } else {
    ok('no migrations in supabase/migrations');
  }
} catch (err) {
  // If supabase/migrations missing, that's fine
  ok('supabase/migrations not present or empty');
}

// 2) Validate db/migrations filenames and ordering
const files = readdirSync(dbDir).filter((f) => f.endsWith('.sql')).sort();
if (files.length === 0) {
  ok('no db migrations found');
  process.exit(0);
}

const seen = new Set();
let lastPrefix = '';
for (const f of files) {
  // Accept numeric prefixes, timestamps, or a numeric prefix with a single-letter suffix (e.g. 0006a_*)
  const match = f.match(/^(\d{4,}[a-z]?|\d{14}|\d+)_/);
  if (!match) {
    fail(`migration filename should start with a numeric or timestamp prefix: ${f}`);
  }
  const prefix = match[1];
  if (seen.has(prefix)) {
    fail(`duplicate migration prefix detected: ${prefix} (${f})`);
  }
  seen.add(prefix);
  if (lastPrefix && prefix < lastPrefix) {
    fail(`migration ordering issue: ${f} has a lower prefix than previous ${lastPrefix}`);
  }
  lastPrefix = prefix;
  // sanity: file not empty
  const full = statSync(join(dbDir, f));
  if (full.size === 0) {
    fail(`empty migration file: ${f}`);
  }
}

ok(`validated ${files.length} db/migrations`);

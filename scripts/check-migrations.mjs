#!/usr/bin/env node
/* eslint-disable no-console */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function fail(msg) {
  console.error(`migrations_check_failed: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`migrations_check_ok: ${msg}`);
}

function checksum(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

const repoRoot = process.cwd();
const dbDir = join(repoRoot, 'db', 'migrations');
const supaDir = join(repoRoot, 'supabase', 'migrations');
const allowLegacySupabase = process.env.ALLOW_SUPABASE_MIGRATIONS === '1';

// 1) Enforce canonical location: db/migrations
if (allowLegacySupabase) {
  ok('supabase/migrations check skipped via ALLOW_SUPABASE_MIGRATIONS');
} else {
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
}

// 2) Validate db/migrations filenames and ordering
const files = readdirSync(dbDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const fileIds = files.map((file) => {
  const match = file.match(/^(\d{14})_([a-z0-9_]+)\.sql$/);
  if (!match) {
    fail(`migration filename must follow YYYYMMDDHHMMSS_slug.sql: ${file}`);
  }
  const [, timestamp, slug] = match;
  return `${timestamp}_${slug}`;
});
if (files.length === 0) {
  ok('no db migrations found');
  process.exit(0);
}

const seen = new Set();
let previousId = null;
const manifestEntries = [];

const dependencyOverrides = existsSync(dependencyOverridesPath)
  ? JSON.parse(readFileSync(dependencyOverridesPath, 'utf8'))
  : {};

for (const overrideId of Object.keys(dependencyOverrides)) {
  if (!fileIds.includes(overrideId)) {
    fail(`dependency-overrides.json references unknown migration id ${overrideId}`);
  }
}

function resolveDependencies(id) {
  const override = dependencyOverrides[id];
  if (override === undefined) {
    return previousId ? [previousId] : [];
  }
  if (!Array.isArray(override)) {
    fail(`dependency override for ${id} must be an array of migration ids`);
  }
  const unique = Array.from(new Set(override.filter((value) => typeof value === 'string' && value.length > 0)));
  unique.sort();
  for (const dependency of unique) {
    if (!fileIds.includes(dependency)) {
      fail(`dependency override for ${id} references unknown migration id ${dependency}`);
    }
    if (dependency === id) {
      fail(`dependency override for ${id} cannot reference itself`);
    }
  }
  return unique;
}

for (const file of files) {
  const match = file.match(/^(\d{14})_([a-z0-9_]+)\.sql$/);
  if (!match) {
    fail(`migration filename must follow YYYYMMDDHHMMSS_slug.sql: ${file}`);
  }
  const [, timestamp, slug] = match;
  const id = `${timestamp}_${slug}`;
  if (seen.has(id)) {
    fail(`duplicate migration identifier detected: ${id}`);
  }
  seen.add(id);

  const fileInfo = statSync(join(dbDir, file));
  if (fileInfo.size === 0) {
    fail(`empty migration file: ${file}`);
  }

  const contents = readFileSync(join(dbDir, file), 'utf8');
  manifestEntries.push({
    id,
    timestamp,
    slug,
    file,
    checksum: `sha256:${checksum(contents)}`,
    dependsOn: resolveDependencies(id),
  });
  previousId = id;
}

ok(`validated ${files.length} db/migrations filenames and ordering`);

// 3) Ensure manifest matches the filesystem view
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
  fail(`unable to read migration manifest at ${manifestPath}: ${error instanceof Error ? error.message : error}`);
}

if (!manifest || !Array.isArray(manifest.migrations)) {
  fail('migration manifest missing "migrations" array');
}

if (manifest.migrations.length !== manifestEntries.length) {
  fail(
    `manifest entry count ${manifest.migrations.length} does not match filesystem count ${manifestEntries.length}. Run node scripts/generate-migration-manifest.mjs`,
  );
}

const idToIndex = new Map(manifestEntries.map((entry, index) => [entry.id, index]));

for (let index = 0; index < manifestEntries.length; index += 1) {
  const expected = manifestEntries[index];
  const actual = manifest.migrations[index];
  if (!actual) {
    fail(`manifest missing entry for ${expected.id}`);
  }
  if (actual.id !== expected.id) {
    fail(`manifest entry ${index} id mismatch: expected ${expected.id}, received ${actual.id}`);
  }
  if (actual.file !== expected.file) {
    fail(`manifest entry ${actual.id} file mismatch: expected ${expected.file}, received ${actual.file}`);
  }
  if (actual.timestamp !== expected.timestamp) {
    fail(`manifest entry ${actual.id} timestamp mismatch: expected ${expected.timestamp}, received ${actual.timestamp}`);
  }
  if (actual.slug !== expected.slug) {
    fail(`manifest entry ${actual.id} slug mismatch: expected ${expected.slug}, received ${actual.slug}`);
  }
  if (!Array.isArray(actual.dependsOn)) {
    fail(`manifest entry ${actual.id} dependsOn must be an array`);
  }
  const actualDependencies = Array.from(new Set(actual.dependsOn.filter((value) => typeof value === 'string' && value.length > 0)));
  const sortedActual = [...actualDependencies].sort();
  if (sortedActual.length !== actualDependencies.length) {
    fail(`manifest entry ${actual.id} dependsOn contains duplicate values`);
  }
  if (sortedActual.some((dep) => !fileIds.includes(dep))) {
    fail(`manifest entry ${actual.id} dependsOn references unknown migration id`);
  }
  if (sortedActual.some((dep) => idToIndex.get(dep) === undefined || idToIndex.get(dep) >= index)) {
    fail(`manifest entry ${actual.id} dependsOn must reference earlier migrations`);
  }
  if (JSON.stringify(sortedActual) !== JSON.stringify(expected.dependsOn)) {
    fail(
      `manifest entry ${actual.id} dependsOn mismatch: expected [${expected.dependsOn.join(', ')}], received [${sortedActual.join(', ')}]`,
    );
  }
  if (actual.checksum !== expected.checksum) {
    fail(
      `manifest entry ${actual.id} checksum mismatch: expected ${expected.checksum}, received ${actual.checksum}. Run node scripts/generate-migration-manifest.mjs`,
    );
  }
  if (!allowedRollbackStrategies.has(actual.rollbackStrategy)) {
    fail(`manifest entry ${actual.id} has unsupported rollback strategy ${actual.rollbackStrategy}`);
  }
}

ok('migration manifest matches filesystem');

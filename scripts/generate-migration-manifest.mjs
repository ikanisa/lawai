#!/usr/bin/env node
/* eslint-disable no-console */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const migrationsDir = join(repoRoot, 'db', 'migrations');
const manifestPath = join(migrationsDir, 'manifest.json');
const strategiesPath = join(migrationsDir, 'rollback-strategies.json');
const dependencyOverridesPath = join(migrationsDir, 'dependency-overrides.json');

const allowedRollbackStrategies = new Set([
  'manual-restore',
  'reapply-migration',
  'reseed',
  'irreversible',
]);

/** @param {string} contents */
function checksum(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

/**
 * @param {string} id
 * @param {string} slug
 * @param {string} sql
 * @param {Record<string, string>} overrides
 */
function resolveRollbackStrategy(id, slug, sql, overrides) {
  if (overrides[id]) {
    return overrides[id];
  }
  const lowerSql = sql.toLowerCase();
  if (slug.endsWith('_rls') || lowerSql.includes('create policy') || lowerSql.includes('enable row level security')) {
    return 'reapply-migration';
  }
  if (lowerSql.includes('create or replace view') || lowerSql.includes('create view') || lowerSql.includes('create or replace function')) {
    return 'reapply-migration';
  }
  if (lowerSql.includes('insert into') && !lowerSql.includes('create table')) {
    return 'reseed';
  }
  if (lowerSql.includes('alter table') && lowerSql.includes('drop ')) {
    return 'reapply-migration';
  }
  if (lowerSql.includes('drop table') || lowerSql.includes('drop function') || lowerSql.includes('drop policy')) {
    return 'reapply-migration';
  }
  return 'manual-restore';
}

const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const fileIds = files.map((file) => {
  const match = file.match(/^(\d{14})_([a-z0-9_]+)\.sql$/);
  if (!match) {
    throw new Error(`Migration file ${file} does not match expected pattern YYYYMMDDHHMMSS_slug.sql`);
  }
  const [, timestamp, slug] = match;
  return `${timestamp}_${slug}`;
});

const overrides = existsSync(strategiesPath)
  ? JSON.parse(readFileSync(strategiesPath, 'utf8'))
  : {};

const dependencyOverrides = existsSync(dependencyOverridesPath)
  ? JSON.parse(readFileSync(dependencyOverridesPath, 'utf8'))
  : {};

for (const overrideId of Object.keys(dependencyOverrides)) {
  if (!fileIds.includes(overrideId)) {
    throw new Error(`dependency-overrides.json references unknown migration id ${overrideId}`);
  }
}

function resolveDependencies(id, previousId) {
  const override = dependencyOverrides[id];
  if (override === undefined) {
    return previousId ? [previousId] : [];
  }
  if (!Array.isArray(override)) {
    throw new Error(`dependency override for ${id} must be an array of migration ids`);
  }
  const unique = Array.from(new Set(override.filter((value) => typeof value === 'string' && value.length > 0)));
  unique.sort();
  for (const dependency of unique) {
    if (!fileIds.includes(dependency)) {
      throw new Error(`dependency override for ${id} references unknown migration id ${dependency}`);
    }
    if (dependency === id) {
      throw new Error(`dependency override for ${id} cannot reference itself`);
    }
  }
  return unique;
}

const manifest = {
  generatedAt: new Date().toISOString(),
  migrations: [],
};

let previousId = null;

for (const file of files) {
  const match = file.match(/^(\d{14})_([a-z0-9_]+)\.sql$/);
  if (!match) {
    throw new Error(`Migration file ${file} does not match expected pattern YYYYMMDDHHMMSS_slug.sql`);
  }
  const [, timestamp, slug] = match;
  const filePath = join(migrationsDir, file);
  const contents = readFileSync(filePath, 'utf8');
  const id = `${timestamp}_${slug}`;
  const rollbackStrategy = resolveRollbackStrategy(id, slug, contents, overrides);
  if (!allowedRollbackStrategies.has(rollbackStrategy)) {
    throw new Error(
      `Rollback strategy for ${id} must be one of ${Array.from(allowedRollbackStrategies).join(', ')}, received ${rollbackStrategy}`,
    );
  }
  manifest.migrations.push({
    id,
    file,
    timestamp,
    slug,
    checksum: `sha256:${checksum(contents)}`,
    dependsOn: resolveDependencies(id, previousId),
    rollbackStrategy,
  });
  previousId = id;
}

mkdirSync(migrationsDir, { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote manifest for ${manifest.migrations.length} migrations.`);

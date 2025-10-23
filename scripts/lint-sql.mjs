#!/usr/bin/env node
/* eslint-disable no-console */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';
import { format } from 'sql-formatter';

const repoRoot = process.cwd();
const shouldFix = process.argv.includes('--fix');
const targets = [join(repoRoot, 'db'), join(repoRoot, 'supabase')];
let failures = 0;

function collectSqlFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSqlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.sql')) {
      files.push(fullPath);
    }
  }
  return files;
}

function normaliseWhitespace(contents) {
  return contents.replace(/\s+$/u, '').replace(/\r\n/g, '\n');
}

const formatOptions = {
  language: 'postgresql',
  keywordCase: 'upper',
  indent: '  ',
  linesBetweenQueries: 1,
};

for (const target of targets) {
  let stats;
  try {
    stats = statSync(target);
  } catch (error) {
    continue;
  }
  if (!stats.isDirectory()) continue;
  const files = collectSqlFiles(target);
  for (const file of files) {
    const relPath = relative(repoRoot, file);
    if (relPath.endsWith('schema.sql')) {
      continue;
    }
    const original = readFileSync(file, 'utf8');
    const formatted = `${format(original, formatOptions).trim()}\n`;
    const normalisedOriginal = `${normaliseWhitespace(original)}\n`;
    if (formatted !== normalisedOriginal) {
      if (shouldFix) {
        writeFileSync(file, formatted);
        console.log(`sql_lint_fixed: ${relPath}`);
      } else {
        console.error(`sql_lint_failed: ${relPath} is not formatted`);
        failures += 1;
      }
    }
  }
}

if (failures > 0) {
  console.error(`sql_lint_failed: ${failures} file(s) require formatting`);
  process.exit(1);
}

console.log('sql_lint_ok: SQL formatting up to date');

#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const envFiles = [
  { path: '.env.example', label: 'root' },
  { path: 'apps/api/.env.example', label: 'apps/api' },
  { path: 'apps/ops/.env.example', label: 'apps/ops' },
  { path: 'apps/web/.env.example', label: 'apps/web' },
];

const matrixPath = path.join(repoRoot, 'docs/env-matrix.md');
const matrixContent = readFileSync(matrixPath, 'utf8');

const codeTokenRegex = /`([^`]+)`/g;
const rawTokens = new Set();
let match;
while ((match = codeTokenRegex.exec(matrixContent)) !== null) {
  const token = match[1];
  if (/^[A-Z0-9_][A-Z0-9_*]*$/.test(token)) {
    rawTokens.add(token);
  }
}

const exactTokens = new Set();
const wildcardTokens = [];
for (const token of rawTokens) {
  if (token.includes('*')) {
    wildcardTokens.push({
      token,
      regex: new RegExp(`^${token.replace(/\*/g, '.*')}$`),
    });
  } else {
    exactTokens.add(token);
  }
}

const EnvEntrySchema = z.object({
  key: z
    .string()
    .min(1, 'Empty variable name')
    .regex(/^[A-Z0-9_]+$/, 'Environment keys must be all-caps snake case'),
  value: z.string(),
  lineNumber: z.number().int().positive(),
});

const FileReportSchema = z.object({
  label: z.string(),
  path: z.string(),
  entries: z.array(EnvEntrySchema),
});

function isDocumented(variable) {
  if (exactTokens.has(variable)) {
    return true;
  }
  return wildcardTokens.some(({ regex }) => regex.test(variable));
}

const reports = envFiles.map(({ path: relativePath, label }) => {
  const absolutePath = path.join(repoRoot, relativePath);
  const content = readFileSync(absolutePath, 'utf8');
  const entries = [];

  content.split(/\r?\n/).forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      return;
    }
    const [rawKey, ...rawRest] = line.split('=');
    const parsed = EnvEntrySchema.safeParse({
      key: rawKey,
      value: rawRest.join('='),
      lineNumber: idx + 1,
    });

    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => issue.message).join(', ');
      throw new Error(
        `Invalid line in ${relativePath}: "${line}" (${issues}). Ensure keys are uppercase snake case.`,
      );
    }

    entries.push(parsed.data);
  });

  return FileReportSchema.parse({ label, path: relativePath, entries });
});

let hasErrors = false;
for (const report of reports) {
  const seen = new Map();
  const undocumented = [];

  report.entries.forEach(({ key, lineNumber }) => {
    if (seen.has(key)) {
      const firstLine = seen.get(key);
      console.error(
        `Duplicate variable \"${key}\" detected in ${report.path} (first occurrence at line ${firstLine}).`,
      );
      hasErrors = true;
    } else {
      seen.set(key, lineNumber);
    }

    if (!isDocumented(key)) {
      undocumented.push(key);
    }
  });

  if (undocumented.length > 0) {
    console.error(
      `Undocumented variables found in ${report.path}: ${undocumented
        .sort()
        .join(', ')}. Update docs/env-matrix.md to describe them or remove the entries.`,
    );
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('\nEnvironment example validation failed.');
  process.exit(1);
}

console.log('All environment example files match docs/env-matrix.md.');

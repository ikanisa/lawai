#!/usr/bin/env node
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(dirname, "..", ".next");
const chunksDir = path.join(rootDir, "static", "chunks");
const appDir = path.join(rootDir, "server", "app");

const BUNDLE_LIMIT_BYTES = Number.parseInt(process.env.BUNDLE_BUDGET_BYTES ?? "1900000", 10);
const ENTRY_LIMIT_BYTES = Number.parseInt(process.env.BUNDLE_ENTRY_BUDGET_BYTES ?? "420000", 10);

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listFiles(resolved);
    }
    return [resolved];
  });
}

function ensureDirExists(dir, label) {
  try {
    statSync(dir);
  } catch (error) {
    console.error(`❌ Bundle budget check failed: missing ${label} directory at ${dir}`);
    process.exit(1);
  }
}

ensureDirExists(chunksDir, "chunks");
ensureDirExists(appDir, "app");

const isCodeFile = (file) => /(\.js|\.mjs|\.css)$/i.test(file);

const files = listFiles(chunksDir).filter(isCodeFile);
const totalSize = files.reduce((sum, file) => sum + statSync(file).size, 0);

if (totalSize > BUNDLE_LIMIT_BYTES) {
  console.error(
    `❌ Bundle size ${totalSize} bytes exceeds budget ${BUNDLE_LIMIT_BYTES} bytes. Adjust code-splitting or intentionally raise the budget if necessary.`,
  );
  process.exit(1);
}

const entryFiles = listFiles(appDir)
  .filter(isCodeFile)
  .map((file) => ({ file, size: statSync(file).size }))
  .sort((a, b) => b.size - a.size)
  .slice(0, 5);

const largestEntry = entryFiles[0];

if (largestEntry && largestEntry.size > ENTRY_LIMIT_BYTES) {
  console.error(
    `❌ Entry bundle ${path.relative(rootDir, largestEntry.file)} at ${largestEntry.size} bytes exceeds budget ${ENTRY_LIMIT_BYTES} bytes. Consider dynamic imports or lighter dependencies.`,
  );
  process.exit(1);
}

console.log(
  `✅ Bundle budgets respected. Total chunks: ${totalSize} bytes (limit ${BUNDLE_LIMIT_BYTES}). Largest entry: ${largestEntry ? largestEntry.size : 0} bytes (limit ${ENTRY_LIMIT_BYTES}).`,
);

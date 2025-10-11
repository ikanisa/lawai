#!/usr/bin/env tsx
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const workspaceRoot = path.resolve(__dirname, '../../..');

const pnpmAvailable = spawnSync('pnpm', ['--version'], { stdio: 'ignore' }).status === 0;

let sharedBuildSucceeded = false;
if (pnpmAvailable) {
  try {
    execSync('pnpm --silent --filter @avocat-ai/shared build', { stdio: 'inherit', cwd: workspaceRoot });
    sharedBuildSucceeded = true;
  } catch (error) {
    console.warn('Warning: pnpm build for @avocat-ai/shared failed, attempting local TypeScript fallback.', error);
  }
}

if (!sharedBuildSucceeded) {
  try {
    const tscBin = require.resolve('typescript/bin/tsc');
    execSync(`node ${tscBin} -p packages/shared/tsconfig.json`, { stdio: 'inherit', cwd: workspaceRoot });
    sharedBuildSucceeded = true;
  } catch (error) {
    console.warn('Warning: failed to build @avocat-ai/shared before exporting agent definition.', error);
  }
}

const { getAgentPlatformDefinition } = await import('../src/agent.js');

const definition = getAgentPlatformDefinition();

const outputDir = path.resolve(__dirname, '../../dist/platform');
mkdirSync(outputDir, { recursive: true });

const outputPath = path.join(outputDir, `${definition.name}.json`);
writeFileSync(outputPath, JSON.stringify(definition, null, 2), 'utf-8');

console.log(`Agent definition exported to ${outputPath}`);

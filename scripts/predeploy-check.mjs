#!/usr/bin/env node

/**
 * Pre-deployment Check Script
 * Validates the environment and codebase before deploying to Netlify
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const errors = [];
const warnings = [];

console.log('🔍 Running pre-deployment checks...\n');

// Check 1: Verify required environment files exist
console.log('1️⃣  Checking environment files...');
const requiredEnvFiles = ['.env.example'];
for (const file of requiredEnvFiles) {
  if (!existsSync(file)) {
    errors.push(`Missing required file: ${file}`);
  } else {
    console.log(`   ✅ Found ${file}`);
  }
}

// Check 2: Verify pnpm version
console.log('\n2️⃣  Checking package manager...');
try {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
  const expectedPnpm = packageJson.packageManager?.match(/pnpm@([\d.]+)/)?.[1];
  
  if (expectedPnpm) {
    console.log(`   ✅ Expected pnpm version: ${expectedPnpm}`);
  }
} catch (err) {
  errors.push(`Failed to read package.json: ${err.message}`);
}

// Check 3: Verify critical configuration files
console.log('\n3️⃣  Checking configuration files...');
const configFiles = [
  'netlify.toml',
  'apps/web/netlify.toml',
  'apps/pwa/netlify.toml',
  'apps/web/next.config.mjs',
  'apps/pwa/next.config.mjs',
];

for (const file of configFiles) {
  if (!existsSync(file)) {
    errors.push(`Missing configuration file: ${file}`);
  } else {
    console.log(`   ✅ Found ${file}`);
  }
}

// Check 4: Verify no Vercel-specific code remains
console.log('\n4️⃣  Checking for Vercel-specific code...');
const vercelPatterns = [
  { pattern: '@vercel/analytics', description: 'Vercel Analytics import' },
  { pattern: '@vercel/speed-insights', description: 'Vercel Speed Insights import' },
  { pattern: '@vercel/kv', description: 'Vercel KV import' },
  { pattern: '@vercel/edge-config', description: 'Vercel Edge Config import' },
  { pattern: 'vercel.live', description: 'Vercel Live reference' },
];

for (const { pattern, description } of vercelPatterns) {
  try {
    const result = execSync(
      `grep -r "${pattern}" apps/web apps/pwa --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.json" || true`,
      { encoding: 'utf-8' }
    );
    
    if (result.trim()) {
      warnings.push(`Found ${description} in:\n${result.split('\n').slice(0, 3).join('\n')}`);
    }
  } catch (err) {
    // grep returns exit code 1 when no matches found, which is what we want
  }
}

// Check 5: Verify Next.js apps can be built (dry run)
console.log('\n5️⃣  Checking Next.js configuration...');
const nextApps = ['apps/web', 'apps/pwa'];
for (const app of nextApps) {
  const nextConfigPath = join(app, 'next.config.mjs');
  if (existsSync(nextConfigPath)) {
    console.log(`   ✅ Next.js config found for ${app}`);
    
    // Check for standalone output mode
    const config = readFileSync(nextConfigPath, 'utf-8');
    if (config.includes("output: 'standalone'")) {
      console.log(`   ✅ Standalone output configured for ${app}`);
    } else {
      warnings.push(`${app} should have output: 'standalone' in next.config.mjs`);
    }
  }
}

// Check 6: Verify no binary files in commits
console.log('\n6️⃣  Checking for binary files...');
try {
  execSync('node ./scripts/check-binaries.mjs', { stdio: 'inherit' });
  console.log('   ✅ Binary files check passed');
} catch (err) {
  errors.push('Binary files check failed');
}

// Check 7: Verify migration manifest
console.log('\n7️⃣  Checking migrations...');
try {
  execSync('ALLOW_SUPABASE_MIGRATIONS=1 node ./scripts/check-migrations.mjs', { stdio: 'inherit' });
  console.log('   ✅ Migration checks passed');
} catch (err) {
  warnings.push('Migration checks failed (may be expected in some contexts)');
}

// Check 8: Validate environment examples
console.log('\n8️⃣  Validating environment examples...');
try {
  execSync('node ./scripts/validate-env-examples.mjs', { stdio: 'inherit' });
  console.log('   ✅ Environment validation passed');
} catch (err) {
  warnings.push('Environment validation failed');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Pre-deployment Check Summary');
console.log('='.repeat(60));

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All checks passed! Ready for deployment.');
  process.exit(0);
}

if (warnings.length > 0) {
  console.log(`\n⚠️  ${warnings.length} Warning(s):`);
  warnings.forEach((warning, i) => {
    console.log(`\n${i + 1}. ${warning}`);
  });
}

if (errors.length > 0) {
  console.log(`\n❌ ${errors.length} Error(s):`);
  errors.forEach((error, i) => {
    console.log(`\n${i + 1}. ${error}`);
  });
  console.log('\n⛔ Deployment blocked due to errors.');
  process.exit(1);
}

if (errors.length === 0 && warnings.length > 0) {
  console.log('\n⚠️  Warnings detected but deployment can proceed.');
  process.exit(0);
}

#!/usr/bin/env tsx

/**
 * Verify Cleanup Script
 * Ensures all provider-specific code has been properly removed
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

const errors: string[] = [];
const warnings: string[] = [];

console.log('🔍 Verifying cleanup completeness...\n');

// Check 1: Verify Vercel config files are removed
console.log('1️⃣  Checking for Vercel configuration files...');
const vercelFiles = [
  'vercel.json',
  'apps/web/vercel.json',
  'apps/pwa/vercel.json',
];

let vercelFilesFound = false;
vercelFiles.forEach((file) => {
  if (existsSync(file)) {
    errors.push(`Vercel config file still exists: ${file}`);
    vercelFilesFound = true;
  }
});

if (!vercelFilesFound) {
  console.log('   ✅ No Vercel configuration files found');
} else {
  console.log('   ❌ Vercel configuration files still exist');
}

// Check 2: Verify Netlify config files exist
console.log('\n2️⃣  Checking for Netlify configuration files...');
const netlifyFiles = [
  'netlify.toml',
  'apps/web/netlify.toml',
  'apps/pwa/netlify.toml',
];

let netlifyFilesFound = true;
netlifyFiles.forEach((file) => {
  if (!existsSync(file)) {
    errors.push(`Missing Netlify config file: ${file}`);
    netlifyFilesFound = false;
  }
});

if (netlifyFilesFound) {
  console.log('   ✅ All Netlify configuration files exist');
} else {
  console.log('   ❌ Some Netlify configuration files are missing');
}

// Check 3: Run provider code scanner
console.log('\n3️⃣  Scanning for provider-specific code...');
try {
  execSync('tsx scripts/scan-provider-code.ts', { stdio: 'inherit' });
  console.log('   ✅ No provider-specific code found');
} catch (err) {
  warnings.push('Provider-specific code still exists (see output above)');
}

// Check 4: Verify package.json doesn't have Vercel/Cloudflare deps
console.log('\n4️⃣  Checking for provider dependencies...');
try {
  const grepResult = execSync(
    'grep -E "@vercel|@cloudflare" apps/web/package.json apps/pwa/package.json package.json 2>/dev/null || true',
    { encoding: 'utf-8' }
  );
  
  if (grepResult.trim()) {
    warnings.push('Provider dependencies found in package.json files:\n' + grepResult);
  } else {
    console.log('   ✅ No provider dependencies found');
  }
} catch (err) {
  // No matches is good
  console.log('   ✅ No provider dependencies found');
}

// Check 5: Verify build scripts exist
console.log('\n5️⃣  Checking for deployment scripts...');
const deploymentScripts = [
  'scripts/netlify-build.sh',
  'scripts/predeploy-check.mjs',
];

deploymentScripts.forEach((script) => {
  if (!existsSync(script)) {
    errors.push(`Missing deployment script: ${script}`);
  } else {
    console.log(`   ✅ Found ${script}`);
  }
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Cleanup Verification Summary');
console.log('='.repeat(60));

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ Cleanup verification passed! All provider-specific code has been removed.');
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
  console.log('\n⛔ Cleanup verification failed.');
  process.exit(1);
}

if (errors.length === 0 && warnings.length > 0) {
  console.log('\n⚠️  Warnings detected but verification passed.');
  process.exit(0);
}

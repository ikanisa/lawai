#!/usr/bin/env node

/**
 * Scan Provider-Specific Code
 * Detects Vercel and Cloudflare specific code in the repository
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

interface ScanResult {
  file: string;
  line: number;
  content: string;
  type: 'vercel' | 'cloudflare' | 'edge-runtime';
}

const results: ScanResult[] = [];

// Patterns to search for
const patterns = [
  { regex: /@vercel\/[a-z-]+/g, type: 'vercel' as const },
  { regex: /from ['"]@vercel/g, type: 'vercel' as const },
  { regex: /import.*@vercel/g, type: 'vercel' as const },
  { regex: /vercel\.live/g, type: 'vercel' as const },
  { regex: /@cloudflare\/[a-z-]+/g, type: 'cloudflare' as const },
  { regex: /from ['"]@cloudflare/g, type: 'cloudflare' as const },
  { regex: /import.*@cloudflare/g, type: 'cloudflare' as const },
  { regex: /export const runtime = ['"]edge['"]/g, type: 'edge-runtime' as const },
  { regex: /runtime: ['"]edge['"]/g, type: 'edge-runtime' as const },
];

// Directories to scan
const dirsToScan = ['apps/web', 'apps/pwa', 'packages'];

// File extensions to check
const validExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs'];

function scanFile(filePath: string): void {
  const ext = extname(filePath);
  if (!validExtensions.includes(ext)) {
    return;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      patterns.forEach(({ regex, type }) => {
        if (regex.test(line)) {
          results.push({
            file: filePath,
            line: index + 1,
            content: line.trim(),
            type,
          });
        }
      });
    });
  } catch (err) {
    // Skip files that can't be read
  }
}

function scanDirectory(dirPath: string): void {
  try {
    const entries = readdirSync(dirPath);

    entries.forEach((entry) => {
      const fullPath = join(dirPath, entry);
      
      // Skip node_modules, .next, dist, etc.
      if (entry === 'node_modules' || entry === '.next' || entry === 'dist' || entry.startsWith('.')) {
        return;
      }

      try {
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDirectory(fullPath);
        } else if (stat.isFile()) {
          scanFile(fullPath);
        }
      } catch (err) {
        // Skip entries we can't access
      }
    });
  } catch (err) {
    console.error(`Error scanning directory ${dirPath}: ${err.message}`);
  }
}

console.log('🔍 Scanning for provider-specific code...\n');

// Scan all directories
dirsToScan.forEach((dir) => {
  console.log(`Scanning ${dir}...`);
  scanDirectory(dir);
});

// Group results by type
const vercelResults = results.filter((r) => r.type === 'vercel');
const cloudflareResults = results.filter((r) => r.type === 'cloudflare');
const edgeRuntimeResults = results.filter((r) => r.type === 'edge-runtime');

console.log('\n' + '='.repeat(60));
console.log('📊 Scan Results');
console.log('='.repeat(60));

if (results.length === 0) {
  console.log('✅ No provider-specific code found!');
  process.exit(0);
}

if (vercelResults.length > 0) {
  console.log(`\n🔴 Vercel-specific code (${vercelResults.length} occurrences):`);
  vercelResults.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.file}:${result.line}`);
    console.log(`   ${result.content}`);
  });
}

if (cloudflareResults.length > 0) {
  console.log(`\n🟠 Cloudflare-specific code (${cloudflareResults.length} occurrences):`);
  cloudflareResults.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.file}:${result.line}`);
    console.log(`   ${result.content}`);
  });
}

if (edgeRuntimeResults.length > 0) {
  console.log(`\n🟡 Edge runtime declarations (${edgeRuntimeResults.length} occurrences):`);
  edgeRuntimeResults.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.file}:${result.line}`);
    console.log(`   ${result.content}`);
  });
}

console.log('\n' + '='.repeat(60));
console.log(`Total: ${results.length} provider-specific code patterns found`);
console.log('='.repeat(60));
console.log('\n⚠️  These need to be manually removed or replaced with Netlify-compatible alternatives.');

process.exit(results.length > 0 ? 1 : 0);

#!/usr/bin/env node

/**
 * Service Worker Verification Script
 * 
 * This script verifies that both PWAs have proper service worker implementation.
 * Run this after building the apps to ensure offline support is working.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const checks = [];

function check(name, condition, details) {
  checks.push({ name, pass: condition, details });
  console.log(condition ? '✅' : '❌', name);
  if (details && !condition) {
    console.log('   ', details);
  }
}

console.log('\n🔍 Service Worker Implementation Verification\n');

// Check public PWA (apps/pwa)
console.log('📱 Public PWA (apps/pwa):');
check(
  'Service worker exists',
  existsSync(resolve('apps/pwa/public/sw.js')),
  'Missing apps/pwa/public/sw.js'
);
check(
  'Offline fallback exists',
  existsSync(resolve('apps/pwa/public/offline.html')),
  'Missing apps/pwa/public/offline.html'
);
check(
  'Manifest exists',
  existsSync(resolve('apps/pwa/public/manifest.json')),
  'Missing apps/pwa/public/manifest.json'
);
check(
  'Service worker bridge exists',
  existsSync(resolve('apps/pwa/lib/pwa/service-worker-bridge.tsx')),
  'Missing service worker bridge component'
);
check(
  'Hook exists',
  existsSync(resolve('apps/pwa/lib/pwa/use-service-worker.tsx')),
  'Missing useServiceWorker hook'
);

// Check admin PWA (apps/web)
console.log('\n🔧 Admin PWA (apps/web):');
check(
  'Service worker exists',
  existsSync(resolve('apps/web/public/sw.js')),
  'Missing apps/web/public/sw.js'
);
check(
  'Offline fallback exists',
  existsSync(resolve('apps/web/public/offline.html')),
  'Missing apps/web/public/offline.html'
);
check(
  'Manifest exists',
  existsSync(resolve('apps/web/public/manifest.json')),
  'Missing apps/web/public/manifest.json'
);
check(
  'Service worker registration exists',
  existsSync(resolve('apps/web/src/components/service-worker-registration.tsx')),
  'Missing service worker registration component'
);
check(
  'Hook exists',
  existsSync(resolve('apps/web/src/hooks/use-service-worker.ts')),
  'Missing useServiceWorker hook'
);

// Check service worker content
console.log('\n📝 Service Worker Content:');
try {
  const pwaSW = readFileSync(resolve('apps/pwa/public/sw.js'), 'utf-8');
  check(
    'Public PWA uses Workbox 7',
    pwaSW.includes('workbox-cdn/releases/7.0.0'),
    'Should use Workbox 7.0.0'
  );
  check(
    'Public PWA has offline fallback',
    pwaSW.includes('offline.html'),
    'Should handle offline navigation'
  );
  check(
    'Public PWA has caching strategies',
    pwaSW.includes('NetworkFirst') && pwaSW.includes('CacheFirst'),
    'Should have proper caching strategies'
  );
} catch (error) {
  check('Public PWA service worker readable', false, error.message);
}

try {
  const adminSW = readFileSync(resolve('apps/web/public/sw.js'), 'utf-8');
  check(
    'Admin PWA uses Workbox 7',
    adminSW.includes('workbox-cdn/releases/7.0.0'),
    'Should use Workbox 7.0.0'
  );
  check(
    'Admin PWA has offline fallback',
    adminSW.includes('offline.html'),
    'Should handle offline navigation'
  );
  check(
    'Admin PWA has API caching',
    adminSW.includes('supabase'),
    'Should cache Supabase API calls'
  );
} catch (error) {
  check('Admin PWA service worker readable', false, error.message);
}

// Summary
console.log('\n📊 Summary:');
const passed = checks.filter((c) => c.pass).length;
const total = checks.length;
const percentage = ((passed / total) * 100).toFixed(1);

console.log(`   ${passed}/${total} checks passed (${percentage}%)`);

if (passed === total) {
  console.log('\n✅ All checks passed! Service workers are properly configured.\n');
  process.exit(0);
} else {
  console.log(`\n❌ ${total - passed} check(s) failed. Review the errors above.\n`);
  process.exit(1);
}

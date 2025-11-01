# PWA Hardening Audit

**Date**: 2025-11-01  
**Scope**: apps/pwa (Public PWA) and apps/web (Admin/Staff PWA)

---

## Executive PWA Summary

**Public PWA Status**: 🔴 **RED** - Critical gaps in offline support  
**Admin PWA Status**: 🔴 **RED** - Not configured as PWA

**Must-Fix Items**:
1. ❌ Service worker implementation (offline support)
2. ❌ Update notification UX
3. ❌ Admin PWA manifest missing
4. ⚠️ No Core Web Vitals budgets configured
5. ⚠️ iOS-specific optimizations incomplete

---

## PWA Baseline Requirements

| Requirement | Public PWA (apps/pwa) | Admin PWA (apps/web) | Priority |
|-------------|----------------------|---------------------|----------|
| **Web App Manifest** | ✅ Present | ❌ Missing | P0 |
| **Service Worker** | ❌ Missing | ❌ Missing | P0 |
| **HTTPS** | ✅ Vercel | ✅ Vercel | - |
| **Responsive Design** | ✅ Yes | ✅ Yes | - |
| **Offline Fallback** | ❌ No | ❌ No | P0 |
| **Install Prompt** | ⚠️ Partial | ❌ No | P1 |
| **App Icons (512px)** | ✅ SVG | ❌ Missing | P1 |
| **Maskable Icons** | ✅ Yes | ❌ No | P1 |
| **Theme Color** | ✅ #0B1220 | ⚠️ Not set | P2 |
| **Apple Touch Icons** | ⚠️ Not verified | ⚠️ Not verified | P2 |
| **Splash Screens** | ❌ No | ❌ No | P2 |

**Baseline Score**: 
- **Public PWA**: 4/11 = 36% 🔴 FAIL
- **Admin PWA**: 2/11 = 18% 🔴 FAIL

---

## Public PWA Analysis (apps/pwa)

### Manifest Audit

**File**: `apps/pwa/public/manifest.json`

```json
{
  "name": "Avocat-AI Francophone",
  "short_name": "Avocat-AI",
  "start_url": "/workspace",
  "display": "standalone",
  "theme_color": "#0B1220",
  "background_color": "#0B1220",
  "description": "Agent-first PWA pour la suite justice autonome.",
  "icons": [
    { "src": "/icons/icon-192.svg", "sizes": "192x192", "type": "image/svg+xml" },
    { "src": "/icons/icon-512.svg", "sizes": "512x512", "type": "image/svg+xml" },
    { "src": "/icons/maskable.svg", "sizes": "512x512", "type": "image/svg+xml", "purpose": "maskable any" }
  ],
  "shortcuts": [
    {
      "name": "Nouvelle recherche",
      "url": "/research?new=1",
      "icons": [{ "src": "/icons/shortcut-research.svg", "sizes": "96x96", "type": "image/svg+xml" }]
    },
    {
      "name": "Nouvelle rédaction",
      "url": "/drafting?new=1",
      "icons": [{ "src": "/icons/shortcut-draft.svg", "sizes": "96x96", "type": "image/svg+xml" }]
    },
    {
      "name": "File HITL",
      "url": "/hitl",
      "icons": [{ "src": "/icons/shortcut-queue.svg", "sizes": "96x96", "type": "image/svg+xml" }]
    }
  ]
}
```

#### ✅ Strengths
- Valid JSON structure
- Appropriate `display: "standalone"` for app-like experience
- Theme and background colors defined
- Descriptive French text
- Maskable icon defined
- App shortcuts for key workflows

#### ⚠️ Issues
1. **No `scope` field**: Should explicitly define scope
   ```json
   "scope": "/",
   ```

2. **SVG icons only**: While supported by modern browsers, PNG fallbacks recommended for compatibility
   - Add 192x192 PNG
   - Add 512x512 PNG

3. **Missing `orientation` field**: Consider adding for specific use cases
   ```json
   "orientation": "portrait-primary",
   ```

4. **Missing `categories` field**: Helps app store classification
   ```json
   "categories": ["business", "productivity", "utilities"],
   ```

5. **Missing `lang` field**: Should match primary language
   ```json
   "lang": "fr",
   ```

6. **Missing `dir` field**: Text direction
   ```json
   "dir": "ltr",
   ```

7. **No `screenshots` field**: Required for richer install prompts
   ```json
   "screenshots": [
     {
       "src": "/screenshots/desktop-1.png",
       "sizes": "1280x720",
       "type": "image/png",
       "platform": "wide",
       "label": "Dashboard principal"
     },
     {
       "src": "/screenshots/mobile-1.png",
       "sizes": "750x1334",
       "type": "image/png",
       "platform": "narrow",
       "label": "Recherche juridique"
     }
   ],
   ```

#### 🔧 Recommended Manifest
```json
{
  "name": "Avocat-AI Francophone",
  "short_name": "Avocat-AI",
  "description": "Agent-first PWA pour la suite justice autonome francophone.",
  "start_url": "/workspace",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#0B1220",
  "background_color": "#0B1220",
  "lang": "fr",
  "dir": "ltr",
  "categories": ["business", "productivity", "utilities"],
  "icons": [
    { 
      "src": "/icons/icon-192.png", 
      "sizes": "192x192", 
      "type": "image/png" 
    },
    { 
      "src": "/icons/icon-512.png", 
      "sizes": "512x512", 
      "type": "image/png" 
    },
    { 
      "src": "/icons/icon-192.svg", 
      "sizes": "192x192", 
      "type": "image/svg+xml" 
    },
    { 
      "src": "/icons/icon-512.svg", 
      "sizes": "512x512", 
      "type": "image/svg+xml" 
    },
    { 
      "src": "/icons/maskable-192.png", 
      "sizes": "192x192", 
      "type": "image/png", 
      "purpose": "maskable" 
    },
    { 
      "src": "/icons/maskable-512.png", 
      "sizes": "512x512", 
      "type": "image/png", 
      "purpose": "maskable" 
    },
    { 
      "src": "/icons/maskable.svg", 
      "sizes": "512x512", 
      "type": "image/svg+xml", 
      "purpose": "maskable any" 
    }
  ],
  "shortcuts": [
    {
      "name": "Nouvelle recherche",
      "short_name": "Recherche",
      "description": "Démarrer une nouvelle recherche juridique",
      "url": "/research?new=1",
      "icons": [
        { "src": "/icons/shortcut-research.svg", "sizes": "96x96", "type": "image/svg+xml" }
      ]
    },
    {
      "name": "Nouvelle rédaction",
      "short_name": "Rédaction",
      "description": "Créer un nouveau document juridique",
      "url": "/drafting?new=1",
      "icons": [
        { "src": "/icons/shortcut-draft.svg", "sizes": "96x96", "type": "image/svg+xml" }
      ]
    },
    {
      "name": "File HITL",
      "short_name": "Révision",
      "description": "Accéder à la file de révision humaine",
      "url": "/hitl",
      "icons": [
        { "src": "/icons/shortcut-queue.svg", "sizes": "96x96", "type": "image/svg+xml" }
      ]
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/desktop-home.png",
      "sizes": "1920x1080",
      "type": "image/png",
      "platform": "wide",
      "label": "Dashboard principal - Vue d'ensemble"
    },
    {
      "src": "/screenshots/desktop-research.png",
      "sizes": "1920x1080",
      "type": "image/png",
      "platform": "wide",
      "label": "Module de recherche juridique"
    },
    {
      "src": "/screenshots/mobile-home.png",
      "sizes": "750x1334",
      "type": "image/png",
      "platform": "narrow",
      "label": "Accueil mobile"
    },
    {
      "src": "/screenshots/mobile-research.png",
      "sizes": "750x1334",
      "type": "image/png",
      "platform": "narrow",
      "label": "Recherche mobile"
    }
  ]
}
```

---

### Service Worker - MISSING ❌

**Status**: No service worker detected in `apps/pwa/`

**Impact**: 
- ❌ No offline support
- ❌ Cannot install as standalone app on some platforms
- ❌ No background sync
- ❌ No push notifications
- ❌ Poor mobile UX when network is unavailable

#### Recommended Implementation: Workbox

**Strategy**: Progressive enhancement with Workbox 7

##### 1. Install Workbox
```bash
cd apps/pwa
pnpm add workbox-webpack-plugin workbox-window
```

##### 2. Configure Next.js Plugin
```javascript
// apps/pwa/next.config.mjs
import withPWA from 'next-pwa';

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        },
      },
    },
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*\.(png|jpg|jpeg|svg|gif)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'supabase-images',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
        },
      },
    },
    {
      urlPattern: /^\/api\/.*$/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 5 * 60, // 5 minutes
        },
      },
    },
    {
      urlPattern: /\.(js|css|woff2)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-resources',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        networkTimeoutSeconds: 3,
      },
    },
  ],
  fallbacks: {
    document: '/offline.html',
  },
})(nextConfig);
```

##### 3. Create Offline Fallback
```html
<!-- apps/pwa/public/offline.html -->
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hors ligne - Avocat-AI</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #0B1220;
      color: #fff;
    }
    .container {
      text-align: center;
      max-width: 400px;
      padding: 2rem;
    }
    h1 { margin: 0 0 1rem; }
    p { opacity: 0.8; line-height: 1.6; }
    button {
      margin-top: 2rem;
      padding: 0.75rem 1.5rem;
      background: #fff;
      color: #0B1220;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Vous êtes hors ligne</h1>
    <p>Cette page nécessite une connexion Internet. Veuillez vérifier votre connexion et réessayer.</p>
    <button onclick="window.location.reload()">Réessayer</button>
  </div>
</body>
</html>
```

##### 4. Register Service Worker
```typescript
// apps/pwa/app/layout.tsx (add to root layout)
'use client';

import { useEffect } from 'react';
import { Workbox } from 'workbox-window';

export default function RootLayout({ children }) {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      window.workbox !== undefined
    ) {
      const wb = new Workbox('/sw.js');

      // Listen for updates
      wb.addEventListener('waiting', () => {
        // Show update notification
        if (confirm('Nouvelle version disponible ! Recharger maintenant ?')) {
          wb.addEventListener('controlling', () => {
            window.location.reload();
          });
          wb.messageSkipWaiting();
        }
      });

      wb.register();
    }
  }, []);

  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
```

---

### Update Notification UX - MISSING ❌

**Current State**: No update notification mechanism

**Recommended Implementation**: Toast notification with Sonner

```typescript
// apps/pwa/components/ServiceWorkerUpdate.tsx
'use client';

import { useEffect, useState } from 'react';
import { Workbox } from 'workbox-window';
import { toast } from 'sonner';

export function ServiceWorkerUpdate() {
  const [wb, setWb] = useState<Workbox | null>(null);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      const workbox = new Workbox('/sw.js');

      workbox.addEventListener('waiting', () => {
        toast('Nouvelle version disponible', {
          description: 'Rechargez pour obtenir les dernières fonctionnalités.',
          action: {
            label: 'Recharger',
            onClick: () => {
              workbox.messageSkipWaiting();
              window.location.reload();
            },
          },
          duration: Infinity,
        });
      });

      workbox.register();
      setWb(workbox);
    }
  }, []);

  return null;
}
```

---

### Offline Routing - MISSING ❌

**Recommendation**: Pre-cache critical routes for offline access

```javascript
// apps/pwa/public/sw-custom.js (if using custom service worker)
const CRITICAL_ROUTES = [
  '/',
  '/workspace',
  '/research',
  '/drafting',
  '/hitl',
  '/offline.html',
];

// Pre-cache on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('pages-v1').then((cache) => cache.addAll(CRITICAL_ROUTES))
  );
});
```

---

### Icon Set Audit

**Current Icons**:
- ✅ `/icons/icon-192.svg`
- ✅ `/icons/icon-512.svg`
- ✅ `/icons/maskable.svg`

**Missing Icons**:
- ❌ PNG fallbacks (192x192, 512x512)
- ❌ Apple Touch Icons (180x180)
- ❌ Favicon ICO
- ❌ Shortcut icon PNGs

**Recommended Icon Set**:
```
public/icons/
├── icon-192.png          # Standard icon
├── icon-512.png          # Large icon
├── icon-192.svg          # Vector (existing)
├── icon-512.svg          # Vector (existing)
├── maskable-192.png      # Maskable PNG
├── maskable-512.png      # Maskable PNG
├── maskable.svg          # Maskable SVG (existing)
├── apple-touch-icon.png  # 180x180 for iOS
├── favicon.ico           # 32x32 multi-size ICO
├── favicon-16x16.png
├── favicon-32x32.png
├── shortcut-research.png # PNG versions of shortcuts
├── shortcut-draft.png
└── shortcut-queue.png
```

**Generation Script**:
```javascript
// apps/pwa/scripts/generate-pwa-icons.mjs
import sharp from 'sharp';
import fs from 'fs/promises';

const SOURCE_SVG = './public/icons/icon-512.svg';
const OUTPUT_DIR = './public/icons';

const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 16, name: 'favicon-16x16.png' },
];

for (const { size, name } of sizes) {
  await sharp(SOURCE_SVG)
    .resize(size, size)
    .png()
    .toFile(`${OUTPUT_DIR}/${name}`);
  console.log(`Generated ${name}`);
}

// Generate maskable PNGs with padding
const maskableSizes = [192, 512];
for (const size of maskableSizes) {
  const padding = Math.floor(size * 0.1);
  await sharp(SOURCE_SVG)
    .resize(size - padding * 2, size - padding * 2)
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 11, g: 18, b: 32, alpha: 1 }, // #0B1220
    })
    .png()
    .toFile(`${OUTPUT_DIR}/maskable-${size}.png`);
  console.log(`Generated maskable-${size}.png`);
}
```

---

### iOS Optimization

**Current State**: ⚠️ Incomplete iOS meta tags

**Recommended Meta Tags**:
```html
<!-- apps/pwa/app/layout.tsx -->
<head>
  {/* Standard PWA */}
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#0B1220" />
  
  {/* iOS-specific */}
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Avocat-AI" />
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
  
  {/* iOS Splash Screens (optional, auto-generated by Vercel/Next.js) */}
  <link
    rel="apple-touch-startup-image"
    media="screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)"
    href="/splash/iphone-14-pro-max.png"
  />
  
  {/* Favicon */}
  <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
  <link rel="shortcut icon" href="/favicon.ico" />
</head>
```

**iOS Quirks to Handle**:
1. **Standalone mode detection**:
   ```typescript
   const isIOSStandalone = 
     window.navigator.standalone === true || 
     window.matchMedia('(display-mode: standalone)').matches;
   ```

2. **Safe area insets**:
   ```css
   body {
     padding-top: env(safe-area-inset-top);
     padding-bottom: env(safe-area-inset-bottom);
     padding-left: env(safe-area-inset-left);
     padding-right: env(safe-area-inset-right);
   }
   ```

3. **Disable pull-to-refresh** (conflicts with app gestures):
   ```css
   body {
     overscroll-behavior-y: contain;
   }
   ```

---

## Admin PWA Analysis (apps/web)

### Manifest - MISSING ❌

**Status**: No `manifest.json` in `apps/web/public/`

**Impact**: 
- ❌ Admin console cannot be installed as PWA
- ❌ Poor mobile experience for HITL reviewers
- ❌ No offline capabilities

**Recommended Manifest**:
```json
{
  "name": "Avocat-AI Admin Console",
  "short_name": "Avocat Admin",
  "description": "Console d'administration et de révision HITL pour Avocat-AI Francophone.",
  "start_url": "/dashboard",
  "scope": "/",
  "display": "standalone",
  "orientation": "any",
  "theme_color": "#0B1220",
  "background_color": "#0B1220",
  "lang": "fr",
  "dir": "ltr",
  "categories": ["business", "productivity", "utilities"],
  "icons": [
    { 
      "src": "/icons/admin-192.png", 
      "sizes": "192x192", 
      "type": "image/png" 
    },
    { 
      "src": "/icons/admin-512.png", 
      "sizes": "512x512", 
      "type": "image/png" 
    },
    { 
      "src": "/icons/admin-maskable-512.png", 
      "sizes": "512x512", 
      "type": "image/png", 
      "purpose": "maskable" 
    }
  ],
  "shortcuts": [
    {
      "name": "File HITL",
      "short_name": "Révision",
      "description": "Accéder à la file de révision HITL",
      "url": "/hitl",
      "icons": [
        { "src": "/icons/shortcut-hitl.png", "sizes": "96x96", "type": "image/png" }
      ]
    },
    {
      "name": "Tableau de bord",
      "short_name": "Dashboard",
      "description": "Vue d'ensemble des métriques",
      "url": "/dashboard",
      "icons": [
        { "src": "/icons/shortcut-dashboard.png", "sizes": "96x96", "type": "image/png" }
      ]
    },
    {
      "name": "Paramètres organisation",
      "short_name": "Paramètres",
      "description": "Gérer les paramètres de l'organisation",
      "url": "/settings/org",
      "icons": [
        { "src": "/icons/shortcut-settings.png", "sizes": "96x96", "type": "image/png" }
      ]
    }
  ]
}
```

**Next Steps**:
1. Generate admin-specific icons (different visual to distinguish from public PWA)
2. Add manifest link to `apps/web/app/layout.tsx`
3. Implement service worker (same Workbox setup as public PWA)

---

### Service Worker - MISSING ❌

**Note**: `apps/web/package.json` includes `workbox-window@6.5.4`, suggesting intent to implement service worker

**Current Setup**:
```json
{
  "scripts": {
    "prepare-sw": "node ./scripts/prepare-sw.mjs"
  },
  "dependencies": {
    "workbox-window": "^6.5.4"
  }
}
```

**Check Script**:
```bash
cat apps/web/scripts/prepare-sw.mjs
```

**Recommendation**: Complete service worker implementation similar to public PWA, with adjusted caching strategies for admin workflows.

---

## Core Web Vitals

### Current State

**Monitoring**: ✅ `web-vitals@3.5.2` in `apps/web` dependencies

**Budgets**: ❌ Not configured

**Lighthouse CI**: ❌ Not configured

### Performance Targets

| Metric | Target (Good) | Current | Status |
|--------|---------------|---------|--------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Unknown | ⚠️ Needs measurement |
| **FID/INP** (Interaction to Next Paint) | < 200ms | Unknown | ⚠️ Needs measurement |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Unknown | ⚠️ Needs measurement |
| **FCP** (First Contentful Paint) | < 1.8s | Unknown | ⚠️ Needs measurement |
| **TTFB** (Time to First Byte) | < 600ms | Unknown | ⚠️ Needs measurement |

### Lighthouse CI Configuration

```yaml
# .lighthouserc.yml (root)
ci:
  collect:
    url:
      - 'http://localhost:3000/'
      - 'http://localhost:3000/workspace'
      - 'http://localhost:3000/research'
      - 'http://localhost:3001/dashboard'
      - 'http://localhost:3001/hitl'
    startServerCommand: 'pnpm build && pnpm start'
    numberOfRuns: 3
  assert:
    preset: 'lighthouse:recommended'
    assertions:
      # Performance budgets
      'first-contentful-paint': ['error', { maxNumericValue: 1800 }]
      'largest-contentful-paint': ['error', { maxNumericValue: 2500 }]
      'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }]
      'max-potential-fid': ['error', { maxNumericValue: 130 }]
      'speed-index': ['error', { maxNumericValue: 3400 }]
      'interactive': ['error', { maxNumericValue: 3800 }]
      'total-blocking-time': ['error', { maxNumericValue: 200 }]
      
      # Category scores
      'categories:performance': ['error', { minScore: 0.9 }]
      'categories:accessibility': ['error', { minScore: 0.9 }]
      'categories:best-practices': ['error', { minScore: 0.9 }]
      'categories:seo': ['error', { minScore: 0.9 }]
      'categories:pwa': ['error', { minScore: 0.9 }]
  upload:
    target: 'temporary-public-storage'
```

**CI Integration**:
```yaml
# .github/workflows/lighthouse-ci.yml
name: Lighthouse CI

on:
  pull_request:
    branches: [main, master, work]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 8.15.4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Build apps
        run: pnpm build
      
      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli@0.13.x
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

### Bundle Size Budgets

**Current**: ✅ `apps/pwa` has bundle check script

```json
{
  "scripts": {
    "bundle:check": "node ./scripts/check-bundle-size.mjs"
  }
}
```

**Recommended Budgets**:
```javascript
// apps/pwa/scripts/check-bundle-size.mjs
const BUDGET = {
  'pages/_app.js': 150 * 1024,      // 150 KB
  'pages/workspace.js': 100 * 1024,  // 100 KB
  'pages/research.js': 80 * 1024,    // 80 KB
  'chunks/framework.js': 200 * 1024, // 200 KB (React)
  total: 600 * 1024,                 // 600 KB total
};
```

---

## Background Sync & Notifications

### Background Sync - NOT IMPLEMENTED

**Use Case**: Queue agent runs for execution when online

**Implementation**:
```javascript
// apps/pwa/lib/background-sync.ts
if ('serviceWorker' in navigator && 'SyncManager' in window) {
  // Queue agent run for background sync
  navigator.serviceWorker.ready.then((registration) => {
    registration.sync.register('sync-agent-runs');
  });
}

// In service worker
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-agent-runs') {
    event.waitUntil(syncAgentRuns());
  }
});
```

### Push Notifications - NOT IMPLEMENTED

**Use Case**: Notify reviewers of new HITL tasks

**Priority**: P2 (nice to have, not critical for launch)

**Implementation**: Supabase Edge Functions + Web Push API

---

## Caching Strategy Summary

| Resource Type | Strategy | Cache Name | Max Age | Max Entries |
|---------------|----------|------------|---------|-------------|
| **App Shell** (HTML) | NetworkFirst (3s timeout) | `pages` | - | - |
| **Static Assets** (JS/CSS/Fonts) | CacheFirst | `static-resources` | 30 days | 64 |
| **Images** (Supabase) | StaleWhileRevalidate | `supabase-images` | 7 days | 64 |
| **API Responses** | NetworkFirst (10s timeout) | `api-cache` | 5 min | 32 |
| **Google Fonts** | CacheFirst | `google-fonts` | 1 year | 4 |
| **Offline Fallback** | Precached | - | Forever | - |

---

## Installation Experience

### Current Install Prompt

**Status**: ⚠️ Browser default (Chrome, Edge, Safari)

**Improvement**: Custom install prompt

```typescript
// apps/pwa/components/InstallPrompt.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('PWA installed');
    }

    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  if (!showInstallPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-card p-4 rounded-lg shadow-lg border">
      <h3 className="font-semibold mb-2">Installer Avocat-AI</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Accédez rapidement à Avocat-AI depuis votre écran d'accueil.
      </p>
      <div className="flex gap-2">
        <Button onClick={handleInstall}>Installer</Button>
        <Button variant="ghost" onClick={() => setShowInstallPrompt(false)}>
          Plus tard
        </Button>
      </div>
    </div>
  );
}
```

---

## Accessibility for PWA

### Screen Reader Support

**Requirements**:
- ✅ Semantic HTML (assumed with React/Next.js)
- ⚠️ ARIA labels for dynamic content (needs audit)
- ⚠️ Keyboard navigation (needs testing)
- ⚠️ Focus management in modals (needs testing)

**Automated Testing**:
```yaml
# .github/workflows/a11y-test.yml
name: Accessibility Tests

on: [pull_request]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: pnpm install
      - name: Run axe-core
        run: |
          pnpm --filter @apps/pwa exec axe http://localhost:3000 \
            --save a11y-report.json \
            --exit
```

### Keyboard Navigation

**Critical Paths to Test**:
1. Navigate to research module: `Tab` → `Enter`
2. Fill search form: `Tab` → type → `Enter`
3. Review results: `Arrow keys`
4. Open case details: `Enter`
5. Close modal: `Esc`

**Recommendation**: Add E2E test with `@playwright/test` keyboard simulation.

---

## Storage Quotas

### Current State

**Status**: ⚠️ No quota monitoring

**Risk**: Cache eviction without user awareness

### Recommended Implementation

```typescript
// apps/pwa/lib/storage-quota.ts
export async function checkStorageQuota() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const { usage, quota } = await navigator.storage.estimate();
    const percentUsed = (usage! / quota!) * 100;

    if (percentUsed > 80) {
      // Warn user
      console.warn(`Storage ${percentUsed.toFixed(0)}% full`);
    }

    return { usage, quota, percentUsed };
  }
  return null;
}

// Request persistent storage
export async function requestPersistentStorage() {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    const isPersisted = await navigator.storage.persisted();
    if (!isPersisted) {
      return await navigator.storage.persist();
    }
    return true;
  }
  return false;
}
```

---

## Security Considerations for PWA

### 1. Service Worker Security

**Threats**:
- Service worker hijacking (if not HTTPS)
- Cache poisoning (malicious content in cache)
- XSS via cached scripts

**Mitigations**:
✅ HTTPS enforced by Vercel
✅ Service worker scope limited to `/`
⚠️ Add CSP headers (see security audit)
⚠️ Implement SRI for CDN scripts

### 2. Offline Data Security

**Threat**: Sensitive data cached on device

**Recommendations**:
1. **Exclude sensitive endpoints** from caching:
   ```javascript
   {
     urlPattern: /\/api\/(auth|secrets|keys)\/.*/,
     handler: 'NetworkOnly', // Never cache
   }
   ```

2. **Encrypt cached data**:
   ```typescript
   // Use Web Crypto API for IndexedDB encryption
   async function encryptCaseData(data: CaseData, key: CryptoKey) {
     const encoder = new TextEncoder();
     const dataBuffer = encoder.encode(JSON.stringify(data));
     const encryptedBuffer = await crypto.subtle.encrypt(
       { name: 'AES-GCM', iv: generateIV() },
       key,
       dataBuffer
     );
     return encryptedBuffer;
   }
   ```

3. **Clear cache on logout**:
   ```typescript
   export async function clearAllCaches() {
     const cacheNames = await caches.keys();
     await Promise.all(cacheNames.map((name) => caches.delete(name)));
   }
   ```

---

## Testing Strategy

### Unit Tests
- ✅ Service worker registration logic
- ✅ Cache strategies (mock Service Worker API)
- ✅ Offline detection

### Integration Tests
- ✅ Service worker lifecycle (install, activate, fetch)
- ✅ Background sync
- ✅ Push notification handling

### E2E Tests (Playwright/Cypress)
- ❌ Install flow
- ❌ Offline functionality
- ❌ Update notification
- ❌ Background sync
- ❌ Cache persistence

**Example E2E Test**:
```typescript
// apps/pwa/test/e2e/offline.spec.ts
import { test, expect } from '@playwright/test';

test('works offline', async ({ page, context }) => {
  // Visit page while online
  await page.goto('/workspace');
  await page.waitForLoadState('networkidle');

  // Go offline
  await context.setOffline(true);

  // Navigate to another page
  await page.click('a[href="/research"]');

  // Should load from cache
  await expect(page.locator('h1')).toContainText('Recherche');

  // Go back online
  await context.setOffline(false);
});
```

---

## PWA Checklist

### Public PWA (apps/pwa)

- [ ] **Manifest Improvements**
  - [ ] Add `scope` field
  - [ ] Add PNG icon fallbacks (192, 512)
  - [ ] Add `screenshots` for install prompt
  - [ ] Add `categories`, `lang`, `dir` fields

- [ ] **Service Worker** (P0 - Critical)
  - [ ] Install Workbox
  - [ ] Configure caching strategies
  - [ ] Create offline fallback page
  - [ ] Implement update notification UX
  - [ ] Pre-cache critical routes

- [ ] **Icons** (P1 - High)
  - [ ] Generate PNG icons from SVG
  - [ ] Create maskable PNGs
  - [ ] Add Apple Touch Icon (180x180)
  - [ ] Create favicon.ico and sizes

- [ ] **iOS Optimization** (P2 - Medium)
  - [ ] Add iOS meta tags
  - [ ] Test standalone mode
  - [ ] Implement safe area insets
  - [ ] Disable pull-to-refresh

- [ ] **Performance** (P1 - High)
  - [ ] Configure Lighthouse CI
  - [ ] Set Core Web Vitals budgets
  - [ ] Implement bundle size checks
  - [ ] Add performance monitoring

- [ ] **Testing** (P1 - High)
  - [ ] Add E2E tests for offline
  - [ ] Test install flow
  - [ ] Test update notification
  - [ ] Verify keyboard navigation

### Admin PWA (apps/web)

- [ ] **Manifest** (P0 - Critical)
  - [ ] Create manifest.json
  - [ ] Generate admin-specific icons
  - [ ] Add shortcuts for HITL, dashboard, settings

- [ ] **Service Worker** (P0 - Critical)
  - [ ] Complete prepare-sw.mjs implementation
  - [ ] Configure Workbox for admin workflows
  - [ ] Create offline fallback
  - [ ] Add update notification

- [ ] **Icons** (P1 - High)
  - [ ] Design distinct admin icon set
  - [ ] Generate all required sizes
  - [ ] Add Apple Touch Icon
  - [ ] Create favicons

- [ ] **Performance** (P1 - High)
  - [ ] Include in Lighthouse CI
  - [ ] Set performance budgets
  - [ ] Monitor Core Web Vitals

---

## Priority Action Items

### P0 (Must Fix Before Launch)

1. **Implement Service Worker for Public PWA** (2 days)
   - Install Workbox
   - Configure caching strategies
   - Create offline fallback
   - Test thoroughly

2. **Implement Service Worker for Admin PWA** (2 days)
   - Same as above, tailored for admin workflows

3. **Create Admin PWA Manifest** (2 hours)
   - Write manifest.json
   - Link in layout.tsx

4. **Add Update Notification UX** (4 hours)
   - Implement toast notification
   - Handle service worker updates
   - Test update flow

### P1 (Should Fix Before Launch)

5. **Improve Public PWA Manifest** (2 hours)
   - Add missing fields
   - Generate screenshots
   - Test install prompt

6. **Generate All Required Icons** (1 day)
   - PNG fallbacks
   - Maskable icons
   - Apple Touch Icons
   - Favicons

7. **Configure Lighthouse CI** (4 hours)
   - Create .lighthouserc.yml
   - Add GitHub Action
   - Set performance budgets

8. **iOS Optimization** (1 day)
   - Add meta tags
   - Test on iOS Safari
   - Handle safe areas
   - Test standalone mode

### P2 (Nice to Have)

9. **Background Sync** (1 day)
   - Implement for agent runs
   - Test offline queueing

10. **Storage Quota Monitoring** (4 hours)
    - Implement quota checking
    - Request persistent storage
    - Warn users when quota is low

---

## Verification Commands

```bash
# Build PWAs
pnpm --filter @apps/pwa build
pnpm --filter @avocat-ai/web build

# Test service worker registration
pnpm --filter @apps/pwa dev
# Open http://localhost:3000
# DevTools → Application → Service Workers → Verify "Activated and running"

# Test offline mode
# DevTools → Network → Offline checkbox
# Navigate app, should work offline

# Validate manifest
# DevTools → Application → Manifest → Check for errors

# Run Lighthouse
npx lighthouse http://localhost:3000 \
  --only-categories=pwa,performance,accessibility \
  --view

# Test install flow
# Chrome: DevTools → Application → Manifest → "Add to home screen"
# Safari iOS: Share → "Add to Home Screen"

# Check bundle sizes
pnpm --filter @apps/pwa bundle:check
```

---

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| **PWA Baseline** | 11/11 | Lighthouse PWA audit |
| **Performance** | ≥ 90 | Lighthouse performance score |
| **Accessibility** | ≥ 90 | Lighthouse a11y score |
| **Install Success Rate** | ≥ 80% | Analytics (users who install) |
| **Offline Success Rate** | ≥ 95% | Analytics (successful offline usage) |
| **Update Adoption** | ≥ 90% in 48h | Analytics (users on latest version) |

---

**End of PWA Hardening Audit**

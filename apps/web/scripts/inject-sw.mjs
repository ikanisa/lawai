import { injectManifest } from 'workbox-build';
import { rm } from 'node:fs/promises';

async function main() {
  try {
    const { count, size, warnings } = await injectManifest({
      swSrc: 'public/sw.tmp.js',
      swDest: 'public/sw.js',
      globDirectory: '.next',
      globPatterns: [
        'app/**/*.{js,css,html}',
        'server/app/**/*.{js,html}',
        'server/chunks/**/*.{js,html}',
        'server/flight-manifest.json',
        'server/app-build-manifest.json',
        'static/**/*.{js,css,html,ico,png,svg,webp,woff2,json}',
        'build-manifest.json',
        'prerender-manifest.json',
      ],
      globIgnores: ['**/node_modules/**/*', '**/*.map'],
      maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      manifestTransforms: [
        async (entries) => ({
          manifest: entries.map((entry) => ({
            ...entry,
            url: entry.url.replace(/^\.next\//, ''),
          })),
          warnings: [],
        }),
      ],
    });

    warnings.forEach((warning) => console.warn('[workbox]', warning));
    console.log(`[workbox] injected ${count} files (${size} bytes) into service worker`);
    await rm('public/sw.tmp.js', { force: true });
  } catch (error) {
    console.error('[workbox] injectManifest failed', error);
    process.exitCode = 1;
  }
}

void main();

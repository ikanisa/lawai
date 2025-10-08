import { injectManifest } from 'workbox-build';

async function main() {
  try {
    const { count, size, warnings } = await injectManifest({
      swSrc: 'public/sw-template.js',
      swDest: 'public/sw.js',
      globDirectory: '.next',
      globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,json}'],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    });

    warnings.forEach((warning) => console.warn('[workbox]', warning));
    console.log(`[workbox] injected ${count} files (${size} bytes) into service worker`);
  } catch (error) {
    console.error('[workbox] injectManifest failed', error);
    process.exitCode = 1;
  }
}

void main();

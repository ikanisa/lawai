import { build } from 'esbuild';
import { resolve } from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import { injectManifest } from 'workbox-build';

async function main() {
  try {
    const entryPoint = resolve('src', 'service-worker', 'sw.ts');
    const intermediate = resolve('.next', 'sw-temp.js');
    const swDest = resolve('public', 'sw.js');

    await mkdir(resolve('.next'), { recursive: true });

    await build({
      entryPoints: [entryPoint],
      outfile: intermediate,
      bundle: true,
      format: 'esm',
      target: ['es2022'],
      platform: 'browser',
      sourcemap: true,
      logLevel: 'info',
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
      },
    });

    const { count, size, warnings } = await injectManifest({
      swSrc: intermediate,
      swDest,
      globDirectory: 'public',
      globPatterns: ['**/*.{js,css,html,svg,json,webmanifest}'],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    });

    if (warnings.length) {
      warnings.forEach((warning) => console.warn('[staff-pwa] workbox warning', warning));
    }

    await rm(intermediate, { force: true });

    console.log(`[staff-pwa] precached ${count} assets (${size} bytes)`);
  } catch (error) {
    console.error('[staff-pwa] failed to build service worker', error);
    process.exitCode = 1;
  }
}

void main();

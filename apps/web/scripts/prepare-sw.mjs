import { build } from 'esbuild';
import { resolve } from 'node:path';

async function main() {
  try {
    const entryPoint = resolve('src', 'service-worker', 'sw.ts');
    const outfile = resolve('public', 'sw.js');
    await build({
      entryPoints: [entryPoint],
      outfile,
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
    console.log('[pwa] service worker built to public/sw.js');
  } catch (error) {
    console.error('[pwa] failed to build service worker', error);
    process.exitCode = 1;
  }
}

void main();

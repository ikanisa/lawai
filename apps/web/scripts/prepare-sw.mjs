import { build } from 'esbuild';
import { resolve } from 'node:path';
import { mkdir, copyFile } from 'node:fs/promises';

async function main() {
  try {
    const entryPoint = resolve('src', 'service-worker', 'sw.ts');
    const publicDir = resolve('public');
    await mkdir(publicDir, { recursive: true });
    const outfile = resolve(publicDir, 'sw.tmp.js');
    await build({
      entryPoints: [entryPoint],
      outfile,
      bundle: true,
      format: 'esm',
      target: ['es2022'],
      platform: 'browser',
      sourcemap: process.env.NODE_ENV !== 'production',
      minify: process.env.NODE_ENV === 'production',
      logLevel: 'info',
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
      },
    });
    await copyFile(outfile, resolve(publicDir, 'sw.js'));
    console.log('[pwa] service worker bundle created at public/sw.tmp.js');
  } catch (error) {
    console.error('[pwa] failed to build service worker', error);
    process.exitCode = 1;
  }
}

void main();

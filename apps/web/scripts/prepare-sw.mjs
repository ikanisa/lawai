import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const templatePath = resolve('public', 'sw-template.js');
const outputPath = resolve('public', 'sw.js');

async function main() {
  try {
    const contents = await readFile(templatePath, 'utf8');
    await writeFile(outputPath, contents);
    console.log('[pwa] service worker template copied to public/sw.js');
  } catch (error) {
    console.error('[pwa] failed to prepare service worker', error);
    process.exitCode = 1;
  }
}

void main();

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const iconsDir = join(__dirname, '..', 'public', 'icons');
const svgPath = join(iconsDir, 'logo.svg');
const sizes = [192, 512];

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function generate() {
  const svg = await readFile(svgPath);
  await ensureDir(iconsDir);

  await Promise.all(
    sizes.map(async (size) => {
      const outputPath = join(iconsDir, `icon-${size}.png`);
      const buffer = await sharp(svg)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9 })
        .toBuffer();

      await writeFile(outputPath, buffer);
      console.log(`Generated ${outputPath}`);
    })
  );
}

generate().catch((error) => {
  console.error('Failed to generate icons', error);
  process.exitCode = 1;
});

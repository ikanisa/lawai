#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { extname } from 'node:path';

const bannedExtensions = new Map([
  ['.png', 'PNG images are considered binary assets.'],
  ['.jpg', 'JPEG images are considered binary assets.'],
  ['.jpeg', 'JPEG images are considered binary assets.'],
  ['.gif', 'GIF images are considered binary assets.'],
  ['.bmp', 'Bitmap images are considered binary assets.'],
  ['.ico', 'Icon files should be generated from SVG sources.'],
  ['.pdf', 'PDF files should not be committed.'],
  ['.zip', 'Archives must not be committed.'],
  ['.tar', 'Archives must not be committed.'],
  ['.gz', 'Compressed archives must not be committed.'],
  ['.tgz', 'Compressed archives must not be committed.'],
  ['.rar', 'Archives must not be committed.'],
  ['.7z', 'Archives must not be committed.'],
  ['.mp3', 'Audio assets must not be committed.'],
  ['.mp4', 'Video assets must not be committed.'],
  ['.mov', 'Video assets must not be committed.'],
]);

function listTrackedFiles() {
  const raw = execSync('git ls-files -z', { encoding: 'buffer' });
  return raw
    .toString('utf8')
    .split('\0')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function findBinaries(files) {
  const offenders = [];
  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (bannedExtensions.has(ext)) {
      offenders.push({ file, reason: bannedExtensions.get(ext) });
    }
  }
  return offenders;
}

function main() {
  const files = listTrackedFiles();
  const offenders = findBinaries(files);
  if (offenders.length === 0) {
    console.log('✅ No disallowed binary assets detected in the Git index.');
    return;
  }

  console.error('\n⛔ Binary assets detected (PRs with these files will be rejected):');
  for (const offender of offenders) {
    console.error(` • ${offender.file} → ${offender.reason}`);
  }
  console.error('\nRemove the files above or replace them with supported text-based alternatives (e.g. SVG sources) before creating the PR.');
  process.exitCode = 1;
}

main();

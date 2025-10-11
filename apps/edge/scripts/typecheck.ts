import { fromFileUrl, join } from 'https://deno.land/std@0.224.0/path/mod.ts';

const rootDir = fromFileUrl(new URL('../', import.meta.url));

async function listEntrypoints(): Promise<string[]> {
  const entries: string[] = [];
  for await (const item of Deno.readDir(rootDir)) {
    if (!item.isDirectory) {
      continue;
    }
    if (item.name === 'scripts') {
      continue;
    }
    const relativeIndex = join(item.name, 'index.ts');
    const indexPath = join(rootDir, relativeIndex);
    try {
      const stat = await Deno.stat(indexPath);
      if (stat.isFile) {
        entries.push(relativeIndex.replaceAll('\\', '/'));
      }
    } catch {
      // ignore missing index.ts files
    }
  }
  return entries.sort();
}

async function main(): Promise<void> {
  const entrypoints = await listEntrypoints();
  if (entrypoints.length === 0) {
    console.log('No edge worker entrypoints discovered.');
    return;
  }

  const command = new Deno.Command(Deno.execPath(), {
    args: ['check', ...entrypoints],
    cwd: rootDir,
    stdout: 'piped',
    stderr: 'piped',
  });

  const { code, stdout, stderr } = await command.output();
  if (stdout.length > 0) {
    await Deno.stdout.write(stdout);
  }
  if (stderr.length > 0) {
    await Deno.stderr.write(stderr);
  }
  if (code !== 0) {
    Deno.exit(code);
  }
}

await main();

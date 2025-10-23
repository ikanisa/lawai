import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../..');

export default async function globalSetup() {
  const scriptPath = path.resolve(repoRoot, 'scripts/seed-compliance-test-data.mjs');

  try {
    await execFileAsync('node', [scriptPath], {
      cwd: repoRoot,
      env: { ...process.env },
    });
  } catch (error) {
    const execError = error as Error & { stderr?: string };
    const details = execError.stderr ? `\n${execError.stderr}` : '';
    throw new Error(`Failed to seed compliance data before tests: ${execError.message}${details}`);
  }
}

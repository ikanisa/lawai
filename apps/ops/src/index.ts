#!/usr/bin/env node
import { runOpsCli } from './lib/cli.js';

if (import.meta.url === `file://${process.argv[1]}`) {
  const code = await runOpsCli(process.argv.slice(2));
  if (code !== 0) {
    process.exitCode = code;
  }
}

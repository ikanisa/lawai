#!/usr/bin/env node
import { spawn } from 'node:child_process';
import process from 'node:process';

let loadServerEnv;
let sharedSupabaseSchema;
let sharedOpenAiSchema;
try {
  ({ loadServerEnv, sharedSupabaseSchema, sharedOpenAiSchema } = await import(
    '@avocat-ai/shared/config/env'
  ));
} catch (error) {
  console.error('❌ Unable to load shared environment schema from @avocat-ai/shared/config/env');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const productionEnvSchema = sharedSupabaseSchema.extend({
  OPENAI_API_KEY: sharedOpenAiSchema.shape.OPENAI_API_KEY,
});

const PRODUCTION_CRITICAL_KEYS = {
  SUPABASE_URL: 'Supabase project URL used by production services',
  SUPABASE_SERVICE_ROLE_KEY: 'Supabase service role key required for server actions and migrations',
  OPENAI_API_KEY: 'OpenAI API key used by orchestrators and background jobs',
};

const GENERIC_PLACEHOLDERS = [
  /^\s*$/,
  /^null$/i,
  /^undefined$/i,
  /placeholder/i,
  /changeme/i,
  /example/i,
  /dummy/i,
  /sample/i,
  /^todo$/i,
];

const KEY_SPECIFIC_PLACEHOLDERS = {
  SUPABASE_URL: [/localhost/i, /https:\/\/(example|project)\.supabase\.co/i, /YOUR_/i],
  SUPABASE_SERVICE_ROLE_KEY: [/service[-_]?role[-_]?test/i],
  OPENAI_API_KEY: [/^sk-(test|demo|example|placeholder|dummy|sample)/i],
};

function isPlaceholder(key, value) {
  if (typeof value !== 'string') {
    return true;
  }

  if (GENERIC_PLACEHOLDERS.some((pattern) => pattern.test(value))) {
    return true;
  }

  const keyPatterns = KEY_SPECIFIC_PLACEHOLDERS[key];
  if (keyPatterns && keyPatterns.some((pattern) => pattern.test(value))) {
    return true;
  }

  return false;
}

function formatIssues(issues) {
  return issues.map((issue) => `  - ${issue}`).join('\n');
}

async function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        const reason =
          code !== null ? `exit code ${code}` : signal ? `signal ${signal}` : 'unknown failure';
        reject(new Error(`Command \`${command} ${args.join(' ')}\` failed with ${reason}`));
      }
    });
  });
}

async function validateEnvironment() {
  try {
    const parsed = loadServerEnv(productionEnvSchema, {
      dotenv: process.env.NODE_ENV !== 'production',
    });

    const issues = [];

    for (const [key, description] of Object.entries(PRODUCTION_CRITICAL_KEYS)) {
      const value = parsed[key];
      if (isPlaceholder(key, value)) {
        issues.push(`${key} (${description}) is missing or still a placeholder.`);
      }
    }

    if (issues.length > 0) {
      throw new Error(`Production secrets check failed:\n${formatIssues(issues)}`);
    }

    console.log('✅ Production secrets validated.');
  } catch (error) {
    if (error instanceof Error && 'issues' in error) {
      console.error('❌ Environment schema validation failed.');
      console.error(error.toString());
    } else if (error instanceof Error) {
      console.error('❌ Environment validation failed.');
      console.error(error.message);
    } else {
      console.error('❌ Environment validation failed with an unknown error.');
      console.error(error);
    }
    process.exit(1);
  }
}

async function main() {
  console.log('🔍 Running deployment preflight checks...');

  await validateEnvironment();

  const steps = [
    { label: 'pnpm install --frozen-lockfile', command: 'pnpm', args: ['install', '--frozen-lockfile'] },
    { label: 'pnpm lint', command: 'pnpm', args: ['lint'] },
    { label: 'pnpm typecheck', command: 'pnpm', args: ['typecheck'] },
    { label: 'pnpm build', command: 'pnpm', args: ['build'] },
  ];

  for (const step of steps) {
    console.log(`▶️  ${step.label}`);
    try {
      await runCommand(step.command, step.args);
    } catch (error) {
      console.error(`❌ ${step.label} failed.`);
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  console.log('🎉 Deployment preflight passed.');
}

main().catch((error) => {
  console.error('❌ Unexpected error during deployment preflight.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});

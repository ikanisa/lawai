import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000000';
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000';
const DEFAULT_VERSION = '2024.09';

function resolveRootDir() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, '..');
}

function loadEnvFiles() {
  const rootDir = resolveRootDir();
  const candidates = [
    path.join(rootDir, '.env.test.local'),
    path.join(rootDir, '.env.test'),
    path.join(rootDir, '.env.local'),
    path.join(rootDir, '.env'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      loadEnv({ path: candidate });
    }
  }
}

function assertEnv(value, key) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export async function seedComplianceTestData(options = {}) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    loadEnvFiles();
  }
  const {
    supabaseUrl = process.env.SUPABASE_URL,
    supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
    orgId = process.env.E2E_ORG_ID ?? DEFAULT_ORG_ID,
    userId = process.env.E2E_USER_ID ?? DEFAULT_USER_ID,
    consentVersion = process.env.E2E_CONSENT_VERSION ?? DEFAULT_VERSION,
    councilVersion = process.env.E2E_COE_VERSION ?? DEFAULT_VERSION,
    orgName = process.env.E2E_ORG_NAME ?? 'Compliance E2E Workspace',
  } = options;

  assertEnv(supabaseUrl, 'SUPABASE_URL');
  assertEnv(supabaseServiceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const [{ error: orgError }] = await Promise.all([
    supabase.from('organizations').upsert(
      { id: orgId, name: orgName },
      { onConflict: 'id' },
    ),
  ]);

  if (orgError) {
    throw new Error(`Failed to upsert organization: ${orgError.message}`);
  }

  const { error: memberError } = await supabase.from('org_members').upsert(
    { org_id: orgId, user_id: userId, role: 'admin' },
    { onConflict: 'org_id,user_id' },
  );

  if (memberError) {
    throw new Error(`Failed to upsert org member: ${memberError.message}`);
  }

  const policies = [
    {
      org_id: orgId,
      key: 'ai_assist_consent_version',
      value: { version: consentVersion, type: 'ai_assist' },
    },
    {
      org_id: orgId,
      key: 'coe_ai_framework_version',
      value: { version: councilVersion },
    },
  ];

  const { error: policiesError } = await supabase
    .from('org_policies')
    .upsert(policies, { onConflict: 'org_id,key' });

  if (policiesError) {
    throw new Error(`Failed to upsert compliance policies: ${policiesError.message}`);
  }

  const consentTypes = ['ai_assist', 'council_of_europe_disclosure'];

  const { error: deleteOrgEventsError } = await supabase
    .from('consent_events')
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .in('consent_type', consentTypes);

  if (deleteOrgEventsError) {
    throw new Error(`Failed to delete existing org consent events: ${deleteOrgEventsError.message}`);
  }

  const { error: deleteGlobalEventsError } = await supabase
    .from('consent_events')
    .delete()
    .is('org_id', null)
    .eq('user_id', userId)
    .in('consent_type', consentTypes);

  if (deleteGlobalEventsError) {
    throw new Error(`Failed to delete existing global consent events: ${deleteGlobalEventsError.message}`);
  }

  return { orgId, userId, consentVersion, councilVersion };
}

async function runCli() {
  loadEnvFiles();
  try {
    const result = await seedComplianceTestData();
    console.log(
      `Seeded compliance test data for org ${result.orgId} / user ${result.userId} (consent ${result.consentVersion}, council ${result.councilVersion}).`,
    );
  } catch (error) {
    console.error('Failed to seed compliance test data:', error);
    process.exitCode = 1;
  }
}

const isCli = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
})();

if (isCli) {
  await runCli();
}

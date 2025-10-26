#!/usr/bin/env node
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('seed-acknowledgements: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000000';
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';
const CONSENT_VERSION = process.env.ACK_TEST_CONSENT_VERSION ?? '2024-06-01';
const COE_VERSION = process.env.ACK_TEST_COE_VERSION ?? '2024-05-15';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  await ensureOrg();
  await ensureMembership();
  await ensurePolicies();
  await resetAcknowledgements();
  console.log('seed-acknowledgements: compliance data prepared');
}

async function ensureOrg() {
  const { error } = await supabase.from('organizations').upsert(
    { id: DEMO_ORG_ID, name: 'Acknowledgement Demo Org' },
    { onConflict: 'id' },
  );
  if (error) {
    console.error('seed-acknowledgements: failed to upsert organization', error);
    throw error;
  }
}

async function ensureMembership() {
  const { error } = await supabase.from('org_members').upsert(
    { org_id: DEMO_ORG_ID, user_id: DEMO_USER_ID, role: 'owner' },
    { onConflict: 'org_id,user_id' },
  );
  if (error) {
    console.error('seed-acknowledgements: failed to upsert membership', error);
    throw error;
  }
}

async function ensurePolicies() {
  const policies = [
    {
      org_id: DEMO_ORG_ID,
      key: 'ai_assist_consent_version',
      value: { type: 'ai_assist', version: CONSENT_VERSION },
    },
    {
      org_id: DEMO_ORG_ID,
      key: 'coe_ai_framework_version',
      value: { version: COE_VERSION },
    },
  ];

  const { error } = await supabase.from('org_policies').upsert(policies, { onConflict: 'org_id,key' });
  if (error) {
    console.error('seed-acknowledgements: failed to upsert policies', error);
    throw error;
  }
}

async function resetAcknowledgements() {
  const { error } = await supabase
    .from('consent_events')
    .delete()
    .eq('org_id', DEMO_ORG_ID)
    .eq('user_id', DEMO_USER_ID)
    .in('consent_type', ['ai_assist', 'council_of_europe_disclosure']);
  if (error) {
    console.error('seed-acknowledgements: failed to clear consent events', error);
    throw error;
  }
}

main().catch((error) => {
  console.error('seed-acknowledgements: seeding failed', error);
  process.exit(1);
});

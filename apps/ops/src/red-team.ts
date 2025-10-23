#!/usr/bin/env node
import ora from 'ora';
import { createSupabaseService } from './lib/supabase.js';
import { requireEnv } from './lib/env.js';
import { assessScenario, summariseAssessment } from './lib/red-team.js';
import { DEFAULT_RED_TEAM_SCENARIOS } from './red-team/scenarios.js';
import { createRestClient, type RestApiClient } from '@avocat-ai/api-clients';
import type { RedTeamScenario } from './lib/red-team.js';
import type { IRACPayload } from '@avocat-ai/shared';

interface CliOptions {
  orgId: string;
  userId: string;
  apiBaseUrl: string;
  dryRun: boolean;
  scenarioKeys?: string[];
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    orgId: process.env.RED_TEAM_ORG_ID ?? '00000000-0000-0000-0000-000000000000',
    userId: process.env.RED_TEAM_USER_ID ?? '00000000-0000-0000-0000-000000000000',
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
    dryRun: false,
    scenarioKeys: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--org':
        options.orgId = args[index + 1] ?? options.orgId;
        index += 1;
        break;
      case '--user':
        options.userId = args[index + 1] ?? options.userId;
        index += 1;
        break;
      case '--api':
        options.apiBaseUrl = args[index + 1] ?? options.apiBaseUrl;
        index += 1;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--scenario':
        options.scenarioKeys = options.scenarioKeys ?? [];
        options.scenarioKeys.push(args[index + 1] ?? '');
        index += 1;
        break;
      default:
        break;
    }
  }

  return options;
}

function selectScenarios(keys: string[] | undefined): RedTeamScenario[] {
  if (!keys || keys.length === 0) {
    return DEFAULT_RED_TEAM_SCENARIOS;
  }
  const normalized = new Set(keys.map((key) => key.trim().toLowerCase()));
  return DEFAULT_RED_TEAM_SCENARIOS.filter((scenario) => normalized.has(scenario.key.toLowerCase()));
}

async function executeScenario(
  scenario: RedTeamScenario,
  options: CliOptions,
  api: RestApiClient,
): Promise<{ payload: IRACPayload; assessmentSummary: string; passed: boolean; observed: string; notes: string[] }>
{
  const result = await api.submitResearchQuestion({
    question: scenario.prompt,
    orgId: options.orgId,
    userId: options.userId,
  });

  const payload = result.data;
  const assessment = assessScenario(payload, scenario);
  return {
    payload,
    assessmentSummary: summariseAssessment(scenario, assessment),
    passed: assessment.passed,
    observed: assessment.observedOutcome,
    notes: assessment.notes,
  };
}

async function recordFinding(
  supabaseUrl: string,
  serviceRoleKey: string,
  orgId: string,
  userId: string,
  scenario: RedTeamScenario,
  observedOutcome: string,
  passed: boolean,
  notes: string[],
  payload: IRACPayload,
): Promise<void> {
  const client = createSupabaseService({
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  });

  const insertPayload = {
    org_id: orgId,
    scenario_key: scenario.key,
    severity: scenario.severity,
    expected_outcome: scenario.expectation,
    observed_outcome: observedOutcome,
    passed,
    summary: scenario.title,
    detail: {
      guidance: scenario.guidance,
      notes,
      payload,
    },
    mitigations: notes.length > 0 ? notes.join(' ') : null,
    status: passed ? 'resolved' : 'open',
    created_by: userId,
    updated_at: new Date().toISOString(),
    resolved_at: passed ? new Date().toISOString() : null,
    resolved_by: passed ? userId : null,
  };

  const { error } = await client.from('red_team_findings').insert(insertPayload);
  if (error) {
    throw new Error(`Impossible d'enregistrer le résultat red-team: ${error.message}`);
  }
}

async function run(): Promise<void> {
  const options = parseArgs();
  const spinner = ora('Exécution des scénarios red-team...').start();

  const scenarios = selectScenarios(options.scenarioKeys);
  if (scenarios.length === 0) {
    spinner.stop();
    console.log('Aucun scénario à exécuter.');
    return;
  }

  const env = options.dryRun ? null : requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  const api = createRestClient({ baseUrl: options.apiBaseUrl });

  const results: Array<{ key: string; status: string; severity: string }> = [];
  try {
    for (const scenario of scenarios) {
      spinner.text = `Scénario ${scenario.key}...`;
      const { assessmentSummary, payload, passed, observed, notes } = await executeScenario(scenario, options, api);
      results.push({ key: scenario.key, status: passed ? 'PASS' : 'FAIL', severity: scenario.severity });
      spinner.info(assessmentSummary);

      if (!options.dryRun && env) {
        await recordFinding(
          env.SUPABASE_URL,
          env.SUPABASE_SERVICE_ROLE_KEY,
          options.orgId,
          options.userId,
          scenario,
          observed,
          passed,
          notes,
          payload,
        );
      }
    }
    spinner.succeed('Scénarios red-team terminés');
  } catch (error) {
    spinner.fail(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }

  console.table(results);
}

run();

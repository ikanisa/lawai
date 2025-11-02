import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import type {
  ClauseDetectionScenario,
  HallucinationScenario,
  KernelEvaluationScenario,
  RedliningScenario,
} from './types.js';

interface SuiteResult {
  suite: string;
  passed: boolean;
  details: string[];
}

const dirname = path.dirname(fileURLToPath(import.meta.url));
const evalRoot = path.resolve(dirname, '../../evals');

async function loadSuites(): Promise<KernelEvaluationScenario[]> {
  const files = await readdir(evalRoot);
  const suites: KernelEvaluationScenario[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }
    const raw = await readFile(path.join(evalRoot, file), 'utf8');
    suites.push(JSON.parse(raw) as KernelEvaluationScenario);
  }
  return suites;
}

function evaluateClauseDetection(suite: ClauseDetectionScenario[]): SuiteResult {
  const details: string[] = [];
  let passed = true;
  for (const scenario of suite) {
    const document = scenario.document.toLowerCase();
    const found = scenario.clauses
      .filter((clause) => document.includes(clause.trigger.toLowerCase()))
      .map((clause) => clause.name);
    const missing = scenario.expected.filter((item) => !found.includes(item));
    const unexpected = found.filter((item) => !scenario.expected.includes(item));
    if (missing.length || unexpected.length) {
      passed = false;
      details.push(
        `Scenario ${scenario.id} failed (missing=${missing.join(',') || 'none'}, unexpected=${unexpected.join(',') || 'none'})`,
      );
    }
  }
  return { suite: 'clause_detection', passed, details };
}

function evaluateRedlining(suite: RedliningScenario[]): SuiteResult {
  const details: string[] = [];
  let passed = true;
  for (const scenario of suite) {
    const normalizedOriginal = scenario.original.toLowerCase();
    const normalizedRevised = scenario.revised.toLowerCase();
    const missingRemovals = scenario.expectedRemoved.filter(
      (phrase) => !normalizedOriginal.includes(phrase.toLowerCase()) || normalizedRevised.includes(phrase.toLowerCase()),
    );
    const missingAdditions = scenario.expectedAdded.filter(
      (phrase) => !normalizedRevised.includes(phrase.toLowerCase()) || normalizedOriginal.includes(phrase.toLowerCase()),
    );
    if (missingRemovals.length || missingAdditions.length) {
      passed = false;
      details.push(
        `Scenario ${scenario.id} failed (removals=${missingRemovals.join(',') || 'none'}, additions=${missingAdditions.join(',') || 'none'})`,
      );
    }
  }
  return { suite: 'redlining', passed, details };
}

function evaluateHallucinations(suite: HallucinationScenario[]): SuiteResult {
  const details: string[] = [];
  let passed = true;
  for (const scenario of suite) {
    const responseLower = scenario.response.toLowerCase();
    const violations = scenario.disallowedPhrases.filter((phrase) => responseLower.includes(phrase.toLowerCase()));
    if (violations.length) {
      passed = false;
      details.push(`Scenario ${scenario.id} failed (hallucinations=${violations.join(',')})`);
    }
    const factMismatches = scenario.facts.filter((fact) => !responseLower.includes(fact.toLowerCase()));
    if (factMismatches.length) {
      passed = false;
      details.push(`Scenario ${scenario.id} missing factual references (${factMismatches.join(',')})`);
    }
  }
  return { suite: 'hallucination', passed, details };
}

async function main(): Promise<void> {
  const suites = await loadSuites();
  const results: SuiteResult[] = [];

  for (const suite of suites) {
    switch (suite.suite) {
      case 'clause_detection':
        results.push(evaluateClauseDetection(suite.scenarios as ClauseDetectionScenario[]));
        break;
      case 'redlining':
        results.push(evaluateRedlining(suite.scenarios as RedliningScenario[]));
        break;
      case 'hallucination':
        results.push(evaluateHallucinations(suite.scenarios as HallucinationScenario[]));
        break;
      default:
        results.push({ suite: suite.suite, passed: false, details: [`Unknown suite type: ${suite.suite}`] });
    }
  }

  let exitCode = 0;
  for (const result of results) {
    if (result.passed) {
      console.log(`✅ ${result.suite} suite passed`);
    } else {
      exitCode = 1;
      console.error(`❌ ${result.suite} suite failed`);
      for (const detail of result.details) {
        console.error(`   - ${detail}`);
      }
    }
  }

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

main().catch((error) => {
  console.error('❌ Evaluation suite encountered an error', error);
  process.exit(1);
});

#!/usr/bin/env node
import ora from 'ora';
import { requireEnv } from './lib/env.js';
import { createSupabaseService } from './lib/supabase.js';
import {
  summariseGoNoGo,
  evaluateGoNoGoReadiness,
  type EvidenceRow,
  type SignoffRow,
  type FriaArtifactRow,
} from './lib/go-no-go.js';

function parseArgs(argv: string[]): { orgId: string | null; releaseTag?: string; requireGo: boolean } {
  let orgId: string | null = process.env.OPS_ORG_ID ?? null;
  let releaseTag: string | undefined;
  let requireGo = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--org' || token === '-o') {
      orgId = argv[index + 1] ?? null;
      index += 1;
    } else if (token === '--release' || token === '-r') {
      releaseTag = argv[index + 1];
      index += 1;
    } else if (token === '--require-go') {
      requireGo = true;
    }
  }

  return { orgId, releaseTag, requireGo };
}

async function main(): Promise<void> {
  const { orgId, releaseTag, requireGo } = parseArgs(process.argv.slice(2));
  if (!orgId) {
    console.error('✗ Veuillez préciser un identifiant d\'organisation via --org ou OPS_ORG_ID.');
    process.exit(1);
    return;
  }

  const env = requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  const client = createSupabaseService(env);
  const spinner = ora(`Collecte des éléments Go / No-Go pour ${orgId}...`).start();

  const [
    { data: evidence, error: evidenceError },
    { data: signoffs, error: signoffError },
    { data: friaArtifacts, error: friaError },
  ] = await Promise.all([
    client
      .from('go_no_go_evidence')
      .select('section, status, criterion')
      .eq('org_id', orgId),
    client
      .from('go_no_go_signoffs')
      .select('release_tag, decision, decided_at, evidence_total')
      .eq('org_id', orgId)
      .order('decided_at', { ascending: false }),
    client
      .from('fria_artifacts')
      .select('release_tag, validated')
      .eq('org_id', orgId),
  ]);

  if (evidenceError || signoffError || friaError) {
    spinner.fail('Impossible de récupérer les éléments Go / No-Go.');
    if (evidenceError) {
      console.error(`  - Evidence: ${evidenceError.message}`);
    }
    if (signoffError) {
      console.error(`  - Signoffs: ${signoffError.message}`);
    }
    if (friaError) {
      console.error(`  - FRIA: ${friaError.message}`);
    }
    process.exit(1);
    return;
  }

  spinner.succeed('Éléments Go / No-Go collectés.');

  const summary = summariseGoNoGo(evidence as EvidenceRow[] | null, signoffs as SignoffRow[] | null);
  const readiness = evaluateGoNoGoReadiness(
    summary,
    releaseTag,
    requireGo,
    friaArtifacts as FriaArtifactRow[] | null,
  );

  console.log('\nSections (satisfaites / total) :');
  for (const section of summary.sections) {
    console.log(`  - ${section.section}: ${section.satisfied}/${section.total} satisfaites (${section.pending} en attente)`);
  }

  if ((friaArtifacts ?? []).length > 0) {
    const validatedCount = (friaArtifacts as FriaArtifactRow[]).filter((row) => row?.validated).length;
    console.log(`\nArtefacts FRIA enregistrés : ${validatedCount}/${(friaArtifacts ?? []).length} validés.`);
  } else {
    console.log('\nAucun artefact FRIA enregistré.');
  }

  if (summary.signoffs.length > 0) {
    console.log('\nSignatures Go / No-Go enregistrées :');
    for (const signoff of summary.signoffs) {
      console.log(
        `  - ${signoff.releaseTag} · décision=${signoff.decision} · date=${signoff.decidedAt} · preuves=${signoff.evidenceTotal}`,
      );
    }
  } else {
    console.log('\nAucune signature Go / No-Go enregistrée.');
  }

  if (readiness.missingSections.length > 0) {
    console.log('\nSections sans preuve satisfaite :', readiness.missingSections.join(', '));
  }

  if (!readiness.friaSatisfied) {
    console.log('\nFRIA manquante pour la fenêtre de publication ciblée.');
  }

  if (readiness.decision) {
    console.log(`\nDernière décision : ${readiness.decision.decision.toUpperCase()} (${readiness.decision.releaseTag}).`);
  } else {
    console.log('\nAucune décision Go / No-Go applicable trouvée.');
  }

  if (!readiness.ready) {
    process.exitCode = 1;
    console.error('\n✗ Le checklist Go / No-Go n\'est pas complet (FRIA ou sections manquantes).');
  } else {
    console.log('\n✓ Checklist Go / No-Go complétée.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

/**
 * Release tools for Go/No-Go checklist verification
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpEnv } from '../env.js';
import { createSupabaseClient } from '../supabase.js';

interface EvidenceRow {
    section: string;
    status: string;
    criterion: string;
}

interface SignoffRow {
    release_tag: string;
    decision: string;
    decided_at: string;
    evidence_total: number;
}

interface FriaArtifactRow {
    release_tag: string;
    validated: boolean;
}

const ALL_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const goNoGoSchema = {
    orgId: z.string().uuid().describe('Organization ID'),
    releaseTag: z.string().optional().describe('Target release tag (e.g., rc-2024-09)'),
};

function summariseGoNoGo(
    evidence: EvidenceRow[] | null,
    signoffs: SignoffRow[] | null,
    friaArtifacts: FriaArtifactRow[] | null
) {
    const sections = ALL_SECTIONS.map((section) => {
        const sectionEvidence = (evidence ?? []).filter((e) => e.section === section);
        const satisfied = sectionEvidence.filter((e) => e.status === 'satisfied').length;
        const pending = sectionEvidence.filter((e) => e.status === 'pending').length;
        return {
            section,
            total: sectionEvidence.length,
            satisfied,
            pending,
            isSatisfied: sectionEvidence.length > 0 && satisfied === sectionEvidence.length,
        };
    });

    const signoffList = (signoffs ?? []).map((s) => ({
        releaseTag: s.release_tag,
        decision: s.decision,
        decidedAt: s.decided_at,
        evidenceTotal: s.evidence_total,
    }));

    const friaValidated = (friaArtifacts ?? []).filter((f) => f.validated);

    return {
        sections,
        signoffs: signoffList,
        friaValidatedCount: friaValidated.length,
        friaTotal: (friaArtifacts ?? []).length,
    };
}

function evaluateReadiness(
    summary: ReturnType<typeof summariseGoNoGo>,
    releaseTag?: string
) {
    const missingSections = summary.sections
        .filter((s) => !s.isSatisfied)
        .map((s) => s.section);

    const hasAllSections = missingSections.length === 0;
    const friaSatisfied = summary.friaValidatedCount > 0;

    const applicableSignoff = summary.signoffs.find((s) =>
        releaseTag ? s.releaseTag === releaseTag : true
    );

    const hasGoDecision = applicableSignoff?.decision === 'go';

    return {
        ready: hasAllSections && friaSatisfied,
        missingSections,
        friaSatisfied,
        hasGoDecision,
        decision: applicableSignoff ?? null,
    };
}

export function registerReleaseTools(server: McpServer, env: McpEnv): void {
    /**
     * release.go_no_go_check - Query Go/No-Go evidence and evaluate readiness
     */
    server.registerTool(
        'release.go_no_go_check',
        {
            title: 'Check Release Readiness',
            description: 'Evaluate Go/No-Go checklist status for a release. Checks evidence per section (A-H), FRIA artifacts, and signoff decisions.',
            inputSchema: goNoGoSchema,
            _meta: {
                'openai/outputTemplate': 'ui://widget/release-readiness.html',
                'openai/toolInvocation/invoking': 'Checking release readiness...',
                'openai/toolInvocation/invoked': 'Readiness checked',
                'openai/readOnlyHint': true,
            },
        },
        async (args) => {
            const { orgId, releaseTag } = args as { orgId: string; releaseTag?: string };
            const supabase = createSupabaseClient(env);

            const [
                { data: evidence, error: evidenceError },
                { data: signoffs, error: signoffError },
                { data: friaArtifacts, error: friaError },
            ] = await Promise.all([
                supabase
                    .from('go_no_go_evidence')
                    .select('section, status, criterion')
                    .eq('org_id', orgId),
                supabase
                    .from('go_no_go_signoffs')
                    .select('release_tag, decision, decided_at, evidence_total')
                    .eq('org_id', orgId)
                    .order('decided_at', { ascending: false }),
                supabase
                    .from('fria_artifacts')
                    .select('release_tag, validated')
                    .eq('org_id', orgId),
            ]);

            if (evidenceError || signoffError || friaError) {
                const errors = [evidenceError, signoffError, friaError]
                    .filter(Boolean)
                    .map((e) => e?.message)
                    .join('; ');
                return {
                    content: [{ type: 'text', text: `Failed to check readiness: ${errors}` }],
                    structuredContent: { success: false, error: errors },
                };
            }

            const summary = summariseGoNoGo(
                evidence as EvidenceRow[] | null,
                signoffs as SignoffRow[] | null,
                friaArtifacts as FriaArtifactRow[] | null
            );
            const readiness = evaluateReadiness(summary, releaseTag);

            const statusText = readiness.ready
                ? '✓ Release readiness: PASSED'
                : '✗ Release readiness: NOT READY';

            const sectionSummary = summary.sections
                .map((s) => `${s.section}: ${s.satisfied}/${s.total} satisfied`)
                .join('\n');

            return {
                content: [
                    {
                        type: 'text',
                        text: `${statusText}\n\nSections:\n${sectionSummary}\n\nFRIA: ${summary.friaValidatedCount}/${summary.friaTotal} validated\n\nSignoffs: ${summary.signoffs.length} recorded`,
                    },
                ],
                structuredContent: {
                    success: true,
                    orgId,
                    releaseTag: releaseTag ?? null,
                    ready: readiness.ready,
                    missingSections: readiness.missingSections,
                    friaSatisfied: readiness.friaSatisfied,
                    hasGoDecision: readiness.hasGoDecision,
                    sections: summary.sections,
                    signoffs: summary.signoffs,
                    friaValidatedCount: summary.friaValidatedCount,
                    friaTotal: summary.friaTotal,
                },
                _meta: {
                    decision: readiness.decision,
                    allEvidence: evidence,
                },
            };
        }
    );
}

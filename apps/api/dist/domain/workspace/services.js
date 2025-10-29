import { buildPhaseCProcessNavigator, buildPhaseCWorkspaceDesk } from '../../workspace.js';
import { collectWorkspaceFetchErrors, normalizeWorkspaceOverview, queryWorkspaceOverview, } from './overview.js';
export async function fetchWorkspaceOverview(supabase, orgId) {
    const results = await queryWorkspaceOverview(supabase, orgId);
    const overviewCore = normalizeWorkspaceOverview({
        jurisdictions: results.jurisdictionsResult.data ?? [],
        matters: results.mattersResult.data ?? [],
        compliance: results.complianceResult.data ?? [],
        hitl: results.hitlResult.data ?? [],
    });
    return {
        data: {
            ...overviewCore,
            desk: buildPhaseCWorkspaceDesk(),
            navigator: buildPhaseCProcessNavigator(),
        },
        errors: collectWorkspaceFetchErrors(results),
    };
}
export async function fetchWorkspaceCitations(supabase, orgId) {
    const { data, error } = await supabase
        .from('sources')
        .select('id, title, source_type, jurisdiction_code, source_url, publisher, binding_lang, consolidated, language_note, effective_date, created_at, capture_sha256')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50);
    const entries = (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        sourceType: row.source_type,
        jurisdiction: row.jurisdiction_code,
        url: row.source_url,
        publisher: row.publisher,
        bindingLanguage: row.binding_lang,
        consolidated: row.consolidated,
        languageNote: row.language_note,
        effectiveDate: row.effective_date,
        capturedAt: row.created_at,
        checksum: row.capture_sha256,
    }));
    return { data: { entries }, error: error ?? undefined };
}
export async function fetchWorkspaceCaseScores(supabase, orgId, sourceId) {
    const query = supabase
        .from('case_scores')
        .select('id, source_id, juris_code, score_overall, axes, hard_block, version, model_ref, notes, computed_at, sources(title, source_url, trust_tier, court_rank)')
        .eq('org_id', orgId)
        .order('computed_at', { ascending: false })
        .limit(50);
    if (sourceId) {
        query.eq('source_id', sourceId);
    }
    const { data, error } = await query;
    const scores = (data ?? []).map((row) => ({
        id: row.id,
        sourceId: row.source_id,
        jurisdiction: row.juris_code,
        score: row.score_overall,
        axes: row.axes,
        hardBlock: row.hard_block,
        version: row.version,
        modelRef: row.model_ref,
        notes: row.notes,
        computedAt: row.computed_at,
        source: row.sources
            ? {
                title: row.sources.title ?? null,
                url: row.sources.source_url ?? null,
                trustTier: row.sources.trust_tier ?? null,
                courtRank: row.sources.court_rank ?? null,
            }
            : null,
    }));
    return { data: { scores }, error: error ?? undefined };
}

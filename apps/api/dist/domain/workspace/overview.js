import { buildPhaseCProcessNavigator, buildPhaseCWorkspaceDesk } from '../../workspace.js';
import { buildHitlInbox, HITL_OVERVIEW_FIELDS } from './hitl.js';
export const JURISDICTION_OVERVIEW_FIELDS = 'code, name, eu, ohada';
export const MATTER_OVERVIEW_FIELDS = 'id, question, risk_level, hitl_required, status, started_at, finished_at, jurisdiction_json';
export const COMPLIANCE_OVERVIEW_FIELDS = 'id, title, publisher, source_url, jurisdiction_code, consolidated, effective_date, created_at';
export function extractCountry(value) {
    if (!value || typeof value !== 'object') {
        return null;
    }
    if ('country' in value && typeof value.country === 'string') {
        const candidate = value.country;
        return candidate && candidate.trim().length > 0 ? candidate : null;
    }
    if ('country_code' in value && typeof value.country_code === 'string') {
        const candidate = value.country_code;
        return candidate && candidate.trim().length > 0 ? candidate : null;
    }
    return null;
}
export function normalizeWorkspaceOverview({ jurisdictions, matters, compliance, hitl, }) {
    const matterCounts = new Map();
    for (const row of matters) {
        const jurisdiction = extractCountry(row.jurisdiction_json);
        const key = jurisdiction ?? 'UNK';
        matterCounts.set(key, (matterCounts.get(key) ?? 0) + 1);
    }
    const jurisdictionsWithCounts = jurisdictions.map((row) => ({
        code: row.code,
        name: row.name,
        eu: row.eu,
        ohada: row.ohada,
        matterCount: matterCounts.get(row.code) ?? 0,
    }));
    const mattersOverview = matters.map((row) => ({
        id: row.id,
        question: row.question,
        status: row.status,
        riskLevel: row.risk_level,
        hitlRequired: row.hitl_required,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        jurisdiction: extractCountry(row.jurisdiction_json),
    }));
    const complianceWatch = compliance.map((row) => ({
        id: row.id,
        title: row.title,
        publisher: row.publisher,
        url: row.source_url,
        jurisdiction: row.jurisdiction_code,
        consolidated: row.consolidated,
        effectiveDate: row.effective_date,
        createdAt: row.created_at,
    }));
    return {
        jurisdictions: jurisdictionsWithCounts,
        matters: mattersOverview,
        complianceWatch,
        hitlInbox: buildHitlInbox(hitl),
    };
}
export function collectWorkspaceFetchErrors({ jurisdictionsResult, mattersResult, complianceResult, hitlResult, }) {
    return {
        jurisdictions: jurisdictionsResult.error ?? undefined,
        matters: mattersResult.error ?? undefined,
        compliance: complianceResult.error ?? undefined,
        hitl: hitlResult.error ?? undefined,
    };
}
export async function queryWorkspaceOverview(supabase, orgId) {
    const [jurisdictionsResult, mattersResult, complianceResult, hitlResult] = await Promise.all([
        supabase.from('jurisdictions').select(JURISDICTION_OVERVIEW_FIELDS).order('name', { ascending: true }),
        supabase
            .from('agent_runs')
            .select(MATTER_OVERVIEW_FIELDS)
            .eq('org_id', orgId)
            .order('started_at', { ascending: false })
            .limit(8),
        supabase
            .from('sources')
            .select(COMPLIANCE_OVERVIEW_FIELDS)
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .limit(8),
        supabase
            .from('hitl_queue')
            .select(HITL_OVERVIEW_FIELDS)
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .limit(8),
    ]);
    return { jurisdictionsResult, mattersResult, complianceResult, hitlResult };
}
export async function getWorkspaceOverview(supabase, orgId) {
    const results = await queryWorkspaceOverview(supabase, orgId);
    const overviewCore = normalizeWorkspaceOverview({
        jurisdictions: results.jurisdictionsResult.data ?? [],
        matters: results.mattersResult.data ?? [],
        compliance: results.complianceResult.data ?? [],
        hitl: results.hitlResult.data ?? [],
    });
    return {
        overview: {
            ...overviewCore,
            desk: buildPhaseCWorkspaceDesk(),
            navigator: buildPhaseCProcessNavigator(),
        },
        errors: collectWorkspaceFetchErrors(results),
    };
}

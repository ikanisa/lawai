import { buildPhaseCProcessNavigator, buildPhaseCWorkspaceDesk } from '../../workspace.js';
import { withRequestSpan } from '../../observability/spans.js';
import { incrementCounter } from '../../observability/metrics.js';
export const COMPLIANCE_ACK_TYPES = {
    consent: 'ai_assist',
    councilOfEurope: 'council_of_europe_disclosure',
};
export class WorkspaceServiceError extends Error {
    statusCode;
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
    }
}
const toStringArray = (input) => Array.isArray(input) ? input.filter((value) => typeof value === 'string') : [];
const extractCountry = (value) => {
    if (value && typeof value === 'object' && 'country' in value) {
        const country = value.country;
        return typeof country === 'string' ? country : null;
    }
    return null;
};
export async function fetchAcknowledgementEvents(ctx, orgId, userId) {
    const { supabase } = ctx;
    const { data, error } = await supabase
        .from('consent_events')
        .select('consent_type, version, created_at, org_id')
        .eq('user_id', userId)
        .or(`org_id.eq.${orgId},org_id.is.null`)
        .in('consent_type', [COMPLIANCE_ACK_TYPES.consent, COMPLIANCE_ACK_TYPES.councilOfEurope])
        .order('created_at', { ascending: false });
    if (error) {
        throw new WorkspaceServiceError('compliance_ack_fetch_failed');
    }
    const rows = (data ?? []);
    const events = [];
    for (const row of rows) {
        if (typeof row.consent_type !== 'string' || typeof row.version !== 'string') {
            continue;
        }
        events.push({ type: row.consent_type, version: row.version, created_at: row.created_at ?? null });
    }
    return events;
}
export async function recordAcknowledgementEvents(ctx, request, orgId, userId, records) {
    if (records.length === 0) {
        return;
    }
    await withRequestSpan(request, {
        name: 'compliance.acknowledgements.persist',
        attributes: { orgId, userId, recordCount: records.length },
    }, async ({ logger, setAttribute }) => {
        const payload = records.map((record) => ({
            org_id: record.org_id,
            user_id: record.user_id,
            consent_type: record.consent_type,
            version: record.version,
        }));
        const { error } = await ctx.supabase.rpc('record_consent_events', { events: payload });
        if (error) {
            setAttribute('errorCode', error.code ?? 'unknown');
            logger.error({ err: error }, 'compliance_ack_persist_failed');
            throw new WorkspaceServiceError('compliance_ack_insert_failed');
        }
        setAttribute('persisted', true);
        incrementCounter('compliance_acknowledgements.recorded', {
            consent_types: records
                .map((record) => record.consent_type)
                .sort()
                .join(',') || 'none',
        });
    });
}
export function summariseAcknowledgements(access, events) {
    const latestByType = new Map();
    for (const event of events) {
        if (!latestByType.has(event.type)) {
            latestByType.set(event.type, { version: event.version, created_at: event.created_at });
        }
    }
    const consentRequirement = access.consent.requirement;
    const councilRequirement = access.councilOfEurope.requirement;
    const consentAck = latestByType.get(COMPLIANCE_ACK_TYPES.consent);
    const councilAck = latestByType.get(COMPLIANCE_ACK_TYPES.councilOfEurope);
    const consentSatisfied = !consentRequirement ||
        consentAck?.version === consentRequirement.version ||
        access.consent.latest?.version === consentRequirement.version;
    const councilSatisfied = !councilRequirement?.version ||
        councilAck?.version === councilRequirement.version ||
        access.councilOfEurope.acknowledgedVersion === councilRequirement.version;
    return {
        consent: {
            requiredVersion: consentRequirement?.version ?? null,
            acknowledgedVersion: consentAck?.version ?? access.consent.latest?.version ?? null,
            acknowledgedAt: consentAck?.created_at ?? null,
            satisfied: consentSatisfied,
        },
        councilOfEurope: {
            requiredVersion: councilRequirement?.version ?? null,
            acknowledgedVersion: councilAck?.version ?? access.councilOfEurope.acknowledgedVersion ?? null,
            acknowledgedAt: councilAck?.created_at ?? null,
            satisfied: councilSatisfied,
        },
    };
}
export function mergeDisclosuresWithAcknowledgements(assessment, acknowledgements) {
    const missing = new Set(assessment.disclosures.missing);
    if (!acknowledgements.consent.satisfied) {
        missing.add('consent');
    }
    if (!acknowledgements.councilOfEurope.satisfied) {
        missing.add('council_of_europe');
    }
    return {
        ...assessment.disclosures,
        consentSatisfied: acknowledgements.consent.satisfied,
        councilSatisfied: acknowledgements.councilOfEurope.satisfied,
        missing: Array.from(missing),
        requiredConsentVersion: acknowledgements.consent.requiredVersion,
        acknowledgedConsentVersion: acknowledgements.consent.acknowledgedVersion,
        requiredCoeVersion: acknowledgements.councilOfEurope.requiredVersion,
        acknowledgedCoeVersion: acknowledgements.councilOfEurope.acknowledgedVersion,
    };
}
export async function getWorkspaceOverview(ctx, { orgId, logger, }) {
    const { supabase } = ctx;
    const [jurisdictionsResult, mattersResult, complianceResult, hitlResult] = await Promise.all([
        supabase.from('jurisdictions').select('code, name, eu, ohada').order('name', { ascending: true }),
        supabase
            .from('agent_runs')
            .select('id, question, risk_level, hitl_required, status, started_at, finished_at, jurisdiction_json')
            .eq('org_id', orgId)
            .order('started_at', { ascending: false })
            .limit(8),
        supabase
            .from('sources')
            .select('id, title, publisher, source_url, jurisdiction_code, consolidated, effective_date, created_at')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .limit(8),
        supabase
            .from('hitl_queue')
            .select('id, run_id, reason, status, created_at')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .limit(8),
    ]);
    const jurisdictionRows = jurisdictionsResult.data ?? [];
    const matterRows = mattersResult.data ?? [];
    const complianceRows = complianceResult.data ?? [];
    const hitlRows = hitlResult.data ?? [];
    if (jurisdictionsResult.error) {
        logger.error({ err: jurisdictionsResult.error }, 'workspace jurisdictions query failed');
    }
    if (mattersResult.error) {
        logger.error({ err: mattersResult.error }, 'workspace matters query failed');
    }
    if (complianceResult.error) {
        logger.error({ err: complianceResult.error }, 'workspace compliance query failed');
    }
    if (hitlResult.error) {
        logger.error({ err: hitlResult.error }, 'workspace hitl query failed');
    }
    const matterCounts = new Map();
    for (const row of matterRows) {
        const jurisdiction = extractCountry(row.jurisdiction_json);
        const key = jurisdiction ?? 'UNK';
        matterCounts.set(key, (matterCounts.get(key) ?? 0) + 1);
    }
    const jurisdictions = jurisdictionRows.map((row) => ({
        code: row.code,
        name: row.name,
        eu: row.eu,
        ohada: row.ohada,
        matterCount: matterCounts.get(row.code ?? '') ?? 0,
    }));
    const matters = matterRows.map((row) => ({
        id: row.id,
        question: row.question,
        status: row.status,
        riskLevel: row.risk_level,
        hitlRequired: row.hitl_required,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        jurisdiction: extractCountry(row.jurisdiction_json),
    }));
    const complianceWatch = complianceRows.map((row) => ({
        id: row.id,
        title: row.title,
        publisher: row.publisher,
        url: row.source_url,
        jurisdiction: row.jurisdiction_code,
        consolidated: row.consolidated,
        effectiveDate: row.effective_date,
        createdAt: row.created_at,
    }));
    const hitlInboxItems = hitlRows.map((row) => ({
        id: row.id,
        runId: row.run_id,
        reason: row.reason,
        status: row.status,
        createdAt: row.created_at,
    }));
    const pendingCount = hitlInboxItems.filter((item) => item.status === 'pending').length;
    return {
        jurisdictions,
        matters,
        complianceWatch,
        hitlInbox: {
            items: hitlInboxItems,
            pendingCount,
        },
        desk: buildPhaseCWorkspaceDesk(),
        navigator: buildPhaseCProcessNavigator(),
    };
}
export async function getComplianceStatus(ctx, { orgId, userId, limit, access, logger, }) {
    const { supabase } = ctx;
    const [assessmentsResult, events] = await Promise.all([
        supabase
            .from('compliance_assessments')
            .select('run_id, created_at, fria_required, fria_reasons, cepej_passed, cepej_violations, statute_passed, statute_violations, disclosures_missing')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .limit(limit),
        fetchAcknowledgementEvents(ctx, orgId, userId),
    ]);
    if (assessmentsResult.error) {
        logger.error({ err: assessmentsResult.error }, 'compliance_status_query_failed');
        throw new WorkspaceServiceError('compliance_status_query_failed');
    }
    const acknowledgements = summariseAcknowledgements(access, events);
    const history = (assessmentsResult.data ?? []).map((row) => {
        const missing = toStringArray(row.disclosures_missing);
        const assessment = {
            fria: {
                required: Boolean(row.fria_required),
                reasons: toStringArray(row.fria_reasons),
            },
            cepej: {
                passed: row.cepej_passed ?? true,
                violations: toStringArray(row.cepej_violations),
            },
            statute: {
                passed: row.statute_passed ?? true,
                violations: toStringArray(row.statute_violations),
            },
            disclosures: {
                consentSatisfied: !missing.includes('consent'),
                councilSatisfied: !missing.includes('council_of_europe'),
                missing,
                requiredConsentVersion: null,
                acknowledgedConsentVersion: null,
                requiredCoeVersion: null,
                acknowledgedCoeVersion: null,
            },
        };
        return {
            runId: row.run_id ?? null,
            createdAt: row.created_at ?? null,
            assessment,
        };
    });
    if (history.length > 0) {
        history[0].assessment = {
            ...history[0].assessment,
            disclosures: mergeDisclosuresWithAcknowledgements(history[0].assessment, acknowledgements),
        };
    }
    const totals = history.reduce((acc, entry) => {
        if (entry.assessment.fria.required)
            acc.friaRequired += 1;
        if (!entry.assessment.cepej.passed)
            acc.cepejViolations += 1;
        if (!entry.assessment.statute.passed)
            acc.statuteViolations += 1;
        if (entry.assessment.disclosures.missing.length > 0)
            acc.disclosureGaps += 1;
        return acc;
    }, { total: history.length, friaRequired: 0, cepejViolations: 0, statuteViolations: 0, disclosureGaps: 0 });
    return {
        acknowledgements,
        latest: history[0] ?? null,
        history,
        totals,
    };
}
export async function acknowledgeCompliance(ctx, { request, orgId, userId, access, payload, }) {
    const records = [];
    if (payload.consent) {
        records.push({
            user_id: userId,
            org_id: orgId,
            consent_type: payload.consent.type,
            version: payload.consent.version,
        });
    }
    if (payload.councilOfEurope) {
        records.push({
            user_id: userId,
            org_id: orgId,
            consent_type: COMPLIANCE_ACK_TYPES.councilOfEurope,
            version: payload.councilOfEurope.version,
        });
    }
    await recordAcknowledgementEvents(ctx, request, orgId, userId, records);
    const events = await withRequestSpan(request, {
        name: 'compliance.acknowledgements.refresh',
        attributes: { orgId, userId },
    }, async ({ setAttribute }) => {
        const result = await fetchAcknowledgementEvents(ctx, orgId, userId);
        setAttribute('eventCount', result.length);
        return result;
    });
    return summariseAcknowledgements(access, events);
}

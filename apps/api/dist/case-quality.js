import { differenceInCalendarDays } from 'date-fns';
const AXES = ['PW', 'ST', 'SA', 'PI', 'JF', 'LB', 'RC', 'CQ'];
export const CASE_TRUST_WEIGHTS = {
    T1: 0.2,
    T2: 1.0,
    T3: 0.6,
    T4: 0.3,
};
const COURT_RANK_WEIGHTS = {
    supreme: 100,
    high: 95,
    ccja: 98,
    appellate: 80,
    tribunal: 55,
    trial: 45,
    first_instance: 45,
    magistrate: 35,
};
const CASE_SCORING_PROFILES = {
    civil_law_default: { PW: 0.18, ST: 0.18, SA: 0.3, PI: 0.08, JF: 0.1, LB: 0.06, RC: 0.05, CQ: 0.05 },
    ohada: { PW: 0.2, ST: 0.18, SA: 0.32, PI: 0.07, JF: 0.1, LB: 0.05, RC: 0.04, CQ: 0.04 },
};
function clamp(value, min = 0, max = 100) {
    if (Number.isNaN(value)) {
        return min;
    }
    if (value < min)
        return min;
    if (value > max)
        return max;
    return value;
}
function resolveProfile(jurisdiction) {
    if (jurisdiction.toUpperCase().startsWith('OHADA')) {
        return CASE_SCORING_PROFILES.ohada;
    }
    return CASE_SCORING_PROFILES.civil_law_default;
}
function yearsSince(dateIso) {
    if (!dateIso) {
        return null;
    }
    const diffDays = differenceInCalendarDays(new Date(), new Date(dateIso));
    return diffDays / 365.25;
}
export function evaluateCaseQuality(signals) {
    if (signals.override) {
        const overrideScore = clamp(signals.override.score);
        const axes = AXES.reduce((acc, axis) => {
            acc[axis] = overrideScore;
            return acc;
        }, {});
        const notes = ['override_applied'];
        if (signals.override.reason) {
            notes.push(`override_reason:${signals.override.reason}`);
        }
        return { axes, score: overrideScore, hardBlock: overrideScore === 0, notes };
    }
    let hardBlock = false;
    const notes = [];
    const profile = resolveProfile(signals.bindingJurisdiction ?? signals.jurisdiction);
    // Precedential weight
    const trustWeight = CASE_TRUST_WEIGHTS[signals.trustTier] ?? CASE_TRUST_WEIGHTS.T4;
    const courtRankKey = (signals.courtRank ?? '').toLowerCase();
    const courtWeight = COURT_RANK_WEIGHTS[courtRankKey] ?? (trustWeight >= 1 ? 80 : 55);
    const axisPW = clamp(courtWeight * trustWeight);
    // Subsequent treatment
    let stScore = 70;
    let pendingPenalty = false;
    for (const treatment of signals.treatments) {
        const normalized = (treatment.treatment ?? '').toLowerCase();
        const weight = treatment.weight ?? 1;
        switch (normalized) {
            case 'followed':
            case 'applied':
            case 'affirmed':
                stScore += 10 * weight;
                break;
            case 'distinguished':
                stScore -= 5 * weight;
                break;
            case 'criticized':
            case 'negative':
            case 'questioned':
                stScore -= 15 * weight;
                notes.push(`negative_treatment:${normalized}`);
                break;
            case 'pending_appeal':
                pendingPenalty = true;
                notes.push('pending_appeal');
                break;
            case 'overruled':
            case 'vacated':
                hardBlock = true;
                notes.push(`hard_block:${normalized}`);
                break;
            default:
                break;
        }
    }
    if (pendingPenalty) {
        stScore -= 20;
    }
    const axisST = clamp(stScore);
    // Statute alignment
    const alignments = signals.statuteAlignments
        .map((item) => (typeof item.alignmentScore === 'number' ? item.alignmentScore : null))
        .filter((value) => value !== null);
    const axisSA = alignments.length > 0 ? clamp(alignments.reduce((acc, value) => acc + value, 0) / alignments.length) : 55;
    if (alignments.length === 0) {
        notes.push('alignment_missing');
    }
    // Procedural integrity
    let axisPI = 90;
    if (signals.politicalRiskFlag) {
        axisPI -= 40;
        notes.push('political_risk_source');
    }
    if (pendingPenalty) {
        axisPI -= 10;
    }
    for (const risk of signals.riskOverlays) {
        axisPI -= 40;
        notes.push(`risk_overlay:${risk.flag}`);
    }
    axisPI = clamp(axisPI);
    // Jurisdiction fit
    const jurisdictionMatch = signals.bindingJurisdiction && signals.bindingJurisdiction === signals.jurisdiction;
    const axisJF = clamp(jurisdictionMatch ? 95 : 60);
    if (!jurisdictionMatch) {
        notes.push('jurisdiction_persuasive');
    }
    // Language binding
    const bindingLang = (signals.bindingLanguage ?? 'fr').toLowerCase();
    let axisLB = 95;
    if (bindingLang !== 'fr') {
        axisLB = bindingLang === 'ar' ? 60 : 70;
        notes.push(`non_binding_translation:${bindingLang}`);
    }
    // Recency
    const years = yearsSince(signals.effectiveDate ?? signals.createdAt);
    let axisRC = 85;
    if (years !== null) {
        if (years < 3) {
            axisRC = 95;
        }
        else if (years < 6) {
            axisRC = 85;
        }
        else if (years < 10) {
            axisRC = 70;
        }
        else {
            axisRC = 55;
            notes.push('older_case');
        }
    }
    // Citation quality
    const axisCQ = clamp(60 + alignments.length * 5);
    const axes = {
        PW: axisPW,
        ST: axisST,
        SA: axisSA,
        PI: axisPI,
        JF: axisJF,
        LB: axisLB,
        RC: axisRC,
        CQ: axisCQ,
    };
    const composite = AXES.reduce((acc, axis) => acc + axes[axis] * (profile[axis] ?? 0), 0);
    const score = clamp(composite);
    if (hardBlock) {
        return { axes, score: 0, hardBlock: true, notes };
    }
    return { axes, score, hardBlock, notes };
}

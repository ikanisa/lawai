import { randomUUID } from 'node:crypto';
import { getLaunchCollateral, listRegulatorDigests } from './launch.js';
import { listWebVitals } from './metrics.js';
const MAX_OUTBOX_ITEMS_PER_ORG = 100;
const outboxStore = [];
export function enqueueOfflineOutboxItem(input) {
    const item = {
        id: randomUUID(),
        status: input.status ?? 'queued',
        queuedAt: input.queuedAt ?? new Date().toISOString(),
        lastAttemptAt: input.lastAttemptAt ?? null,
        orgId: input.orgId,
        channel: input.channel,
        label: input.label,
        locale: input.locale ?? null,
    };
    outboxStore.unshift(item);
    pruneOutboxForOrg(input.orgId);
    return item;
}
function pruneOutboxForOrg(orgId) {
    let seen = 0;
    for (let index = 0; index < outboxStore.length; index += 1) {
        const entry = outboxStore[index];
        if (entry.orgId !== orgId) {
            continue;
        }
        seen += 1;
        if (seen > MAX_OUTBOX_ITEMS_PER_ORG) {
            outboxStore.splice(index, 1);
            index -= 1;
        }
    }
}
export function updateOfflineOutboxStatus(orgId, itemId, status, attemptAt) {
    const item = outboxStore.find((entry) => entry.id === itemId && entry.orgId === orgId);
    if (!item) {
        return null;
    }
    item.status = status;
    item.lastAttemptAt = attemptAt ?? new Date().toISOString();
    return item;
}
export function listOfflineOutboxItems(orgId) {
    return outboxStore.filter((entry) => entry.orgId === orgId);
}
function summariseVitals(vitals) {
    const counts = {
        total: vitals.length,
        good: 0,
        needsImprovement: 0,
        poor: 0,
        lastSampleAt: vitals[0]?.createdAt ?? null,
    };
    for (const record of vitals) {
        if (record.rating === 'good') {
            counts.good += 1;
        }
        else if (record.rating === 'needs-improvement') {
            counts.needsImprovement += 1;
        }
        else {
            counts.poor += 1;
        }
    }
    return counts;
}
function summariseOfflineOutbox(items) {
    let lastQueuedAt = null;
    let oldestQueuedAt = null;
    let queued = 0;
    let syncing = 0;
    for (const item of items) {
        if (item.status === 'queued') {
            queued += 1;
            if (!lastQueuedAt || item.queuedAt > lastQueuedAt) {
                lastQueuedAt = item.queuedAt;
            }
            if (!oldestQueuedAt || item.queuedAt < oldestQueuedAt) {
                oldestQueuedAt = item.queuedAt;
            }
        }
        else {
            syncing += 1;
        }
    }
    return { queued, syncing, lastQueuedAt, oldestQueuedAt };
}
function summariseDigests() {
    const digests = listRegulatorDigests();
    let weekly = 0;
    let monthly = 0;
    let lastCreatedAt = null;
    for (const digest of digests) {
        if (digest.frequency === 'weekly') {
            weekly += 1;
        }
        else if (digest.frequency === 'monthly') {
            monthly += 1;
        }
        if (!lastCreatedAt || digest.createdAt > lastCreatedAt) {
            lastCreatedAt = digest.createdAt;
        }
    }
    return { total: weekly + monthly, weekly, monthly, lastCreatedAt };
}
function computeReadinessScore(vitals, offline, digests) {
    let score = 100;
    if (vitals.poor > 0) {
        score -= Math.min(35, vitals.poor * 7);
    }
    if (vitals.needsImprovement > 0) {
        score -= Math.min(20, vitals.needsImprovement * 3);
    }
    if (offline.queued > 0) {
        score -= Math.min(25, offline.queued * 5);
    }
    if (digests.total === 0) {
        score -= 10;
    }
    return Math.max(10, Math.min(100, score));
}
function buildActions(orgId, vitals, offline, digests) {
    const actions = [];
    if (vitals.poor > 0) {
        actions.push({
            id: 'core-web-vitals',
            severity: vitals.poor >= 3 ? ('critical') : 'warning',
            label: `Investigate ${vitals.poor} poor Web Vitals sample${vitals.poor > 1 ? 's' : ''}`,
            description: 'Review the Core Web Vitals dashboard and schedule remediation with engineering.',
            href: `/admin/org/${orgId}/web-vitals`,
        });
    }
    if (offline.queued > 0) {
        actions.push({
            id: 'offline-outbox',
            severity: offline.queued > 5 ? 'critical' : 'warning',
            label: `Sync ${offline.queued} offline outbox item${offline.queued > 1 ? 's' : ''}`,
            description: 'Ensure the mobile offline outbox is flushed before exporting regulator packages.',
            href: `/admin/org/${orgId}/offline-outbox`,
        });
    }
    if (digests.total === 0) {
        actions.push({
            id: 'regulator-digests',
            severity: 'warning',
            label: 'Schedule regulator digests',
            description: 'Configure weekly or monthly regulator digests before Go/No-Go sign-off.',
            href: '/admin/launch/digests',
        });
    }
    return actions;
}
export function buildPhaseEReadiness(orgId) {
    const vitals = summariseVitals(listWebVitals(orgId, 50));
    const offline = summariseOfflineOutbox(listOfflineOutboxItems(orgId));
    const digests = summariseDigests();
    const collateral = getLaunchCollateral();
    const readinessScore = computeReadinessScore(vitals, offline, digests);
    const actions = buildActions(orgId, vitals, offline, digests);
    const notes = [];
    if (collateral.pilotOnboarding.length > 0) {
        notes.push(`Pilot onboarding packs available: ${collateral.pilotOnboarding.length}`);
    }
    if (collateral.transparency.length > 0) {
        notes.push(`Transparency disclosures published for ${collateral.transparency.length} jurisdictions.`);
    }
    if (vitals.good > 0 && vitals.total > 0) {
        const percentage = Math.round((vitals.good / vitals.total) * 100);
        notes.push(`Good Web Vitals samples: ${percentage}% (${vitals.good}/${vitals.total}).`);
    }
    if (offline.syncing > 0) {
        notes.push(`${offline.syncing} offline items currently syncing.`);
    }
    return {
        orgId,
        readinessScore,
        vitals,
        offlineOutbox: offline,
        digests,
        collateral: {
            pilotOnboarding: collateral.pilotOnboarding.length,
            pricingPacks: collateral.pricingPacks.length,
            transparency: collateral.transparency.length,
        },
        actions,
        notes,
    };
}
export function __resetPostLaunchStateForTests() {
    outboxStore.length = 0;
}

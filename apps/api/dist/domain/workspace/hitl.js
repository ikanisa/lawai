export const HITL_OVERVIEW_FIELDS = 'id, run_id, reason, status, created_at';
export function buildHitlInbox(rows) {
    const items = rows.map((row) => ({
        id: row.id,
        runId: row.run_id,
        reason: row.reason,
        status: row.status,
        createdAt: row.created_at,
    }));
    const pendingCount = items.filter((item) => item.status === 'pending').length;
    return { items, pendingCount };
}

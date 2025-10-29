import type { PostgrestSingleResponse } from '@supabase/supabase-js';
export interface HitlQueueRow {
    id: string;
    run_id: string;
    reason: string;
    status: string;
    created_at: string | null;
}
export interface HitlInboxItem {
    id: string;
    runId: string;
    reason: string;
    status: string;
    createdAt: string | null;
}
export interface HitlInbox {
    items: HitlInboxItem[];
    pendingCount: number;
}
export declare const HITL_OVERVIEW_FIELDS = "id, run_id, reason, status, created_at";
export type HitlQueryResult = PostgrestSingleResponse<HitlQueueRow>;
export declare function buildHitlInbox(rows: HitlQueueRow[]): HitlInbox;
//# sourceMappingURL=hitl.d.ts.map
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

export const HITL_OVERVIEW_FIELDS = 'id, run_id, reason, status, created_at';

export type HitlQueryResult = PostgrestSingleResponse<HitlQueueRow>;

export function buildHitlInbox(rows: HitlQueueRow[]): HitlInbox {
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

-- Phase 1 schema hardening for Lawai Supabase project.
-- - Deduplicate and protect document_chunks ordering
-- - Improve agent_runs / hitl_queue query performance
-- - Allow org members to view their roster
BEGIN;

-- Remove duplicate chunk sequences per document before adding the constraint.
WITH
  ranked_chunks AS (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY
          document_id,
          seq
        ORDER BY
          created_at ASC,
          id ASC
      ) AS rn
    FROM
      public.document_chunks
  )
DELETE FROM public.document_chunks dc USING ranked_chunks r
WHERE
  dc.id = r.id
  AND r.rn > 1;

ALTER TABLE public.document_chunks
ADD CONSTRAINT document_chunks_document_seq_unique UNIQUE (document_id, seq);

CREATE INDEX if NOT EXISTS agent_runs_org_status_idx ON public.agent_runs (org_id, status, started_at DESC);

CREATE INDEX if NOT EXISTS hitl_queue_org_status_idx ON public.hitl_queue (org_id, status, created_at DESC);

CREATE POLICY "org_members read by org" ON public.org_members FOR
SELECT
  USING (public.is_org_member (org_id));

COMMIT;

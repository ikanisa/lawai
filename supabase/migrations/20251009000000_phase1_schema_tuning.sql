-- Phase 1 schema hardening for Lawai Supabase project.
-- - Deduplicate and protect document_chunks ordering
-- - Improve agent_runs / hitl_queue query performance
-- - Allow org members to view their roster

begin;

-- Remove duplicate chunk sequences per document before adding the constraint.
with ranked_chunks as (
  select
    id,
    row_number() over (
      partition by document_id, seq
      order by created_at asc, id asc
    ) as rn
  from public.document_chunks
)
delete from public.document_chunks dc
using ranked_chunks r
where dc.id = r.id
  and r.rn > 1;

alter table public.document_chunks
  add constraint document_chunks_document_seq_unique
  unique (document_id, seq);

create index if not exists agent_runs_org_status_idx
  on public.agent_runs (org_id, status, started_at desc);

create index if not exists hitl_queue_org_status_idx
  on public.hitl_queue (org_id, status, created_at desc);

create policy "org_members read by org"
  on public.org_members
  for select
  using (public.is_org_member(org_id));

commit;

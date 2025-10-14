-- Store reviewer edit diagnostics for HITL resolutions
create table if not exists public.hitl_reviewer_edits (
  id uuid primary key default gen_random_uuid(),
  hitl_id uuid not null references public.hitl_queue(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  reviewer_id uuid,
  action text not null,
  comment text,
  previous_payload jsonb,
  revised_payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.hitl_reviewer_edits enable row level security;

create index if not exists hitl_reviewer_edits_hitl_idx on public.hitl_reviewer_edits (hitl_id);
create index if not exists hitl_reviewer_edits_run_idx on public.hitl_reviewer_edits (run_id);

drop policy if exists "hitl reviewer edits by org" on public.hitl_reviewer_edits;
create policy "hitl reviewer edits by org" on public.hitl_reviewer_edits
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

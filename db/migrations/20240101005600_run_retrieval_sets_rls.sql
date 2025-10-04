-- Enforce RLS for run_retrieval_sets
alter table public.run_retrieval_sets enable row level security;

drop policy if exists "retrieval_sets_by_org" on public.run_retrieval_sets;
create policy "retrieval_sets_by_org" on public.run_retrieval_sets
for all
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));

drop policy if exists "retrieval_sets_by_run" on public.run_retrieval_sets;
create policy "retrieval_sets_by_run" on public.run_retrieval_sets
for select
using (
  exists (
    select 1
    from public.agent_runs r
    where r.id = run_id
      and public.is_org_member(r.org_id)
  )
);

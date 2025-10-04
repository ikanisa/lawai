alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.profiles enable row level security;
alter table public.sources enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.agent_runs enable row level security;
alter table public.tool_invocations enable row level security;
alter table public.run_citations enable row level security;
alter table public.hitl_queue enable row level security;
alter table public.eval_cases enable row level security;
alter table public.eval_results enable row level security;

drop policy if exists "orgs readable to members" on public.organizations;
create policy "orgs readable to members" on public.organizations
for select
using (public.is_org_member(id));

drop policy if exists "org_members self-read" on public.org_members;
create policy "org_members self-read" on public.org_members
for select
using (auth.uid() = user_id);

drop policy if exists "sources by org" on public.sources;
create policy "sources by org" on public.sources
for all
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name = 'org_id'
  ) then
    execute 'drop policy if exists "documents by org" on public.documents';
    execute 'create policy "documents by org" on public.documents for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id))';
  end if;
end
$$;

drop policy if exists "chunks by org" on public.document_chunks;
create policy "chunks by org" on public.document_chunks
for select
using (public.is_org_member(org_id));

drop policy if exists "runs by org" on public.agent_runs;
create policy "runs by org" on public.agent_runs
for all
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));

drop policy if exists "tool invocations by run" on public.tool_invocations;
create policy "tool invocations by run" on public.tool_invocations
for select
using (
  exists (
    select 1
    from public.agent_runs r
    where r.id = run_id
      and public.is_org_member(r.org_id)
  )
);

drop policy if exists "citations by run" on public.run_citations;
create policy "citations by run" on public.run_citations
for select
using (
  exists (
    select 1
    from public.agent_runs r
    where r.id = run_id
      and public.is_org_member(r.org_id)
  )
);

drop policy if exists "hitl by org" on public.hitl_queue;
create policy "hitl by org" on public.hitl_queue
for all
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));

drop policy if exists "evals by org" on public.eval_cases;
create policy "evals by org" on public.eval_cases
for all
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));

drop policy if exists "eval results by case" on public.eval_results;
create policy "eval results by case" on public.eval_results
for select
using (
  exists (
    select 1
    from public.eval_cases c
    where c.id = case_id
      and public.is_org_member(c.org_id)
  )
);

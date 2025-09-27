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

create policy if not exists "orgs readable to members" on public.organizations
for select
using (public.is_org_member(id));

create policy if not exists "org_members self-read" on public.org_members
for select
using (auth.uid() = user_id);

create policy if not exists "sources by org" on public.sources
for all
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));

create policy if not exists "documents by org" on public.documents
for all
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));

create policy if not exists "chunks by org" on public.document_chunks
for select
using (public.is_org_member(org_id));

create policy if not exists "runs by org" on public.agent_runs
for all
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));

create policy if not exists "tool invocations by run" on public.tool_invocations
for select
using (
  exists (
    select 1
    from public.agent_runs r
    where r.id = run_id
      and public.is_org_member(r.org_id)
  )
);

create policy if not exists "citations by run" on public.run_citations
for select
using (
  exists (
    select 1
    from public.agent_runs r
    where r.id = run_id
      and public.is_org_member(r.org_id)
  )
);

create policy if not exists "hitl by org" on public.hitl_queue
for all
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));

create policy if not exists "evals by org" on public.eval_cases
for all
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));

create policy if not exists "eval results by case" on public.eval_results
for select
using (
  exists (
    select 1
    from public.eval_cases c
    where c.id = case_id
      and public.is_org_member(c.org_id)
  )
);

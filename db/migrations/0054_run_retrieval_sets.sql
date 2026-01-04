-- Create run_retrieval_sets to capture hybrid retrieval context per agent execution
create table if not exists public.run_retrieval_sets (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  origin text not null check (origin in ('local', 'file_search')),
  snippet text not null,
  similarity numeric(6,5),
  weight numeric(6,5),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists run_retrieval_sets_run_id_idx on public.run_retrieval_sets(run_id);
create index if not exists run_retrieval_sets_org_id_idx on public.run_retrieval_sets(org_id);

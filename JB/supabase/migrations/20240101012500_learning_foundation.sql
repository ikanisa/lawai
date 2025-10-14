create table if not exists public.learning_signals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid,
  source text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_learning_signals_created_at on public.learning_signals(created_at desc);
create index if not exists idx_learning_signals_org on public.learning_signals(org_id, created_at desc);

alter table public.learning_signals enable row level security;

drop policy if exists "learning_signals_policy" on public.learning_signals;

create policy "learning_signals_policy" on public.learning_signals
  for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create table if not exists public.learning_metrics (
  id uuid primary key default gen_random_uuid(),
  "window" text not null,
  metric text not null,
  value double precision not null,
  dims jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);

create index if not exists idx_learning_metrics_metric on public.learning_metrics(metric, computed_at desc);

alter table public.learning_metrics enable row level security;

drop policy if exists "learning_metrics_select" on public.learning_metrics;
drop policy if exists "learning_metrics_write" on public.learning_metrics;
drop policy if exists "learning_metrics_service" on public.learning_metrics;

create policy "learning_metrics_select" on public.learning_metrics
  for select
  using (true);

create policy "learning_metrics_service" on public.learning_metrics
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.query_hints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  juris_code text,
  topic text,
  hint_type text not null,
  phrase text not null,
  weight double precision not null default 1.0,
  policy_version_id uuid,
  activated_at timestamptz not null default now()
);

create index if not exists idx_query_hints_org on public.query_hints(org_id, juris_code);

alter table public.query_hints enable row level security;

drop policy if exists "query_hints_policy" on public.query_hints;

create policy "query_hints_policy" on public.query_hints
  for all
  using (
    org_id is null
    or public.is_org_member(org_id)
  )
  with check (
    org_id is null
    or public.is_org_member(org_id)
  );

create table if not exists public.citation_canonicalizer (
  id uuid primary key default gen_random_uuid(),
  jurisdiction text,
  pattern text not null,
  replacement text not null,
  policy_version_id uuid,
  activated_at timestamptz not null default now()
);

alter table public.citation_canonicalizer enable row level security;

drop policy if exists "citation_canonicalizer_select" on public.citation_canonicalizer;
drop policy if exists "citation_canonicalizer_write" on public.citation_canonicalizer;
drop policy if exists "citation_canonicalizer_service" on public.citation_canonicalizer;

create policy "citation_canonicalizer_select" on public.citation_canonicalizer
  for select
  using (true);

create policy "citation_canonicalizer_service" on public.citation_canonicalizer
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.denylist_deboost (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  juris_code text,
  reason text not null,
  pattern text not null,
  action text not null check (action in ('deny', 'deboost')),
  weight double precision,
  policy_version_id uuid,
  activated_at timestamptz not null default now()
);

alter table public.denylist_deboost enable row level security;

drop policy if exists "denylist_deboost_policy" on public.denylist_deboost;

create policy "denylist_deboost_policy" on public.denylist_deboost
  for all
  using (
    org_id is null
    or public.is_org_member(org_id)
  )
  with check (
    (org_id is null and auth.role() = 'service_role')
    or public.is_org_member(org_id)
  );

create index if not exists idx_denylist_deboost_org on public.denylist_deboost(org_id, juris_code);

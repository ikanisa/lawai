-- Case quality scoring and trust metadata
alter table public.sources
  add column if not exists trust_tier text check (trust_tier in ('T1','T2','T3','T4')) default 'T1',
  add column if not exists court_rank text,
  add column if not exists court_identifier text,
  add column if not exists political_risk_flag boolean default false,
  add column if not exists treatment_status text;

create table if not exists public.case_scores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  juris_code text not null,
  score_overall numeric(5,2) not null,
  axes jsonb not null,
  hard_block boolean not null default false,
  version integer not null default 1,
  model_ref text,
  notes jsonb,
  computed_at timestamptz not null default now()
);

create index if not exists case_scores_source_idx on public.case_scores (source_id, computed_at desc);
create index if not exists case_scores_org_idx on public.case_scores (org_id, computed_at desc);

create table if not exists public.case_treatments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  citing_source_id uuid references public.sources(id) on delete set null,
  treatment text not null check (treatment in (
    'followed',
    'applied',
    'affirmed',
    'distinguished',
    'criticized',
    'negative',
    'overruled',
    'vacated',
    'pending_appeal',
    'questioned',
    'unknown'
  )),
  court_rank text,
  weight numeric(4,2) default 1.0,
  decided_at date,
  created_at timestamptz not null default now()
);

create index if not exists case_treatments_source_idx on public.case_treatments (source_id);
create index if not exists case_treatments_citing_idx on public.case_treatments (citing_source_id);

create table if not exists public.case_statute_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  case_source_id uuid not null references public.sources(id) on delete cascade,
  statute_url text not null,
  article text,
  alignment_score numeric(5,2),
  rationale_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists case_statute_links_case_idx on public.case_statute_links (case_source_id);

create table if not exists public.risk_register (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  juris_code text not null,
  court_identifier text,
  period_from date,
  period_to date,
  risk_flag text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.case_score_overrides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  reviewer_id uuid not null,
  new_score numeric(5,2) not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists case_score_overrides_source_idx on public.case_score_overrides (source_id, created_at desc);

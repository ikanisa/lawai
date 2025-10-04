-- Governance publications for DPIA, Council of Europe commitments, etc.
create table if not exists public.governance_publications (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text,
  doc_url text not null,
  category text not null,
  status text not null default 'published',
  published_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists governance_publications_category_idx on public.governance_publications (category);
create index if not exists governance_publications_status_idx on public.governance_publications (status);

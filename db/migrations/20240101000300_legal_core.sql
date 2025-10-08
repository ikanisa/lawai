create table if not exists public.jurisdictions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  eu boolean not null default false,
  ohada boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.authority_domains (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null,
  host text not null,
  unique (jurisdiction_code, host)
);

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  jurisdiction_code text not null,
  source_type text not null,
  title text not null,
  publisher text,
  source_url text not null,
  binding_lang text default 'fr',
  consolidated boolean default false,
  adopted_date date,
  effective_date date,
  capture_sha256 text,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  name text not null,
  storage_path text not null,
  openai_file_id text,
  mime_type text,
  bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  jurisdiction_code text not null,
  content text not null,
  embedding vector(1536) not null,
  seq integer not null,
  created_at timestamptz not null default now()
);

-- Drafting drafts metadata and persistence of clause comparisons/exports
create table if not exists public.drafting_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  template_id uuid references public.pleading_templates(id) on delete set null,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  created_by uuid not null,
  prompt text not null,
  title text,
  jurisdiction_code text,
  matter_type text,
  citations jsonb,
  clause_comparisons jsonb,
  exports jsonb,
  content_sha256 text,
  signature_manifest jsonb,
  status text not null default 'draft' check (status in ('draft', 'finalized', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drafting_drafts_org_idx on public.drafting_drafts(org_id, created_at desc);
create index if not exists drafting_drafts_document_idx on public.drafting_drafts(document_id);

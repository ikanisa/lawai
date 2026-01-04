create table if not exists public.pleading_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  jurisdiction_code text not null,
  matter_type text not null,
  title text not null,
  summary text,
  locale text not null default 'fr',
  sections jsonb not null,
  fill_ins jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists pleading_templates_unique
  on public.pleading_templates(coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid), jurisdiction_code, matter_type, locale);

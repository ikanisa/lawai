-- Add ELI/ECLI identifiers and Akoma Ntoso payloads
alter table public.sources
  add column if not exists eli text,
  add column if not exists ecli text,
  add column if not exists akoma_ntoso jsonb;

alter table public.documents
  add column if not exists residency_zone text;

create index if not exists documents_residency_idx on public.documents(residency_zone);

-- Add supplementary metadata for authoritative source tracking
alter table public.sources
  add column if not exists language_note text,
  add column if not exists version_label text;

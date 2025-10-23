-- Add supplementary metadata for authoritative source tracking
ALTER TABLE public.sources
ADD COLUMN IF NOT EXISTS language_note text,
ADD COLUMN IF NOT EXISTS version_label text;

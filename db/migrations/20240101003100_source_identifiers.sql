-- Add ELI/ECLI identifiers and Akoma Ntoso payloads
ALTER TABLE public.sources
ADD COLUMN IF NOT EXISTS eli text,
ADD COLUMN IF NOT EXISTS ecli text,
ADD COLUMN IF NOT EXISTS akoma_ntoso jsonb;

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS residency_zone text;

CREATE INDEX if NOT EXISTS documents_residency_idx ON public.documents (residency_zone);

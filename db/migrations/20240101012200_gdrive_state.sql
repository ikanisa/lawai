-- Google Drive watch state per organization
CREATE TABLE IF NOT EXISTS public.gdrive_state (
  org_id uuid PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  drive_id text,
  folder_id text,
  channel_id text,
  resource_id text,
  expiration timestamptz,
  start_page_token text,
  last_page_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gdrive_state enable ROW level security;

DROP POLICY if EXISTS "gdrive state by org" ON public.gdrive_state;

CREATE POLICY "gdrive state by org" ON public.gdrive_state FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.tg_set_timestamp () returns trigger AS $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

DROP TRIGGER if EXISTS set_timestamp_gdrive_state ON public.gdrive_state;

CREATE TRIGGER set_timestamp_gdrive_state before
UPDATE ON public.gdrive_state FOR each ROW
EXECUTE function public.tg_set_timestamp ();

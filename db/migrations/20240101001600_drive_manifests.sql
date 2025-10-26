-- Track Google Drive manifest validations and watcher events
CREATE TABLE IF NOT EXISTS public.drive_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  manifest_name text NOT NULL,
  manifest_url text,
  file_count integer NOT NULL DEFAULT 0,
  valid_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  errors jsonb,
  warnings jsonb,
  validated boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.drive_manifest_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id uuid NOT NULL REFERENCES public.drive_manifests (id) ON DELETE CASCADE,
  file_id text NOT NULL,
  juris_code text NOT NULL,
  source_type text NOT NULL,
  source_url text NOT NULL,
  allowlisted boolean NOT NULL DEFAULT FALSE,
  binding_language text,
  effective_date date,
  consolidation_status text,
  validation_errors jsonb,
  validation_warnings jsonb
);

CREATE INDEX if NOT EXISTS drive_manifest_items_manifest_idx ON public.drive_manifest_items (manifest_id);

ALTER TABLE public.change_log_entries enable ROW level security;

DROP POLICY if EXISTS change_log_entries_select ON public.change_log_entries;

CREATE POLICY change_log_entries_select ON public.change_log_entries FOR
SELECT
  USING (public.is_org_member (org_id));

DROP POLICY if EXISTS change_log_entries_modify ON public.change_log_entries;

CREATE POLICY change_log_entries_modify ON public.change_log_entries FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

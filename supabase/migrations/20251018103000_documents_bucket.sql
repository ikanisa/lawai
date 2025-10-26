-- Introduce dedicated `documents` storage bucket for customer uploads.
-- Also update RLS policies so org members can access the new bucket subject to residency checks.
BEGIN;

INSERT INTO
  storage.buckets (id, name, public)
VALUES
  ('documents', 'documents', FALSE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.documents
ALTER COLUMN bucket_id
SET DEFAULT 'documents';

DO $policy$
declare
  owns_table boolean;
begin
  select pg_get_userbyid(c.relowner) = current_user
    into owns_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'storage'
    and c.relname = 'objects';

  if owns_table then
    execute $$drop policy if exists "Org members read documents" on storage.objects$$;
    execute $$create policy "Org members read documents" on storage.objects
      for select using (
        bucket_id = 'documents'
        and public.storage_object_org(name) is not null
        and public.storage_object_residency(name) is not null
        and public.org_residency_allows(public.storage_object_org(name), public.storage_object_residency(name))
        and public.is_org_member(public.storage_object_org(name))
      )$$;

    execute $$drop policy if exists "Org members write documents" on storage.objects$$;
    execute $$create policy "Org members write documents" on storage.objects
      for all using (
        bucket_id = 'documents'
        and public.storage_object_org(name) is not null
        and public.storage_object_residency(name) is not null
        and public.org_residency_allows(public.storage_object_org(name), public.storage_object_residency(name))
        and public.is_org_member(public.storage_object_org(name))
      )
      with check (
        bucket_id = 'documents'
        and public.storage_object_org(name) is not null
        and public.storage_object_residency(name) is not null
        and public.org_residency_allows(public.storage_object_org(name), public.storage_object_residency(name))
        and public.is_org_member(public.storage_object_org(name))
      )$$;
  end if;
end;
$policy$;

COMMIT;

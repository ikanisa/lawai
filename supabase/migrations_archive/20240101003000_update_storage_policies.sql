-- Enforce residency prefixes in storage policies
CREATE OR REPLACE FUNCTION public.storage_object_is_valid (path text) returns boolean language sql stable AS $$
  select
    public.storage_object_org(path) is not null
    and public.storage_residency_allowed(public.storage_object_residency(path));
$$;

DROP POLICY if EXISTS "Org members read authorities" ON storage.objects;

DROP POLICY if EXISTS "Org members upload authorities" ON storage.objects;

DROP POLICY if EXISTS "Org members manage authorities" ON storage.objects;

DROP POLICY if EXISTS "Org members delete authorities" ON storage.objects;

DROP POLICY if EXISTS "Org members read uploads" ON storage.objects;

DROP POLICY if EXISTS "Org members write uploads" ON storage.objects;

DROP POLICY if EXISTS "Org members manage snapshots" ON storage.objects;

CREATE POLICY "Org members read authorities" ON storage.objects FOR
SELECT
  USING (
    bucket_id = 'authorities'
    AND public.storage_object_is_valid (name)
    AND public.is_org_member (public.storage_object_org (name))
  );

CREATE POLICY "Org members upload authorities" ON storage.objects FOR insert
WITH
  CHECK (
    bucket_id = 'authorities'
    AND public.storage_object_is_valid (name)
    AND public.is_org_member (public.storage_object_org (name))
  );

CREATE POLICY "Org members manage authorities" ON storage.objects
FOR UPDATE
  USING (
    bucket_id = 'authorities'
    AND public.storage_object_is_valid (name)
    AND public.is_org_member (public.storage_object_org (name))
  )
WITH
  CHECK (
    bucket_id = 'authorities'
    AND public.storage_object_is_valid (name)
    AND public.is_org_member (public.storage_object_org (name))
  );

CREATE POLICY "Org members delete authorities" ON storage.objects FOR delete USING (
  bucket_id = 'authorities'
  AND public.storage_object_is_valid (name)
  AND public.is_org_member (public.storage_object_org (name))
);

CREATE POLICY "Org members read uploads" ON storage.objects FOR
SELECT
  USING (
    bucket_id = 'uploads'
    AND public.storage_object_is_valid (name)
    AND public.is_org_member (public.storage_object_org (name))
  );

CREATE POLICY "Org members write uploads" ON storage.objects FOR ALL USING (
  bucket_id = 'uploads'
  AND public.storage_object_is_valid (name)
  AND public.is_org_member (public.storage_object_org (name))
)
WITH
  CHECK (
    bucket_id = 'uploads'
    AND public.storage_object_is_valid (name)
    AND public.is_org_member (public.storage_object_org (name))
  );

CREATE POLICY "Org members manage snapshots" ON storage.objects FOR ALL USING (
  bucket_id = 'snapshots'
  AND public.storage_object_is_valid (name)
  AND public.is_org_member (public.storage_object_org (name))
)
WITH
  CHECK (
    bucket_id = 'snapshots'
    AND public.storage_object_is_valid (name)
    AND public.is_org_member (public.storage_object_org (name))
  );

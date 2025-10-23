-- Enforce residency-aware prefixes and org policy checks on storage buckets
CREATE OR REPLACE FUNCTION public.org_residency_allows (org_uuid uuid, zone text) returns boolean language sql stable AS $$
  with policy as (
    select value from public.org_policies where org_id = org_uuid and key = 'residency_zone'
  )
  select case
    when zone is null then false
    when not public.storage_residency_allowed(zone) then false
    when not exists(select 1 from policy) then true
    when jsonb_typeof((select value from policy)) = 'object' then
      lower((select value ->> 'code' from policy)) = lower(zone)
    when jsonb_typeof((select value from policy)) = 'array' then
      exists(select 1 from jsonb_array_elements_text((select value from policy)) elem where lower(elem) = lower(zone))
    else true
  end;
$$;

ALTER POLICY "Org members read authorities" ON storage.objects USING (
  bucket_id = 'authorities'
  AND public.storage_object_org (name) IS NOT NULL
  AND public.storage_object_residency (name) IS NOT NULL
  AND public.org_residency_allows (
    public.storage_object_org (name),
    public.storage_object_residency (name)
  )
  AND public.is_org_member (public.storage_object_org (name))
);

ALTER POLICY "Org members upload authorities" ON storage.objects
WITH
  CHECK (
    bucket_id = 'authorities'
    AND public.storage_object_org (name) IS NOT NULL
    AND public.storage_object_residency (name) IS NOT NULL
    AND public.org_residency_allows (
      public.storage_object_org (name),
      public.storage_object_residency (name)
    )
    AND public.is_org_member (public.storage_object_org (name))
  );

ALTER POLICY "Org members manage authorities" ON storage.objects USING (
  bucket_id = 'authorities'
  AND public.storage_object_org (name) IS NOT NULL
  AND public.storage_object_residency (name) IS NOT NULL
  AND public.org_residency_allows (
    public.storage_object_org (name),
    public.storage_object_residency (name)
  )
  AND public.is_org_member (public.storage_object_org (name))
)
WITH
  CHECK (
    bucket_id = 'authorities'
    AND public.storage_object_org (name) IS NOT NULL
    AND public.storage_object_residency (name) IS NOT NULL
    AND public.org_residency_allows (
      public.storage_object_org (name),
      public.storage_object_residency (name)
    )
    AND public.is_org_member (public.storage_object_org (name))
  );

ALTER POLICY "Org members write uploads" ON storage.objects USING (
  bucket_id = 'uploads'
  AND public.storage_object_org (name) IS NOT NULL
  AND public.storage_object_residency (name) IS NOT NULL
  AND public.org_residency_allows (
    public.storage_object_org (name),
    public.storage_object_residency (name)
  )
  AND public.is_org_member (public.storage_object_org (name))
)
WITH
  CHECK (
    bucket_id = 'uploads'
    AND public.storage_object_org (name) IS NOT NULL
    AND public.storage_object_residency (name) IS NOT NULL
    AND public.org_residency_allows (
      public.storage_object_org (name),
      public.storage_object_residency (name)
    )
    AND public.is_org_member (public.storage_object_org (name))
  );

ALTER POLICY "Org members manage snapshots" ON storage.objects USING (
  bucket_id = 'snapshots'
  AND public.storage_object_org (name) IS NOT NULL
  AND public.storage_object_residency (name) IS NOT NULL
  AND public.org_residency_allows (
    public.storage_object_org (name),
    public.storage_object_residency (name)
  )
  AND public.is_org_member (public.storage_object_org (name))
)
WITH
  CHECK (
    bucket_id = 'snapshots'
    AND public.storage_object_org (name) IS NOT NULL
    AND public.storage_object_residency (name) IS NOT NULL
    AND public.org_residency_allows (
      public.storage_object_org (name),
      public.storage_object_residency (name)
    )
    AND public.is_org_member (public.storage_object_org (name))
  );

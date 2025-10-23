ALTER TABLE public.drive_manifests enable ROW level security;

ALTER TABLE public.drive_manifest_items enable ROW level security;

DROP POLICY if EXISTS "drive manifests readable" ON public.drive_manifests;

CREATE POLICY "drive manifests readable" ON public.drive_manifests FOR
SELECT
  USING (
    org_id IS NULL
    OR public.is_org_member (org_id)
  );

DROP POLICY if EXISTS "drive manifests writable" ON public.drive_manifests;

CREATE POLICY "drive manifests writable" ON public.drive_manifests FOR ALL USING (
  org_id IS NULL
  OR public.is_org_member (org_id)
)
WITH
  CHECK (
    org_id IS NULL
    OR public.is_org_member (org_id)
  );

DROP POLICY if EXISTS "drive manifest items readable" ON public.drive_manifest_items;

CREATE POLICY "drive manifest items readable" ON public.drive_manifest_items FOR
SELECT
  USING (
    EXISTS (
      SELECT
        1
      FROM
        public.drive_manifests dm
      WHERE
        dm.id = manifest_id
        AND (
          dm.org_id IS NULL
          OR public.is_org_member (dm.org_id)
        )
    )
  );

DROP POLICY if EXISTS "drive manifest items writable" ON public.drive_manifest_items;

CREATE POLICY "drive manifest items writable" ON public.drive_manifest_items FOR ALL USING (
  EXISTS (
    SELECT
      1
    FROM
      public.drive_manifests dm
    WHERE
      dm.id = manifest_id
      AND (
        dm.org_id IS NULL
        OR public.is_org_member (dm.org_id)
      )
  )
)
WITH
  CHECK (
    EXISTS (
      SELECT
        1
      FROM
        public.drive_manifests dm
      WHERE
        dm.id = manifest_id
        AND (
          dm.org_id IS NULL
          OR public.is_org_member (dm.org_id)
        )
    )
  );

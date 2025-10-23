-- Aggregate provenance coverage per organisation and jurisdiction
CREATE OR REPLACE VIEW public.org_jurisdiction_provenance AS
WITH
  base AS (
    SELECT
      s.org_id,
      s.jurisdiction_code,
      nullif(s.residency_zone, '') AS residency_zone,
      nullif(s.binding_lang, '') AS binding_lang,
      nullif(s.language_note, '') AS language_note,
      s.source_type,
      s.consolidated,
      nullif(s.eli, '') AS eli,
      nullif(s.ecli, '') AS ecli,
      s.akoma_ntoso
    FROM
      public.sources s
  ),
  residency AS (
    SELECT
      org_id,
      jurisdiction_code,
      coalesce(
        max(residency_zone) FILTER (
          WHERE
            residency_zone IS NOT NULL
        ),
        'unknown'
      ) AS residency_zone
    FROM
      base
    GROUP BY
      org_id,
      jurisdiction_code
  ),
  binding_breakdown AS (
    SELECT
      org_id,
      jurisdiction_code,
      jsonb_object_agg(
        binding_lang,
        binding_count
        ORDER BY
          binding_lang
      ) AS binding_breakdown
    FROM
      (
        SELECT
          org_id,
          jurisdiction_code,
          binding_lang,
          count(*) AS binding_count
        FROM
          base
        WHERE
          binding_lang IS NOT NULL
        GROUP BY
          org_id,
          jurisdiction_code,
          binding_lang
      ) counts
    GROUP BY
      org_id,
      jurisdiction_code
  ),
  source_type_breakdown AS (
    SELECT
      org_id,
      jurisdiction_code,
      jsonb_object_agg(
        source_type,
        type_count
        ORDER BY
          source_type
      ) AS source_type_breakdown
    FROM
      (
        SELECT
          org_id,
          jurisdiction_code,
          source_type,
          count(*) AS type_count
        FROM
          base
        GROUP BY
          org_id,
          jurisdiction_code,
          source_type
      ) counts
    GROUP BY
      org_id,
      jurisdiction_code
  ),
  language_note_breakdown AS (
    SELECT
      org_id,
      jurisdiction_code,
      jsonb_object_agg(
        language_note,
        note_count
        ORDER BY
          language_note
      ) AS language_note_breakdown
    FROM
      (
        SELECT
          org_id,
          jurisdiction_code,
          language_note,
          count(*) AS note_count
        FROM
          base
        WHERE
          language_note IS NOT NULL
        GROUP BY
          org_id,
          jurisdiction_code,
          language_note
      ) counts
    GROUP BY
      org_id,
      jurisdiction_code
  )
SELECT
  b.org_id,
  b.jurisdiction_code,
  coalesce(r.residency_zone, 'unknown') AS residency_zone,
  count(*) AS total_sources,
  count(*) FILTER (
    WHERE
      b.consolidated
  ) AS sources_consolidated,
  count(*) FILTER (
    WHERE
      b.binding_lang IS NOT NULL
  ) AS sources_with_binding,
  count(*) FILTER (
    WHERE
      b.language_note IS NOT NULL
  ) AS sources_with_language_note,
  count(*) FILTER (
    WHERE
      b.eli IS NOT NULL
  ) AS sources_with_eli,
  count(*) FILTER (
    WHERE
      b.ecli IS NOT NULL
  ) AS sources_with_ecli,
  count(*) FILTER (
    WHERE
      b.akoma_ntoso IS NOT NULL
  ) AS sources_with_akoma,
  coalesce(bb.binding_breakdown, '{}'::jsonb) AS binding_breakdown,
  coalesce(st.source_type_breakdown, '{}'::jsonb) AS source_type_breakdown,
  coalesce(ln.language_note_breakdown, '{}'::jsonb) AS language_note_breakdown
FROM
  base b
  LEFT JOIN residency r ON r.org_id = b.org_id
  AND r.jurisdiction_code = b.jurisdiction_code
  LEFT JOIN binding_breakdown bb ON bb.org_id = b.org_id
  AND bb.jurisdiction_code = b.jurisdiction_code
  LEFT JOIN source_type_breakdown st ON st.org_id = b.org_id
  AND st.jurisdiction_code = b.jurisdiction_code
  LEFT JOIN language_note_breakdown ln ON ln.org_id = b.org_id
  AND ln.jurisdiction_code = b.jurisdiction_code
GROUP BY
  b.org_id,
  b.jurisdiction_code,
  r.residency_zone,
  bb.binding_breakdown,
  st.source_type_breakdown,
  ln.language_note_breakdown;

ALTER VIEW public.org_jurisdiction_provenance
SET
  (security_invoker = TRUE);

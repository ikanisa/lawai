-- Provide provenance and link-health aggregates per organisation
CREATE OR REPLACE VIEW public.org_provenance_metrics AS
WITH
  source_counts AS (
    SELECT
      s.org_id,
      count(*) AS total_sources,
      count(*) FILTER (
        WHERE
          coalesce(s.binding_lang, '') <> ''
      ) AS with_binding,
      count(*) FILTER (
        WHERE
          coalesce(s.language_note, '') <> ''
      ) AS with_language_note,
      count(*) FILTER (
        WHERE
          coalesce(s.eli, '') <> ''
      ) AS with_eli,
      count(*) FILTER (
        WHERE
          coalesce(s.ecli, '') <> ''
      ) AS with_ecli,
      count(*) FILTER (
        WHERE
          coalesce(s.residency_zone, '') <> ''
      ) AS with_residency,
      count(*) FILTER (
        WHERE
          s.link_last_status = 'ok'
          AND s.link_last_checked_at >= now() - interval '30 days'
      ) AS link_ok_recent,
      count(*) FILTER (
        WHERE
          s.link_last_status = 'ok'
          AND (
            s.link_last_checked_at IS NULL
            OR s.link_last_checked_at < now() - interval '30 days'
          )
      ) AS link_stale,
      count(*) FILTER (
        WHERE
          s.link_last_status = 'failed'
      ) AS link_failed
    FROM
      public.sources s
    GROUP BY
      s.org_id
  ),
  binding_breakdown AS (
    SELECT
      org_id,
      jsonb_object_agg(
        binding_lang,
        binding_count
        ORDER BY
          binding_lang
      ) AS binding_breakdown
    FROM
      (
        SELECT
          s.org_id,
          s.binding_lang,
          count(*) AS binding_count
        FROM
          public.sources s
        WHERE
          coalesce(s.binding_lang, '') <> ''
        GROUP BY
          s.org_id,
          s.binding_lang
      ) binding
    GROUP BY
      org_id
  ),
  residency_breakdown AS (
    SELECT
      org_id,
      jsonb_object_agg(
        residency_zone,
        residency_count
        ORDER BY
          residency_zone
      ) AS residency_breakdown
    FROM
      (
        SELECT
          s.org_id,
          s.residency_zone,
          count(*) AS residency_count
        FROM
          public.sources s
        WHERE
          coalesce(s.residency_zone, '') <> ''
        GROUP BY
          s.org_id,
          s.residency_zone
      ) residency
    GROUP BY
      org_id
  ),
  chunk_summary AS (
    SELECT
      dc.org_id,
      count(*) AS total_chunks,
      count(*) FILTER (
        WHERE
          coalesce(dc.article_or_section, '') <> ''
      ) AS chunks_with_markers
    FROM
      public.document_chunks dc
    GROUP BY
      dc.org_id
  )
SELECT
  o.id AS org_id,
  coalesce(sc.total_sources, 0) AS total_sources,
  coalesce(sc.with_binding, 0) AS sources_with_binding,
  coalesce(sc.with_language_note, 0) AS sources_with_language_note,
  coalesce(sc.with_eli, 0) AS sources_with_eli,
  coalesce(sc.with_ecli, 0) AS sources_with_ecli,
  coalesce(sc.with_residency, 0) AS sources_with_residency,
  coalesce(sc.link_ok_recent, 0) AS sources_link_ok_recent,
  coalesce(sc.link_stale, 0) AS sources_link_stale,
  coalesce(sc.link_failed, 0) AS sources_link_failed,
  coalesce(bb.binding_breakdown, '{}'::jsonb) AS binding_breakdown,
  coalesce(rb.residency_breakdown, '{}'::jsonb) AS residency_breakdown,
  coalesce(cs.total_chunks, 0) AS chunk_total,
  coalesce(cs.chunks_with_markers, 0) AS chunks_with_markers
FROM
  public.organizations o
  LEFT JOIN source_counts sc ON sc.org_id = o.id
  LEFT JOIN binding_breakdown bb ON bb.org_id = o.id
  LEFT JOIN residency_breakdown rb ON rb.org_id = o.id
  LEFT JOIN chunk_summary cs ON cs.org_id = o.id;

ALTER VIEW public.org_provenance_metrics
SET
  (security_invoker = TRUE);

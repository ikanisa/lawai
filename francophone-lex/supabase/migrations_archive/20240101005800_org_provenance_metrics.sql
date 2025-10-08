-- Provide provenance and link-health aggregates per organisation
create or replace view public.org_provenance_metrics as
with source_counts as (
  select
    s.org_id,
    count(*) as total_sources,
    count(*) filter (where coalesce(s.binding_lang, '') <> '') as with_binding,
    count(*) filter (where coalesce(s.language_note, '') <> '') as with_language_note,
    count(*) filter (where coalesce(s.eli, '') <> '') as with_eli,
    count(*) filter (where coalesce(s.ecli, '') <> '') as with_ecli,
    count(*) filter (where coalesce(s.residency_zone, '') <> '') as with_residency,
    count(*) filter (
      where s.link_last_status = 'ok'
        and s.link_last_checked_at >= now() - interval '30 days'
    ) as link_ok_recent,
    count(*) filter (
      where s.link_last_status = 'ok'
        and (s.link_last_checked_at is null or s.link_last_checked_at < now() - interval '30 days')
    ) as link_stale,
    count(*) filter (where s.link_last_status = 'failed') as link_failed
  from public.sources s
  group by s.org_id
), binding_breakdown as (
  select
    org_id,
    jsonb_object_agg(binding_lang, binding_count order by binding_lang) as binding_breakdown
  from (
    select
      s.org_id,
      s.binding_lang,
      count(*) as binding_count
    from public.sources s
    where coalesce(s.binding_lang, '') <> ''
    group by s.org_id, s.binding_lang
  ) binding
  group by org_id
), residency_breakdown as (
  select
    org_id,
    jsonb_object_agg(residency_zone, residency_count order by residency_zone) as residency_breakdown
  from (
    select
      s.org_id,
      s.residency_zone,
      count(*) as residency_count
    from public.sources s
    where coalesce(s.residency_zone, '') <> ''
    group by s.org_id, s.residency_zone
  ) residency
  group by org_id
), chunk_summary as (
  select
    dc.org_id,
    count(*) as total_chunks,
    count(*) filter (where coalesce(dc.article_or_section, '') <> '') as chunks_with_markers
  from public.document_chunks dc
  group by dc.org_id
)
select
  o.id as org_id,
  coalesce(sc.total_sources, 0) as total_sources,
  coalesce(sc.with_binding, 0) as sources_with_binding,
  coalesce(sc.with_language_note, 0) as sources_with_language_note,
  coalesce(sc.with_eli, 0) as sources_with_eli,
  coalesce(sc.with_ecli, 0) as sources_with_ecli,
  coalesce(sc.with_residency, 0) as sources_with_residency,
  coalesce(sc.link_ok_recent, 0) as sources_link_ok_recent,
  coalesce(sc.link_stale, 0) as sources_link_stale,
  coalesce(sc.link_failed, 0) as sources_link_failed,
  coalesce(bb.binding_breakdown, '{}'::jsonb) as binding_breakdown,
  coalesce(rb.residency_breakdown, '{}'::jsonb) as residency_breakdown,
  coalesce(cs.total_chunks, 0) as chunk_total,
  coalesce(cs.chunks_with_markers, 0) as chunks_with_markers
from public.organizations o
left join source_counts sc on sc.org_id = o.id
left join binding_breakdown bb on bb.org_id = o.id
left join residency_breakdown rb on rb.org_id = o.id
left join chunk_summary cs on cs.org_id = o.id;

alter view public.org_provenance_metrics set (security_invoker = true);

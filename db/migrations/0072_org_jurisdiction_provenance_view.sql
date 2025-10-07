-- Aggregate provenance coverage per organisation and jurisdiction
create or replace view public.org_jurisdiction_provenance as
with base as (
  select
    s.org_id,
    s.jurisdiction_code,
    nullif(s.residency_zone, '') as residency_zone,
    nullif(s.binding_lang, '') as binding_lang,
    nullif(s.language_note, '') as language_note,
    s.source_type,
    s.consolidated,
    nullif(s.eli, '') as eli,
    nullif(s.ecli, '') as ecli,
    s.akoma_ntoso
  from public.sources s
),
residency as (
  select
    org_id,
    jurisdiction_code,
    -- prefer explicit residency zone when present; fallback to most frequent value
    coalesce(
      max(residency_zone) filter (where residency_zone is not null),
      'unknown'
    ) as residency_zone
  from base
  group by org_id, jurisdiction_code
),
binding_breakdown as (
  select
    org_id,
    jurisdiction_code,
    jsonb_object_agg(binding_lang, binding_count order by binding_lang) as binding_breakdown
  from (
    select
      org_id,
      jurisdiction_code,
      binding_lang,
      count(*) as binding_count
    from base
    where binding_lang is not null
    group by org_id, jurisdiction_code, binding_lang
  ) counts
  group by org_id, jurisdiction_code
),
source_type_breakdown as (
  select
    org_id,
    jurisdiction_code,
    jsonb_object_agg(source_type, type_count order by source_type) as source_type_breakdown
  from (
    select
      org_id,
      jurisdiction_code,
      source_type,
      count(*) as type_count
    from base
    group by org_id, jurisdiction_code, source_type
  ) counts
  group by org_id, jurisdiction_code
),
language_note_breakdown as (
  select
    org_id,
    jurisdiction_code,
    jsonb_object_agg(language_note, note_count order by language_note) as language_note_breakdown
  from (
    select
      org_id,
      jurisdiction_code,
      language_note,
      count(*) as note_count
    from base
    where language_note is not null
    group by org_id, jurisdiction_code, language_note
  ) counts
  group by org_id, jurisdiction_code
)
select
  b.org_id,
  b.jurisdiction_code,
  coalesce(r.residency_zone, 'unknown') as residency_zone,
  count(*) as total_sources,
  count(*) filter (where b.consolidated) as sources_consolidated,
  count(*) filter (where b.binding_lang is not null) as sources_with_binding,
  count(*) filter (where b.language_note is not null) as sources_with_language_note,
  count(*) filter (where b.eli is not null) as sources_with_eli,
  count(*) filter (where b.ecli is not null) as sources_with_ecli,
  count(*) filter (where b.akoma_ntoso is not null) as sources_with_akoma,
  coalesce(bb.binding_breakdown, '{}'::jsonb) as binding_breakdown,
  coalesce(st.source_type_breakdown, '{}'::jsonb) as source_type_breakdown,
  coalesce(ln.language_note_breakdown, '{}'::jsonb) as language_note_breakdown
from base b
left join residency r on r.org_id = b.org_id and r.jurisdiction_code = b.jurisdiction_code
left join binding_breakdown bb on bb.org_id = b.org_id and bb.jurisdiction_code = b.jurisdiction_code
left join source_type_breakdown st on st.org_id = b.org_id and st.jurisdiction_code = b.jurisdiction_code
left join language_note_breakdown ln on ln.org_id = b.org_id and ln.jurisdiction_code = b.jurisdiction_code
group by
  b.org_id,
  b.jurisdiction_code,
  r.residency_zone,
  bb.binding_breakdown,
  st.source_type_breakdown,
  ln.language_note_breakdown;

alter view public.org_jurisdiction_provenance set (security_invoker = true);

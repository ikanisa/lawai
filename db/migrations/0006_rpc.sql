create or replace function public.match_chunks(
  p_org uuid,
  p_query_embedding vector(3072),
  p_match_count int default 8,
  p_min_sim float default 0.75,
  p_jurisdiction text default null
)
returns table(
  chunk_id uuid,
  document_id uuid,
  jurisdiction_code text,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    dc.id as chunk_id,
    dc.document_id,
    dc.jurisdiction_code,
    dc.content,
    1 - (dc.embedding <=> p_query_embedding) as similarity
  from public.document_chunks dc
  where dc.org_id = p_org
    and (p_jurisdiction is null or dc.jurisdiction_code = p_jurisdiction)
    and 1 - (dc.embedding <=> p_query_embedding) >= p_min_sim
  order by dc.embedding <=> p_query_embedding
  limit p_match_count
$$;

create or replace function public.domain_in_allowlist(url text)
returns boolean
language sql
immutable
as $$
  with host as (
    select lower(regexp_replace(regexp_replace(url, '^https?://', ''), '/.*$', '')) as h
  )
  select exists (
    select 1
    from public.authority_domains d
    join host on host.h = d.host
  );
$$;

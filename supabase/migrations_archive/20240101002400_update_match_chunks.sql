-- Update match_chunks RPC to expose trust metadata
DROP FUNCTION if EXISTS public.match_chunks (uuid, vector (1536), int, float, text);

CREATE OR REPLACE FUNCTION public.match_chunks (
  p_org uuid,
  p_query_embedding vector (1536),
  p_match_count int DEFAULT 8,
  p_min_sim float DEFAULT 0.75,
  p_jurisdiction text DEFAULT NULL
) returns TABLE (
  chunk_id uuid,
  document_id uuid,
  source_id uuid,
  jurisdiction_code text,
  trust_tier text,
  source_type text,
  similarity float,
  content text
) language sql stable AS $$
  select
    dc.id as chunk_id,
    dc.document_id,
    doc.source_id,
    dc.jurisdiction_code,
    coalesce(src.trust_tier, 'T4') as trust_tier,
    src.source_type,
    1 - (dc.embedding <=> p_query_embedding) as similarity,
    dc.content
  from public.document_chunks dc
  join public.documents doc on doc.id = dc.document_id
  left join public.sources src on src.id = doc.source_id
  where dc.org_id = p_org
    and (p_jurisdiction is null or dc.jurisdiction_code = p_jurisdiction)
    and (src.trust_tier is null or src.trust_tier <> 'T4' or 1 - (dc.embedding <=> p_query_embedding) >= p_min_sim)
  order by (1 - (dc.embedding <=> p_query_embedding)) desc
  limit p_match_count
$$;

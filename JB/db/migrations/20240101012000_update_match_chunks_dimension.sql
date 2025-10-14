-- Align match_chunks RPC with 3072-dimension embeddings
DROP FUNCTION IF EXISTS public.match_chunks(uuid, vector(1536), int, float, text);

CREATE OR REPLACE FUNCTION public.match_chunks(
  p_org uuid,
  p_query_embedding vector(3072),
  p_match_count int DEFAULT 8,
  p_min_sim float DEFAULT 0.75,
  p_jurisdiction text DEFAULT null
)
RETURNS TABLE(
  chunk_id uuid,
  document_id uuid,
  source_id uuid,
  jurisdiction_code text,
  trust_tier text,
  source_type text,
  similarity float,
  content text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    dc.id AS chunk_id,
    dc.document_id,
    doc.source_id,
    dc.jurisdiction_code,
    COALESCE(src.trust_tier, 'T4') AS trust_tier,
    src.source_type,
    1 - (dc.embedding <=> p_query_embedding) AS similarity,
    dc.content
  FROM public.document_chunks dc
  JOIN public.documents doc ON doc.id = dc.document_id
  LEFT JOIN public.sources src ON src.id = doc.source_id
  WHERE dc.org_id = p_org
    AND (p_jurisdiction IS NULL OR dc.jurisdiction_code = p_jurisdiction)
    AND (
      src.trust_tier IS NULL OR
      src.trust_tier <> 'T4' OR
      1 - (dc.embedding <=> p_query_embedding) >= p_min_sim
    )
  ORDER BY (1 - (dc.embedding <=> p_query_embedding)) DESC
  LIMIT p_match_count
$$;

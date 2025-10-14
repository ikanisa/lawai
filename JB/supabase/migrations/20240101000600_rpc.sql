DO $$
BEGIN
  EXECUTE '
    CREATE FUNCTION public.match_chunks(
      p_org uuid,
      p_query_embedding vector(1536),
      p_match_count int DEFAULT 8,
      p_min_sim float DEFAULT 0.75,
      p_jurisdiction text DEFAULT NULL
    )
    RETURNS TABLE (
      chunk_id uuid,
      document_id uuid,
      jurisdiction_code text,
      content text,
      similarity float
    )
    LANGUAGE sql
    STABLE
    AS $fn$
      SELECT
        dc.id AS chunk_id,
        dc.document_id,
        dc.jurisdiction_code,
        dc.content,
        1 - (dc.embedding <=> p_query_embedding) AS similarity
      FROM public.document_chunks dc
      WHERE dc.org_id = p_org
        AND (p_jurisdiction IS NULL OR dc.jurisdiction_code = p_jurisdiction)
        AND 1 - (dc.embedding <=> p_query_embedding) >= p_min_sim
      ORDER BY dc.embedding <=> p_query_embedding
      LIMIT p_match_count
    $fn$;
  ';
EXCEPTION
  WHEN duplicate_function THEN
    NULL;
END
$$;

DO $$
BEGIN
  EXECUTE '
    CREATE FUNCTION public.domain_in_allowlist(url text)
    RETURNS boolean
    LANGUAGE sql
    IMMUTABLE
    AS $fn$
      WITH host AS (
        SELECT lower(regexp_replace(regexp_replace(url, ''^https?://'', ''''), ''/.*$'', '''')) AS h
      )
      SELECT EXISTS (
        SELECT 1
        FROM public.authority_domains d
        JOIN host ON host.h = d.host
      );
    $fn$;
  ';
EXCEPTION
  WHEN duplicate_function THEN
    NULL;
END
$$;

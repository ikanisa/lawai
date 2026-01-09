# pgvector Setup Guide

## Overview

pgvector is a PostgreSQL extension for storing and querying vector embeddings. This guide explains how to integrate it for optimized semantic search.

## Current Implementation

The current semantic search uses in-memory cosine similarity calculation, which works well for small to medium document sets. pgvector provides better performance for large-scale deployments.

## Setup Steps

### 1. Install pgvector Extension

```sql
-- Connect to your PostgreSQL database
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Update Prisma Schema

Add pgvector support to the Document model:

```prisma
model Document {
  // ... existing fields ...
  
  // Change from Json to Unsupported for native vector type
  embeddingVector Unsupported("vector(1536)")? @map("embedding_vector")
  
  // Add index for vector similarity search
  @@index([embeddingVector(ops: VectorL2Ops)], type: Hnsw)
}
```

**Note**: Prisma doesn't natively support pgvector, so you'll need to use `Unsupported` type and handle migrations manually.

### 3. Manual Migration

Create a migration file:

```sql
-- Add vector column if not exists
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);

-- Create HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS documents_embedding_vector_idx 
ON documents 
USING hnsw (embedding_vector vector_l2_ops);

-- Migrate existing JSON embeddings to vector type
UPDATE documents
SET embedding_vector = (
  SELECT embedding::vector(1536)
  FROM jsonb_array_elements(embedding_vector::jsonb) AS embedding
)
WHERE embedding_vector IS NOT NULL 
  AND jsonb_typeof(embedding_vector::jsonb) = 'array';
```

### 4. Update Document Processor

Modify `lib/document-processor.ts` to store embeddings as arrays (Prisma will handle conversion):

```typescript
// No changes needed - arrays work with pgvector
await prisma.document.update({
  where: { id: documentId },
  data: {
    embeddingVector: embedding, // Array of numbers
  },
});
```

### 5. Update Search Query

Modify `app/api/vaults/[vaultId]/search/route.ts` to use pgvector:

```typescript
// Use raw SQL for pgvector queries
const results = await prisma.$queryRaw`
  SELECT 
    id,
    title,
    filename,
    extracted_text,
    ai_summary,
    uploaded_at,
    review_status,
    embedding_vector <-> ${queryEmbedding}::vector AS distance
  FROM documents
  WHERE vault_id = ${vaultId}
    AND extraction_status = 'completed'
    AND embedding_vector IS NOT NULL
  ORDER BY distance
  LIMIT ${limit}
`;
```

### 6. Alternative: Use Prisma Extension

You can also use a Prisma extension for better type safety:

```typescript
import { PrismaClient } from '@prisma/client';
import { withPgvector } from 'prisma-extension-pgvector';

const prisma = new PrismaClient().$extends(withPgvector());
```

## Performance Comparison

| Method | Small (<100 docs) | Medium (100-1K) | Large (1K-10K) | Very Large (10K+) |
|--------|-------------------|-----------------|----------------|-------------------|
| In-Memory | Fast | Medium | Slow | Very Slow |
| pgvector | Fast | Fast | Fast | Fast |

## When to Use pgvector

**Use pgvector if:**
- You have 1,000+ documents per vault
- You need sub-second search performance
- You're running in production at scale

**Current implementation is fine if:**
- You have <1,000 documents per vault
- Search performance is acceptable
- You want to avoid database extension setup

## Testing

After setup, test with:

```sql
-- Test vector similarity
SELECT 
  title,
  embedding_vector <-> '[0.1,0.2,...]'::vector AS distance
FROM documents
WHERE embedding_vector IS NOT NULL
ORDER BY distance
LIMIT 10;
```

## Resources

- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [pgvector Documentation](https://github.com/pgvector/pgvector#installation)
- [Prisma pgvector Extension](https://github.com/olivierwilkinson/prisma-extension-pgvector)

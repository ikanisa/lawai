import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { generateEmbedding } from '@/lib/document-processor';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/vaults/[vaultId]/search
 * Semantic search across vault documents
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { vaultId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify vault access
    const vault = await prisma.vault.findFirst({
      where: {
        id: params.vaultId,
        matter: {
          organizationId: user.organizationId,
          OR: [
            { ownerId: user.id },
            {
              teamMembers: {
                some: {
                  userId: user.id,
                },
              },
            },
          ],
        },
      },
    });

    if (!vault) {
      return NextResponse.json(
        { error: 'Vault not found or access denied' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { query, limit = 20, filters } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query string is required' },
        { status: 400 }
      );
    }

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Get all documents in vault with embeddings
    const documents = await prisma.document.findMany({
      where: {
        vaultId: vault.id,
        extractionStatus: 'completed',
        embeddingVector: { not: null },
        ...(filters?.fileTypes && {
          fileType: { in: filters.fileTypes },
        }),
        ...(filters?.reviewStatus && {
          reviewStatus: filters.reviewStatus,
        }),
      },
      select: {
        id: true,
        title: true,
        filename: true,
        extractedText: true,
        embeddingVector: true,
        aiSummary: true,
        uploadedAt: true,
        reviewStatus: true,
      },
      take: 100, // Limit initial fetch for performance
    });

    // Calculate cosine similarity (simplified - in production use pgvector)
    const results = documents
      .map((doc) => {
        if (!doc.embeddingVector || !Array.isArray(doc.embeddingVector)) {
          return null;
        }

        const similarity = cosineSimilarity(
          queryEmbedding,
          doc.embeddingVector as number[]
        );

        return {
          document: {
            id: doc.id,
            title: doc.title,
            filename: doc.filename,
            summary: doc.aiSummary,
            uploadedAt: doc.uploadedAt,
            reviewStatus: doc.reviewStatus,
          },
          similarity,
          // Extract relevant snippet
          snippet: extractRelevantSnippet(doc.extractedText || '', query),
        };
      })
      .filter((r) => r !== null)
      .sort((a, b) => (b?.similarity || 0) - (a?.similarity || 0))
      .slice(0, limit);

    // Also do keyword search for documents without embeddings
    const keywordResults = await prisma.document.findMany({
      where: {
        vaultId: vault.id,
        extractionStatus: 'completed',
        OR: [
          { embeddingVector: null },
          { extractedText: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        title: true,
        filename: true,
        extractedText: true,
        aiSummary: true,
        uploadedAt: true,
        reviewStatus: true,
      },
      take: 10,
    });

    // Combine results (semantic + keyword)
    const allResults = [
      ...results.map((r) => ({ ...r, type: 'semantic' as const })),
      ...keywordResults.map((doc) => ({
        document: {
          id: doc.id,
          title: doc.title,
          filename: doc.filename,
          summary: doc.aiSummary,
          uploadedAt: doc.uploadedAt,
          reviewStatus: doc.reviewStatus,
        },
        similarity: 0.5, // Default for keyword matches
        snippet: extractRelevantSnippet(doc.extractedText || '', query),
        type: 'keyword' as const,
      })),
    ]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return NextResponse.json({
      query,
      results: allResults,
      total: allResults.length,
    });
  } catch (error) {
    console.error('Vault search error:', error);
    return NextResponse.json(
      { error: 'Failed to search vault', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Extract relevant snippet from text containing query
 */
function extractRelevantSnippet(text: string, query: string): string {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const index = textLower.indexOf(queryLower);

  if (index === -1) {
    // Return first 200 chars if query not found
    return text.substring(0, 200) + (text.length > 200 ? '...' : '');
  }

  // Extract 100 chars before and after the query
  const start = Math.max(0, index - 100);
  const end = Math.min(text.length, index + query.length + 100);

  let snippet = text.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}

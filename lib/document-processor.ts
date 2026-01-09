/**
 * Document Processing Pipeline
 * Handles file upload, extraction, OCR, and embedding generation
 */

import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { prisma } from './db';
import OpenAI from 'openai';

const getOpenAIApiKey = () => {
  return (
    process.env.OPENAI_API_KEY ||
    process.env.SUPABASE_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY_SECRET
  );
};

const openaiApiKey = getOpenAIApiKey();
const openai = new OpenAI({
  apiKey: openaiApiKey || 'dummy-key',
});

/**
 * Calculate SHA-256 hash of file for deduplication
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  const fileBuffer = await readFile(filePath);
  return createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Extract text from document based on file type
 */
export async function extractTextFromDocument(
  filePath: string,
  mimeType: string,
  filename: string
): Promise<string> {
  // For PDF files
  if (mimeType === 'application/pdf' || filename.endsWith('.pdf')) {
    return await extractTextFromPDF(filePath);
  }

  // For text files
  if (mimeType.startsWith('text/') || filename.endsWith('.txt')) {
    const content = await readFile(filePath, 'utf-8');
    return content;
  }

  // For Word documents (simplified - in production use mammoth or docx library)
  if (
    mimeType.includes('wordprocessingml') ||
    filename.endsWith('.docx')
  ) {
    // Placeholder - in production, use a proper DOCX parser
    return 'DOCX extraction not yet implemented. Please convert to PDF or text.';
  }

  // For images (OCR would go here)
  if (mimeType.startsWith('image/')) {
    // Placeholder for OCR - in production use Tesseract.js or cloud OCR service
    return 'OCR extraction not yet implemented. Please provide text-based documents.';
  }

  return '';
}

/**
 * Extract text from PDF (simplified version)
 * In production, use pdf-parse or pdfjs-dist
 */
async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    // Placeholder - in production use pdf-parse:
    // const pdfParse = require('pdf-parse');
    // const dataBuffer = await readFile(filePath);
    // const data = await pdfParse(dataBuffer);
    // return data.text;

    // For now, return placeholder
    return 'PDF text extraction placeholder. Install pdf-parse for full functionality.';
  } catch (error) {
    console.error('PDF extraction error:', error);
    return '';
  }
}

/**
 * Generate embedding vector for document text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small', // or text-embedding-ada-002
      input: text.substring(0, 8000), // Limit to 8000 chars
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Embedding generation error:', error);
    throw error;
  }
}

/**
 * Process document: extract text, generate embedding, analyze
 */
export async function processDocument(
  documentId: string,
  filePath: string,
  mimeType: string,
  filename: string
): Promise<void> {
  try {
    // Update status to processing
    await prisma.document.update({
      where: { id: documentId },
      data: { extractionStatus: 'processing' },
    });

    // Extract text
    const extractedText = await extractTextFromDocument(
      filePath,
      mimeType,
      filename
    );

    // Generate embedding
    let embedding: number[] | null = null;
    if (extractedText) {
      try {
        embedding = await generateEmbedding(extractedText);
      } catch (error) {
        console.error('Failed to generate embedding:', error);
      }
    }

    // Generate AI summary
    let aiSummary: string | null = null;
    if (extractedText && extractedText.length > 100) {
      try {
        const summaryResponse = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content:
                'Summarize this legal document in 2-3 sentences. Focus on key points, parties, and important dates.',
            },
            {
              role: 'user',
              content: extractedText.substring(0, 4000),
            },
          ],
          max_tokens: 200,
          temperature: 0.3,
        });
        aiSummary = summaryResponse.choices[0]?.message?.content || null;
      } catch (error) {
        console.error('Failed to generate summary:', error);
      }
    }

    // Update document with extracted data
    await prisma.document.update({
      where: { id: documentId },
      data: {
        extractionStatus: 'completed',
        extractedText: extractedText || null,
        embeddingVector: embedding ? (embedding as any) : null, // Store as JSON for now
        aiSummary,
        aiMetadata: {
          extractedAt: new Date().toISOString(),
          textLength: extractedText.length,
          hasEmbedding: !!embedding,
        },
      },
    });
  } catch (error) {
    console.error('Document processing error:', error);
    await prisma.document.update({
      where: { id: documentId },
      data: {
        extractionStatus: 'failed',
        aiMetadata: {
          error: String(error),
        },
      },
    });
    throw error;
  }
}

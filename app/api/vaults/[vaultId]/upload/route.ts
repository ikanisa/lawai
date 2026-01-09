import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { processDocument } from '@/lib/document-processor';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/vaults/[vaultId]/upload
 * Bulk upload documents to vault
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

    // Verify vault exists and user has access
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
                  role: { in: ['editor', 'contributor'] },
                },
              },
            },
          ],
        },
      },
      include: {
        matter: true,
      },
    });

    if (!vault) {
      return NextResponse.json(
        { error: 'Vault not found or access denied' },
        { status: 404 }
      );
    }

    // Check vault capacity
    const documentCount = await prisma.document.count({
      where: { vaultId: vault.id },
    });

    if (documentCount >= vault.maxDocuments) {
      return NextResponse.json(
        { error: `Vault is full. Maximum ${vault.maxDocuments} documents allowed.` },
        { status: 400 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const preserveStructure = formData.get('preserveStructure') === 'true';

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Create upload directory
    const uploadDir = join(process.cwd(), 'uploads', vault.id);
    await mkdir(uploadDir, { recursive: true });

    const uploadResults: Array<{
      filename: string;
      documentId: string;
      status: 'success' | 'duplicate' | 'error';
      error?: string;
    }> = [];

    // Process each file
    for (const file of files) {
      try {
        const fileBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(fileBuffer);

        // Calculate file hash for deduplication
        const hash = createHash('sha256');
        hash.update(buffer);
        const fileHash = hash.digest('hex');

        // Check for duplicates
        const existingDoc = await prisma.document.findFirst({
          where: {
            vaultId: vault.id,
            fileHash,
          },
        });

        if (existingDoc) {
          uploadResults.push({
            filename: file.name,
            documentId: existingDoc.id,
            status: 'duplicate',
          });
          continue;
        }

        // Save file to disk
        const filePath = join(uploadDir, file.name);
        await writeFile(filePath, buffer);

        // Create document record
        const document = await prisma.document.create({
          data: {
            vaultId: vault.id,
            userId: user.id,
            title: file.name,
            filename: file.name,
            filePath: filePath,
            fileType: file.type || getFileType(file.name),
            fileSize: BigInt(buffer.length),
            fileHash,
            path: preserveStructure ? file.name : null,
            extractionStatus: 'pending',
          },
        });

        uploadResults.push({
          filename: file.name,
          documentId: document.id,
          status: 'success',
        });

        // Process document asynchronously (in production, use a job queue)
        processDocument(document.id, filePath, file.type, file.name).catch(
          (error) => {
            console.error(`Failed to process document ${document.id}:`, error);
          }
        );
      } catch (error) {
        uploadResults.push({
          filename: file.name,
          documentId: '',
          status: 'error',
          error: String(error),
        });
      }
    }

    // Log audit event
    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action: 'VAULT_BULK_UPLOAD',
        resourceType: 'vault',
        resourceId: vault.id,
        metadata: {
          filesCount: files.length,
          results: uploadResults,
        },
      },
    });

    return NextResponse.json({
      success: true,
      vaultId: vault.id,
      uploaded: uploadResults.filter((r) => r.status === 'success').length,
      duplicates: uploadResults.filter((r) => r.status === 'duplicate').length,
      errors: uploadResults.filter((r) => r.status === 'error').length,
      results: uploadResults,
    });
  } catch (error) {
    console.error('Vault upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload documents', details: String(error) },
      { status: 500 }
    );
  }
}

function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const typeMap: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
  };
  return typeMap[ext || ''] || 'application/octet-stream';
}


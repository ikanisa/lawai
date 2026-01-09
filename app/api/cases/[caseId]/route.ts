import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { LawAIAgent } from '@/lib/ai-agent';

export async function GET(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const session = await requireAuth();
    if (session instanceof NextResponse) return session;

    const case_ = await prisma.case.findFirst({
      where: {
        id: params.caseId,
        // Staff can only see their own cases
        ...(session.user.role !== 'ADMIN' && {
          OR: [
            { createdBy: session.user.id },
            { assignedTo: session.user.id },
          ],
        }),
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
        documents: {
          orderBy: { uploadedAt: 'desc' },
        },
        chatSessions: {
          orderBy: { updatedAt: 'desc' },
          take: 5,
        },
        _count: {
          select: { documents: true, chatSessions: true },
        },
      },
    });

    if (!case_) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    return NextResponse.json(case_);
  } catch (error) {
    console.error('Get case error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch case' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const session = await requireAuth();
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const { title, description, status, assignedTo } = body;

    // Verify ownership or admin
    const existingCase = await prisma.case.findFirst({
      where: {
        id: params.caseId,
        ...(session.user.role !== 'ADMIN' && {
          OR: [
            { createdBy: session.user.id },
            { assignedTo: session.user.id },
          ],
        }),
      },
    });

    if (!existingCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const updatedCase = await prisma.case.update({
      where: { id: params.caseId },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(assignedTo !== undefined && { assignedTo }),
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CASE_UPDATED',
        resourceType: 'case',
        resourceId: updatedCase.id,
        metadata: { changes: body },
      },
    });

    return NextResponse.json(updatedCase);
  } catch (error) {
    console.error('Update case error:', error);
    return NextResponse.json(
      { error: 'Failed to update case' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const session = await requireAuth();
    if (session instanceof NextResponse) return session;

    // Only admin can delete cases
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    await prisma.case.delete({
      where: { id: params.caseId },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CASE_DELETED',
        resourceType: 'case',
        resourceId: params.caseId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete case error:', error);
    return NextResponse.json(
      { error: 'Failed to delete case' },
      { status: 500 }
    );
  }
}

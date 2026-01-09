import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createSessionSchema = z.object({
  title: z.string().optional(),
  caseId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (session instanceof NextResponse) return session;

    const sessions = await prisma.chatSession.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Get sessions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const { title, caseId } = createSessionSchema.parse(body);

    // Verify case access if caseId provided
    if (caseId) {
      const case_ = await prisma.case.findFirst({
        where: {
          id: caseId,
          ...(session.user.role !== 'ADMIN' && {
            OR: [
              { createdBy: session.user.id },
              { assignedTo: session.user.id },
            ],
          }),
        },
      });

      if (!case_) {
        return NextResponse.json(
          { error: 'Case not found or access denied' },
          { status: 404 }
        );
      }
    }

    const newSession = await prisma.chatSession.create({
      data: {
        userId: session.user.id,
        caseId: caseId || null,
        title: title || 'New Chat',
      },
    });

    return NextResponse.json(newSession);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create session error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

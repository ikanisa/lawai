import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createCaseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'closed']).optional(),
  assignedTo: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');

    const where: any = {};
    
    // Staff can only see their own cases, admin sees all
    if (session.user.role !== 'ADMIN') {
      where.OR = [
        { createdBy: session.user.id },
        { assignedTo: session.user.id },
      ];
    }

    if (status) where.status = status;
    if (assignedTo) where.assignedTo = assignedTo;

    const cases = await prisma.case.findMany({
      where,
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { documents: true, chatSessions: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(cases);
  } catch (error) {
    console.error('Get cases error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cases' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const { title, description, status, assignedTo } = createCaseSchema.parse(body);

    const newCase = await prisma.case.create({
      data: {
        title,
        description: description || null,
        status: status || 'open',
        createdBy: session.user.id,
        assignedTo: assignedTo || null,
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
        action: 'CASE_CREATED',
        resourceType: 'case',
        resourceId: newCase.id,
        metadata: { title: newCase.title },
      },
    });

    return NextResponse.json(newCase);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create case error:', error);
    return NextResponse.json(
      { error: 'Failed to create case' },
      { status: 500 }
    );
  }
}

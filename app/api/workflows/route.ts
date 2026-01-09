import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/workflows
 * List workflows for the organization
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const workflowType = searchParams.get('type');
    const isTemplate = searchParams.get('template') === 'true';

    const workflows = await prisma.workflow.findMany({
      where: {
        organizationId: user.organizationId,
        ...(workflowType && { workflowType }),
        ...(isTemplate !== null && { isTemplate }),
        OR: [
          { isPublic: true },
          { createdById: user.id },
        ],
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            executions: true,
          },
        },
      },
      orderBy: {
        usageCount: 'desc',
      },
    });

    return NextResponse.json(workflows);
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflows
 * Create a new workflow
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      name,
      description,
      workflowType,
      isTemplate,
      isPublic,
      steps,
      status,
    } = body;

    if (!name || !steps || !Array.isArray(steps)) {
      return NextResponse.json(
        { error: 'name and steps (array) are required' },
        { status: 400 }
      );
    }

    const workflow = await prisma.workflow.create({
      data: {
        organizationId: user.organizationId,
        name,
        description,
        workflowType,
        isTemplate: isTemplate || false,
        isPublic: isPublic || false,
        steps,
        createdById: user.id,
        status: status || 'DRAFT',
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action: 'WORKFLOW_CREATED',
        resourceType: 'workflow',
        resourceId: workflow.id,
        metadata: { name, workflowType },
      },
    });

    return NextResponse.json(workflow, { status: 201 });
  } catch (error) {
    console.error('Error creating workflow:', error);
    return NextResponse.json(
      { error: 'Failed to create workflow' },
      { status: 500 }
    );
  }
}

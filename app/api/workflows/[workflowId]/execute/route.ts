import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { LawAIOrchestrator } from '@/lib/ai-orchestrator';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/workflows/[workflowId]/execute
 * Execute a workflow
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
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

    const workflow = await prisma.workflow.findFirst({
      where: {
        id: params.workflowId,
        organizationId: user.organizationId,
        status: 'ACTIVE',
        OR: [
          { isPublic: true },
          { createdById: user.id },
        ],
      },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found or not active' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { matterId, inputData } = body;

    // Create orchestrator
    const orchestrator = new LawAIOrchestrator(
      user.id,
      user.organizationId,
      matterId
    );

    // Execute workflow
    const result = await orchestrator.processRequest({
      type: 'workflow',
      content: `Execute workflow: ${workflow.name}`,
      context: {
        workflowId: workflow.id,
        ...inputData,
      },
    });

    // Update workflow usage count
    await prisma.workflow.update({
      where: { id: workflow.id },
      data: {
        usageCount: {
          increment: 1,
        },
      },
    });

    return NextResponse.json({
      success: true,
      result,
      workflowId: workflow.id,
    });
  } catch (error) {
    console.error('Error executing workflow:', error);
    return NextResponse.json(
      { error: 'Failed to execute workflow', details: String(error) },
      { status: 500 }
    );
  }
}

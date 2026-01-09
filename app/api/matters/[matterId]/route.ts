import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/matters/[matterId]
 * Get a specific matter with all related data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { matterId: string } }
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

    const matter = await prisma.matter.findFirst({
      where: {
        id: params.matterId,
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
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        teamMembers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        cases: {
          include: {
            assignedUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                documents: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        vaults: {
          include: {
            _count: {
              select: {
                documents: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            cases: true,
            vaults: true,
            chatSessions: true,
            workflowExecutions: true,
          },
        },
      },
    });

    if (!matter) {
      return NextResponse.json({ error: 'Matter not found' }, { status: 404 });
    }

    return NextResponse.json(matter);
  } catch (error) {
    console.error('Error fetching matter:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matter' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/matters/[matterId]
 * Update a matter
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { matterId: string } }
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

    // Check if user has permission (owner or team member with editor role)
    const matter = await prisma.matter.findFirst({
      where: {
        id: params.matterId,
        organizationId: user.organizationId,
        OR: [
          { ownerId: user.id },
          {
            teamMembers: {
              some: {
                userId: user.id,
                role: 'editor',
              },
            },
          },
        ],
      },
    });

    if (!matter) {
      return NextResponse.json(
        { error: 'Matter not found or insufficient permissions' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, description, matterType, clientName, status, metadata } = body;

    const updatedMatter = await prisma.matter.update({
      where: { id: params.matterId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(matterType && { matterType }),
        ...(clientName !== undefined && { clientName }),
        ...(status && { status }),
        ...(metadata && { metadata }),
      },
      include: {
        owner: {
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
        action: 'MATTER_UPDATED',
        resourceType: 'matter',
        resourceId: updatedMatter.id,
        metadata: body,
      },
    });

    return NextResponse.json(updatedMatter);
  } catch (error) {
    console.error('Error updating matter:', error);
    return NextResponse.json(
      { error: 'Failed to update matter' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/matters/[matterId]
 * Delete a matter (soft delete by archiving)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { matterId: string } }
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

    // Only owner can delete
    const matter = await prisma.matter.findFirst({
      where: {
        id: params.matterId,
        organizationId: user.organizationId,
        ownerId: user.id,
      },
    });

    if (!matter) {
      return NextResponse.json(
        { error: 'Matter not found or insufficient permissions' },
        { status: 404 }
      );
    }

    // Soft delete by archiving
    await prisma.matter.update({
      where: { id: params.matterId },
      data: {
        status: 'ARCHIVED',
      },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action: 'MATTER_ARCHIVED',
        resourceType: 'matter',
        resourceId: matter.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error archiving matter:', error);
    return NextResponse.json(
      { error: 'Failed to archive matter' },
      { status: 500 }
    );
  }
}

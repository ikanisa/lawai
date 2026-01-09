import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/matters
 * List all matters for the user's organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { organization: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get matters user owns or is a team member of
    const matters = await prisma.matter.findMany({
      where: {
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
        _count: {
          select: {
            cases: true,
            vaults: true,
            chatSessions: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return NextResponse.json(matters);
  } catch (error) {
    console.error('Error fetching matters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matters' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/matters
 * Create a new matter
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { organization: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, matterType, clientName, status } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Matter name is required' },
        { status: 400 }
      );
    }

    const matter = await prisma.matter.create({
      data: {
        organizationId: user.organizationId,
        name,
        description,
        matterType,
        clientName,
        status: status || 'ACTIVE',
        ownerId: user.id,
        metadata: {},
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
        action: 'MATTER_CREATED',
        resourceType: 'matter',
        resourceId: matter.id,
        metadata: { name, matterType },
      },
    });

    return NextResponse.json(matter, { status: 201 });
  } catch (error) {
    console.error('Error creating matter:', error);
    return NextResponse.json(
      { error: 'Failed to create matter' },
      { status: 500 }
    );
  }
}

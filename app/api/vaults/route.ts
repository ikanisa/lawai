import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/vaults
 * List vaults for a matter
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
    const matterId = searchParams.get('matterId');

    if (!matterId) {
      return NextResponse.json(
        { error: 'matterId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify user has access to matter
    const matter = await prisma.matter.findFirst({
      where: {
        id: matterId,
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
    });

    if (!matter) {
      return NextResponse.json(
        { error: 'Matter not found or access denied' },
        { status: 404 }
      );
    }

    const vaults = await prisma.vault.findMany({
      where: {
        matterId,
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
            documents: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(vaults);
  } catch (error) {
    console.error('Error fetching vaults:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vaults' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vaults
 * Create a new vault
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
    const { matterId, name, description, vaultType, isShared, sharedWith } = body;

    if (!matterId || !name) {
      return NextResponse.json(
        { error: 'matterId and name are required' },
        { status: 400 }
      );
    }

    // Verify user has access to matter
    const matter = await prisma.matter.findFirst({
      where: {
        id: matterId,
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
    });

    if (!matter) {
      return NextResponse.json(
        { error: 'Matter not found or insufficient permissions' },
        { status: 404 }
      );
    }

    const vault = await prisma.vault.create({
      data: {
        matterId,
        name,
        description,
        vaultType: vaultType || 'GENERAL',
        isShared: isShared || false,
        sharedWith: sharedWith || [],
        createdById: user.id,
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
        action: 'VAULT_CREATED',
        resourceType: 'vault',
        resourceId: vault.id,
        metadata: { name, vaultType, matterId },
      },
    });

    return NextResponse.json(vault, { status: 201 });
  } catch (error) {
    console.error('Error creating vault:', error);
    return NextResponse.json(
      { error: 'Failed to create vault' },
      { status: 500 }
    );
  }
}

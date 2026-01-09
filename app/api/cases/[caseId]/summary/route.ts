import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { LawAIAgent } from '@/lib/ai-agent';

export async function POST(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const session = await requireAuth();
    if (session instanceof NextResponse) return session;

    // Verify access
    const case_ = await prisma.case.findFirst({
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

    if (!case_) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const agent = new LawAIAgent(session.user.id);
    const summary = await agent.generateCaseSummary(case_.title, case_.description || '');

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Generate summary error:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}

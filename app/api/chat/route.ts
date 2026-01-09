import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/permissions';
import { LawAIAgent } from '@/lib/ai-agent';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const chatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const { sessionId, message } = chatRequestSchema.parse(body);

    // Verify session belongs to user
    const chatSession = await prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id,
      },
    });

    if (!chatSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get conversation history
    const existingMessages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    // Add new user message
    await prisma.chatMessage.create({
      data: {
        sessionId,
        userId: session.user.id,
        role: 'user',
        content: message,
      },
    });

    // Prepare conversation history for AI
    const conversationHistory = existingMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    conversationHistory.push({ role: 'user', content: message });

    // Get AI response
    const agent = new LawAIAgent(session.user.id);
    
    // Get case context if session is linked to a case
    let caseContext: string | undefined;
    if (chatSession.caseId) {
      const case_ = await prisma.case.findUnique({
        where: { id: chatSession.caseId },
        select: { title: true, description: true },
      });
      if (case_) {
        caseContext = `${case_.title}: ${case_.description || ''}`;
      }
    }
    
    const aiResponse = await agent.chat(
      conversationHistory,
      sessionId,
      caseContext
    );

    // Save AI response
    const savedMessage = await prisma.chatMessage.create({
      data: {
        sessionId,
        userId: session.user.id,
        role: 'assistant',
        content: aiResponse,
      },
    });

    // Update session updated_at
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      message: aiResponse,
      id: savedMessage.id,
      timestamp: savedMessage.createdAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}

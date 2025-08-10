import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import scheduler from '@/lib/scheduler';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const topic = await prisma.searchTopic.findUnique({
      where: { id: resolvedParams.id }
    });
    
    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }
    
    // Trigger manual search (last parameter true indicates manual)
    await scheduler.performSearch(topic.id, topic.name, topic.platform as any, true);
    
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to trigger search' }, { status: 500 });
  }
}
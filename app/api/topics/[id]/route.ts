import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import scheduler from '@/lib/scheduler';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { active } = await request.json();
    
    const topic = await prisma.searchTopic.update({
      where: { id: resolvedParams.id },
      data: { active }
    });
    
    if (active) {
      const intervalHours = parseInt(process.env.SEARCH_INTERVAL_HOURS || '4');
      await scheduler.startScheduler(topic.id, topic.name, intervalHours);
    } else {
      scheduler.stopScheduler(resolvedParams.id);
    }
    
    return NextResponse.json(topic);
  } catch {
    return NextResponse.json({ error: 'Failed to update topic' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    scheduler.stopScheduler(resolvedParams.id);
    
    await prisma.searchTopic.delete({
      where: { id: resolvedParams.id }
    });
    
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete topic' }, { status: 500 });
  }
}
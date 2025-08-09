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
      await scheduler.startScheduler(topic.id, topic.name, topic.platform as any, intervalHours);
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
    
    // Delete all related data in a transaction
    await prisma.$transaction(async (tx) => {
      // First get all searches for this topic
      const searches = await tx.search.findMany({
        where: { topicId: resolvedParams.id },
        select: { id: true }
      });
      
      const searchIds = searches.map(s => s.id);
      
      // Delete all videos related to these searches
      await tx.video.deleteMany({
        where: { searchId: { in: searchIds } }
      });
      
      // Delete all searches for this topic
      await tx.search.deleteMany({
        where: { topicId: resolvedParams.id }
      });
      
      // Finally delete the topic
      await tx.searchTopic.delete({
        where: { id: resolvedParams.id }
      });
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Failed to delete topic:', error);
    return NextResponse.json({ error: 'Failed to delete topic' }, { status: 500 });
  }
}
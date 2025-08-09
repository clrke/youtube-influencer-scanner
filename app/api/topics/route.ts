import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import scheduler from '@/lib/scheduler';

export async function GET() {
  try {
    const topics = await prisma.searchTopic.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { searches: true }
        }
      }
    });
    return NextResponse.json(topics);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, platform = 'YOUTUBE' } = await request.json();
    
    if (!name) {
      return NextResponse.json({ error: 'Topic name is required' }, { status: 400 });
    }
    
    const topic = await prisma.searchTopic.create({
      data: { name, platform }
    });
    
    // Try to start scheduler but don't fail if it doesn't work
    // Skip initial search to avoid Puppeteer issues on topic creation
    try {
      const intervalHours = parseInt(process.env.SEARCH_INTERVAL_HOURS || '4');
      await scheduler.startScheduler(topic.id, topic.name, platform as any, intervalHours, true);
    } catch (schedulerError) {
      console.error('[API] Failed to start scheduler:', schedulerError);
      // Continue - topic was created successfully
    }
    
    return NextResponse.json(topic);
  } catch (error) {
    console.error('[API] Failed to create topic:', error);
    return NextResponse.json({ error: 'Failed to create topic' }, { status: 500 });
  }
}
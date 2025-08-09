import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { message, platform = 'YouTube' } = await request.json();
    
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    
    const outreach = await prisma.outreach.create({
      data: {
        influencerId: resolvedParams.id,
        message,
        platform
      }
    });
    
    // Update influencer status to CONTACTED
    await prisma.influencer.update({
      where: { id: resolvedParams.id },
      data: { 
        status: 'CONTACTED',
        lastContactedAt: new Date()
      }
    });
    
    return NextResponse.json(outreach);
  } catch {
    return NextResponse.json({ error: 'Failed to create outreach' }, { status: 500 });
  }
}
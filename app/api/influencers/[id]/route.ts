import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const influencer = await prisma.influencer.findUnique({
      where: { id: resolvedParams.id },
      include: {
        videos: {
          orderBy: { publishedAt: 'desc' }
        },
        outreaches: {
          orderBy: { createdAt: 'desc' }
        },
        tags: true
      }
    });
    
    if (!influencer) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
    }
    
    return NextResponse.json(influencer);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch influencer' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { status, notes } = await request.json();
    
    const updateData: any = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    
    const influencer = await prisma.influencer.update({
      where: { id: resolvedParams.id },
      data: updateData
    });
    
    return NextResponse.json(influencer);
  } catch {
    return NextResponse.json({ error: 'Failed to update influencer' }, { status: 500 });
  }
}
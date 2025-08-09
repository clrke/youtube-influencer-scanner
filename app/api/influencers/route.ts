import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const where: Prisma.InfluencerWhereInput = {};
    
    if (status && status !== 'ALL') {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { channelTitle: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    const [influencers, total] = await Promise.all([
      prisma.influencer.findMany({
        where,
        orderBy: { subscriberCount: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          videos: {
            orderBy: { publishedAt: 'desc' },
            take: 5
          },
          outreaches: {
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          tags: true,
          _count: {
            select: { videos: true, outreaches: true }
          }
        }
      }),
      prisma.influencer.count({ where })
    ]);
    
    return NextResponse.json({
      influencers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch influencers' }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { subDays, format } from 'date-fns';

export async function GET() {
  try {
    // Basic counts
    const totalInfluencers = await prisma.influencer.count();
    const newThisWeek = await prisma.influencer.count({
      where: {
        createdAt: {
          gte: subDays(new Date(), 7)
        }
      }
    });

    // Status breakdown
    const statusCounts = await prisma.influencer.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });

    const statusBreakdown = statusCounts.map(item => ({
      name: item.status.replace('_', ' ').toLowerCase(),
      value: item._count.status
    }));

    const contacted = await prisma.influencer.count({
      where: {
        status: {
          not: 'NEW'
        }
      }
    });

    const responded = await prisma.influencer.count({
      where: {
        status: {
          in: ['RESPONDED', 'NEGOTIATING', 'CONVERTED']
        }
      }
    });

    const converted = await prisma.influencer.count({
      where: {
        status: 'CONVERTED'
      }
    });

    // Weekly trend data
    const weeklyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);

      const dayData = {
        date: format(date, 'EEE'),
        new: await prisma.influencer.count({
          where: {
            createdAt: {
              gte: dateStart,
              lte: dateEnd
            }
          }
        }),
        contacted: await prisma.outreach.count({
          where: {
            createdAt: {
              gte: dateStart,
              lte: dateEnd
            }
          }
        }),
        converted: await prisma.influencer.count({
          where: {
            status: 'CONVERTED',
            updatedAt: {
              gte: dateStart,
              lte: dateEnd
            }
          }
        })
      };

      weeklyTrend.push(dayData);
    }

    // Calculate response time (mock for now)
    const avgResponseTime = 18;

    const stats = {
      totalInfluencers,
      newThisWeek,
      contacted,
      responded,
      converted,
      conversionRate: contacted > 0 ? (converted / contacted) * 100 : 0,
      avgResponseTime,
      statusBreakdown,
      weeklyTrend
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
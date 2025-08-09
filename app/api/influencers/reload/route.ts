import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ScraperFactory } from '@/lib/scraper-factory';

// Helper function to parse subscriber/video counts with K/M/B suffixes
function parseCountString(countStr: string): number {
  if (!countStr) return 0;
  
  // Remove extra whitespace and make lowercase
  const cleaned = countStr.trim().toLowerCase();
  
  // Extract number and suffix
  const match = cleaned.match(/([\d,\.]+)\s*([kmb])?/);
  if (!match) return 0;
  
  const [, numberPart, suffix] = match;
  const number = parseFloat(numberPart.replace(/,/g, ''));
  
  if (isNaN(number)) return 0;
  
  switch (suffix) {
    case 'k': return Math.round(number * 1000);
    case 'm': return Math.round(number * 1000000);
    case 'b': return Math.round(number * 1000000000);
    default: return Math.round(number);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { influencerIds } = body;
    
    // If specific influencer IDs are provided, reload those, otherwise reload all
    const whereClause = influencerIds?.length > 0 
      ? { id: { in: influencerIds } }
      : {};
    
    const influencers = await prisma.influencer.findMany({
      where: whereClause,
      select: {
        id: true,
        channelUrl: true,
        platform: true,
        channelTitle: true
      }
    });

    if (influencers.length === 0) {
      return NextResponse.json({ message: 'No influencers found to reload' });
    }

    let updatedCount = 0;
    const results = [];

    for (const influencer of influencers) {
      try {
        console.log(`[Reload] Re-scraping ${influencer.platform} influencer: ${influencer.channelTitle}`);
        
        const scraper = ScraperFactory.createScraper(influencer.platform as any);
        await scraper.initialize();

        const channelInfo = await scraper.getChannelInfo(influencer.channelUrl);
        
        if (channelInfo) {
          // Update influencer with fresh data
          await prisma.influencer.update({
            where: { id: influencer.id },
            data: {
              channelTitle: channelInfo.channelTitle || influencer.channelTitle,
              subscriberCount: parseCountString(channelInfo.subscriberCount),
              videoCount: parseCountString(channelInfo.videoCount),
              description: channelInfo.description,
              thumbnailUrl: channelInfo.thumbnailUrl,
              updatedAt: new Date()
            }
          });

          updatedCount++;
          results.push({
            id: influencer.id,
            channelTitle: influencer.channelTitle,
            status: 'updated',
            subscriberCount: channelInfo.subscriberCount,
            videoCount: channelInfo.videoCount
          });
          
          console.log(`[Reload] Updated ${influencer.channelTitle}: ${channelInfo.subscriberCount} subscribers, ${channelInfo.videoCount} videos`);
        } else {
          results.push({
            id: influencer.id,
            channelTitle: influencer.channelTitle,
            status: 'failed',
            error: 'Could not fetch channel info'
          });
          console.log(`[Reload] Failed to update ${influencer.channelTitle}: Could not fetch channel info`);
        }

        await scraper.close();
        
        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`[Reload] Error updating ${influencer.channelTitle}:`, error);
        results.push({
          id: influencer.id,
          channelTitle: influencer.channelTitle,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      message: `Successfully reloaded ${updatedCount} out of ${influencers.length} influencers`,
      updated: updatedCount,
      total: influencers.length,
      results
    });
    
  } catch (error) {
    console.error('Error reloading influencer data:', error);
    return NextResponse.json(
      { error: 'Failed to reload influencer data' }, 
      { status: 500 }
    );
  }
}
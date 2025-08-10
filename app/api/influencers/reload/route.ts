import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ScraperFactory } from '@/lib/scraper-factory';
import ScanService from '@/lib/scan-service';

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
    
    const scanService = ScanService.getInstance();
    
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

    // Create scan in database
    const scan = await scanService.createScan('rescrape', {
      total: influencers.length
    });
    
    await scanService.log(scan.id, 'info', `Found ${influencers.length} influencers to re-scrape`);

    let updatedCount = 0;
    const results = [];

    for (let i = 0; i < influencers.length; i++) {
      const influencer = influencers[i];
      
      try {
        // Check for cancellation
        if (await scanService.checkShouldCancel(scan.id)) {
          await scanService.completeScan(scan.id, 'cancelled', 'Re-scrape was cancelled by user');
          return NextResponse.json({ 
            error: 'Scan cancelled', 
            updated: updatedCount, 
            total: influencers.length,
            scanId: scan.id
          });
        }

        await scanService.updateProgress(scan.id, i + 1, `Re-scraping: ${influencer.channelTitle}`);
        await scanService.log(scan.id, 'info', `Re-scraping ${influencer.platform} influencer: ${influencer.channelTitle}`);
        
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
          
          await scanService.log(scan.id, 'success', `Updated ${influencer.channelTitle}: ${channelInfo.subscriberCount} subscribers, ${channelInfo.videoCount} videos`);
        } else {
          results.push({
            id: influencer.id,
            channelTitle: influencer.channelTitle,
            status: 'failed',
            error: 'Could not fetch channel info'
          });
          await scanService.log(scan.id, 'warning', `Failed to update ${influencer.channelTitle}: Could not fetch channel info`);
        }

        await scraper.close();
        
        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        await scanService.log(scan.id, 'error', `Error updating ${influencer.channelTitle}: ${error}`);
        results.push({
          id: influencer.id,
          channelTitle: influencer.channelTitle,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    await scanService.completeScan(scan.id, 'completed', `Successfully reloaded ${updatedCount} out of ${influencers.length} influencers`);

    return NextResponse.json({
      message: `Successfully reloaded ${updatedCount} out of ${influencers.length} influencers`,
      updated: updatedCount,
      total: influencers.length,
      results,
      scanId: scan.id
    });
    
  } catch (error) {
    console.error('Error reloading influencer data:', error);
    return NextResponse.json(
      { error: 'Failed to reload influencer data' }, 
      { status: 500 }
    );
  }
}
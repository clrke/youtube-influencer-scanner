import cron from 'node-cron';
import { prisma } from './db';
import { ScraperFactory, type Platform, type Scraper } from './scraper-factory';

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

class SearchScheduler {
  private tasks: Map<string, cron.ScheduledTask> = new Map();

  async performSearch(topicId: string, topicName: string, platform: Platform = 'YOUTUBE') {
    console.log(`[Scheduler] Starting ${platform} search for topic: ${topicName}`);
    
    const scraper = ScraperFactory.createScraper(platform);
    
    try {
      await scraper.initialize();
      
      // Search for videos from the last 24 hours
      const videos = await scraper.searchVideos(topicName, 'today');
      
      console.log(`[Scheduler] Found ${videos.length} videos for ${topicName}`);
      
      // Create search record
      const search = await prisma.search.create({
        data: {
          topicId,
          resultCount: videos.length,
        },
      });
      
      // Process each video
      for (const videoData of videos) {
        try {
          // Parse view count (remove commas and convert)
          const viewCount = parseInt(videoData.viewCount.replace(/[^0-9]/g, '') || '0');
          
          // Check if video already exists first
          const existingVideo = await prisma.video.findUnique({
            where: { videoId: videoData.videoId },
          });
          
          if (existingVideo) {
            console.log(`[Scheduler] Video already exists: ${videoData.title}`);
            continue;
          }
          
          // Parse published date first to check if we should skip
          let publishedAt = new Date();
          let skipVideo = false;
          
          if (videoData.publishedAt) {
            // Handle relative times like "2 hours ago", "1 day ago"
            const timeStr = videoData.publishedAt.toLowerCase();
            if (timeStr.includes('hour')) {
              const hours = parseInt(timeStr.match(/\d+/)?.[0] || '1');
              publishedAt = new Date(Date.now() - hours * 60 * 60 * 1000);
            } else if (timeStr.includes('day')) {
              const days = parseInt(timeStr.match(/\d+/)?.[0] || '1');
              publishedAt = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
              
              // For TikTok, skip videos older than 24 hours
              if (platform === 'TIKTOK' && days > 1) {
                skipVideo = true;
                console.log(`[Scheduler] Skipping TikTok video older than 24 hours: ${videoData.title} (${days} days old)`);
              }
            } else if (timeStr.includes('week')) {
              const weeks = parseInt(timeStr.match(/\d+/)?.[0] || '1');
              publishedAt = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
              
              // For TikTok, skip videos older than 24 hours
              if (platform === 'TIKTOK') {
                skipVideo = true;
                console.log(`[Scheduler] Skipping TikTok video older than 24 hours: ${videoData.title} (${weeks} weeks old)`);
              }
            } else if (timeStr.includes('month')) {
              // For TikTok, skip videos older than 24 hours
              if (platform === 'TIKTOK') {
                skipVideo = true;
                console.log(`[Scheduler] Skipping TikTok video older than 24 hours: ${videoData.title} (months old)`);
              }
            }
          }
          
          // Skip this video if it's too old for TikTok
          if (skipVideo) {
            continue;
          }
          
          // Use transaction to ensure both influencer and video are created together
          await prisma.$transaction(async (tx) => {
            // Check if influencer exists, create if not
            let influencer = await tx.influencer.findUnique({
              where: { 
                channelId_platform: {
                  channelId: videoData.channelId,
                  platform: platform
                }
              },
            });
            
            if (!influencer) {
              // Try to get more channel info
              const channelInfo = await scraper.getChannelInfo(videoData.channelUrl);
              
              influencer = await tx.influencer.create({
                data: {
                  channelId: videoData.channelId,
                  channelTitle: videoData.channelTitle,
                  channelUrl: videoData.channelUrl,
                  platform: platform,
                  subscriberCount: channelInfo ? parseCountString(channelInfo.subscriberCount) : 0,
                  videoCount: channelInfo ? parseCountString(channelInfo.videoCount) : 0,
                  description: channelInfo?.description,
                  thumbnailUrl: channelInfo?.thumbnailUrl,
                },
              });
              
              console.log(`[Scheduler] Created new influencer: ${videoData.channelTitle}`);
            }
            
            // Create video record within the same transaction
            await tx.video.create({
              data: {
                videoId: videoData.videoId,
                title: videoData.title,
                description: videoData.description || '',
                channelId: videoData.channelId,
                channelTitle: videoData.channelTitle,
                publishedAt,
                viewCount,
                thumbnailUrl: videoData.thumbnailUrl,
                videoUrl: videoData.videoUrl,
                searchId: search.id,
                influencerId: influencer.id,
              },
            });
            
            console.log(`[Scheduler] Added video: ${videoData.title}`);
          }, {
            timeout: 15000, // 15 second timeout instead of default 5 seconds
          });
          
          // Add delay between processing videos
          await this.delay(parseInt(process.env.SCRAPE_DELAY_MS || '2000'));
          
        } catch (error) {
          console.error(`[Scheduler] Error processing video ${videoData.videoId}:`, error);
        }
      }
      
      await scraper.close();
      
      // Clean up orphaned influencers (those with no videos)
      await this.cleanupOrphanedInfluencers();
      
      console.log(`[Scheduler] Completed ${platform} search for ${topicName}`);
      
    } catch (error) {
      console.error(`[Scheduler] Error during ${platform} search for ${topicName}:`, error);
      await scraper.close();
    }
  }

  async cleanupOrphanedInfluencers() {
    try {
      // Find influencers that have no associated videos
      const orphanedInfluencers = await prisma.influencer.findMany({
        where: {
          videos: {
            none: {}
          }
        },
        select: {
          id: true,
          channelTitle: true
        }
      });

      if (orphanedInfluencers.length > 0) {
        console.log(`[Scheduler] Found ${orphanedInfluencers.length} orphaned influencers, cleaning up...`);
        
        // Delete orphaned influencers
        const result = await prisma.influencer.deleteMany({
          where: {
            id: {
              in: orphanedInfluencers.map(i => i.id)
            }
          }
        });
        
        console.log(`[Scheduler] Removed ${result.count} orphaned influencers: ${orphanedInfluencers.map(i => i.channelTitle).join(', ')}`);
      }
    } catch (error) {
      console.error('[Scheduler] Error cleaning up orphaned influencers:', error);
    }
  }

  async startScheduler(topicId: string, topicName: string, platform: Platform = 'YOUTUBE', intervalHours: number = 4, skipInitialSearch: boolean = false) {
    // Stop existing task if any
    this.stopScheduler(topicId);
    
    // Perform initial search if not skipped
    if (!skipInitialSearch) {
      try {
        await this.performSearch(topicId, topicName, platform);
      } catch (error) {
        console.error(`[Scheduler] Initial search failed for ${topicName} on ${platform}:`, error);
      }
    }
    
    // Schedule recurring searches
    const cronExpression = `0 */${intervalHours} * * *`; // Every N hours
    const task = cron.schedule(cronExpression, async () => {
      await this.performSearch(topicId, topicName, platform);
    });
    
    this.tasks.set(topicId, task);
    task.start();
    
    console.log(`[Scheduler] Started ${platform} scheduler for ${topicName} every ${intervalHours} hours`);
  }

  stopScheduler(topicId: string) {
    const task = this.tasks.get(topicId);
    if (task) {
      task.stop();
      this.tasks.delete(topicId);
      console.log(`[Scheduler] Stopped scheduler for topic ${topicId}`);
    }
  }

  stopAllSchedulers() {
    this.tasks.forEach((task, topicId) => {
      task.stop();
      console.log(`[Scheduler] Stopped scheduler for topic ${topicId}`);
    });
    this.tasks.clear();
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
const scheduler = new SearchScheduler();

export default scheduler;
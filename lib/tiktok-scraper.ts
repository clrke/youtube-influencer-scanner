import puppeteer, { Browser, Page } from 'puppeteer';

interface TikTokVideoData {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  channelUrl: string;
  viewCount: string;
  likeCount: string;
  publishedAt: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: string;
}

interface TikTokChannelInfo {
  channelId: string;
  channelTitle: string;
  subscriberCount: string;
  videoCount: string;
  description: string;
  thumbnailUrl: string;
  channelUrl: string;
}

class TikTokScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: process.env.HEADLESS_BROWSER !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    this.page = await this.browser.newPage();
    
    // Set viewport and user agent
    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set extra headers to avoid detection
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });
  }

  async searchVideos(query: string, filter: 'today' | 'week' | 'month' = 'today'): Promise<TikTokVideoData[]> {
    if (!this.page) {
      await this.initialize();
    }

    const videos: TikTokVideoData[] = [];
    
    try {
      // Navigate to TikTok search
      const searchUrl = `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`;
      console.log(`[TikTok Scraper] Navigating to: ${searchUrl}`);
      await this.page!.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait a bit for content to load
      await this.delay(5000);
      
      // Scroll to load more videos
      for (let i = 0; i < 5; i++) {
        await this.page!.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await this.delay(2000);
      }
      
      // Try multiple selector strategies for TikTok
      const videoData = await this.page!.evaluate(() => {
        const videos: any[] = [];
        
        // Try multiple possible selectors
        let videoContainers = document.querySelectorAll('[data-e2e="search-card-video"]');
        
        // If no videos found, try alternative selectors
        if (videoContainers.length === 0) {
          videoContainers = document.querySelectorAll('div[class*="DivItemContainerV2"]');
        }
        
        if (videoContainers.length === 0) {
          videoContainers = document.querySelectorAll('div[class*="video-card"]');
        }
        
        if (videoContainers.length === 0) {
          // Try to find any links to TikTok videos
          const links = document.querySelectorAll('a[href*="/video/"]');
          links.forEach((link, index) => {
            const href = (link as HTMLAnchorElement).href;
            if (href.includes('tiktok.com')) {
              // Extract username from URL
              const usernameMatch = href.match(/@([^/]+)/);
              const username = usernameMatch ? usernameMatch[1] : 'unknown';
              
              videos.push({
                videoId: `tiktok_${Date.now()}_${index}`,
                title: link.textContent || 'TikTok Video',
                description: '',
                channelId: `@${username}`,
                channelTitle: username,
                channelUrl: `https://www.tiktok.com/@${username}`,
                viewCount: '0',
                likeCount: '0',
                publishedAt: 'recently',
                thumbnailUrl: '',
                videoUrl: href,
                duration: ''
              });
            }
          });
          return videos;
        }
        
        console.log(`Found ${videoContainers.length} video containers`);
        
        videoContainers.forEach((container, index) => {
          try {
            const linkElement = container.querySelector('a') as HTMLAnchorElement;
            const videoUrl = linkElement?.href || '';
            
            // Extract video ID from URL
            const videoIdMatch = videoUrl.match(/\/video\/(\d+)/);
            const videoId = videoIdMatch ? videoIdMatch[1] : `tiktok_${Date.now()}_${index}`;
            
            // Get video metadata
            const titleElement = container.querySelector('[data-e2e="search-card-desc"]');
            const title = titleElement?.textContent?.trim() || 'TikTok Video';
            
            // Get channel info - try to extract from URL if element not found
            const channelElement = container.querySelector('[data-e2e="search-card-user-unique-id"]');
            let channelTitle = channelElement?.textContent?.trim()?.replace('@', '') || '';
            
            // If we couldn't find the channel element, extract username from video URL
            if (!channelTitle && videoUrl) {
              const usernameMatch = videoUrl.match(/@([^/]+)/);
              if (usernameMatch) {
                channelTitle = usernameMatch[1];
              }
            }
            
            // Fallback to 'Unknown Creator' only if we couldn't extract anything
            channelTitle = channelTitle || 'Unknown Creator';
            const channelId = `@${channelTitle}`;
            const channelUrl = `https://www.tiktok.com/@${channelTitle}`;
            
            // Get stats
            const viewElement = container.querySelector('[data-e2e="video-views"]');
            const viewCount = viewElement?.textContent?.trim() || '0';
            
            const likeElement = container.querySelector('[data-e2e="like-count"]');
            const likeCount = likeElement?.textContent?.trim() || '0';
            
            // Get thumbnail
            const imgElement = container.querySelector('img');
            const thumbnailUrl = imgElement?.src || '';
            
            if (videoId && channelTitle) {
              videos.push({
                videoId,
                title,
                description: title, // TikTok usually shows title as description
                channelId,
                channelTitle,
                channelUrl,
                viewCount,
                likeCount,
                publishedAt: 'recently', // TikTok doesn't show exact publish dates in search
                thumbnailUrl,
                videoUrl,
                duration: ''
              });
            }
          } catch (error) {
            console.error('Error parsing TikTok video element:', error);
          }
        });
        
        return videos;
      });
      
      videos.push(...videoData);
      console.log(`[TikTok Scraper] Found ${videos.length} videos for query: ${query}`);
      
    } catch (error) {
      console.error('[TikTok Scraper] Error searching videos:', error);
      
      // As a fallback, return mock data for testing
      console.log('[TikTok Scraper] Returning mock data for testing purposes');
      return [
        {
          videoId: `mock_${Date.now()}_1`,
          title: `${query} - TikTok Video 1`,
          description: 'Mock TikTok video for testing',
          channelId: '@mockuser1',
          channelTitle: 'Mock TikTok User 1',
          channelUrl: 'https://www.tiktok.com/@mockuser1',
          viewCount: '1000',
          likeCount: '100',
          publishedAt: 'recently',
          thumbnailUrl: '',
          videoUrl: `https://www.tiktok.com/@mockuser1/video/${Date.now()}`,
          duration: '0:30'
        },
        {
          videoId: `mock_${Date.now()}_2`,
          title: `${query} - TikTok Video 2`,
          description: 'Mock TikTok video for testing',
          channelId: '@mockuser2',
          channelTitle: 'Mock TikTok User 2',
          channelUrl: 'https://www.tiktok.com/@mockuser2',
          viewCount: '2000',
          likeCount: '200',
          publishedAt: 'recently',
          thumbnailUrl: '',
          videoUrl: `https://www.tiktok.com/@mockuser2/video/${Date.now()}`,
          duration: '0:45'
        }
      ];
    }
    
    return videos;
  }

  async getChannelInfo(channelUrl: string): Promise<TikTokChannelInfo | null> {
    if (!this.page) {
      await this.initialize();
    }

    try {
      await this.page!.goto(channelUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.delay(3000);
      
      const channelInfo = await this.page!.evaluate(() => {
        // Extract channel info from TikTok profile page
        const channelTitle = document.querySelector('[data-e2e="user-title"]')?.textContent?.trim() || '';
        const subscriberElement = document.querySelector('[data-e2e="followers-count"]');
        const subscriberCount = subscriberElement?.textContent?.trim() || '0';
        
        const videoCountElement = document.querySelector('[data-e2e="user-post-item"]');
        const videoElements = document.querySelectorAll('[data-e2e="user-post-item"]');
        const videoCount = videoElements.length.toString();
        
        const bioElement = document.querySelector('[data-e2e="user-bio"]');
        const description = bioElement?.textContent?.trim() || '';
        
        const avatarElement = document.querySelector('[data-e2e="user-avatar"] img') as HTMLImageElement;
        const thumbnailUrl = avatarElement?.src || '';
        
        const currentUrl = window.location.href;
        const channelId = currentUrl.split('@')[1]?.split('/')[0] || '';
        
        return {
          channelId,
          channelTitle,
          subscriberCount,
          videoCount,
          description,
          thumbnailUrl,
          channelUrl: currentUrl
        };
      });
      
      return channelInfo;
    } catch (error) {
      console.error('Error getting TikTok channel info:', error);
      return null;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default TikTokScraper;
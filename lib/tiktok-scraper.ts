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
      await this.page!.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait a bit for content to load
      await this.delay(5000);
      
      // Scroll to load more videos
      for (let i = 0; i < 5; i++) {
        await this.page!.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await this.delay(2000);
      }
      
      // Extract video data
      const videoData = await this.page!.evaluate(() => {
        const videos: any[] = [];
        
        // TikTok uses dynamic selectors, so we'll look for video containers
        const videoContainers = document.querySelectorAll('[data-e2e="search-card-video"]');
        
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
            
            // Get channel info
            const channelElement = container.querySelector('[data-e2e="search-card-user-unique-id"]');
            const channelTitle = channelElement?.textContent?.trim()?.replace('@', '') || 'Unknown Creator';
            const channelId = channelTitle;
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
      
    } catch (error) {
      console.error('Error searching TikTok videos:', error);
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
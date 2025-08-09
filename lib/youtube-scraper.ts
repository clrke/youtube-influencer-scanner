import puppeteer, { Browser, Page } from 'puppeteer';

export interface VideoData {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  channelUrl: string;
  publishedAt: string;
  viewCount: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: string;
}

export interface ChannelData {
  channelId: string;
  channelTitle: string;
  subscriberCount: string;
  videoCount: string;
  description: string;
  thumbnailUrl: string;
  channelUrl: string;
}

class YouTubeScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: process.env.HEADLESS_BROWSER !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });
    
    // Set user agent to avoid detection
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  }

  async searchVideos(query: string, filter: 'hour' | 'today' | 'week' | 'month' = 'today'): Promise<VideoData[]> {
    if (!this.page) await this.initialize();
    
    const videos: VideoData[] = [];
    
    try {
      // Build search URL with filters
      const filterParam = {
        'hour': 'EgIIAQ%253D%253D',
        'today': 'EgQIAhAB',
        'week': 'EgQIAxAB', 
        'month': 'EgQIBBAB'
      }[filter];
      
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=${filterParam}`;
      
      await this.page!.goto(searchUrl, { waitUntil: 'networkidle2' });
      
      // Wait for content to load
      await this.page!.waitForSelector('ytd-video-renderer', { timeout: 10000 }).catch(() => {});
      
      // Scroll to load more results
      for (let i = 0; i < 3; i++) {
        await this.page!.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await this.delay(2000);
      }
      
      // Extract video data
      const videoElements = await this.page!.evaluate(() => {
        const videos = [];
        const elements = document.querySelectorAll('ytd-video-renderer');
        
        elements.forEach((el) => {
          try {
            const titleEl = el.querySelector('#video-title');
            const channelEl = el.querySelector('#channel-name a');
            const metaEl = el.querySelectorAll('#metadata-line span');
            const thumbnailEl = el.querySelector('img#img');
            const descriptionEl = el.querySelector('#description-text');
            
            if (titleEl && channelEl) {
              const videoUrl = (titleEl as HTMLAnchorElement).href;
              const videoId = videoUrl.split('v=')[1]?.split('&')[0];
              
              videos.push({
                videoId: videoId || '',
                title: titleEl.textContent?.trim() || '',
                description: descriptionEl?.textContent?.trim() || '',
                channelTitle: channelEl.textContent?.trim() || '',
                channelUrl: (channelEl as HTMLAnchorElement).href,
                channelId: (channelEl as HTMLAnchorElement).href.split('/').pop() || '',
                viewCount: metaEl[0]?.textContent?.trim() || '0',
                publishedAt: metaEl[1]?.textContent?.trim() || '',
                thumbnailUrl: (thumbnailEl as HTMLImageElement)?.src || '',
                videoUrl: videoUrl,
                duration: el.querySelector('span.ytd-thumbnail-overlay-time-status-renderer')?.textContent?.trim() || ''
              });
            }
          } catch (error) {
            console.error('Error parsing video element:', error);
          }
        });
        
        return videos;
      });
      
      videos.push(...videoElements);
      
    } catch (error) {
      console.error('Error searching videos:', error);
    }
    
    return videos;
  }

  async getChannelInfo(channelUrl: string): Promise<ChannelData | null> {
    if (!this.page) await this.initialize();
    
    try {
      await this.page!.goto(`${channelUrl}/about`, { waitUntil: 'networkidle2' });
      
      await this.delay(2000);
      
      const channelData = await this.page!.evaluate(() => {
        const channelId = window.location.pathname.split('/')[2];
        const channelTitle = document.querySelector('#channel-title')?.textContent?.trim() || '';
        const subscriberEl = document.querySelector('#subscriber-count');
        const subscriberCount = subscriberEl?.textContent?.trim() || '0';
        const statsEls = document.querySelectorAll('#right-column yt-formatted-string');
        const description = document.querySelector('#description-container')?.textContent?.trim() || '';
        const thumbnailEl = document.querySelector('img#img') as HTMLImageElement;
        
        let videoCount = '0';
        statsEls.forEach(el => {
          const text = el.textContent || '';
          if (text.includes('video')) {
            videoCount = text.replace(/[^0-9]/g, '');
          }
        });
        
        return {
          channelId,
          channelTitle,
          subscriberCount,
          videoCount,
          description,
          thumbnailUrl: thumbnailEl?.src || '',
          channelUrl: window.location.origin + window.location.pathname.replace('/about', '')
        };
      });
      
      return channelData;
      
    } catch (error) {
      console.error('Error getting channel info:', error);
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

export default YouTubeScraper;
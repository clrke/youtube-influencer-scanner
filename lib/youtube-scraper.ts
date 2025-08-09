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
      // First try the main channel page instead of about page
      await this.page!.goto(channelUrl, { waitUntil: 'networkidle2' });
      
      // Wait longer for content to load
      await this.delay(5000);
      
      // Scroll to trigger lazy loading
      await this.page!.evaluate(() => {
        window.scrollTo(0, 500);
      });
      
      await this.delay(2000);
      
      // Scroll back up
      await this.page!.evaluate(() => {
        window.scrollTo(0, 0);
      });
      
      await this.delay(1000);
      
      const channelData = await this.page!.evaluate(() => {
        const channelId = window.location.pathname.split('/')[2];
        const channelTitle = document.querySelector('#channel-title')?.textContent?.trim() || 
                            document.querySelector('#channel-name')?.textContent?.trim() || 
                            document.querySelector('[itemprop="name"]')?.textContent?.trim() || '';
        
        // Try multiple selectors for subscriber count
        let subscriberCount = '0';
        const subscriberSelectors = [
          '#subscriber-count',
          '#owner-sub-count',
          'yt-formatted-string#subscriber-count',
          'yt-formatted-string.ytd-c4-tabbed-header-renderer',
          '[aria-label*="subscriber"]',
          'yt-subscriber-count',
          '.subscriber-count',
          'span.yt-subscription-button-subscriber-count-branded-horizontal',
          'yt-formatted-string.ytd-channel-name'
        ];
        
        for (const selector of subscriberSelectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent) {
            const text = el.textContent.trim();
            if (text.includes('subscriber') || text.match(/[\d.]+[KMB]?/)) {
              subscriberCount = text;
              break;
            }
          }
        }
        
        // Also check aria-labels
        document.querySelectorAll('[aria-label]').forEach(el => {
          const label = el.getAttribute('aria-label') || '';
          if (label.includes('subscriber') && !subscriberCount.match(/\d/)) {
            const match = label.match(/([\d,\.]+[KMB]?)\s*subscriber/i);
            if (match) {
              subscriberCount = match[1];
            }
          }
        });
        
        // Last resort: look for any text containing subscriber count pattern
        if (subscriberCount === '0') {
          document.querySelectorAll('*').forEach(el => {
            const text = el.textContent || '';
            if (text.length < 100 && text.match(/\d/) && text.toLowerCase().includes('subscriber')) {
              const match = text.match(/([\d,\.]+[KMB]?)\s*subscriber/i);
              if (match && subscriberCount === '0') {
                subscriberCount = match[1];
                console.log(`Found subscriber count in text: ${subscriberCount}`);
              }
            }
          });
        }
        
        // Look for video count
        let videoCount = '0';
        document.querySelectorAll('yt-formatted-string, span').forEach(el => {
          const text = el.textContent || '';
          if (text.includes('video') && text.match(/\d/)) {
            const match = text.match(/([\d,]+)\s*video/i);
            if (match) {
              videoCount = match[1].replace(/,/g, '');
            }
          }
        });
        
        const description = document.querySelector('#description-container')?.textContent?.trim() || 
                           document.querySelector('yt-formatted-string#description')?.textContent?.trim() || '';
        
        // Look for channel avatar/profile picture with multiple selectors
        let thumbnailUrl = '';
        const avatarSelectors = [
          'yt-img-shadow#avatar img',           // Main channel avatar
          '#channel-header-container img',      // Header container
          '.yt-spec-avatar-shape img',         // Avatar shape
          'ytd-c4-tabbed-header-renderer img', // Tabbed header
          '#img.ytd-c4-tabbed-header-renderer', // Header image
          'img[style*="border-radius"]',       // Rounded images (likely avatars)
          'yt-image img[alt*="channel"]',      // Channel image
          '#avatar img',                       // Simple avatar ID
          'img[alt*="profile"]'                // Profile image
        ];
        
        for (const selector of avatarSelectors) {
          const el = document.querySelector(selector) as HTMLImageElement;
          if (el?.src && el.src.includes('yt') && !el.src.includes('default')) {
            thumbnailUrl = el.src;
            console.log(`[YouTube] Found avatar with selector: ${selector}`);
            break;
          }
        }
        
        // Fallback to any img if no specific avatar found
        if (!thumbnailUrl) {
          const imgEl = document.querySelector('img#img') as HTMLImageElement;
          thumbnailUrl = imgEl?.src || '';
        }
        
        console.log(`[YouTube Scraper] Channel: ${channelTitle}, Subscribers: ${subscriberCount}, Videos: ${videoCount}`);
        
        return {
          channelId,
          channelTitle,
          subscriberCount: subscriberCount || '0',
          videoCount,
          description,
          thumbnailUrl,
          channelUrl: window.location.href
        };
      });
      
      return channelData;
      
    } catch (error) {
      console.error('Error getting channel info:', error);
      // Return basic info even if we can't get all details
      return {
        channelId: channelUrl.split('/').pop() || '',
        channelTitle: 'YouTube Channel',
        subscriberCount: '0',
        videoCount: '0',
        description: '',
        thumbnailUrl: '',
        channelUrl
      };
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
import puppeteer, { Browser, Page } from 'puppeteer';

interface InstagramPostData {
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

interface InstagramProfileInfo {
  channelId: string;
  channelTitle: string;
  subscriberCount: string;
  videoCount: string;
  description: string;
  thumbnailUrl: string;
  channelUrl: string;
}

class InstagramScraper {
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
        '--disable-features=VizDisplayCompositor',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });
    
    this.page = await this.browser.newPage();
    
    // Set viewport and user agent
    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set extra headers
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });
  }

  async searchVideos(query: string, filter: 'today' | 'week' | 'month' = 'today'): Promise<InstagramPostData[]> {
    if (!this.page) {
      await this.initialize();
    }

    const posts: InstagramPostData[] = [];
    
    try {
      // Instagram search via hashtag (most reliable without login)
      const searchUrl = `https://www.instagram.com/explore/tags/${encodeURIComponent(query.replace(/\s+/g, ''))}/`;
      console.log(`[Instagram Scraper] Navigating to: ${searchUrl}`);
      
      await this.page!.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait for content to load
      await this.delay(5000);
      
      // Scroll to load more posts
      for (let i = 0; i < 3; i++) {
        await this.page!.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await this.delay(2000);
      }
      
      // Extract post data
      const postData = await this.page!.evaluate(() => {
        const posts: any[] = [];
        
        // Try to find post containers
        const postLinks = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
        
        postLinks.forEach((link, index) => {
          if (index >= 20) return; // Limit to 20 posts
          
          const href = (link as HTMLAnchorElement).href;
          const postIdMatch = href.match(/\/(p|reel)\/([^/]+)/);
          const postId = postIdMatch ? postIdMatch[2] : `ig_${Date.now()}_${index}`;
          
          // Try to extract username from nearby elements
          let username = 'instagram_user';
          const article = link.closest('article');
          if (article) {
            const userLink = article.querySelector('a[href^="/"][href$="/"]');
            if (userLink) {
              const userHref = (userLink as HTMLAnchorElement).href;
              const usernameMatch = userHref.match(/instagram\.com\/([^/]+)/);
              if (usernameMatch) {
                username = usernameMatch[1];
              }
            }
          }
          
          // Get image/thumbnail
          const img = link.querySelector('img');
          const thumbnailUrl = img ? (img as HTMLImageElement).src : '';
          const altText = img ? (img as HTMLImageElement).alt : '';
          
          posts.push({
            videoId: postId,
            title: altText || `Instagram post by @${username}`,
            description: altText || '',
            channelId: `@${username}`,
            channelTitle: username,
            channelUrl: `https://www.instagram.com/${username}/`,
            viewCount: '0',
            likeCount: '0',
            publishedAt: 'recently',
            thumbnailUrl: thumbnailUrl,
            videoUrl: href,
            duration: ''
          });
        });
        
        return posts;
      });
      
      posts.push(...postData);
      console.log(`[Instagram Scraper] Found ${posts.length} posts for query: ${query}`);
      
    } catch (error) {
      console.error('[Instagram Scraper] Error searching posts:', error);
    }
    
    return posts;
  }


  async getChannelInfo(channelUrl: string): Promise<InstagramProfileInfo | null> {
    if (!this.page) {
      await this.initialize();
    }

    try {
      await this.page!.goto(channelUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.delay(3000);
      
      const profileInfo = await this.page!.evaluate(() => {
        const username = window.location.pathname.replace(/\//g, '') || 'unknown';
        
        // Try to extract follower count
        let followerCount = '0';
        const statsElements = document.querySelectorAll('span');
        statsElements.forEach(span => {
          const text = span.textContent || '';
          if (text.includes('followers')) {
            const prevElement = span.previousElementSibling;
            if (prevElement) {
              followerCount = prevElement.textContent || '0';
            }
          }
        });
        
        // Try to extract post count
        let postCount = '0';
        statsElements.forEach(span => {
          const text = span.textContent || '';
          if (text.includes('posts')) {
            const prevElement = span.previousElementSibling;
            if (prevElement) {
              postCount = prevElement.textContent || '0';
            }
          }
        });
        
        // Try to extract bio
        const bioElement = document.querySelector('div.-vDIg span');
        const bio = bioElement?.textContent || '';
        
        // Try to extract profile picture
        const profilePicElement = document.querySelector('img[alt*="profile picture"]') as HTMLImageElement;
        const profilePic = profilePicElement?.src || '';
        
        return {
          channelId: `@${username}`,
          channelTitle: username,
          subscriberCount: followerCount,
          videoCount: postCount,
          description: bio,
          thumbnailUrl: profilePic,
          channelUrl: window.location.href
        };
      });
      
      return profileInfo;
    } catch (error) {
      console.error('[Instagram Scraper] Error getting profile info:', error);
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

export default InstagramScraper;
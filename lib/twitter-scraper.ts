import puppeteer, { Browser, Page } from 'puppeteer';

interface TwitterPostData {
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

interface TwitterProfileInfo {
  channelId: string;
  channelTitle: string;
  subscriberCount: string;
  videoCount: string;
  description: string;
  thumbnailUrl: string;
  channelUrl: string;
}

class TwitterScraper {
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

  async searchVideos(query: string, filter: 'today' | 'week' | 'month' = 'today'): Promise<TwitterPostData[]> {
    if (!this.page) {
      await this.initialize();
    }

    const posts: TwitterPostData[] = [];
    
    try {
      // Use Twitter/X search without login (limited functionality)
      // Note: X.com has strong anti-scraping measures
      const searchUrl = `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query`;
      console.log(`[Twitter Scraper] Navigating to: ${searchUrl}`);
      
      await this.page!.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait for content to load
      await this.delay(5000);
      
      // Scroll to load more tweets
      for (let i = 0; i < 3; i++) {
        await this.page!.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await this.delay(2000);
      }
      
      // Extract tweet data
      const tweetData = await this.page!.evaluate(() => {
        const tweets: any[] = [];
        
        // Try multiple selectors for tweets
        const tweetElements = document.querySelectorAll('article[data-testid="tweet"], article[role="article"]');
        
        if (tweetElements.length === 0) {
          console.log('No tweets found with standard selectors');
          
          // Fallback: try to find any links to tweets
          const tweetLinks = document.querySelectorAll('a[href*="/status/"]');
          tweetLinks.forEach((link, index) => {
            if (index >= 20) return;
            
            const href = (link as HTMLAnchorElement).href;
            const statusMatch = href.match(/\/([^/]+)\/status\/(\d+)/);
            if (statusMatch) {
              const username = statusMatch[1];
              const tweetId = statusMatch[2];
              
              tweets.push({
                videoId: tweetId,
                title: `Tweet by @${username}`,
                description: '',
                channelId: `@${username}`,
                channelTitle: username,
                channelUrl: `https://x.com/${username}`,
                viewCount: '0',
                likeCount: '0',
                publishedAt: 'recently',
                thumbnailUrl: '',
                videoUrl: href,
                duration: ''
              });
            }
          });
        } else {
          tweetElements.forEach((tweet, index) => {
            if (index >= 20) return;
            
            try {
              // Extract username
              const userLink = tweet.querySelector('a[href^="/"][tabindex="-1"]');
              const username = userLink?.getAttribute('href')?.replace('/', '') || 'twitter_user';
              
              // Extract tweet text
              const tweetTextElement = tweet.querySelector('[data-testid="tweetText"]');
              const tweetText = tweetTextElement?.textContent || '';
              
              // Extract engagement metrics
              const likeButton = tweet.querySelector('[data-testid="like"]');
              const likeCount = likeButton?.getAttribute('aria-label')?.match(/\d+/)?.[0] || '0';
              
              const replyButton = tweet.querySelector('[data-testid="reply"]');
              const replyCount = replyButton?.getAttribute('aria-label')?.match(/\d+/)?.[0] || '0';
              
              // Generate tweet ID from timestamp or index
              const tweetId = `twitter_${Date.now()}_${index}`;
              
              // Extract tweet URL if available
              const tweetLink = tweet.querySelector('a[href*="/status/"]');
              const tweetUrl = tweetLink ? (tweetLink as HTMLAnchorElement).href : `https://x.com/${username}/status/${tweetId}`;
              
              tweets.push({
                videoId: tweetId,
                title: tweetText.substring(0, 100) || `Tweet by @${username}`,
                description: tweetText,
                channelId: `@${username}`,
                channelTitle: username,
                channelUrl: `https://x.com/${username}`,
                viewCount: replyCount,
                likeCount: likeCount,
                publishedAt: 'recently',
                thumbnailUrl: '',
                videoUrl: tweetUrl,
                duration: ''
              });
            } catch (err) {
              console.error('Error parsing tweet:', err);
            }
          });
        }
        
        return tweets;
      });
      
      posts.push(...tweetData);
      console.log(`[Twitter Scraper] Found ${posts.length} tweets for query: ${query}`);
      
    } catch (error) {
      console.error('[Twitter Scraper] Error searching tweets:', error);
    }
    
    return posts;
  }


  async getChannelInfo(channelUrl: string): Promise<TwitterProfileInfo | null> {
    if (!this.page) {
      await this.initialize();
    }

    try {
      await this.page!.goto(channelUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.delay(3000);
      
      const profileInfo = await this.page!.evaluate(() => {
        const username = window.location.pathname.replace('/', '') || 'unknown';
        
        // Try to extract follower count
        let followerCount = '0';
        const followersLink = document.querySelector('a[href$="/followers"]');
        if (followersLink) {
          const followersText = followersLink.textContent || '';
          const match = followersText.match(/([\d,\.]+[KMB]?)/);
          if (match) {
            followerCount = match[1];
          }
        }
        
        // Try to extract tweet count
        let tweetCount = '0';
        const statsElements = document.querySelectorAll('[data-testid="primaryColumn"] span');
        statsElements.forEach(span => {
          const text = span.textContent || '';
          if (text.includes('posts') || text.includes('Tweets')) {
            const match = text.match(/([\d,\.]+)/);
            if (match) {
              tweetCount = match[1];
            }
          }
        });
        
        // Try to extract bio
        const bioElement = document.querySelector('[data-testid="UserDescription"]');
        const bio = bioElement?.textContent || '';
        
        // Try to extract profile picture
        const profilePicElement = document.querySelector('img[alt="Profile picture"]') as HTMLImageElement;
        const profilePic = profilePicElement?.src || '';
        
        return {
          channelId: `@${username}`,
          channelTitle: username,
          subscriberCount: followerCount,
          videoCount: tweetCount,
          description: bio,
          thumbnailUrl: profilePic,
          channelUrl: window.location.href
        };
      });
      
      return profileInfo;
    } catch (error) {
      console.error('[Twitter Scraper] Error getting profile info:', error);
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

export default TwitterScraper;
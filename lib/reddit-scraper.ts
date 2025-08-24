import puppeteer, { Browser, Page } from 'puppeteer';

interface RedditPostData {
  postId: string;
  title: string;
  content: string;
  subreddit: string;
  author: string;
  authorUrl: string;
  upvotes: string;
  comments: string;
  publishedAt: string;
  postUrl: string;
  thumbnailUrl?: string;
  flair?: string;
}

interface RedditUserInfo {
  username: string;
  displayName: string;
  karma: string;
  accountAge: string;
  description: string;
  avatarUrl: string;
  profileUrl: string;
}

class RedditScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[Reddit Scraper] Initializing browser (attempt ${attempt}/${retries})...`);
        
        this.browser = await puppeteer.launch({
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--disable-extensions',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--enable-features=NetworkService',
            '--force-color-profile=srgb',
            '--window-size=1920,1080'
          ],
          protocolTimeout: 120000,
          timeout: 120000
        });
        
        this.page = await this.browser.newPage();
        
        await this.page.setDefaultNavigationTimeout(120000);
        await this.page.setDefaultTimeout(120000);
        
        await this.page.setViewport({ width: 1920, height: 1080 });
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await this.page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9'
        });
        
        console.log('[Reddit Scraper] Browser initialized successfully');
        return;
        
      } catch (error) {
        console.error(`[Reddit Scraper] Initialization attempt ${attempt} failed:`, error);
        
        if (this.browser) {
          try {
            await this.browser.close();
          } catch (closeError) {
            console.error('[Reddit Scraper] Error closing browser:', closeError);
          }
          this.browser = null;
          this.page = null;
        }
        
        if (attempt === retries) {
          throw new Error(`Failed to initialize browser after ${retries} attempts: ${error}`);
        }
        
        await this.delay(2000 * attempt);
      }
    }
  }

  async searchPosts(query: string, filter: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' = 'day'): Promise<RedditPostData[]> {
    if (!this.page) {
      await this.initialize();
    }
    
    if (!this.page || this.page.isClosed()) {
      console.log('[Reddit Scraper] Page was closed, reinitializing...');
      this.browser = null;
      this.page = null;
      await this.initialize();
    }

    const posts: RedditPostData[] = [];
    
    try {
      // Use old Reddit for easier scraping
      const searchUrl = `https://old.reddit.com/search?q=${encodeURIComponent(query)}&t=${filter}&sort=relevance`;
      console.log(`[Reddit Scraper] Navigating to: ${searchUrl}`);
      await this.page!.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      await this.delay(3000);
      
      const postData = await this.page!.evaluate(() => {
        const posts: any[] = [];
        const postElements = document.querySelectorAll('.thing.search-result');
        
        postElements.forEach((element) => {
          try {
            // Extract post ID
            const postId = element.getAttribute('data-fullname') || '';
            
            // Extract title
            const titleElement = element.querySelector('a.search-title');
            const title = titleElement?.textContent?.trim() || '';
            const postUrl = (titleElement as HTMLAnchorElement)?.href || '';
            
            // Extract subreddit
            const subredditElement = element.querySelector('.search-subreddit-link');
            const subreddit = subredditElement?.textContent?.trim() || '';
            
            // Extract author
            const authorElement = element.querySelector('.search-author a');
            const author = authorElement?.textContent?.trim() || '[deleted]';
            const authorUrl = author !== '[deleted]' ? `https://old.reddit.com/user/${author}` : '';
            
            // Extract upvotes
            const scoreElement = element.querySelector('.search-score');
            const upvotes = scoreElement?.textContent?.trim().replace(' points', '') || '0';
            
            // Extract comments count
            const commentsElement = element.querySelector('.search-comments');
            const commentsText = commentsElement?.textContent?.trim() || '0 comments';
            const comments = commentsText.match(/\d+/)?.[0] || '0';
            
            // Extract time
            const timeElement = element.querySelector('.search-time time');
            const publishedAt = timeElement?.getAttribute('datetime') || '';
            
            // Extract content/selftext if available
            const contentElement = element.querySelector('.search-result-body');
            const content = contentElement?.textContent?.trim() || '';
            
            // Extract thumbnail if available
            const thumbnailElement = element.querySelector('.thumbnail img') as HTMLImageElement;
            const thumbnailUrl = thumbnailElement?.src || '';
            
            // Extract flair if available
            const flairElement = element.querySelector('.linkflairlabel');
            const flair = flairElement?.textContent?.trim() || '';
            
            if (postId && title) {
              posts.push({
                postId,
                title,
                content,
                subreddit,
                author,
                authorUrl,
                upvotes,
                comments,
                publishedAt,
                postUrl,
                thumbnailUrl: thumbnailUrl !== 'self' ? thumbnailUrl : undefined,
                flair: flair || undefined
              });
            }
          } catch (error) {
            console.error('Error parsing Reddit post element:', error);
          }
        });
        
        return posts;
      });
      
      posts.push(...postData);
      console.log(`[Reddit Scraper] Found ${posts.length} posts for query: ${query}`);
      
    } catch (error) {
      console.error('[Reddit Scraper] Error searching posts:', error);
    }
    
    return posts;
  }

  async searchSubreddit(subreddit: string, filter: 'hot' | 'new' | 'top' | 'rising' = 'hot', timeFilter?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all'): Promise<RedditPostData[]> {
    if (!this.page) {
      await this.initialize();
    }
    
    if (!this.page || this.page.isClosed()) {
      console.log('[Reddit Scraper] Page was closed, reinitializing...');
      this.browser = null;
      this.page = null;
      await this.initialize();
    }

    const posts: RedditPostData[] = [];
    
    try {
      let url = `https://old.reddit.com/r/${subreddit}/${filter}`;
      if (filter === 'top' && timeFilter) {
        url += `?t=${timeFilter}`;
      }
      
      console.log(`[Reddit Scraper] Navigating to: ${url}`);
      await this.page!.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      await this.delay(3000);
      
      const postData = await this.page!.evaluate((subredditName) => {
        const posts: any[] = [];
        const postElements = document.querySelectorAll('.thing.link');
        
        postElements.forEach((element) => {
          try {
            const postId = element.getAttribute('data-fullname') || '';
            
            const titleElement = element.querySelector('a.title');
            const title = titleElement?.textContent?.trim() || '';
            const postUrl = (titleElement as HTMLAnchorElement)?.href || '';
            
            const authorElement = element.querySelector('.tagline .author');
            const author = authorElement?.textContent?.trim() || '[deleted]';
            const authorUrl = author !== '[deleted]' ? `https://old.reddit.com/user/${author}` : '';
            
            const scoreElement = element.querySelector('.score.unvoted');
            const upvotes = scoreElement?.textContent?.trim() || '0';
            
            const commentsElement = element.querySelector('.comments');
            const commentsText = commentsElement?.textContent?.trim() || '0 comments';
            const comments = commentsText.match(/\d+/)?.[0] || '0';
            
            const timeElement = element.querySelector('.tagline time');
            const publishedAt = timeElement?.getAttribute('datetime') || '';
            
            const contentElement = element.querySelector('.usertext-body .md');
            const content = contentElement?.textContent?.trim() || '';
            
            const thumbnailElement = element.querySelector('.thumbnail img') as HTMLImageElement;
            const thumbnailUrl = thumbnailElement?.src || '';
            
            const flairElement = element.querySelector('.linkflairlabel');
            const flair = flairElement?.textContent?.trim() || '';
            
            if (postId && title) {
              posts.push({
                postId,
                title,
                content,
                subreddit: subredditName,
                author,
                authorUrl,
                upvotes,
                comments,
                publishedAt,
                postUrl,
                thumbnailUrl: thumbnailUrl !== 'self' ? thumbnailUrl : undefined,
                flair: flair || undefined
              });
            }
          } catch (error) {
            console.error('Error parsing Reddit post element:', error);
          }
        });
        
        return posts;
      }, subreddit);
      
      posts.push(...postData);
      console.log(`[Reddit Scraper] Found ${posts.length} posts in r/${subreddit}`);
      
    } catch (error) {
      console.error('[Reddit Scraper] Error fetching subreddit posts:', error);
    }
    
    return posts;
  }

  async getUserInfo(username: string): Promise<RedditUserInfo | null> {
    if (!this.page) {
      await this.initialize();
    }

    try {
      const profileUrl = `https://old.reddit.com/user/${username}`;
      await this.page!.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.delay(3000);
      
      const userInfo = await this.page!.evaluate(() => {
        const usernameElement = document.querySelector('.titlebox h1');
        const username = usernameElement?.textContent?.trim().replace('/u/', '') || '';
        
        const karmaElement = document.querySelector('.karma');
        const karma = karmaElement?.textContent?.trim() || '0';
        
        const ageElement = document.querySelector('.age time');
        const accountAge = ageElement?.getAttribute('datetime') || '';
        
        // Try to get user description from about page
        const descriptionElement = document.querySelector('.usertext-body .md');
        const description = descriptionElement?.textContent?.trim() || '';
        
        // Old Reddit doesn't have easily accessible avatars
        const avatarUrl = '';
        
        return {
          username,
          displayName: username,
          karma,
          accountAge,
          description,
          avatarUrl,
          profileUrl: window.location.href
        };
      });
      
      return userInfo;
    } catch (error) {
      console.error('Error getting Reddit user info:', error);
      return null;
    }
  }

  // Adapter methods to match the Scraper interface
  async searchVideos(query: string, filter?: string): Promise<any[]> {
    // Map Reddit posts to video-like format for compatibility
    const timeFilter = filter || 'day';
    const posts = await this.searchPosts(query, timeFilter as any);
    
    return posts.map(post => ({
      videoId: post.postId,
      title: post.title,
      description: post.content,
      channelId: post.author,
      channelTitle: post.author,
      channelUrl: post.authorUrl,
      viewCount: post.upvotes,
      likeCount: post.upvotes,
      publishedAt: post.publishedAt,
      thumbnailUrl: post.thumbnailUrl || '',
      videoUrl: post.postUrl,
      duration: ''
    }));
  }

  async getChannelInfo(userUrl: string): Promise<any | null> {
    // Extract username from URL
    const usernameMatch = userUrl.match(/\/user\/([^/]+)/);
    if (!usernameMatch) return null;
    
    const username = usernameMatch[1];
    const userInfo = await this.getUserInfo(username);
    
    if (!userInfo) return null;
    
    return {
      channelId: userInfo.username,
      channelTitle: userInfo.displayName,
      subscriberCount: userInfo.karma,
      videoCount: '0',
      description: userInfo.description,
      thumbnailUrl: userInfo.avatarUrl,
      channelUrl: userInfo.profileUrl
    };
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

export default RedditScraper;
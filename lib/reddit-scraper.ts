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
        
        // Use config that bypasses Reddit's bot detection
        this.browser = await puppeteer.launch({
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled', // Critical: Hide automation
            '--exclude-switches=enable-automation',
            '--disable-features=VizDisplayCompositor',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--disable-extensions',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--window-size=1920,1080'
          ],
          protocolTimeout: 120000,
          timeout: 120000
        });
        
        this.page = await this.browser.newPage();
        
        // Remove webdriver property to avoid detection
        await this.page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
          });
        });
        
        // Increase timeouts
        await this.page.setDefaultNavigationTimeout(60000);
        await this.page.setDefaultTimeout(60000);
        
        await this.page.setViewport({ width: 1920, height: 1080 });
        
        // Use a real Chrome user agent
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await this.page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
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

  // Simplified approach - just get posts from subreddit directly
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
      // Get subreddits for the query
      const subreddits = this.getSubredditsForQuery(query);
      console.log(`[Reddit Scraper] Searching in subreddits: ${subreddits.join(', ')}`);
      
      for (const subreddit of subreddits) {
        try {
          // Try using Reddit's JSON endpoint instead
          const url = `https://www.reddit.com/r/${subreddit}/top.json?t=${filter}&limit=25`;
          console.log(`[Reddit Scraper] Fetching from r/${subreddit} (JSON API)...`);
          
          await this.page!.goto(url, { 
            waitUntil: 'networkidle0',
            timeout: 30000 
          });
          
          // Wait for JSON to load
          await this.delay(2000);
          
          // Parse the JSON response
          const subredditPosts = await this.page!.evaluate((subredditName) => {
            const posts: any[] = [];
            
            try {
              // Get the JSON content from the page
              const preElement = document.querySelector('pre');
              if (!preElement) {
                console.log('No JSON data found');
                return posts;
              }
              
              const jsonText = preElement.textContent || '{}';
              const data = JSON.parse(jsonText);
              
              if (data && data.data && data.data.children) {
                console.log(`Found ${data.data.children.length} posts in JSON`);
                
                data.data.children.forEach((child: any) => {
                  const post = child.data;
                  if (post && post.title) {
                    posts.push({
                      postId: post.id || `reddit_${Date.now()}`,
                      title: post.title,
                      content: post.selftext || '',
                      subreddit: post.subreddit || subredditName,
                      author: post.author || 'unknown',
                      authorUrl: post.author ? `https://www.reddit.com/user/${post.author}` : '',
                      upvotes: String(post.ups || 0),
                      comments: String(post.num_comments || 0),
                      publishedAt: new Date(post.created_utc * 1000).toISOString(),
                      postUrl: `https://www.reddit.com${post.permalink}`,
                      thumbnailUrl: post.thumbnail !== 'self' ? post.thumbnail : undefined,
                      flair: post.link_flair_text
                    });
                  }
                });
              }
            } catch (error) {
              console.error('Error parsing Reddit JSON:', error);
            }
            
            return posts;
          }, subreddit);
          
          posts.push(...subredditPosts);
          console.log(`[Reddit Scraper] Found ${subredditPosts.length} posts in r/${subreddit}`);
          
          // Stop if we have enough posts
          if (posts.length >= 10) {
            break;
          }
          
          await this.delay(3000); // Delay between subreddits
        } catch (error) {
          console.error(`[Reddit Scraper] Error fetching r/${subreddit}:`, error);
        }
      }
      
      console.log(`[Reddit Scraper] Total posts found: ${posts.length}`);
      
    } catch (error) {
      console.error('[Reddit Scraper] Error searching posts:', error);
    }
    
    return posts;
  }

  private getSubredditsForQuery(query: string): string[] {
    const queryLower = query.toLowerCase();
    
    // Map common topics to relevant subreddits
    if (queryLower.includes('vrfit') || queryLower.includes('vr fitness')) {
      return ['vrfit', 'OculusQuest', 'virtualreality'];
    }
    if (queryLower.includes('vr') || queryLower.includes('virtual reality') || queryLower.includes('oculus') || queryLower.includes('quest')) {
      return ['virtualreality', 'OculusQuest', 'VRGaming'];
    }
    if (queryLower.includes('artificial intelligence') || queryLower.includes('ai')) {
      return ['artificial', 'MachineLearning', 'technology'];
    }
    if (queryLower.includes('programming') || queryLower.includes('coding')) {
      return ['programming', 'webdev', 'learnprogramming'];
    }
    if (queryLower.includes('javascript') || queryLower.includes('react')) {
      return ['javascript', 'reactjs', 'webdev'];
    }
    if (queryLower.includes('python')) {
      return ['Python', 'learnpython'];
    }
    if (queryLower.includes('crypto') || queryLower.includes('bitcoin')) {
      return ['CryptoCurrency', 'Bitcoin'];
    }
    if (queryLower.includes('fitness')) {
      return ['fitness', 'vrfit'];
    }
    
    // Default - search in popular subreddits
    return ['technology', 'programming'];
  }

  async searchSubreddit(subreddit: string, filter: 'hot' | 'new' | 'top' | 'rising' = 'hot', timeFilter?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all'): Promise<RedditPostData[]> {
    if (!this.page) {
      await this.initialize();
    }
    
    const posts: RedditPostData[] = [];
    
    try {
      let url = `https://www.reddit.com/r/${subreddit}/${filter}/`;
      if (filter === 'top' && timeFilter) {
        url += `?t=${timeFilter}`;
      }
      
      console.log(`[Reddit Scraper] Navigating to: ${url}`);
      await this.page!.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      await this.delay(5000);
      
      // Implementation similar to searchPosts
      
    } catch (error) {
      console.error('[Reddit Scraper] Error fetching subreddit:', error);
    }
    
    return posts;
  }

  async getUserInfo(username: string): Promise<RedditUserInfo | null> {
    // Simplified implementation
    return {
      username,
      displayName: username,
      karma: '0',
      accountAge: '',
      description: '',
      avatarUrl: '',
      profileUrl: `https://www.reddit.com/user/${username}`
    };
  }

  // Adapter methods to match the Scraper interface
  async searchVideos(query: string, filter?: string): Promise<any[]> {
    // Map 'today' to 'day' for Reddit
    let timeFilter = filter || 'day';
    if (timeFilter === 'today') {
      timeFilter = 'day';
    }
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
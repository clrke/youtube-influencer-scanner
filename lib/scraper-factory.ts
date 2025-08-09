import YouTubeScraper from './youtube-scraper';
import TikTokScraper from './tiktok-scraper';
import InstagramScraper from './instagram-scraper';
import TwitterScraper from './twitter-scraper';

export type Platform = 'YOUTUBE' | 'TIKTOK' | 'INSTAGRAM' | 'TWITTER';

export interface VideoData {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  channelUrl: string;
  viewCount: string;
  likeCount?: string;
  publishedAt: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: string;
}

export interface ChannelInfo {
  channelId: string;
  channelTitle: string;
  subscriberCount: string;
  videoCount: string;
  description: string;
  thumbnailUrl: string;
  channelUrl: string;
}

export interface Scraper {
  initialize(): Promise<void>;
  searchVideos(query: string, filter?: string): Promise<VideoData[]>;
  getChannelInfo(channelUrl: string): Promise<ChannelInfo | null>;
  close(): Promise<void>;
}

export class ScraperFactory {
  static createScraper(platform: Platform): Scraper {
    switch (platform) {
      case 'YOUTUBE':
        return new YouTubeScraper();
      case 'TIKTOK':
        return new TikTokScraper();
      case 'INSTAGRAM':
        throw new Error('Instagram scraper coming soon - API integration required');
      case 'TWITTER':
        throw new Error('Twitter/X scraper coming soon - API integration required');
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }
}
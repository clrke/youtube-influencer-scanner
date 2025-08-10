import { prisma } from './db';
import scheduler from './scheduler';

export async function initializeSchedulers() {
  try {
    console.log('[Scheduler] Initializing schedulers...');
    
    // Get all active topics
    const activeTopics = await prisma.searchTopic.findMany({
      where: { active: true }
    });
    
    console.log(`[Scheduler] Found ${activeTopics.length} active topics`);
    
    // Start schedulers for each active topic
    const intervalHours = parseInt(process.env.SEARCH_INTERVAL_HOURS || '4');
    
    for (const topic of activeTopics) {
      await scheduler.startScheduler(topic.id, topic.name, topic.platform as any, intervalHours, true); // Skip initial search on startup
    }
    
    console.log('[Scheduler] All schedulers initialized');
  } catch (error) {
    console.error('[Scheduler] Failed to initialize schedulers:', error);
  }
}

// Initialize schedulers when the module loads (in production)
if (process.env.NODE_ENV === 'production') {
  initializeSchedulers();
}
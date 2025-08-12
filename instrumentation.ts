export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize database pragmas
    const { prisma } = await import('./lib/db');
    
    // Set SQLite pragmas for better concurrency
    try {
      await prisma.$executeRawUnsafe(`PRAGMA journal_mode = WAL;`);
      await prisma.$executeRawUnsafe(`PRAGMA busy_timeout = 20000;`);
      await prisma.$executeRawUnsafe(`PRAGMA synchronous = NORMAL;`);
      await prisma.$executeRawUnsafe(`PRAGMA cache_size = -64000;`);
      await prisma.$executeRawUnsafe(`PRAGMA temp_store = MEMORY;`);
      console.log('[Instrumentation] SQLite pragmas configured');
    } catch (error) {
      console.error('[Instrumentation] Failed to set SQLite pragmas:', error);
    }
    
    if (process.env.NODE_ENV === 'production') {
      // This runs only on the server in production
      const { initializeSchedulers } = await import('./lib/scheduler-init');
      
      // Delay initialization to allow server to fully start
      setTimeout(async () => {
        console.log('[Instrumentation] Initializing schedulers...');
        await initializeSchedulers();
      }, 10000); // Wait 10 seconds after server starts
    }
  }
}
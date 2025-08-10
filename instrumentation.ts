export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production') {
    // This runs only on the server in production
    const { initializeSchedulers } = await import('./lib/scheduler-init');
    
    // Delay initialization to allow server to fully start
    setTimeout(async () => {
      console.log('[Instrumentation] Initializing schedulers...');
      await initializeSchedulers();
    }, 10000); // Wait 10 seconds after server starts
  }
}
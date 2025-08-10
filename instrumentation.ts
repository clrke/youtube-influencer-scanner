export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // This runs only on the server
    const { initializeSchedulers } = await import('./lib/scheduler-init');
    
    // Initialize schedulers on server startup
    console.log('[Instrumentation] Initializing schedulers...');
    await initializeSchedulers();
  }
}
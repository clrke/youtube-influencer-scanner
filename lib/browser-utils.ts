import type { Browser } from 'puppeteer';

const CLOSE_TIMEOUT_MS = 10000;

/**
 * Close a Puppeteer browser reliably.
 *
 * Tries a graceful close first (which also lets Puppeteer delete its temporary
 * /tmp/puppeteer_dev_chrome_profile-* directory). If that throws or hangs, the
 * Chromium process is force-killed so no orphaned processes are left behind
 * in the container. Never throws.
 */
export async function closeBrowser(browser: Browser | null | undefined): Promise<void> {
  if (!browser) return;

  try {
    await Promise.race([
      browser.close(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('browser.close() timed out')), CLOSE_TIMEOUT_MS)
      ),
    ]);
  } catch (error) {
    console.error('[Browser] Graceful close failed, killing process:', error);
    try {
      browser.process()?.kill('SIGKILL');
    } catch (killError) {
      console.error('[Browser] Failed to kill browser process:', killError);
    }
  }
}

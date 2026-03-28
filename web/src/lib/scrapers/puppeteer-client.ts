
import puppeteer, { Browser } from 'puppeteer';

/**
 * Singleton Puppeteer Client
 * Manages a single browser instance to prevent memory leaks.
 */
class PuppeteerClient {
  private static instance: PuppeteerClient;
  private browser: Browser | null = null;
  private isInitializing = false;

  private constructor() {}

  public static getInstance(): PuppeteerClient {
    if (!PuppeteerClient.instance) {
      PuppeteerClient.instance = new PuppeteerClient();
    }
    return PuppeteerClient.instance;
  }

  /**
   * Initializes the browser if it's not already running.
   */
  public async getBrowser(): Promise<Browser> {
    if (this.browser) {
       // Check if disconnected
       if (!this.browser.isConnected()) {
           console.log('🔄 [Puppeteer] Browser disconnected. Restarting...');
           this.browser = null;
       } else {
           return this.browser;
       }
    }

    if (this.isInitializing) {
        // Simple retry logic if currently initializing
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (this.browser) return this.browser;
    }

    this.isInitializing = true;
    try {
      console.log('🚀 [Puppeteer] Launching new browser instance...');
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      this.browser = await puppeteer.launch({
        headless: true, // Run in background
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', 
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--ignore-certificate-errors',
          '--disable-web-security'
        ],
        ...(executablePath ? { executablePath } : {})
      });
      console.log('✅ [Puppeteer] Browser launched successfully.');
      return this.browser;
    } catch (error) {
      console.error('❌ [Puppeteer] Failed to launch browser:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Closes the browser instance.
   * Call this on server shutdown.
   */
  public async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const puppeteerClient = PuppeteerClient.getInstance();

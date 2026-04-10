import type { Browser } from 'puppeteer';

let puppeteerModulePromise: Promise<typeof import('puppeteer')> | null = null;

async function loadPuppeteer() {
  if (!puppeteerModulePromise) {
    puppeteerModulePromise = import('puppeteer');
  }
  return puppeteerModulePromise;
}

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
           console.log('Puppeteer browser disconnected. Restarting...');
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
      console.log('Launching new Puppeteer browser instance...');
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      const userDataDir = process.env.CHROME_USER_DATA_DIR || '/tmp/chrome-data';
      const configHome = process.env.XDG_CONFIG_HOME || '/tmp/chrome-config';
      const cacheHome = process.env.XDG_CACHE_HOME || '/tmp/chrome-cache';
      const puppeteer = await loadPuppeteer();

      this.browser = await puppeteer.default.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--ignore-certificate-errors',
          '--disable-web-security',
          '--disable-crash-reporter',
          '--disable-crashpad',
          '--disable-features=Crashpad',
          '--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter',
          '--disable-blink-features=AutomationControlled',
          '--lang=en-US,en',
          `--user-data-dir=${userDataDir}`,
          `--data-path=${configHome}`,
          `--disk-cache-dir=${cacheHome}`
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        env: {
          ...process.env,
          XDG_CONFIG_HOME: configHome,
          XDG_CACHE_HOME: cacheHome,
        },
        ...(executablePath ? { executablePath } : {})
      });
      console.log('Puppeteer browser launched successfully.');
      return this.browser;
    } catch (error) {
      console.error('Failed to launch Puppeteer browser:', error);
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

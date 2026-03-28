
import { AdvocateProfileScraper } from '@/lib/scrapers/advocate-profile-scraper';

/**
 * Singleton Session Manager to hold active scraper instances during the interactive flow.
 * In a serverless environment (Vercel), this won't persist across different lambdas.
 * BUT for a long-running Node server (or local dev), this works.
 * 
 * If deploying to Vercel/Serverless, we would need to store the session ID and handle browser 
 * reconnections via browser.wsEndpoint(), storing that in Redis/DB.
 * 
 * Since user is local/VPS for now, in-memory Map is simplest.
 */

// Global augmentation for hot-reload persistence in dev
const globalForScraper = global as unknown as { scraperSessions: Map<string, AdvocateProfileScraper> };

export const scraperSessions = globalForScraper.scraperSessions || new Map<string, AdvocateProfileScraper>();

if (process.env.NODE_ENV !== 'production') globalForScraper.scraperSessions = scraperSessions;

export class AdvocateScraperSessionManager {
  static async getSession(userId: string): Promise<AdvocateProfileScraper> {
    if (!scraperSessions.has(userId)) {
      const scraper = new AdvocateProfileScraper();
      // Initialize browser session lazily or eagerly?
      // Better to init when requested.
      scraperSessions.set(userId, scraper);
    }
    return scraperSessions.get(userId)!;
  }

  static async endSession(userId: string): Promise<void> {
    const scraper = scraperSessions.get(userId);
    if (scraper) {
      await scraper.close();
      scraperSessions.delete(userId);
    }
  }
}

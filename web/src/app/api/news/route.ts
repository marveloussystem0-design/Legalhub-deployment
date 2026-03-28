import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Parser from "rss-parser";

// Initialize RSS Parser
const parser = new Parser();

interface NewsItem {
  title?: string;
  link?: string;
  pubDate?: string;
  source?: string;
  type: string;
}

type FeedLikeItem = {
  title?: string;
  link?: string;
  pubDate?: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Internal Server Error";
}

// Default Feeds (Fallbacks) - Refined for Legal Relevance
const DEFAULT_FEED_1 = "https://news.google.com/rss/search?q=Supreme+Court+of+India+Judgments+site:livelaw.in+OR+site:barandbench.com&hl=en-IN&gl=IN&ceid=IN:en";
const DEFAULT_FEED_2 = "https://news.google.com/rss/search?q=High+Court+India+Legal+News+site:livelaw.in+OR+site:barandbench.com&hl=en-IN&gl=IN&ceid=IN:en";

// Cache structure (Simple in-memory cache for this serverless function instance)
// Note: In Vercel serverless, this might reset often, which is fine.
// For better caching, use KV or database.
let newsCache: {
  data: NewsItem[];
  timestamp: number;
} | null = null;

const CACHE_DURATION = 0; // Disabled temporarily to force refresh

export async function GET() {
  try {
    // 1. Check Cache
    if (newsCache && Date.now() - newsCache.timestamp < CACHE_DURATION) {
      return NextResponse.json({ items: newsCache.data, source: 'cache' });
    }

    const supabase = await createClient();

    // 2. Fetch All News Settings from DB 
    const { data: settings } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .like('setting_key', 'news_rss_url_%');

    // Extract URLs 
    const feedUrls = settings?.map(s => s.setting_value).filter(Boolean) || [];
    
    // If no custom feeds in DB, use defaults
    const finalUrls = feedUrls.length > 0 ? feedUrls : [DEFAULT_FEED_1, DEFAULT_FEED_2];

    // 3. Fetch RSS Feeds in Parallel
    const feedPromises = finalUrls.map(url => parser.parseURL(url!));
    const feedResults = await Promise.allSettled(feedPromises);

    // 4. Process and Merge Items
    let items: NewsItem[] = [];

    const processFeedItem = (item: FeedLikeItem, source: string): NewsItem => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      source: source,
      type: 'news' // or 'tip' if we add logic for that later
    });

    feedResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const feedLabel = result.value.title || `Feed ${index + 1}`;
        items = [...items, ...(result.value.items || []).map(i => processFeedItem(i, feedLabel))];
      }
    });

    // 5. Sort by Date (Newest First)
    items.sort((a, b) => {
      const dateA = a.pubDate ? new Date(a.pubDate).getTime() : NaN;
      const dateB = b.pubDate ? new Date(b.pubDate).getTime() : NaN;
      // Handle invalid dates
      if (isNaN(dateA)) return 1;
      if (isNaN(dateB)) return -1;
      return dateB - dateA;
    });

    // 6. Limit and inject static tips
    // We inject a few static tips/reminders to ensure there's always "ticker" content
    const tips = [
      { title: "Tip: Update your profile to improve client visibility.", type: 'tip' },
      { title: "Reminder: Sync your calendar for hearing alerts.", type: 'reminder' }
    ];

    // Interleave tips every 5 news items
    const finalItems: NewsItem[] = [];
    let tipIndex = 0;
    
    // Take top 15 news items
    const topNews = items.slice(0, 15);

    for (let i = 0; i < topNews.length; i++) {
        finalItems.push(topNews[i]);
        if ((i + 1) % 5 === 0) {
            finalItems.push(tips[tipIndex % tips.length]);
            tipIndex++;
        }
    }
    
    // If no news, just show tips
    if (finalItems.length === 0) {
        finalItems.push(...tips);
        finalItems.push({ title: "System: Unable to fetch live news at this moment.", type: 'system' });
    }

    // 7. Update Cache
    newsCache = {
      data: finalItems,
      timestamp: Date.now()
    };

    return NextResponse.json({ items: finalItems, source: 'live' });

  } catch (error: unknown) {
    console.error("News API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch news", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

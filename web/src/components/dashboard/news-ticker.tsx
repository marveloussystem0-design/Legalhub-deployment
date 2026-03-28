"use client";

import { Bell, Info, Lightbulb, ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

type NewsItem = {
  title: string;
  source?: string;
  link?: string;
  type: 'news' | 'tip' | 'reminder' | 'system';
};

export default function NewsTicker() {
  const [isPaused, setIsPaused] = useState(false);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNews() {
      try {
        const res = await fetch(`/api/news?t=${Date.now()}`);
        const data = await res.json();
        
        if (data.items && Array.isArray(data.items)) {
          setItems(data.items);
        }
      } catch (error) {
        console.error("Failed to fetch ticker news:", error);
        // Fallback items if API fails
        setItems([
           { type: 'system', title: "System: Unable to load live news. Checking connection..." },
           { type: 'tip', title: "Tip: You can manually check court websites for updates." }
        ]);
      } finally {
        setLoading(false);
      }
    }

    fetchNews();
    
    // Refresh every 15 minutes
    const interval = setInterval(fetchNews, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return null;

  // Ensure we have enough items to scroll smoothly - duplicate the array
  const displayItems = items.length < 5 ? [...items, ...items, ...items, ...items] : [...items, ...items];

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes ticker-scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .ticker-animate {
            animation: ticker-scroll 120s linear infinite;
          }
          .ticker-paused {
            animation-play-state: paused;
          }
        `
      }} />
      
      <div className="w-full bg-white border-y border-gray-200 py-4 overflow-hidden flex items-center shadow-sm relative z-10">
        {/* Label Badge */}
        <div className="flex-shrink-0 bg-teal-600 text-white px-4 py-2 rounded-r-full text-sm font-bold uppercase tracking-wider shadow-md absolute left-0 z-20 flex items-center gap-2">
          <Bell className="h-4 w-4" />
          <span>Updates</span>
        </div>

        {/* Scrolling Container */}
        <div 
          className="flex overflow-hidden w-full ml-28 md:ml-32 relative"
          style={{
            maskImage: 'linear-gradient(to right, transparent, black 20px, black 95%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 20px, black 95%, transparent)'
          }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div 
            className={`flex gap-20 items-center whitespace-nowrap ticker-animate ${isPaused ? 'ticker-paused' : ''}`}
          >
            {displayItems.map((item, index) => (
              <a 
                key={index} 
                href={item.link || '#'}
                target={item.link ? "_blank" : undefined}
                rel="noopener noreferrer"
                className={`flex items-center gap-2 text-base font-semibold group transition-colors ${item.link ? 'cursor-pointer hover:text-teal-700' : 'cursor-default'}`}
                onClick={(e) => !item.link && e.preventDefault()}
              >
                {item.type === 'tip' && <Lightbulb className="h-5 w-5 text-amber-500 flex-shrink-0" />}
                {item.type === 'news' && <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />}
                {item.type === 'reminder' && <Bell className="h-5 w-5 text-red-500 flex-shrink-0" />}
                {item.type === 'system' && <RefreshCw className="h-5 w-5 text-gray-500 flex-shrink-0" />}
                
                <span className="truncate max-w-2xl text-gray-800 group-hover:text-teal-800 transition-colors">
                  {item.title}
                </span>
                
                {item.link && (
                  <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-teal-600 transition-colors" />
                )}
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

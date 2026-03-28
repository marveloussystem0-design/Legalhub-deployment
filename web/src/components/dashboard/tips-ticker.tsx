"use client";

import { Lightbulb } from "lucide-react";
import { useEffect, useState } from "react";

type Tip = {
  id: string;
  content: string;
};

export default function TipsTicker() {
  const [tips, setTips] = useState<Tip[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    async function fetchTips() {
      try {
        const res = await fetch("/api/tips");
        const data = await res.json();
        if (data.tips && Array.isArray(data.tips) && data.tips.length > 0) {
          setTips(data.tips);
        }
      } catch {
        // silently fail — no tips to show is fine
      }
    }

    fetchTips();
    const interval = setInterval(fetchTips, 30 * 60 * 1000); // Refresh every 30 min
    return () => clearInterval(interval);
  }, []);

  // Don't render the bar if there are no tips
  if (tips.length === 0) return null;

  // Duplicate enough for smooth scroll
  const displayItems = tips.length < 4 ? [...tips, ...tips, ...tips, ...tips] : [...tips, ...tips];

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes tips-scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .tips-animate {
            animation: tips-scroll 30s linear infinite;
          }
          .tips-paused {
            animation-play-state: paused;
          }
        `
      }} />

      <div className="w-full bg-amber-50 border-y border-amber-200 py-3 overflow-hidden flex items-center relative z-10">
        {/* Badge */}
        <div className="flex-shrink-0 bg-amber-500 text-white px-4 py-1.5 rounded-r-full text-sm font-bold uppercase tracking-wider shadow-md absolute left-0 z-20 flex items-center gap-2">
          <Lightbulb className="h-4 w-4" />
          <span>Tips</span>
        </div>

        {/* Scrolling Container */}
        <div
          className="flex overflow-hidden w-full ml-28 md:ml-32 relative"
          style={{
            maskImage: "linear-gradient(to right, transparent, black 20px, black 95%, transparent)",
            WebkitMaskImage: "linear-gradient(to right, transparent, black 20px, black 95%, transparent)",
          }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div
            className={`flex gap-20 items-center whitespace-nowrap tips-animate ${isPaused ? "tips-paused" : ""}`}
          >
            {displayItems.map((tip, index) => (
              <span
                key={index}
                className="flex items-center gap-2 text-base font-semibold text-amber-900"
              >
                <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0" />
                {tip.content}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

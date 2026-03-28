'use client';

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface AutoRefreshToggleProps {
  onRefresh: () => Promise<void>;
  intervalMinutes?: number;
}

export default function AutoRefreshToggle({ 
  onRefresh, 
  intervalMinutes = 5 
}: AutoRefreshToggleProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    if (!isEnabled) return;

    const interval = setInterval(async () => {
      setIsRefreshing(true);
      try {
        await onRefresh();
        setLastRefresh(new Date());
      } catch (error) {
        console.error('Auto-refresh failed:', error);
      } finally {
        setIsRefreshing(false);
      }
    }, intervalMinutes * 60 * 1000);

    return () => clearInterval(interval);
  }, [isEnabled, intervalMinutes, onRefresh]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Manual refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
        </label>
        <span className="text-sm font-medium text-gray-700">
          Auto-refresh ({intervalMinutes}m)
        </span>
      </div>

      <button
        onClick={handleManualRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-teal-600 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh Now
      </button>

      {lastRefresh && (
        <span className="text-xs text-gray-400">
          Last: {lastRefresh.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

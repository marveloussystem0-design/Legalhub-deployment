'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, X } from 'lucide-react';
import { useState } from 'react';

export default function CaseFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  // Get current filters
  const currentStatus = searchParams.get('status') || '';
  const currentType = searchParams.get('type') || '';
  const currentSort = searchParams.get('sort') || 'newest';

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push('/dashboard/advocate');
    setIsOpen(false);
  };

  const hasActiveFilters = currentStatus || currentType || currentSort !== 'newest';

  return (
    <div className="mb-6 relative font-sans">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all shadow-sm ${
          hasActiveFilters 
            ? 'bg-teal-50 border-teal-200 text-teal-700 font-medium' 
            : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <Filter className="h-4 w-4" />
        Filters & Sort
        {hasActiveFilters && (
          <span className="ml-1 px-1.5 py-0.5 text-xs bg-teal-600 text-white rounded-full">
            !
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 p-4 bg-white border border-gray-200 rounded-xl shadow-xl grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-2 w-full max-w-2xl">
          
          {/* Status Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
            <select
              value={currentStatus}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none text-sm cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Case Type Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Case Type</label>
            <select
              value={currentType}
              onChange={(e) => updateFilter('type', e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none text-sm cursor-pointer"
            >
              <option value="">All Types</option>
              <option value="civil">Civil</option>
              <option value="criminal">Criminal</option>
              <option value="family">Family</option>
              <option value="corporate">Corporate</option>
              <option value="property">Property</option>
            </select>
          </div>

          {/* Sort Order */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sort By</label>
            <select
              value={currentSort}
              onChange={(e) => updateFilter('sort', e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none text-sm cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="updated">Recently Updated</option>
            </select>
          </div>

          {hasActiveFilters && (
            <div className="md:col-span-3 flex justify-end pt-2 border-t border-gray-100 mt-2">
              <button
                onClick={clearFilters}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium"
              >
                <X className="h-3 w-3" />
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

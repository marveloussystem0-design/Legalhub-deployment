'use client';

import { useState, useMemo } from 'react';
import { Search, X, FileText, Filter } from 'lucide-react';

type TemplateItem = {
  id: string;
  title: string;
  category?: string | null;
  is_system?: boolean | null;
};

interface TemplateBrowserProps {
  templates: TemplateItem[];
  onSelect: (template: TemplateItem) => void;
  onClose: () => void;
}

export default function TemplateBrowser({ templates, onSelect, onClose }: TemplateBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category || 'Uncategorized'));
    return ['all', ...Array.from(cats).sort()];
  }, [templates]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, selectedCategory]);

  // Group by category
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, TemplateItem[]> = {};
    filteredTemplates.forEach(template => {
      const cat = template.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(template);
    });
    return groups;
  }, [filteredTemplates]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-5xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gray-50/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 font-serif">Template Library</h3>
              <p className="text-gray-500 text-sm mt-1">Select a starting point for your legal document</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-teal-600 transition-colors h-5 w-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates (e.g., 'Affidavit', 'Lease', 'Notice')..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-all shadow-sm"
              autoFocus
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3 overflow-x-auto bg-gray-50/30 custom-scrollbar">
          <Filter className="h-4 w-4 text-teal-600 flex-shrink-0" />
          <div className="flex gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-all border ${
                  selectedCategory === cat
                    ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-500/20'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                {cat === 'all' ? 'All Templates' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/10 custom-scrollbar">
          {filteredTemplates.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-forwards">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 border border-gray-200">
                <Search className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No templates found</h3>
              <p className="text-gray-500 max-w-sm">
                We couldn&apos;t find matches for &quot;{searchQuery}&quot;. Try searching for specific legal terms or browse categories.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedTemplates).map(([category, temps]) => (
                <div key={category} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-3 mb-4 sticky top-0 bg-white/95 backdrop-blur py-2 z-10 border-b border-gray-100">
                    <h4 className="text-lg font-bold text-gray-800 font-serif tracking-wide border-l-4 border-teal-500 pl-3">
                      {category}
                    </h4>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium border border-gray-200">
                      {temps.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {temps.map((template: TemplateItem) => (
                      <button
                        key={template.id}
                        onClick={() => {
                          onSelect(template);
                          onClose();
                        }}
                        className="group relative flex flex-col text-left p-4 bg-white hover:bg-teal-50/30 border border-gray-200 hover:border-teal-200 rounded-lg transition-all hover:shadow-md hover:-translate-y-0.5"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className={`p-1.5 rounded-md ${template.is_system ? 'bg-teal-50 text-teal-600' : 'bg-purple-50 text-purple-600'}`}>
                            <FileText className="h-4 w-4" />
                          </div>
                          {!template.is_system && (
                            <span className="text-[10px] uppercase tracking-wider font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                              Custom
                            </span>
                          )}
                        </div>
                        
                        <h5 className="text-gray-900 font-medium text-sm leading-snug group-hover:text-teal-700 transition-colors line-clamp-2 mb-2">
                          {template.title}
                        </h5>
                        
                        <div className="mt-auto pt-2 border-t border-gray-100 group-hover:border-teal-100 transition-colors flex items-center justify-between text-[10px] text-gray-400">
                             <span>Preview & Fill</span>
                             <span className="opacity-0 group-hover:opacity-100 transition-opacity text-teal-600 font-medium">Select →</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center text-xs text-gray-500">
          <span>Showing {filteredTemplates.length} templates</span>
          <span>Press <kbd className="px-2 py-0.5 bg-white rounded border border-gray-200 text-gray-700 font-sans shadow-sm">ESC</kbd> to close</span>
        </div>
      </div>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(209, 213, 219, 0.8);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.8);
        }
      `}</style>
    </div>
  );
}

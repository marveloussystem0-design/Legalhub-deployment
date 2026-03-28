'use client';

import { ExternalLink, Book, Map, Search, Globe, FileText, Landmark, Gavel, Video, MonitorPlay } from 'lucide-react';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Book,
  Map,
  Search,
  Globe,
  FileText,
  Landmark,
  Gavel,
  Video,
  MonitorPlay,
};

interface Portal {
  id: string;
  name: string;
  url: string;
  icon: string; // Changed to string
  color: string;
  description: string;
}

interface PortalShortcutsProps {
  title: string;
  items: Portal[];
}

export default function PortalShortcuts({ title, items }: PortalShortcutsProps) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">{title}</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {items.map((portal) => {
          const Icon = iconMap[portal.icon] || Book; // Fallback to Book icon
          
          return (
            <a
              key={portal.id}
              href={portal.url}
              target={portal.url.startsWith('http') ? "_blank" : undefined}
              rel={portal.url.startsWith('http') ? "noopener noreferrer" : undefined}
              className="group relative bg-white border border-gray-200 rounded-xl p-5 hover:border-teal-500 hover:shadow-lg transition-all duration-200 flex flex-col items-center text-center"
            >
              {/* Icon Container */}
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${portal.color}15` }}
              >
                <Icon className="w-7 h-7" style={{ color: portal.color }} />
              </div>

              {/* Portal Name */}
              <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">
                {portal.name}
              </h3>

              {/* Description */}
              <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                {portal.description}
              </p>

              {/* External Link Icon */}
              {portal.url.startsWith('http') && (
                <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity absolute top-3 right-3" />
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}

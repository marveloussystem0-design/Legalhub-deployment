'use client';

import { useState } from 'react';
import { Calendar, FileText, Gavel, AlertCircle, CheckCircle, Clock, ChevronDown, ChevronUp, MoreVertical } from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: 'hearing' | 'status_change' | 'document' | 'filing' | 'order';
  title: string;
  description?: string;
  date: string;
  metadata?: Record<string, unknown>;
}

interface CaseTimelineProps {
  events: TimelineEvent[];
}

const getEventIcon = (type: TimelineEvent['type']) => {
  switch (type) {
    case 'hearing':
      return <Gavel className="h-5 w-5 text-blue-600" />;
    case 'status_change':
      return <AlertCircle className="h-5 w-5 text-amber-600" />;
    case 'document':
      return <FileText className="h-5 w-5 text-purple-600" />;
    case 'filing':
      return <Calendar className="h-5 w-5 text-teal-600" />;
    case 'order':
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    default:
      return <Clock className="h-5 w-5 text-gray-600" />;
  }
};

const getEventColor = (type: TimelineEvent['type']) => {
  switch (type) {
    case 'hearing':
      return 'bg-blue-50 border-blue-200';
    case 'status_change':
      return 'bg-amber-50 border-amber-200';
    case 'document':
      return 'bg-purple-50 border-purple-200';
    case 'filing':
      return 'bg-teal-50 border-teal-200';
    case 'order':
      return 'bg-green-50 border-green-200';
    default:
      return 'bg-gray-50 border-gray-200';
  }
};

export default function CaseTimeline({ events }: CaseTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (events.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No Timeline Events</h3>
        <p className="text-gray-500 mt-1">Case events will appear here as they occur</p>
      </div>
    );
  }

  // Sort events by date (newest first)
  const sortedEvents = [...events].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const shouldShrink = sortedEvents.length > 2 && !isExpanded;
  const displayEvents = shouldShrink 
    ? [sortedEvents[0], sortedEvents[sortedEvents.length - 1]] 
    : sortedEvents;

  const hiddenCount = sortedEvents.length - 2;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Clock className="h-5 w-5 text-teal-600" />
          Case Timeline
        </h2>
        {sortedEvents.length > 2 && (
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors flex items-center gap-1"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" /> Collapse
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" /> Expand All
              </>
            )}
          </button>
        )}
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        <div className="space-y-6">
          {displayEvents.map((event, index) => (
            <div key={event.id}>
              <div className="relative flex gap-4">
                {/* Icon */}
                <div className={`flex-shrink-0 w-12 h-12 rounded-full border-2 ${getEventColor(event.type)} flex items-center justify-center z-10 bg-white`}>
                  {getEventIcon(event.type)}
                </div>

                {/* Content */}
                <div className={`flex-1 ${index === displayEvents.length - 1 ? '' : 'pb-6'}`}>
                  <div className={`border rounded-lg p-4 ${getEventColor(event.type)}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-900">{event.title}</h3>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                        {new Date(event.date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    
                    {event.description && (
                      <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                    )}

                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200/50">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(event.metadata).map(([key, value]) => (
                            <div key={key}>
                              <span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}:</span>
                              <span className="ml-1 text-gray-700 font-medium">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Dotted lines expander between first and last */}
              {shouldShrink && index === 0 && (
                <div className="relative flex items-center gap-4 py-4">
                  <div className="flex-shrink-0 w-12 flex justify-center z-10">
                    <button 
                      onClick={() => setIsExpanded(true)}
                      className="w-8 h-8 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center hover:bg-teal-50 hover:border-teal-300 transition-all group"
                      title={`Show ${hiddenCount} more events`}
                    >
                      <MoreVertical className="h-4 w-4 text-gray-400 group-hover:text-teal-600" />
                    </button>
                  </div>
                  <button 
                    onClick={() => setIsExpanded(true)}
                    className="flex-1 flex items-center py-2 px-4 border border-dashed border-gray-200 rounded-lg bg-gray-50/50 hover:bg-teal-50/50 hover:border-teal-200 transition-all group"
                  >
                    <span className="text-xs font-semibold text-gray-400 group-hover:text-teal-600 uppercase tracking-widest">
                      {hiddenCount} more hearings & updates ...
                    </span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { Calendar, FileText, AlertCircle, CheckCircle, Clock, Gavel, ChevronDown, ChevronUp, MoreVertical } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useState } from 'react';

interface TimelineEvent {
  id: string;
  type: 'hearing' | 'status_change' | 'document' | 'filing' | 'order';
  title: string;
  description?: string;
  date: string;
  metadata?: Record<string, any>;
}

interface CaseTimelineProps {
  events: TimelineEvent[];
}

export default function CaseTimeline({ events }: CaseTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'hearing': return <Gavel size={20} color="#3B82F6" />;
      case 'status_change': return <AlertCircle size={20} color="#D97706" />;
      case 'document': return <FileText size={20} color="#7C3AED" />;
      case 'filing': return <Calendar size={20} color="#0D9488" />;
      case 'order': return <CheckCircle size={20} color="#059669" />;
      default: return <Clock size={20} color="#4B5563" />;
    }
  };

  const getEventColorStyles = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'hearing': return { bg: '#EFF6FF', border: '#BFDBFE' }; // Blue-50
      case 'status_change': return { bg: '#FFFBEB', border: '#FDE68A' }; // Amber-50
      case 'document': return { bg: '#F5F3FF', border: '#DDD6FE' }; // Purple-50
      case 'filing': return { bg: '#F0FDFA', border: '#99F6E4' }; // Teal-50
      case 'order': return { bg: '#ECFDF5', border: '#A7F3D0' }; // Green-50
      default: return { bg: '#F9FAFB', border: '#E5E7EB' }; // Gray-50
    }
  };

  if (events.length === 0) {
    return (
      <View style={[styles.emptyContainer, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <Clock size={32} color={theme.icon} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>No Timeline Events</Text>
        <Text style={[styles.emptyText, { color: theme.icon }]}>Events will appear here as they occur</Text>
      </View>
    );
  }

  const sortedEvents = [...events].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const shouldShrink = sortedEvents.length > 2 && !isExpanded;
  const displayEvents = shouldShrink 
    ? [sortedEvents[0], sortedEvents[sortedEvents.length - 1]]
    : sortedEvents;
  
  const hiddenCount = sortedEvents.length - 2;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text, marginBottom: 0 }]}>Case Timeline</Text>
        {sortedEvents.length > 2 && (
          <TouchableOpacity 
            onPress={() => setIsExpanded(!isExpanded)}
            style={styles.expandToggle}
          >
            <Text style={[styles.expandToggleText, { color: theme.tint }]}>
              {isExpanded ? 'Collapse' : 'Expand All'}
            </Text>
            {isExpanded ? <ChevronUp size={16} color={theme.tint} /> : <ChevronDown size={16} color={theme.tint} />}
          </TouchableOpacity>
        )}
      </View>
      
      <View style={[styles.timelineContainer, { borderLeftColor: theme.border }]}>
        {displayEvents.map((event, index) => {
          const stylesColors = getEventColorStyles(event.type);
          
          return (
            <View key={event.id}>
              <View style={styles.eventRow}>
                {/* Icon Bubble */}
                <View style={[styles.iconBubble, { backgroundColor: theme.background, borderColor: stylesColors.border }]}>
                  {getEventIcon(event.type)}
                </View>

                {/* Content Card */}
                <View style={[styles.card, { backgroundColor: stylesColors.bg, borderColor: stylesColors.border }]}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.eventTitle, { color: '#1F2937' }]}>{event.title}</Text>
                    <Text style={styles.eventDate}>
                      {new Date(event.date).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </Text>
                  </View>
                  
                  {event.description && (
                    <Text style={styles.eventDesc}>{event.description}</Text>
                  )}

                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <View style={styles.metadataContainer}>
                      {Object.entries(event.metadata).map(([key, value]) => (
                        <Text key={key} style={styles.metaText}>
                          <Text style={styles.metaKey}>{key.replace(/_/g, ' ')}: </Text>
                          {String(value)}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {/* Expander between first and last */}
              {shouldShrink && index === 0 && (
                <View style={styles.shrinkDividerContainer}>
                  <TouchableOpacity 
                    onPress={() => setIsExpanded(true)}
                    style={styles.shrinkBubble}
                  >
                    <MoreVertical size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setIsExpanded(true)}
                    style={[styles.shrinkCard, { borderColor: theme.border }]}
                  >
                    <Text style={styles.shrinkText}>{hiddenCount} more hearings & updates ...</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expandToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    margin: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 4,
  },
  timelineContainer: {
    borderLeftWidth: 2,
    marginLeft: 16,
    paddingLeft: 24,
    paddingBottom: 16,
  },
  eventRow: {
    position: 'relative',
    marginBottom: 24,
  },
  iconBubble: {
    position: 'absolute',
    left: -42, // Adjust to center on line
    top: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  card: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  eventDate: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  eventDesc: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  metadataContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  metaText: {
    fontSize: 11,
    color: '#4B5563',
  },
  metaKey: {
    textTransform: 'capitalize',
    color: '#9CA3AF',
  },
  shrinkDividerContainer: {
    position: 'relative',
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  shrinkBubble: {
    position: 'absolute',
    left: -38,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  shrinkCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    backgroundColor: '#F9FAFB',
  },
  shrinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

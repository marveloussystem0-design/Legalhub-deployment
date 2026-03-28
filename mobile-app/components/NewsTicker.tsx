import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, Platform, Dimensions } from 'react-native';
import { Bell, Info, Lightbulb, RefreshCw, ExternalLink } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { supabase } from '@/lib/supabase';

const ITEM_WIDTH = 300;

type NewsItem = {
  title: string;
  source?: string;
  link?: string;
  type: 'news' | 'tip' | 'reminder' | 'system';
};

const DEFAULT_ITEMS: NewsItem[] = [
  { type: 'system', title: "Welcome to LegalHub Mobile." },
  { type: 'tip', title: "Tip: Swipe to see more updates." },
  { type: 'news', title: "LegalHub Mobile Beta is now live!" }
];

// Fallback RSS URLs if not in DB
const DEFAULT_RSS_1 = "https://news.google.com/rss/search?q=Supreme+Court+of+India+Judgments+site:livelaw.in+OR+site:barandbench.com&hl=en-IN&gl=IN&ceid=IN:en";
const DEFAULT_RSS_2 = "https://news.google.com/rss/search?q=High+Court+India+Legal+News+site:livelaw.in+OR+site:barandbench.com&hl=en-IN&gl=IN&ceid=IN:en";

export default function NewsTicker() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  
  const [items, setItems] = useState<NewsItem[]>(DEFAULT_ITEMS);
  const flatListRef = useRef<FlatList>(null);
  const scrollIndex = useRef(0);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 15 * 60 * 1000); // 15 min
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    scrollIndex.current = 0;
    
    const scrollInterval = setInterval(() => {
      if (flatListRef.current) {
        scrollIndex.current += 1;
        if (scrollIndex.current >= items.length) {
            scrollIndex.current = 0;
        }
        flatListRef.current.scrollToIndex({ 
          index: scrollIndex.current, 
          animated: true,
          viewPosition: 0
        });
      }
    }, 4000); 

    return () => clearInterval(scrollInterval);
  }, [items]);

  const parseRSS = (xmlText: string, sourceLabel: string): NewsItem[] => {
    const items: NewsItem[] = [];
    try {
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        while ((match = itemRegex.exec(xmlText)) !== null) {
            const content = match[1];
            // Simple regex to extract title and link
            let title = content.match(/<title>(.*?)<\/title>/)?.[1] || '';
            let link = content.match(/<link>(.*?)<\/link>/)?.[1] || '';

            // Clean CDATA if present
            title = title.replace('<![CDATA[', '').replace(']]>', '');
            link = link.replace('<![CDATA[', '').replace(']]>', '');

            if (title && link) {
                // Decode HTML entities (basic)
                title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                
                items.push({ 
                    title, 
                    link, 
                    source: sourceLabel,
                    type: 'news' 
                });
            }
        }
    } catch (e) {
        console.log('XML Parse error', e);
    }
    return items;
  };

  const fetchNews = async () => {
    try {
      console.log('📰 Fetching news directly from RSS...');
      
      // 1. Get RSS URLs from Settings
      const { data: settings } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['news_rss_url_1', 'news_rss_url_2']);

      const url1 = settings?.find(s => s.key === 'news_rss_url_1')?.value || DEFAULT_RSS_1;
      const url2 = settings?.find(s => s.key === 'news_rss_url_2')?.value || DEFAULT_RSS_2;

      
      // 2. Fetch RSS Feeds (Parallel)
      const feedPromises = [
        fetch(url1).then(res => res.text()).then(text => parseRSS(text, 'Supreme Court')),
        fetch(url2).then(res => res.text()).then(text => parseRSS(text, 'High Court'))
      ];

      const results = await Promise.allSettled(feedPromises);
      let allNews: NewsItem[] = [];

      results.forEach(result => {
        if (result.status === 'fulfilled') {
            allNews = [...allNews, ...result.value];
        }
      });

      // 3. Sort by newness? RSS is usually sorted. 
      // We just interleave or take top items.
      const topNews = allNews.slice(0, 15);
      
      if (topNews.length > 0) {
        // Interleave tips
        const tips: NewsItem[] = [
             { type: 'tip', title: "Tip: Update your profile to improve litigant visibility." },
             { type: 'reminder', title: "Reminder: Sync your calendar for hearing alerts." }
        ];

        const finalItems: NewsItem[] = [];
        let tipIndex = 0;
        
        for (let i = 0; i < topNews.length; i++) {
            finalItems.push(topNews[i]);
            if ((i + 1) % 5 === 0) {
                finalItems.push(tips[tipIndex % tips.length]);
                tipIndex++;
            }
        }
        
        console.log(`✅ Loaded ${finalItems.length} items directly.`);
        setItems(finalItems);
      } else {
         console.log('⚠️ No news items found from RSS.');
      }

    } catch (error: any) {
      console.log('❌ Direct News fetch failed:', error.message);
      // Keep defaults
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'tip': return <Lightbulb size={16} color="#F59E0B" />;
      case 'news': return <Info size={16} color="#3B82F6" />;
      case 'reminder': return <Bell size={16} color="#EF4444" />;
      default: return <RefreshCw size={16} color="#6B7280" />;
    }
  };

  if (items.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
      <View style={[styles.badge, { backgroundColor: theme.tint }]}>
        <Bell size={12} color="#fff" />
        <Text style={styles.badgeText}>UPDATES</Text>
      </View>
      
      <FlatList
        ref={flatListRef}
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_WIDTH}
        decelerationRate="fast"
        pagingEnabled={false} 
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.itemContainer, { width: ITEM_WIDTH }]} 
            onPress={() => item.link && Linking.openURL(item.link)}
            activeOpacity={0.8}
          >
            <View style={styles.iconContainer}>
              {getIcon(item.type)}
            </View>
            <Text 
              style={[styles.text, { color: theme.text }]} 
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {item.link && <ExternalLink size={12} color={theme.icon} style={{ marginLeft: 6 }} />}
          </TouchableOpacity>
        )}
        getItemLayout={(data, index) => ({
          length: ITEM_WIDTH,
          offset: ITEM_WIDTH * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          console.log('Scroll failed', info);
          flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
        }}
        style={{ flex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingRight: 16,
  },
  badge: {
    paddingHorizontal: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginRight: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingRight: 16,
  },
  iconContainer: {
    marginRight: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
});

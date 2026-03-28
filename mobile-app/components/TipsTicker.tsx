import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  useColorScheme,
  Dimensions,
} from 'react-native';
import { Lightbulb } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

const SCREEN_WIDTH = Dimensions.get('window').width;

type Tip = {
  id: string;
  content: string;
};

export default function TipsTicker() {
  const [tips, setTips] = useState<Tip[]>([]);
  const scrollX = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const fetchTips = async () => {
    try {
      const { data } = await supabase
        .from('advocate_tips')
        .select('id, content')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        setTips(data);
      }
    } catch {
      // Silent fail – tips are non-critical
    }
  };

  useEffect(() => {
    fetchTips();
    const interval = setInterval(fetchTips, 30 * 60 * 1000); // 30 min refresh
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (tips.length === 0) return;

    // Estimate total text width: roughly 8px per character + 80px gap between tips
    const fullTextWidth = tips.reduce((acc, t) => acc + t.content.length * 8 + 80, 0);
    const duration = Math.max(fullTextWidth * 35, 15000); // min 15s

    const startAnimation = () => {
      scrollX.setValue(0);
      animRef.current = Animated.loop(
        Animated.timing(scrollX, {
          toValue: -fullTextWidth,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      animRef.current.start();
    };

    startAnimation();
    return () => animRef.current?.stop();
  }, [tips]);

  if (tips.length === 0) return null;

  // Duplicate tips for seamless loop
  const displayTips = [...tips, ...tips, ...tips];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#451a03' : '#fffbeb', borderTopColor: isDark ? '#78350f' : '#fde68a', borderBottomColor: isDark ? '#78350f' : '#fde68a' }]}>
      {/* Badge */}
      <View style={styles.badge}>
        <Lightbulb size={12} color="#fff" />
        <Text style={styles.badgeText}>TIPS</Text>
      </View>

      {/* Scrolling ticker */}
      <View style={styles.clipper}>
        <Animated.View
          style={[styles.scrollRow, { transform: [{ translateX: scrollX }] }]}
        >
          {displayTips.map((tip, index) => (
            <View key={`${tip.id}-${index}`} style={styles.tipItem}>
              <Lightbulb size={13} color="#f59e0b" style={{ marginRight: 5 }} />
              <Text numberOfLines={1} style={[styles.tipText, { color: isDark ? '#fcd34d' : '#92400e' }]}>
                {tip.content}
              </Text>
            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    gap: 4,
    zIndex: 2,
    marginRight: 8,
    minWidth: 60,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  clipper: {
    flex: 1,
    overflow: 'hidden',
  },
  scrollRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 48,
  },
  tipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

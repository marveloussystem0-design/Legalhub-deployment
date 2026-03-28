
import React, { memo, useState } from 'react';
import { View, StyleSheet, useColorScheme, Text, Dimensions } from 'react-native';
import Svg, { Path, G, Text as SvgText, Rect } from 'react-native-svg';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedProps,
  runOnJS,
  useAnimatedReaction
} from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors } from '@/constants/Colors';
import mapData from '../data/tn-map-paths.json';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TNInteractiveMapProps {
  onDistrictPress: (districtName: string) => void;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedText = Animated.createAnimatedComponent(SvgText);

// SNAPPY DISTRICT PATH
const DistrictPath = memo(({ name, data, theme, activeDistrict, onDistrictPress, isGestureActive }: any) => {
  const animatedProps = useAnimatedProps(() => {
    const isSelected = activeDistrict.value === name;
    return {
      fill: isSelected ? theme.tint : theme.surface,
      strokeWidth: isSelected ? 1.5 : 0.8,
      stroke: isSelected ? '#fff' : theme.border,
    };
  });

  return (
    <AnimatedPath
      d={data.path}
      animatedProps={animatedProps}
      onPressIn={() => {
        if (!isGestureActive.value) {
          activeDistrict.value = name;
        }
      }}
      onPressOut={() => {
        // Instant clear on release for "snappy" feel
        activeDistrict.value = '';
      }}
      onPress={() => {
        if (!isGestureActive.value) {
          onDistrictPress(name);
        }
      }}
    />
  );
});

// SNAPPY DISTRICT LABEL
const DistrictLabel = memo(({ name, data, theme, activeDistrict }: any) => {
  const animatedProps = useAnimatedProps(() => {
    const isSelected = activeDistrict.value === name;
    return {
      fill: isSelected ? '#fff' : theme.text,
      opacity: isSelected ? 1 : 0.7,
      scale: isSelected ? 1.15 : 1,
    };
  });

  return (
    <AnimatedText
      x={data.centroid[0]}
      y={data.centroid[1]}
      animatedProps={animatedProps}
      fontSize={10}
      fontWeight="900"
      textAnchor="middle"
      alignmentBaseline="middle"
      pointerEvents="none"
    >
      {name}
    </AnimatedText>
  );
});

const TNInteractiveMap: React.FC<TNInteractiveMapProps> = ({ onDistrictPress }) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  
  const [headerName, setHeaderName] = useState('Select a District');
  const activeDistrict = useSharedValue('');
  const isGestureActive = useSharedValue(false);

  const districts = mapData.districts as unknown as Record<string, { path: string; centroid: [number, number] }>;

  // GESTURE VALUES
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Sync header text from UI thread to JS
  useAnimatedReaction(
    () => activeDistrict.value,
    (name) => {
      runOnJS(setHeaderName)(name || 'Select a District');
    },
    [activeDistrict]
  );

  // STABLE FOCAL POINT ZOOM
  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      isGestureActive.value = true;
    })
    .onUpdate((e) => {
      const nextScale = Math.min(6, Math.max(1, savedScale.value * e.scale));
      const scaleChange = nextScale / scale.value;
      
      scale.value = nextScale;
      
      // Pivot translation around the focal point to keep it anchored to fingers
      translateX.value = e.focalX - (e.focalX - translateX.value) * scaleChange;
      translateY.value = e.focalY - (e.focalY - translateY.value) * scaleChange;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onFinalize(() => {
      isGestureActive.value = false;
    });

  const panGesture = Gesture.Pan()
    .minDistance(5)
    .onBegin(() => {
      isGestureActive.value = true;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onFinalize(() => {
      isGestureActive.value = false;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: theme.surfaceVariant }]}>
          <Text style={[styles.headerText, { color: theme.text }]}>
            {headerName}
          </Text>
        </View>

        {/* GestureDetector wraps the entire mapWrapper to capture empty space gestures */}
        <GestureDetector gesture={composedGesture}>
          <View style={styles.mapWrapper}>
            <Animated.View style={[styles.animatedContainer, animatedStyle]}>
              <Svg
                width="100%"
                height="100%"
                viewBox={mapData.viewBox}
                preserveAspectRatio="xMidYMid meet"
                style={{ backgroundColor: 'transparent' }}
              >
                <G>
                  {/* Backdrop ensures entire viewBox region captures gestures */}
                  <Rect
                    x="-100%"
                    y="-100%"
                    width="300%"
                    height="300%"
                    fill="transparent"
                  />
                  {Object.entries(districts).map(([name, data]) => (
                    <DistrictPath
                      key={`path-${name}`}
                      name={name}
                      data={data}
                      theme={theme}
                      activeDistrict={activeDistrict}
                      onDistrictPress={onDistrictPress}
                      isGestureActive={isGestureActive}
                    />
                  ))}
                  {Object.entries(districts).map(([name, data]) => (
                    <DistrictLabel
                      key={`text-${name}`}
                      name={name}
                      data={data}
                      theme={theme}
                      activeDistrict={activeDistrict}
                    />
                  ))}
                </G>
              </Svg>
            </Animated.View>
          </View>
        </GestureDetector>
        
        <View style={styles.footer}>
           <Text style={[styles.hint, { color: theme.icon }]}>
             Pinch to zoom • Drag to move • Tap to select
           </Text>
        </View>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  container: { flex: 1, width: '100%', alignItems: 'center', gap: 16, paddingVertical: 10 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    minWidth: SCREEN_WIDTH * 0.8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    zIndex: 10,
  },
  headerText: { fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  mapWrapper: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  animatedContainer: { 
    width: '100%', 
    height: '100%', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  footer: { alignItems: 'center', paddingBottom: 20 },
  hint: { fontSize: 13, fontWeight: '700', opacity: 0.5, letterSpacing: 0.5 }
});

export default TNInteractiveMap;

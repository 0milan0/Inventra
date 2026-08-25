import { AnimatedPressable } from '@/components/plattegrond/AnimatedPressable';
import { Theme } from '@/constants/plattegrond-theme';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface SegmentedControlProps<T extends string> {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  theme: Theme;
}

/**
 * Segmented control met een fysiek schuivende indicator (i.p.v. losse
 * achtergrondkleur per tab) — hetzelfde component wordt gebruikt voor de
 * "lagen"-selector op de plattegrond én de tabs op de schap-detailpagina,
 * zodat het gedrag en gevoel overal identiek is.
 */
export function SegmentedControl<T extends string>({ options, value, onChange, theme }: SegmentedControlProps<T>) {
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.id === value));
  const indicatorPos = useSharedValue(index);

  useEffect(() => {
    indicatorPos.value = withSpring(index, { damping: 18, stiffness: 230 });
  }, [index]);

  const pillWidth = trackWidth / options.length;

  const indicatorStyle = useAnimatedStyle(() => ({
    width: pillWidth,
    transform: [{ translateX: indicatorPos.value * pillWidth }],
  }));

  return (
    <View
      style={[styles.track, { backgroundColor: theme.surface }]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      {trackWidth > 0 && (
        <Animated.View
          style={[styles.indicator, indicatorStyle, { backgroundColor: theme.surfaceRaised }]}
          pointerEvents="none"
        />
      )}
      {options.map((opt) => {
        const actief = opt.id === value;
        return (
          <AnimatedPressable
            key={opt.id}
            style={styles.tab}
            scaleTo={0.97}
            onPress={() => onChange(opt.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: actief }}
          >
            <Text style={[styles.tabText, { color: actief ? theme.text : theme.textSecondary }]}>{opt.label}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: 12, padding: 4, position: 'relative' },
  indicator: { position: 'absolute', top: 4, bottom: 4, left: 0, borderRadius: 9 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  tabText: { fontSize: 11, fontWeight: '600', fontFamily: 'Montserrat' },
});

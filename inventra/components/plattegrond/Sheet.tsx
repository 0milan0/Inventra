import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Theme } from '@/constants/plattegrond-theme';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  theme: Theme;
  children: React.ReactNode;
}

const DISMISS_DRAG_THRESHOLD = 90;

/**
 * Bottom sheet met echte veer-fysica (spring in, snelle fade uit) en een
 * sleepbare handle om 'm weg te vegen — het native iOS-sheetgevoel, zonder
 * een aparte sheet-library nodig te hebben. Blijft een RN <Modal> vanbinnen
 * zodat 'ie gewoon boven tab bars/navigatie portalt.
 */
export function Sheet({ visible, onClose, theme, children }: SheetProps) {
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  const dragY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      dragY.value = 0;
      progress.value = withSpring(1, { damping: 20, stiffness: 240 });
    } else if (mounted) {
      progress.value = withTiming(0, { duration: 160 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dragGesture = Gesture.Pan()
    .onUpdate((e) => {
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (dragY.value > DISMISS_DRAG_THRESHOLD || e.velocityY > 800) {
        runOnJS(onClose)();
      }
      dragY.value = withSpring(0, { damping: 20, stiffness: 260 });
    });

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 36 + dragY.value }],
  }));

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlayScrim }, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Sluiten" />
        </Animated.View>

        <Animated.View style={[styles.sheet, { backgroundColor: theme.surface }, sheetStyle]}>
          <GestureDetector gesture={dragGesture}>
            <View style={styles.handleZone}>
              <View style={[styles.handle, { backgroundColor: theme.borderStrong }]} />
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 12,
  },
  handleZone: { paddingVertical: 10, alignItems: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2 },
});

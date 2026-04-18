import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(280, SCREEN_WIDTH * 0.75);

interface DrawerMenuItem {
  key: string;
  label: string;
  icon: string;
}

const menuItems: DrawerMenuItem[] = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'explore', label: 'Explore', icon: '✈️' },
  { key: 'profile', label: 'Profiel', icon: '👤' },
  { key: 'settings', label: 'Instellingen', icon: '⚙️' },
];

interface DrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  activeKey?: string;
}

export function DrawerMenu({ isOpen, onClose, activeKey = 'home' }: DrawerMenuProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen]);

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Dimmed overlay */}
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: overlayAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.4],
            }),
          },
        ]}
      />

      {/* Tap outside to close */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      {/* Drawer panel */}
      <Animated.View
        style={[
          styles.drawer,
          {
            width: DRAWER_WIDTH,
            backgroundColor: colors.background,
            borderRightColor: colors.border,
            transform: [{ translateX: slideAnim }],
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        {/* User header */}
        <View style={[styles.drawerHeader, { borderBottomColor: colors.border }]}>
          <View style={[styles.drawerAvatar, { backgroundColor: colors.tint + '22' }]}>
            <Text style={[styles.drawerAvatarText, { color: colors.tint }]}>JD</Text>
          </View>
          <ThemedText style={styles.drawerName}>Jan de Vries</ThemedText>
          <Text style={[styles.drawerRole, { color: colors.textSecondary }]}>Developer</Text>
        </View>

        {/* Nav items */}
        <View style={styles.drawerNav}>
          {menuItems.map((item) => {
            const isActive = item.key === activeKey;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.drawerItem,
                  isActive && { backgroundColor: colors.tint + '18' },
                ]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.drawerItemIcon}>{item.icon}</Text>
                <Text
                  style={[
                    styles.drawerItemLabel,
                    { color: isActive ? colors.tint : colors.text },
                    isActive && { fontWeight: '500' },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Footer */}
        <View style={[styles.drawerFooter, { borderTopColor: colors.border }]}>
          <TouchableOpacity style={styles.drawerItem} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.drawerItemIcon}>🚪</Text>
            <Text style={[styles.drawerItemLabel, { color: colors.text }]}>Uitloggen</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  drawerHeader: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  drawerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  drawerAvatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  drawerName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  drawerRole: {
    fontSize: 13,
  },
  drawerNav: {
    flex: 1,
    paddingTop: 8,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
    gap: 12,
    borderRadius: 0,
  },
  drawerItemIcon: {
    fontSize: 16,
    width: 22,
    textAlign: 'center',
  },
  drawerItemLabel: {
    fontSize: 15,
  },
  drawerFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
  },
});
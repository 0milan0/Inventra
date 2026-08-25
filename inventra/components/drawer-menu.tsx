import { ThemedText } from '@/components/themed-text';
import { FontFamily, getPalette, Radius, Shadow, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { getRolNiveau, type RolNiveau } from '@/data/session';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(300, SCREEN_WIDTH * 0.8);
const F = FontFamily;

interface DrawerMenuItem {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  route: string;
  /** Ontbreekt = voor iedereen zichtbaar. */
  rollen?: RolNiveau[];
  /** Ontbreekt = geen permissie vereist. Naam uit `permissions.name` (user.permissies). */
  permissie?: string;
}

interface DrawerMenuGroup {
  title: string;
  items: DrawerMenuItem[];
}

const menuGroups: DrawerMenuGroup[] = [
  {
    title: 'Algemeen',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline', route: '/' },
      { key: 'scanner', label: 'Scanner', icon: 'scan-outline', route: '/products' },
    ],
  },
  {
    title: 'Verkoop',
    items: [
      { key: 'bestellingen', label: 'Bestellingen', icon: 'cart-outline', route: '/orders-screen' },
      { key: 'pakbonnen', label: 'Pakbonnen', icon: 'cube-outline', route: '/bonnen/pakbonnen' },
      { key: 'verkoopbonnen', label: 'Verkoopbonnen', icon: 'receipt-outline', route: '/bonnen/verkoopbonnen' },
      { key: 'statistieken', label: 'Statistieken', icon: 'bar-chart-outline', route: '/statistieken' },
    ],
  },
  {
    title: 'Werk',
    items: [
      { key: 'taken', label: 'Taken', icon: 'checkbox-outline', route: '/taken' },
      { key: 'planning', label: 'Planning', icon: 'calendar-outline', route: '/planning' },
      {
        key: 'personeel',
        label: 'Personeel',
        icon: 'people-outline',
        route: '/personeel',
        rollen: ['teamleider', 'filiaalmanager'],
      },
    ],
  },
  {
    title: 'Winkel',
    items: [
      { key: 'plattegrond', label: 'Plattegrond', icon: 'map-outline', route: '/plattegrond' },
      {
        key: 'producten-toevoegen',
        label: 'Product toevoegen',
        icon: 'add-circle-outline',
        route: '/producten-toevoegen',
        permissie: 'producten_aanmaken',
      },
      {
        key: 'recalls',
        label: 'Recalls',
        icon: 'warning-outline',
        route: '/recalls',
        permissie: 'recalls_aanmaken',
      },
    ],
  },
  {
    title: 'Profiel',
    items: [
      { key: 'profiel', label: 'Profiel', icon: 'person-circle-outline', route: '/profile' },
      { key: 'verlof', label: 'Verlof', icon: 'sunny-outline', route: '/verlof/mijn' },

    ],
  },
];

interface DrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DrawerMenu({ isOpen, onClose }: DrawerMenuProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const p = getPalette(isDark);
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const rolNiveau = getRolNiveau(user?.rol ?? '');

  function handleNavigeer(route: string) {
    onClose();
    const doel = route === '/profile' && user ? `/profile/${user.id}` : route;
    router.push(doel as never);
  }

  function handleUitloggen() {
    onClose();
    logout();
  }

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setModalVisible(true);
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
      // Modal pas na afloop van de sluit-animatie verbergen — anders trekt
      // React Native's Modal zichzelf al native weg voordat de slide-out
      // klaar is, en "clipt" de animatie zichtbaar weg.
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
      ]).start(({ finished }) => {
        if (finished) setModalVisible(false);
      });
    }
  }, [isOpen, overlayAnim, slideAnim]);

  return (
    <Modal
      visible={modalVisible}
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
          Shadow.raised,
          {
            width: DRAWER_WIDTH,
            backgroundColor: p.surface,
            transform: [{ translateX: slideAnim }],
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        {/* User header */}
        <View style={[styles.drawerHeader, { borderBottomColor: p.border }]}>
          {user?.profielfoto ? (
            <Image source={{ uri: user.profielfoto }} style={styles.drawerAvatar} />
          ) : (
            <View style={[styles.drawerAvatar, { backgroundColor: p.accentSoft }]}>
              <Text style={[styles.drawerAvatarText, { color: p.accent }]}>{user?.initialen ?? ''}</Text>
            </View>
          )}
          <ThemedText style={styles.drawerName}>{user?.naam ?? ''}</ThemedText>
          <Text style={[styles.drawerRole, { color: p.textSecondary }]}>{user?.rol ?? ''}</Text>
        </View>

        {/* Nav items */}
        <ScrollView
          style={styles.drawerNav}
          contentContainerStyle={styles.drawerNavContent}
          showsVerticalScrollIndicator={false}
        >
          {menuGroups.map((group) => (
            <View key={group.title} style={styles.drawerGroup}>
              <Text style={[styles.drawerGroupTitle, { color: p.textMuted }]}>{group.title}</Text>

              {group.items
                .filter((item) => !item.rollen || item.rollen.includes(rolNiveau))
                .filter((item) => !item.permissie || !!user?.permissies?.includes(item.permissie))
                .map((item) => {
                const isActive = item.key === 'profiel'
                  ? pathname.startsWith('/profile/')
                  : pathname === item.route;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.drawerItem,
                      isActive && { backgroundColor: p.accentSoft },
                    ]}
                    onPress={() => handleNavigeer(item.route)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={isActive ? p.accent : p.textSecondary}
                    />
                    <Text
                      style={[
                        styles.drawerItemLabel,
                        { color: isActive ? p.accent : p.text },
                        isActive && { fontWeight: '600' },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.drawerFooter, { borderTopColor: p.border }]}>
          <TouchableOpacity style={styles.drawerItem} onPress={handleUitloggen} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color={p.textSecondary} />
            <Text style={[styles.drawerItemLabel, { color: p.text }]}>Uitloggen</Text>
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
  },
  drawerHeader: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  drawerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm + 2,
  },
  drawerAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: F,
  },
  drawerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    fontFamily: F,
  },
  drawerRole: {
    fontSize: 12.5,
    fontFamily: F,
  },
  drawerNav: {
    flex: 1,
  },
  drawerNavContent: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  drawerGroup: {
    marginBottom: Spacing.sm,
  },
  drawerGroupTitle: {
    fontSize: 10.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: F,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.sm,
    gap: Spacing.md,
    borderRadius: Radius.md,
  },
  drawerItemLabel: {
    fontSize: 14.5,
    fontFamily: F,
  },
  drawerFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
});

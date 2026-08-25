import { DrawerMenu } from '@/components/drawer-menu';
import { FontFamily, getPalette, Radius, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const F = FontFamily;

/**
 * Vaste header voor elk tab-scherm met een hamburger-menu: hamburger →
 * paginatitel + filiaalnaam als subtitel → profielfoto. Beheert de
 * drawer-state zelf, zodat een scherm alleen `<ScreenHeader title="…" />`
 * hoeft te renderen — geen losse drawerOpen-state of <DrawerMenu>-mount
 * meer nodig per scherm.
 */
export function ScreenHeader({ title }: { title: string }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);

  return (
    <>
      <SafeAreaView edges={['top']} style={{ backgroundColor: p.bg }}>
        <View style={[styles.header, { backgroundColor: p.bg }]}>
          <Pressable
            onPress={() => setDrawerOpen(true)}
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: p.surface, borderColor: p.border, opacity: pressed ? 0.6 : 1 },
            ]}
            accessibilityLabel="Open menu"
          >
            <Ionicons name="menu-outline" size={19} color={p.text} />
          </Pressable>

          <View style={styles.headerMidden}>
            <Text style={[styles.headerTitle, { color: p.text }]} numberOfLines={1}>
              {title}
            </Text>
            {!!user?.filiaal?.naam && (
              <Text style={[styles.headerSub, { color: p.textMuted }]} numberOfLines={1}>
                {user.filiaal.naam}
              </Text>
            )}
          </View>

          <Pressable
            onPress={() => user && router.push(`/profile/${user.id}` as never)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Open profiel"
          >
            {user?.profielfoto ? (
              <Image source={{ uri: user.profielfoto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: p.accentSoft }]}>
                <Text style={[styles.avatarText, { color: p.accent }]}>{user?.initialen}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </SafeAreaView>

      <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  headerMidden: { flex: 1, alignItems: 'center' },
  iconBtn: {
    width: 34, height: 34, borderRadius: Radius.sm,
    justifyContent: 'center', alignItems: 'center', borderWidth: 0.5,
  },
  headerTitle: { fontSize: 13.5, fontWeight: '600', letterSpacing: 0.1, fontFamily: F },
  headerSub:   { fontSize: 9.5, fontWeight: '500', letterSpacing: 0.6, marginTop: 1, fontFamily: F },
  avatar:      { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarText:  { fontSize: 11, fontWeight: '700', fontFamily: F },
});

import { ThemedView } from '@/components/themed-view';
import { FontFamily, getPalette, Radius, Spacing } from '@/constants/design-tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const F = FontFamily;

interface ComingSoonScreenProps {
  titel: string;
  icoon: React.ComponentProps<typeof Ionicons>['name'];
  omschrijving: string;
}

/** Simpel wachtscherm voor menu-items die al navigeerbaar zijn, maar nog geen echte functionaliteit hebben. */
export function ComingSoonScreen({ titel, icoon, omschrijving }: ComingSoonScreenProps) {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);

  return (
    <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={[styles.header, { borderBottomColor: p.border }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.iconBtn, { backgroundColor: p.surface, borderColor: p.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={p.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: p.text }]} numberOfLines={1}>{titel}</Text>
        </View>

        <View style={styles.body}>
          <View style={[styles.iconWrap, { backgroundColor: p.accentSoft }]}>
            <Ionicons name={icoon} size={32} color={p.accent} />
          </View>
          <Text style={[styles.titel, { color: p.text }]}>{titel}</Text>
          <Text style={[styles.omschrijving, { color: p.textSecondary }]}>{omschrijving}</Text>
          <View style={[styles.badge, { backgroundColor: p.warningSoft }]}>
            <Text style={[styles.badgeText, { color: p.warning }]}>Binnenkort beschikbaar</Text>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 52,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBtn: {
    width: 32, height: 32, borderRadius: Radius.sm,
    justifyContent: 'center', alignItems: 'center', borderWidth: 0.5,
  },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: '700', fontFamily: F },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.sm },
  iconWrap: {
    width: 64, height: 64, borderRadius: Radius.xl,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  titel: { fontSize: 18, fontWeight: '700', fontFamily: F },
  omschrijving: { fontSize: 13.5, textAlign: 'center', lineHeight: 19, fontFamily: F, maxWidth: 280 },
  badge: { marginTop: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill },
  badgeText: { fontSize: 11.5, fontWeight: '700', fontFamily: F },
});

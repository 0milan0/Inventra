import { DrawerMenu } from '@/components/drawer-menu';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const stats = [
  { label: 'Producten', value: '1.284', delta: '+12', positive: true },
  { label: 'Verlopen', value: '23', delta: '-5', positive: true },
  { label: 'Bijna verlopen', value: '67', delta: '+8', positive: false },
  { label: 'Locaties', value: '14', delta: '±0', positive: true },
];

const quickActions: {
  title: string;
  subtitle: string;
  progress: number;
  accent: string;
  iconBg: string;
  icon: string;
  href: '/(tabs)' | '/(tabs)/explore' | '/modal';
}[] = [
  {
    title: 'THT controle',
    subtitle: 'Tenminste Houdbaar Tot',
    progress: 92,
    accent: '#E24B4A',
    iconBg: '#FCEBEB',
    icon: '📦',
    href: '/tht',
  },
  {
    title: 'Gestuurd',
    subtitle: 'Extra informatie',
    progress: 68,
    accent: '#EF9F27',
    iconBg: '#FAEEDA',
    icon: '📋',
    href: '/(tabs)',
  },
  {
    title: 'Overzicht',
    subtitle: 'Open modal scherm',
    progress: 24,
    accent: '#1D9E75',
    iconBg: '#EAF3DE',
    icon: '📊',
    href: '/modal',
  },
];

export default function HomeScreen() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const surface = isDark ? '#2c2c2e' : '#ffffff';
  const pageBg = isDark ? '#1c1c1e' : '#f2f2f7';
  const textPrimary = isDark ? '#ffffff' : '#1a1a1a';
  const textSecondary = isDark ? '#aaaaaa' : '#666666';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const trackBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <ThemedView style={[styles.container, { backgroundColor: pageBg }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: pageBg }}>
        <View style={[styles.header, { backgroundColor: pageBg }]}>
          <TouchableOpacity
            onPress={() => setDrawerOpen(true)}
            style={styles.hamburgerBtn}
            accessibilityLabel="Open menu"
          >
            <View style={[styles.bar, { backgroundColor: textPrimary }]} />
            <View style={[styles.bar, { backgroundColor: textPrimary }]} />
            <View style={[styles.bar, { backgroundColor: textPrimary, width: 12 }]} />
          </TouchableOpacity>

          <ThemedText style={styles.headerTitle}>Dashboard</ThemedText>

          <View style={[styles.avatar, { backgroundColor: '#EEEDFE' }]}>
            <Text style={[styles.avatarText, { color: '#534AB7' }]}>JD</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={[styles.content, { backgroundColor: pageBg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Taken card */}
        <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
          <View style={[styles.tag, { backgroundColor: '#EEEDFE' }]}>
            <View style={[styles.tagDot, { backgroundColor: '#7F77DD' }]} />
            <Text style={[styles.tagText, { color: '#534AB7' }]}>4 openstaand</Text>
          </View>
          <Text style={[styles.cardTitle, { color: textPrimary }]}>Openstaande taken</Text>
          <Text style={[styles.cardBody, { color: textSecondary }]}>
            Je hebt vandaag nog 4 openstaande taken,{'\n'}waarvan 1 met de hoogste prioriteit.
          </Text>
          <TouchableOpacity
            style={[styles.btnSolid, { backgroundColor: '#534AB7' }]}
            onPress={() => router.push('/(tabs)')}
          >
            <Text style={styles.btnSolidText}>Bekijk taken</Text>
          </TouchableOpacity>
        </View>

        {/* Negatieve voorraad card */}
        <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
          <View style={[styles.tag, { backgroundColor: '#FAEEDA' }]}>
            <View style={[styles.tagDot, { backgroundColor: '#EF9F27' }]} />
            <Text style={[styles.tagText, { color: '#854F0B' }]}>Let op</Text>
          </View>
          <Text style={[styles.cardTitle, { color: textPrimary }]}>Negatieve voorraad</Text>
          <Text style={[styles.cardBody, { color: textSecondary }]}>
            Er zijn momenteel 2 producten met een negatieve voorraadstand.
          </Text>
          <TouchableOpacity
            style={[styles.btnOutline, { borderColor: '#BA7517' }]}
            onPress={() => router.push('/(tabs)')}
          >
            <Text style={[styles.btnOutlineText, { color: '#BA7517' }]}>Bekijk producten</Text>
          </TouchableOpacity>
        </View>

        {/* Stat grid */}
        <View style={styles.statGrid}>
          {stats.map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[styles.statLabel, { color: textSecondary }]}>{s.label}</Text>
              <Text style={[styles.statValue, { color: textPrimary }]}>{s.value}</Text>
              <View style={[
                styles.deltaBadge,
                { backgroundColor: s.positive ? '#EAF3DE' : '#FCEBEB' },
              ]}>
                <Text style={[
                  styles.deltaText,
                  { color: s.positive ? '#3B6D11' : '#A32D2D' },
                ]}>
                  {s.delta}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Snelle acties */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>Snelle acties</Text>
          <Text style={[styles.sectionMeta, { color: textSecondary }]}>3 taken</Text>
        </View>

        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.title}
            style={[styles.actionBtn, { backgroundColor: surface, borderColor: border }]}
            onPress={() => router.push(action.href)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: action.iconBg }]}>
              <Text style={styles.actionIconEmoji}>{action.icon}</Text>
            </View>

            <View style={styles.actionText}>
              <Text style={[styles.actionLabel, { color: textPrimary }]}>{action.title}</Text>
              <Text style={[styles.actionSub, { color: textSecondary }]}>{action.subtitle}</Text>
            </View>

            <View style={styles.actionRight}>
              <Text style={[styles.actionPct, { color: action.accent }]}>{action.progress}%</Text>
              <View style={[styles.progressTrack, { backgroundColor: trackBg }]}>
                <View style={[styles.progressFill, { width: `${action.progress}%` as any, backgroundColor: action.accent }]} />
              </View>
            </View>

            <Text style={[styles.chevron, { color: isDark ? '#555' : '#ccc' }]}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  hamburgerBtn: {
    width: 36, height: 36,
    justifyContent: 'center', alignItems: 'flex-start',
    gap: 5,
  },
  bar: { height: 2, borderRadius: 2, width: 18 },
  headerTitle: { fontSize: 16, fontWeight: '600', letterSpacing: 0.2, fontFamily: 'Montserrat' },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '700', fontFamily: 'Montserrat' },

  content: { padding: 16, paddingBottom: 40, gap: 12 },

  /* Card base */
  card: {
    borderRadius: 16,
    borderWidth: 0.5,
    padding: 16,
    gap: 6,
  },

  /* Tag */
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 2,
  },
  tagDot: { width: 6, height: 6, borderRadius: 3 },
  tagText: { fontSize: 12, fontWeight: '600', fontFamily: 'Montserrat' },

  cardTitle: { fontSize: 15, fontWeight: '600', fontFamily: 'Montserrat' },
  cardBody: { fontSize: 13, lineHeight: 20, fontFamily: 'Montserrat' },

  /* Buttons */
  btnSolid: {
    alignSelf: 'flex-start',
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  btnSolidText: { color: '#fff', fontSize: 13, fontWeight: '600', fontFamily: 'Montserrat' },

  btnOutline: {
    alignSelf: 'flex-start',
    borderRadius: 9,
    borderWidth: 1.5,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  btnOutlineText: { fontSize: 13, fontWeight: '600', fontFamily: 'Montserrat' },

  /* Stat grid */
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '47.5%',
    borderRadius: 16,
    borderWidth: 0.5,
    padding: 14,
    gap: 4,
  },
  statLabel: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.4, fontFamily: 'Montserrat' },
  statValue: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5, fontFamily: 'Montserrat' },
  deltaBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
    marginTop: 2,
  },
  deltaText: { fontSize: 11, fontWeight: '700', fontFamily: 'Montserrat' },

  /* Section header */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', fontFamily: 'Montserrat' },
  sectionMeta: { fontSize: 12, fontFamily: 'Montserrat' },

  /* Action buttons */
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    borderWidth: 0.5,
    padding: 16,
  },
  actionIcon: {
    width: 44, height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  actionIconEmoji: { fontSize: 20 },
  actionText: { flex: 1, gap: 2 },
  actionLabel: { fontSize: 15, fontWeight: '600', fontFamily: 'Montserrat' },
  actionSub: { fontSize: 12, fontFamily: 'Montserrat' },
  actionRight: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  actionPct: { fontSize: 13, fontWeight: '600', fontFamily: 'Montserrat' },
  progressTrack: { height: 4, width: 48, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  chevron: { fontSize: 22, flexShrink: 0, marginLeft: -6 },
});
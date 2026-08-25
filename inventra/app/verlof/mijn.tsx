import { ThemedView } from '@/components/themed-view';
import { Surface } from '@/components/ui/surface';
import { FontFamily, getPalette, Radius, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { verlofSamenvatting } from '@/data/verlofaanvragen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ApiVerlofaanvraag, getMijnVerlofaanvragen } from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const F = FontFamily;

const STATUS_LABEL: Record<ApiVerlofaanvraag['status'], string> = {
  open: 'In behandeling',
  goedgekeurd: 'Goedgekeurd',
  afgewezen: 'Afgewezen',
  geannuleerd: 'Geannuleerd',
};

const STATUS_KLEUR: Record<ApiVerlofaanvraag['status'], 'warning' | 'success' | 'danger' | 'muted'> = {
  open: 'warning',
  goedgekeurd: 'success',
  afgewezen: 'danger',
  geannuleerd: 'muted',
};

type Palette = ReturnType<typeof getPalette>;

export default function MijnVerlofScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);
  const { token } = useAuth();

  const [aanvragen, setAanvragen] = useState<ApiVerlofaanvraag[]>([]);
  const [laden, setLaden] = useState(true);
  const [verversen, setVerversen] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const laad = useCallback(async () => {
    if (!token) return;
    setFout(null);
    try {
      setAanvragen(await getMijnVerlofaanvragen(token));
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Verlofaanvragen laden is mislukt.');
    }
  }, [token]);

  const eersteLaadGedaan = useRef(false);
  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (!eersteLaadGedaan.current) {
          setLaden(true);
          await laad();
          setLaden(false);
          eersteLaadGedaan.current = true;
        } else {
          await laad();
        }
      })();
    }, [laad])
  );

  const onRefresh = useCallback(async () => {
    setVerversen(true);
    await laad();
    setVerversen(false);
  }, [laad]);

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
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: p.text }]}>Mijn verlof</Text>
            <Text style={[styles.headerSub, { color: p.textMuted }]}>
              {aanvragen.length} {aanvragen.length === 1 ? 'aanvraag' : 'aanvragen'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/verlof/nieuw' as never)}
            style={[styles.iconBtn, { backgroundColor: p.accentSoft, borderColor: p.accent }]}
            accessibilityLabel="Verlof aanvragen"
          >
            <Ionicons name="add" size={19} color={p.accent} />
          </TouchableOpacity>
        </View>

        {laden ? (
          <View style={styles.center}>
            <ActivityIndicator color={p.accent} />
          </View>
        ) : fout ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={40} color={p.danger} />
            <Text style={[styles.foutTekst, { color: p.danger }]}>{fout}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={verversen} onRefresh={onRefresh} tintColor={p.textMuted} />}
          >
            {aanvragen.length === 0 ? (
              <View style={styles.leeg}>
                <Ionicons name="calendar-outline" size={28} color={p.textMuted} />
                <Text style={[styles.leegTxt, { color: p.textSecondary }]}>Nog geen verlofaanvragen</Text>
                <TouchableOpacity
                  style={[styles.leegBtn, { backgroundColor: p.accent }]}
                  onPress={() => router.push('/verlof/nieuw' as never)}
                >
                  <Text style={styles.leegBtnTxt}>Verlof aanvragen</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Surface style={styles.sectionCard}>
                {aanvragen.map((a, idx) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[
                      styles.rij,
                      idx < aanvragen.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: p.divider },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: '/verlof/[id]', params: { id: String(a.id) } })}
                  >
                    <View style={styles.rijBody}>
                      <Text style={[styles.rijTitel, { color: p.text }]} numberOfLines={1}>
                        {verlofSamenvatting(a)}
                      </Text>
                      {!!a.reden && (
                        <Text style={[styles.rijMeta, { color: p.textSecondary }]} numberOfLines={1}>
                          {a.reden}
                        </Text>
                      )}
                    </View>
                    <StatusBadge status={a.status} p={p} />
                    <Ionicons name="chevron-forward" size={15} color={p.textMuted} />
                  </TouchableOpacity>
                ))}
              </Surface>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function StatusBadge({ status, p }: { status: ApiVerlofaanvraag['status']; p: Palette }) {
  const kleur = STATUS_KLEUR[status];
  const bg = kleur === 'muted' ? p.surfaceAlt : kleur === 'success' ? p.successSoft : kleur === 'warning' ? p.warningSoft : p.dangerSoft;
  const fg = kleur === 'muted' ? p.textMuted : kleur === 'success' ? p.success : kleur === 'warning' ? p.warning : p.danger;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeTxt, { color: fg }]} numberOfLines={1}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, padding: Spacing.xxl },
  foutTekst: { fontSize: 13, fontFamily: F, textAlign: 'center' },

  header: {
    height: 56,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: Radius.sm,
    justifyContent: 'center', alignItems: 'center', borderWidth: 0.5,
  },
  headerTitle: { fontSize: 15.5, fontWeight: '700', fontFamily: F },
  headerSub: { fontSize: 11.5, fontFamily: F, marginTop: 1 },

  content: { padding: Spacing.lg, paddingBottom: 36 },

  sectionCard: { borderRadius: Radius.lg, overflow: 'hidden' },
  rij: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md + 2, paddingVertical: 11 },
  rijBody: { flex: 1, minWidth: 0, gap: 1 },
  rijTitel: { fontSize: 13.5, fontWeight: '600', fontFamily: F },
  rijMeta: { fontSize: 11.5, fontFamily: F },

  badge: { borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  badgeTxt: { fontSize: 10, fontWeight: '700', fontFamily: F },

  leeg: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
  leegTxt: { fontSize: 12.5, fontFamily: F },
  leegBtn: { borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm + 2 },
  leegBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13, fontFamily: F },
});

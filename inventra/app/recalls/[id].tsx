import { ThemedView } from '@/components/themed-view';
import { Surface } from '@/components/ui/surface';
import { FontFamily, getPalette, Radius, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ApiRecallDetail, getRecall } from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const F = FontFamily;

function formatDatum(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function RecallDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);
  const { token } = useAuth();

  const recallId = Number(id);

  const [recall, setRecall] = useState<ApiRecallDetail | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  const laad = useCallback(async () => {
    if (!token || !Number.isFinite(recallId)) return;
    setLaden(true);
    setFout(null);
    try {
      setRecall(await getRecall(token, recallId));
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Recall laden is mislukt.');
    } finally {
      setLaden(false);
    }
  }, [token, recallId]);

  useEffect(() => {
    laad();
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
          <Text style={[styles.headerTitle, { color: p.text }]} numberOfLines={1}>Recall</Text>
        </View>

        {laden ? (
          <View style={styles.center}>
            <ActivityIndicator color={p.accent} />
          </View>
        ) : fout || !recall ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={40} color={p.danger} />
            <Text style={[styles.foutTekst, { color: p.danger }]}>{fout ?? 'Recall niet gevonden'}</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xxl }}
          >
            <View style={styles.hero}>
              <View style={[styles.heroIcoon, { backgroundColor: p.dangerSoft }]}>
                <Ionicons name="warning" size={22} color={p.danger} />
              </View>
              <Text style={[styles.heroNaam, { color: p.text }]} numberOfLines={2}>{recall.productNaam}</Text>
              <Text style={[styles.heroSub, { color: p.textSecondary }]}>{recall.productBarcode}</Text>
            </View>

            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Reden & criteria</Text>
              <Surface style={styles.card}>
                <Text style={[styles.reden, { color: p.text }]}>{recall.titel}</Text>
                {!!recall.criteriaNotitie && (
                  <Text style={[styles.criteria, { color: p.textSecondary }]}>{recall.criteriaNotitie}</Text>
                )}
                {(recall.thtVan || recall.thtTot) && (
                  <View style={[styles.thtRow, { borderTopColor: p.divider }]}>
                    <Ionicons name="calendar-outline" size={13} color={p.textMuted} />
                    <Text style={[styles.thtTxt, { color: p.textMuted }]}>
                      THT: {recall.thtVan ?? '…'} t/m {recall.thtTot ?? '…'}
                    </Text>
                  </View>
                )}
                <Text style={[styles.metaTxt, { color: p.textMuted }]}>
                  Aangemaakt door {recall.aangemaaktDoor} · {formatDatum(recall.aangemaaktOp)}
                </Text>
              </Surface>
            </View>

            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionLabel, { color: p.textMuted }]}>
                Filialen · {recall.filialen.filter((f) => f.status === 'aangemaakt').length}/{recall.filialen.length}
              </Text>
              <Surface style={styles.sectionCard}>
                {recall.filialen.map((f, idx) => (
                  <TouchableOpacity
                    key={f.branchId}
                    disabled={!f.taakId}
                    activeOpacity={f.taakId ? 0.7 : 1}
                    onPress={() => f.taakId && router.push({ pathname: '/tasks/[id]', params: { id: String(f.taakId) } })}
                    style={[
                      styles.rij,
                      idx < recall.filialen.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: p.divider },
                    ]}
                  >
                    <View style={styles.rijBody}>
                      <Text style={[styles.rijTitel, { color: p.text }]} numberOfLines={1}>{f.naam}</Text>
                      <Text style={[styles.rijMeta, { color: p.textSecondary }]} numberOfLines={1}>
                        {f.status === 'aangemaakt' ? `${f.afdeling} · taak: ${f.taakStatus}` : 'Voert dit product niet'}
                      </Text>
                    </View>
                    {f.status === 'aangemaakt' ? (
                      <View style={[styles.badge, { backgroundColor: p.successSoft }]}>
                        <Text style={[styles.badgeTxt, { color: p.success }]}>Taak aangemaakt</Text>
                      </View>
                    ) : (
                      <View style={[styles.badge, { backgroundColor: p.surfaceAlt }]}>
                        <Text style={[styles.badgeTxt, { color: p.textMuted }]}>Overgeslagen</Text>
                      </View>
                    )}
                    {!!f.taakId && <Ionicons name="chevron-forward" size={15} color={p.textMuted} />}
                  </TouchableOpacity>
                ))}
              </Surface>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, padding: Spacing.xxl },
  foutTekst: { fontSize: 13, fontFamily: F, textAlign: 'center' },

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

  hero: { alignItems: 'center', marginBottom: Spacing.xl, marginTop: Spacing.sm, gap: 2 },
  heroIcoon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  heroNaam: { fontSize: 16, fontWeight: '700', fontFamily: F, textAlign: 'center' },
  heroSub: { fontSize: 12, fontFamily: F },

  sectionWrap: { marginBottom: Spacing.xl },
  sectionLabel: {
    fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: Spacing.sm, paddingHorizontal: 2, fontFamily: F,
  },
  card: { borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  reden: { fontSize: 14, fontWeight: '600', fontFamily: F, lineHeight: 19 },
  criteria: { fontSize: 12.5, fontFamily: F, lineHeight: 18 },
  thtRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.sm },
  thtTxt: { fontSize: 11.5, fontFamily: F },
  metaTxt: { fontSize: 10.5, fontFamily: F, marginTop: 2 },

  sectionCard: { borderRadius: Radius.lg, overflow: 'hidden' },
  rij: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md + 2, paddingVertical: 11 },
  rijBody: { flex: 1, minWidth: 0, gap: 1 },
  rijTitel: { fontSize: 13.5, fontWeight: '600', fontFamily: F },
  rijMeta: { fontSize: 11, fontFamily: F },
  badge: { borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  badgeTxt: { fontSize: 9.5, fontWeight: '700', fontFamily: F },
});

import { ThemedView } from '@/components/themed-view';
import { Surface } from '@/components/ui/surface';
import { FontFamily, getPalette, Radius, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { magRecallsAanmaken } from '@/data/session';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ApiRecallSamenvatting, getRecalls } from '@/lib/api';
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

function formatDatum(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function RecallsScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);
  const { user, token } = useAuth();
  const magAanmaken = magRecallsAanmaken(user);

  const [recalls, setRecalls] = useState<ApiRecallSamenvatting[]>([]);
  const [laden, setLaden] = useState(true);
  const [verversen, setVerversen] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const laadRecalls = useCallback(async () => {
    if (!token) return;
    setFout(null);
    try {
      setRecalls(await getRecalls(token));
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Recalls laden is mislukt.');
    }
  }, [token]);

  const eersteLaadGedaan = useRef(false);
  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (!eersteLaadGedaan.current) {
          setLaden(true);
          await laadRecalls();
          setLaden(false);
          eersteLaadGedaan.current = true;
        } else {
          await laadRecalls();
        }
      })();
    }, [laadRecalls])
  );

  const onRefresh = useCallback(async () => {
    setVerversen(true);
    await laadRecalls();
    setVerversen(false);
  }, [laadRecalls]);

  if (!magAanmaken) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
        <SafeAreaView style={styles.center}>
          <Ionicons name="lock-closed-outline" size={40} color={p.textMuted} />
          <Text style={[styles.foutTekst, { color: p.text }]}>Geen toegang</Text>
          <Text style={[styles.foutSub, { color: p.textSecondary }]}>
            Alleen Regiomanager, Inkoper, Logistiek Coördinator (of medewerkers met deze permissie) kunnen recalls bekijken.
          </Text>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: p.accent }]} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Terug</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </ThemedView>
    );
  }

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
            <Text style={[styles.headerTitle, { color: p.text }]}>Recalls</Text>
            <Text style={[styles.headerSub, { color: p.textMuted }]}>
              {recalls.length} {recalls.length === 1 ? 'recall' : 'recalls'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/recalls/nieuw' as never)}
            style={[styles.iconBtn, { backgroundColor: p.accentSoft, borderColor: p.accent }]}
            accessibilityLabel="Nieuwe recall"
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
            {recalls.length === 0 ? (
              <View style={styles.leeg}>
                <Ionicons name="warning-outline" size={28} color={p.textMuted} />
                <Text style={[styles.leegTxt, { color: p.textSecondary }]}>Nog geen recalls aangemaakt</Text>
              </View>
            ) : (
              <Surface style={styles.sectionCard}>
                {recalls.map((r, idx) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      styles.rij,
                      idx < recalls.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: p.divider },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: '/recalls/[id]', params: { id: String(r.id) } })}
                  >
                    <View style={[styles.icoonWrap, { backgroundColor: p.dangerSoft }]}>
                      <Ionicons name="warning" size={16} color={p.danger} />
                    </View>
                    <View style={styles.rijBody}>
                      <Text style={[styles.rijTitel, { color: p.text }]} numberOfLines={1}>
                        {r.productNaam}
                      </Text>
                      <Text style={[styles.rijMeta, { color: p.textSecondary }]} numberOfLines={1}>
                        {r.titel}
                      </Text>
                      <Text style={[styles.rijSub, { color: p.textMuted }]}>
                        {r.aangemaaktFilialen}/{r.totaalFilialen} filialen · {r.aangemaaktDoor} · {formatDatum(r.aangemaaktOp)}
                      </Text>
                    </View>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, padding: Spacing.xxl },
  foutTekst: { fontSize: 14, fontWeight: '600', fontFamily: F, textAlign: 'center' },
  foutSub: { fontSize: 12, fontFamily: F, textAlign: 'center', lineHeight: 17 },

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
  icoonWrap: { width: 34, height: 34, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rijBody: { flex: 1, minWidth: 0, gap: 1 },
  rijTitel: { fontSize: 13.5, fontWeight: '600', fontFamily: F },
  rijMeta: { fontSize: 11.5, fontFamily: F },
  rijSub: { fontSize: 10.5, fontFamily: F, marginTop: 1 },

  leeg: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl },
  leegTxt: { fontSize: 12.5, fontFamily: F },

  primaryButton: { borderRadius: Radius.md, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 13.5, fontFamily: F },
});

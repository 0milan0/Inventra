import { ThemedView } from '@/components/themed-view';
import { Surface } from '@/components/ui/surface';
import { FontFamily, getPalette, Radius, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ApiVerkoopbon, Betaalmethode, getVerkoopbonnen, VerkoopbonStatus } from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const F = FontFamily;

const STATUS_LABEL: Record<VerkoopbonStatus, string> = {
  voltooid: 'Voltooid',
  geannuleerd: 'Geannuleerd',
  geretourneerd: 'Geretourneerd',
};

const STATUS_KLEUR: Record<VerkoopbonStatus, 'success' | 'muted' | 'warning'> = {
  voltooid: 'success',
  geannuleerd: 'muted',
  geretourneerd: 'warning',
};

const BETAAL_ICOON: Record<Betaalmethode, React.ComponentProps<typeof Ionicons>['name']> = {
  pin: 'card-outline',
  contant: 'cash-outline',
  creditcard: 'wallet-outline',
  ideal: 'phone-portrait-outline',
  klarna: 'time-outline',
};

const BETAAL_LABEL: Record<Betaalmethode, string> = {
  pin: 'Pin',
  contant: 'Contant',
  creditcard: 'Creditcard',
  ideal: 'iDEAL',
  klarna: 'Klarna',
};

const STATUS_FILTERS: { id: VerkoopbonStatus | 'alles'; label: string }[] = [
  { id: 'alles', label: 'Alles' },
  { id: 'voltooid', label: 'Voltooid' },
  { id: 'geannuleerd', label: 'Geannuleerd' },
  { id: 'geretourneerd', label: 'Geretourneerd' },
];

type Palette = ReturnType<typeof getPalette>;

function formatDatum(iso: string): string {
  const d = new Date(iso.replace(' ', 'T'));
  const dag = String(d.getDate()).padStart(2, '0');
  const maand = String(d.getMonth() + 1).padStart(2, '0');
  const uur = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dag}-${maand}-${d.getFullYear()} · ${uur}:${min}`;
}

function formatEuro(bedrag: number): string {
  return `€ ${bedrag.toFixed(2).replace('.', ',')}`;
}

export default function VerkoopbonnenScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);
  const { token } = useAuth();

  const [bonnen, setBonnen] = useState<ApiVerkoopbon[]>([]);
  const [laden, setLaden] = useState(true);
  const [verversen, setVerversen] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [zoek, setZoek] = useState('');
  const [statusFilter, setStatusFilter] = useState<VerkoopbonStatus | 'alles'>('alles');

  const laadBonnen = useCallback(async () => {
    if (!token) return;
    setFout(null);
    try {
      setBonnen(await getVerkoopbonnen(token));
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Verkoopbonnen laden is mislukt.');
    }
  }, [token]);

  useEffect(() => {
    (async () => {
      setLaden(true);
      await laadBonnen();
      setLaden(false);
    })();
  }, [laadBonnen]);

  const onRefresh = useCallback(async () => {
    setVerversen(true);
    await laadBonnen();
    setVerversen(false);
  }, [laadBonnen]);

  const gefilterd = useMemo(() => {
    const term = zoek.trim().toLowerCase();
    return bonnen.filter((bon) => {
      if (statusFilter !== 'alles' && bon.status !== statusFilter) return false;
      if (!term) return true;
      return (
        String(bon.id).includes(term) ||
        bon.kassamedewerker.toLowerCase().includes(term) ||
        (bon.klantNaam?.toLowerCase().includes(term) ?? false) ||
        (bon.loyaltyKaart?.toLowerCase().includes(term) ?? false)
      );
    });
  }, [bonnen, zoek, statusFilter]);

  return (
    <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: p.border }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.iconBtn, { backgroundColor: p.surface, borderColor: p.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={p.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: p.text }]}>Verkoopbonnen</Text>
            <Text style={[styles.headerSub, { color: p.textMuted }]}>
              {gefilterd.length} {gefilterd.length === 1 ? 'bon' : 'bonnen'}
            </Text>
          </View>
        </View>

        {/* Zoeken */}
        <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.sm }}>
          <View style={[styles.zoekBalk, { backgroundColor: p.surface, borderColor: p.border }]}>
            <Ionicons name="search-outline" size={16} color={p.textMuted} />
            <TextInput
              value={zoek}
              onChangeText={setZoek}
              placeholder="Zoek op bonnummer, klant of kassa…"
              placeholderTextColor={p.textMuted}
              style={[styles.zoekInput, { color: p.text }]}
              autoCapitalize="none"
            />
            {zoek.length > 0 && (
              <TouchableOpacity onPress={() => setZoek('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={p.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.xs + 2 }}>
            {STATUS_FILTERS.map((f) => {
              const actief = f.id === statusFilter;
              return (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => setStatusFilter(f.id)}
                  style={[
                    styles.filterChip,
                    { borderColor: actief ? p.accent : p.border, backgroundColor: actief ? p.accentSoft : p.surface },
                  ]}
                >
                  <Text style={[styles.filterChipText, { color: actief ? p.accent : p.textSecondary }]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
            {gefilterd.length === 0 ? (
              <View style={styles.leeg}>
                <Ionicons name="receipt-outline" size={28} color={p.textMuted} />
                <Text style={[styles.leegTxt, { color: p.textSecondary }]}>
                  {zoek || statusFilter !== 'alles' ? 'Geen bonnen gevonden' : 'Nog geen verkoopbonnen'}
                </Text>
              </View>
            ) : (
              <Surface style={styles.sectionCard}>
                {gefilterd.map((bon, idx) => (
                  <TouchableOpacity
                    key={bon.id}
                    style={[
                      styles.rij,
                      idx < gefilterd.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: p.divider },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/bonnen/verkoopbonnen/${bon.id}` as never)}
                  >
                    <View style={[styles.betaalIcoon, { backgroundColor: p.surfaceAlt }]}>
                      <Ionicons name={BETAAL_ICOON[bon.betaalmethode]} size={16} color={p.textSecondary} />
                    </View>
                    <View style={styles.rijBody}>
                      <Text style={[styles.bonnummer, { color: p.text }]} numberOfLines={1}>
                        Bon #{bon.id} · {BETAAL_LABEL[bon.betaalmethode]}
                      </Text>
                      <Text style={[styles.subtekst, { color: p.textSecondary }]} numberOfLines={1}>
                        {bon.klantNaam ?? 'Geen klantkaart'} · {formatDatum(bon.datum)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={[styles.totaal, { color: p.text }]}>{formatEuro(bon.totaal)}</Text>
                      <StatusBadge status={bon.status} palette={p} />
                    </View>
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

function StatusBadge({ status, palette }: { status: VerkoopbonStatus; palette: Palette }) {
  const kleur = STATUS_KLEUR[status];
  const bg = kleur === 'muted' ? palette.surfaceAlt : kleur === 'success' ? palette.successSoft : palette.warningSoft;
  const fg = kleur === 'muted' ? palette.textMuted : kleur === 'success' ? palette.success : palette.warning;

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeTxt, { color: fg }]} numberOfLines={1}>
        {STATUS_LABEL[status]}
      </Text>
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

  zoekBalk: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 0.5, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 9,
  },
  zoekInput: { flex: 1, fontSize: 13.5, fontFamily: F, padding: 0 },

  filterChip: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  filterChipText: { fontSize: 11.5, fontWeight: '600', fontFamily: F },

  content: { padding: Spacing.lg, paddingBottom: 36, gap: Spacing.lg },
  sectionCard: { borderRadius: Radius.lg, overflow: 'hidden' },

  rij: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.md + 2, paddingVertical: 11,
  },
  betaalIcoon: { width: 34, height: 34, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  rijBody: { flex: 1, minWidth: 0, gap: 1 },
  bonnummer: { fontSize: 13.5, fontWeight: '600', fontFamily: F },
  subtekst: { fontSize: 11.5, fontFamily: F },
  totaal: { fontSize: 13.5, fontWeight: '700', fontFamily: F },

  badge: { borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  badgeTxt: { fontSize: 10, fontWeight: '700', fontFamily: F },

  leeg: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl },
  leegTxt: { fontSize: 12.5, fontFamily: F },
});

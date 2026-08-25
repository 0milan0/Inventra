import { ThemedView } from '@/components/themed-view';
import { Surface } from '@/components/ui/surface';
import { FontFamily, getPalette, Radius, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  ApiVerkoopbonArtikel,
  ApiVerkoopbonDetail,
  Betaalmethode,
  getVerkoopbonDetail,
  VerkoopbonStatus,
} from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const F = FontFamily;
type Palette = ReturnType<typeof getPalette>;

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

const BETAAL_LABEL: Record<Betaalmethode, string> = {
  pin: 'Pin',
  contant: 'Contant',
  creditcard: 'Creditcard',
  ideal: 'iDEAL',
  klarna: 'Klarna',
};

function formatDatum(iso: string): string {
  const d = new Date(iso.replace(' ', 'T'));
  const dag = String(d.getDate()).padStart(2, '0');
  const maand = String(d.getMonth() + 1).padStart(2, '0');
  const uur = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dag}-${maand}-${d.getFullYear()} om ${uur}:${min}`;
}

function formatEuro(bedrag: number): string {
  return `€ ${bedrag.toFixed(2).replace('.', ',')}`;
}

function InfoRow({
  icon, label, value, p, last,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  p: Palette;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.infoRij,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.divider },
      ]}
    >
      <View style={[styles.infoIconWrap, { backgroundColor: p.surfaceAlt }]}>
        <Ionicons name={icon} size={15} color={p.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: p.textMuted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: p.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function ArtikelRij({ artikel, p, last }: { artikel: ApiVerkoopbonArtikel; p: Palette; last?: boolean }) {
  return (
    <View
      style={[
        styles.artikelRij,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.divider },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[styles.artikelNaam, { color: p.text }]} numberOfLines={1}>{artikel.naam}</Text>
        <Text style={[styles.artikelSub, { color: p.textSecondary }]}>
          {artikel.aantal} × {formatEuro(artikel.stukprijs)}
          {artikel.korting > 0 ? ` · korting ${formatEuro(artikel.korting)}` : ''}
        </Text>
      </View>
      <Text style={[styles.artikelSubtotaal, { color: p.text }]}>{formatEuro(artikel.subtotaal)}</Text>
    </View>
  );
}

export default function VerkoopbonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);
  const { token } = useAuth();

  const bonId = Number(id);

  const [bon, setBon] = useState<ApiVerkoopbonDetail | null>(null);
  const [artikelen, setArtikelen] = useState<ApiVerkoopbonArtikel[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  const laad = useCallback(async () => {
    if (!token || !Number.isFinite(bonId)) return;
    setLaden(true);
    setFout(null);
    try {
      const data = await getVerkoopbonDetail(token, bonId);
      setBon(data.bon);
      setArtikelen(data.artikelen);
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Bon laden is mislukt.');
    } finally {
      setLaden(false);
    }
  }, [token, bonId]);

  useEffect(() => {
    laad();
  }, [laad]);

  const kleur = bon ? STATUS_KLEUR[bon.status] : 'muted';
  const badgeBg = kleur === 'muted' ? p.surfaceAlt : kleur === 'success' ? p.successSoft : p.warningSoft;
  const badgeFg = kleur === 'muted' ? p.textMuted : kleur === 'success' ? p.success : p.warning;

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
          <Text style={[styles.headerTitle, { color: p.text }]} numberOfLines={1}>
            {bon ? `Bon #${bon.id}` : 'Bon'}
          </Text>
          <View style={styles.iconBtn} />
        </View>

        {laden ? (
          <View style={styles.center}>
            <ActivityIndicator color={p.accent} />
          </View>
        ) : fout || !bon ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={40} color={p.danger} />
            <Text style={[styles.foutTekst, { color: p.danger }]}>{fout ?? 'Bon niet gevonden'}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.lg }} showsVerticalScrollIndicator={false}>
            {/* Status + totaal */}
            <View style={styles.heroRow}>
              <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                <Text style={[styles.badgeTxt, { color: badgeFg }]}>{STATUS_LABEL[bon.status]}</Text>
              </View>
              <Text style={[styles.totaal, { color: p.text }]}>{formatEuro(bon.totaal)}</Text>
            </View>

            {/* Gegevens */}
            <View style={{ gap: Spacing.sm }}>
              <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Gegevens</Text>
              <Surface style={styles.card}>
                <InfoRow icon="calendar-outline" label="Datum" value={formatDatum(bon.datum)} p={p} />
                <InfoRow icon="person-outline" label="Kassamedewerker" value={bon.kassamedewerker} p={p} />
                <InfoRow
                  icon="card-outline"
                  label="Betaalmethode"
                  value={BETAAL_LABEL[bon.betaalmethode]}
                  p={p}
                  last={!bon.klantNaam}
                />
                {bon.klantNaam && (
                  <InfoRow
                    icon="person-circle-outline"
                    label="Klant"
                    value={
                      bon.loyaltyKaart ? `${bon.klantNaam} · ${bon.loyaltyKaart}` : bon.klantNaam
                    }
                    p={p}
                    last
                  />
                )}
              </Surface>
            </View>

            {/* Artikelen */}
            <View style={{ gap: Spacing.sm }}>
              <Text style={[styles.sectionLabel, { color: p.textMuted }]}>
                Artikelen · {artikelen.length}
              </Text>
              <Surface style={styles.card}>
                {artikelen.map((artikel, idx) => (
                  <ArtikelRij key={artikel.id} artikel={artikel} p={p} last={idx === artikelen.length - 1} />
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
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  iconBtn: {
    width: 32, height: 32, borderRadius: Radius.sm,
    justifyContent: 'center', alignItems: 'center', borderWidth: 0.5,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', fontFamily: F },

  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totaal: { fontSize: 22, fontWeight: '700', fontFamily: F },

  badge: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  badgeTxt: { fontSize: 11.5, fontWeight: '700', fontFamily: F },

  sectionLabel: {
    fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 2, fontFamily: F,
  },
  card: { borderRadius: Radius.lg, overflow: 'hidden' },

  infoRij: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  infoIconWrap: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: F },
  infoValue: { fontSize: 14, fontWeight: '600', marginTop: 1, fontFamily: F },

  artikelRij: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  artikelNaam: { fontSize: 13.5, fontWeight: '600', fontFamily: F },
  artikelSub: { fontSize: 11.5, fontFamily: F },
  artikelSubtotaal: { fontSize: 13.5, fontWeight: '700', fontFamily: F, flexShrink: 0 },
});

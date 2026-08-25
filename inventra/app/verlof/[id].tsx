import { ThemedView } from '@/components/themed-view';
import { Surface } from '@/components/ui/surface';
import { FontFamily, getPalette, Radius, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { formatPeriode } from '@/data/verlofaanvragen';
import { getAfdelingLabel } from '@/data/session';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ApiVerlofaanvraagDetail, beslisVerlofaanvraag, getVerlofaanvraag } from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const F = FontFamily;

const STATUS_LABEL: Record<string, string> = {
  open: 'In behandeling',
  goedgekeurd: 'Goedgekeurd',
  afgewezen: 'Afgewezen',
  geannuleerd: 'Geannuleerd',
};

export default function VerlofDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);
  const { token } = useAuth();

  const aanvraagId = Number(id);

  const [aanvraag, setAanvraag] = useState<ApiVerlofaanvraagDetail | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [notitie, setNotitie] = useState('');
  const [beslissenBezig, setBeslissenBezig] = useState<'goedgekeurd' | 'afgewezen' | null>(null);

  const laad = useCallback(async () => {
    if (!token || !Number.isFinite(aanvraagId)) return;
    setLaden(true);
    setFout(null);
    try {
      setAanvraag(await getVerlofaanvraag(token, aanvraagId));
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Aanvraag laden is mislukt.');
    } finally {
      setLaden(false);
    }
  }, [token, aanvraagId]);

  useEffect(() => { laad(); }, [laad]);

  const beslis = async (status: 'goedgekeurd' | 'afgewezen') => {
    if (!token || !aanvraag) return;
    setBeslissenBezig(status);
    try {
      await beslisVerlofaanvraag(token, aanvraag.id, status, notitie.trim() || undefined);
      Alert.alert(
        status === 'goedgekeurd' ? 'Goedgekeurd' : 'Afgewezen',
        `${aanvraag.medewerkerNaam} krijgt hier een melding van.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert('Mislukt', e instanceof Error ? e.message : 'Beslissen is mislukt.');
    } finally {
      setBeslissenBezig(null);
    }
  };

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
          <Text style={[styles.headerTitle, { color: p.text }]} numberOfLines={1}>Verlofaanvraag</Text>
        </View>

        {laden ? (
          <View style={styles.center}>
            <ActivityIndicator color={p.accent} />
          </View>
        ) : fout || !aanvraag ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={40} color={p.danger} />
            <Text style={[styles.foutTekst, { color: p.danger }]}>{fout ?? 'Aanvraag niet gevonden'}</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xxl }}>
            <View style={styles.hero}>
              <View style={[styles.heroIcoon, { backgroundColor: p.accentSoft }]}>
                <Ionicons name="calendar-outline" size={22} color={p.accent} />
              </View>
              <Text style={[styles.heroNaam, { color: p.text }]}>{aanvraag.typeLabel}</Text>
              <Text style={[styles.heroSub, { color: p.textSecondary }]}>{formatPeriode(aanvraag.van, aanvraag.tot)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: p.surfaceAlt, marginTop: Spacing.sm }]}>
                <Text style={[styles.statusBadgeTxt, { color: p.textSecondary }]}>{STATUS_LABEL[aanvraag.status] ?? aanvraag.status}</Text>
              </View>
            </View>

            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Details</Text>
              <Surface style={styles.card}>
                {!aanvraag.isEigen && (
                  <InfoRow icon="person-outline" label="Medewerker" value={aanvraag.medewerkerNaam} p={p} />
                )}
                <InfoRow icon="business-outline" label="Afdeling" value={getAfdelingLabel(aanvraag.afdelingId)} p={p} />
                {!!aanvraag.reden && <InfoRow icon="chatbox-ellipses-outline" label="Toelichting" value={aanvraag.reden} p={p} />}
                {!!aanvraag.notitie && (
                  <InfoRow
                    icon="document-text-outline"
                    label={aanvraag.status === 'afgewezen' ? 'Reden afwijzing' : 'Notitie'}
                    value={aanvraag.notitie}
                    p={p}
                  />
                )}
                {!!aanvraag.beslistDoorNaam && (
                  <InfoRow icon="checkmark-done-outline" label="Beslist door" value={aanvraag.beslistDoorNaam} p={p} last />
                )}
              </Surface>
            </View>

            {aanvraag.magBeslissen && (
              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Beslissen</Text>
                <Surface style={[styles.card, { gap: Spacing.sm }]}>
                  <TextInput
                    value={notitie}
                    onChangeText={setNotitie}
                    placeholder="Notitie voor de medewerker (optioneel)"
                    placeholderTextColor={p.textMuted}
                    multiline
                    style={[styles.input, { color: p.text, borderColor: p.border }]}
                  />
                  <View style={styles.knopRij}>
                    <TouchableOpacity
                      style={[styles.knop, { backgroundColor: p.dangerSoft, opacity: beslissenBezig ? 0.6 : 1 }]}
                      onPress={() => beslis('afgewezen')}
                      disabled={!!beslissenBezig}
                    >
                      {beslissenBezig === 'afgewezen' ? (
                        <ActivityIndicator size="small" color={p.danger} />
                      ) : (
                        <Text style={[styles.knopTxt, { color: p.danger }]}>Afwijzen</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.knop, { backgroundColor: p.accent, opacity: beslissenBezig ? 0.6 : 1 }]}
                      onPress={() => beslis('goedgekeurd')}
                      disabled={!!beslissenBezig}
                    >
                      {beslissenBezig === 'goedgekeurd' ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={[styles.knopTxt, { color: '#fff' }]}>Goedkeuren</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </Surface>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

type Palette = ReturnType<typeof getPalette>;

function InfoRow({ icon, label, value, p, last }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string; p: Palette; last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.divider }]}>
      <View style={[styles.fieldIconWrap, { backgroundColor: p.surfaceAlt }]}>
        <Ionicons name={icon} size={15} color={p.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.fieldLabel, { color: p.textMuted }]}>{label}</Text>
        <Text style={[styles.fieldValue, { color: p.text }]}>{value}</Text>
      </View>
    </View>
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
  heroNaam: { fontSize: 16, fontWeight: '700', fontFamily: F },
  heroSub: { fontSize: 12, fontFamily: F },
  statusBadge: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeTxt: { fontSize: 11, fontWeight: '700', fontFamily: F },

  sectionWrap: { marginBottom: Spacing.xl },
  sectionLabel: {
    fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: Spacing.sm, paddingHorizontal: 2, fontFamily: F,
  },
  card: { borderRadius: Radius.lg, padding: 0 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  fieldIconWrap: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: F },
  fieldValue: { fontSize: 14, fontWeight: '600', marginTop: 1, fontFamily: F },

  input: {
    borderWidth: 0.5, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: 13.5, fontFamily: F, minHeight: 70, textAlignVertical: 'top', margin: Spacing.md, marginBottom: 0,
  },
  knopRij: { flexDirection: 'row', gap: Spacing.sm, margin: Spacing.md, marginTop: 0 },
  knop: { flex: 1, paddingVertical: 12, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  knopTxt: { fontWeight: '700', fontSize: 13.5, fontFamily: F },
});

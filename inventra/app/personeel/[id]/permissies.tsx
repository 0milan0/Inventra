import { FontFamily, getPalette, Radius, Shadow, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ApiPermissieCategorie, getStaffPermissions, updateStaffPermission } from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const F = FontFamily;

// Pas na deze stilte-periode worden opgestapelde wijzigingen echt opgeslagen
// — anders springt de lijst bij elke tik terug naar boven (elke aanroep
// herlaadde vroeger de hele lijst, wat de ScrollView opnieuw mount).
const OPSLAAN_DEBOUNCE_MS = 1500;

const BRON_LABEL: Record<string, string> = {
  rank: 'Standaard via rang',
  department: 'Standaard via afdeling',
  account: 'Los ingesteld voor deze medewerker',
};

export default function PersoneelPermissiesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);
  const { token } = useAuth();

  const targetId = Number(id);

  const [categorieen, setCategorieen] = useState<ApiPermissieCategorie[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [opslaanBezig, setOpslaanBezig] = useState(false);
  const [wachtend, setWachtend] = useState(0);

  const pendingRef = useRef<Map<number, 'grant' | 'revoke'>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const laad = useCallback(async () => {
    if (!token || !Number.isFinite(targetId)) return;
    setLaden(true);
    setFout(null);
    try {
      setCategorieen(await getStaffPermissions(token, targetId));
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Permissies laden is mislukt.');
    } finally {
      setLaden(false);
    }
  }, [token, targetId]);

  useEffect(() => {
    laad();
  }, [laad]);

  // Niet vergeten op te slaan als het scherm verlaten wordt terwijl er nog
  // een wachtende (gedebouncte) wijziging openstaat.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const opslaanNu = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (!token || pendingRef.current.size === 0) return;

    const wijzigingen = Array.from(pendingRef.current.entries());
    pendingRef.current.clear();
    setWachtend(0);
    setOpslaanBezig(true);
    try {
      await Promise.all(
        wijzigingen.map(([permissieId, actie]) => updateStaffPermission(token, targetId, permissieId, actie))
      );
    } catch (e) {
      Alert.alert('Opslaan mislukt', e instanceof Error ? e.message : 'Sommige wijzigingen zijn niet opgeslagen.');
      await laad(); // lokale staat kan afwijken van de server na een mislukte opslag — opnieuw ophalen
    } finally {
      setOpslaanBezig(false);
    }
  }, [token, targetId, laad]);

  function wijzig(permissieId: number, waarde: boolean) {
    // Meteen lokaal bijwerken zodat de switch direct reageert — de echte
    // opslag (en dus elk risico op de lijst laten "springen") wordt
    // gedebounced, zodat je gewoon door kan tikken/scrollen.
    const override: 'grant' | 'revoke' = waarde ? 'grant' : 'revoke';
    setCategorieen((prev) =>
      prev.map((cat) => ({
        ...cat,
        permissies: cat.permissies.map((perm) =>
          perm.id === permissieId
            ? { ...perm, effectief: waarde, bron: 'account' as const, override }
            : perm
        ),
      }))
    );

    pendingRef.current.set(permissieId, waarde ? 'grant' : 'revoke');
    setWachtend(pendingRef.current.size);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(opslaanNu, OPSLAAN_DEBOUNCE_MS);
  }

  async function terugzetten(permissieId: number) {
    if (!token) return;
    await opslaanNu(); // eerst nog wachtende wijzigingen wegschrijven, anders overschrijft reset ze
    setOpslaanBezig(true);
    try {
      await updateStaffPermission(token, targetId, permissieId, 'reset');
      await laad();
    } catch (e) {
      Alert.alert('Mislukt', e instanceof Error ? e.message : 'Terugzetten is mislukt.');
    } finally {
      setOpslaanBezig(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: p.bg }]}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={[styles.header, { borderBottomColor: p.border }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.iconBtn, { backgroundColor: p.surface, borderColor: p.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={p.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: p.text }]}>Permissies</Text>
          {(opslaanBezig || wachtend > 0) && (
            <View style={styles.statusWrap}>
              {opslaanBezig ? (
                <ActivityIndicator size="small" color={p.accent} />
              ) : (
                <View style={[styles.statusDot, { backgroundColor: p.warning }]} />
              )}
              <Text style={[styles.statusTxt, { color: p.textMuted }]}>
                {opslaanBezig ? 'Opslaan…' : 'Wordt zo opgeslagen…'}
              </Text>
            </View>
          )}
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
            contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.lg }}
            showsVerticalScrollIndicator={false}
          >
            {categorieen.map((cat) => (
              <View key={cat.categorie} style={{ gap: Spacing.sm }}>
                <Text style={[styles.sectionLabel, { color: p.textMuted }]}>{cat.categorie}</Text>
                <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                  {cat.permissies.map((perm, idx) => (
                    <View
                      key={perm.id}
                      style={[
                        styles.rij,
                        idx < cat.permissies.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.divider },
                      ]}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[styles.label, { color: p.text }]}>{perm.label}</Text>
                        {!!perm.omschrijving && (
                          <Text style={[styles.omschrijving, { color: p.textSecondary }]}>{perm.omschrijving}</Text>
                        )}
                        <Text style={[styles.bron, { color: p.textMuted }]}>
                          {perm.bron ? BRON_LABEL[perm.bron] ?? perm.bron : 'Standaard niet toegekend'}
                        </Text>
                        {perm.override && (
                          <TouchableOpacity onPress={() => terugzetten(perm.id)} hitSlop={6}>
                            <Text style={[styles.resetLink, { color: p.accent }]}>↺ Terugzetten naar standaard</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <Switch
                        value={perm.effectief}
                        onValueChange={(waarde) => wijzig(perm.id, waarde)}
                        trackColor={{ false: p.border, true: p.accent }}
                        thumbColor="#fff"
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
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
  headerTitle: { fontSize: 15, fontWeight: '700', fontFamily: F },
  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { fontSize: 10.5, fontFamily: F, fontWeight: '600' },

  sectionLabel: {
    fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 2, fontFamily: F,
  },
  card: { borderRadius: Radius.lg, borderWidth: 0.5, overflow: 'hidden' },

  rij: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  label: { fontSize: 13, fontWeight: '600', fontFamily: F },
  omschrijving: { fontSize: 11, lineHeight: 15, fontFamily: F },
  bron: { fontSize: 10, fontFamily: F, marginTop: 1 },
  resetLink: { fontSize: 11, fontWeight: '600', fontFamily: F, marginTop: 2 },
});

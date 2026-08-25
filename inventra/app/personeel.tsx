import { ThemedView } from '@/components/themed-view';
import { Surface } from '@/components/ui/surface';
import { FontFamily, getPalette, Radius, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { getRolNiveau, magPersoneelAanmaken } from '@/data/session';
import { getDepartementInfo, type Department } from '@/data/store-map';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ApiStaffMember, getStaff, type AccountStatus } from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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

const STATUS_LABEL: Record<AccountStatus, string> = {
  actief: 'Actief',
  uitgenodigd: 'Uitgenodigd',
  inactief: 'Inactief',
  geblokkeerd: 'Geblokkeerd',
};

const STATUS_KLEUR: Record<AccountStatus, 'success' | 'warning' | 'muted' | 'danger'> = {
  actief: 'success',
  uitgenodigd: 'warning',
  inactief: 'muted',
  geblokkeerd: 'danger',
};

type Palette = ReturnType<typeof getPalette>;

export default function PersoneelScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);
  const { user, token } = useAuth();

  const rolNiveau = getRolNiveau(user?.rol ?? '');
  const isFiliaalbreed = rolNiveau === 'filiaalmanager';
  const magAanmaken = magPersoneelAanmaken(user);

  const [personeel, setPersoneel] = useState<ApiStaffMember[]>([]);
  const [laden, setLaden] = useState(true);
  const [verversen, setVerversen] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [zoek, setZoek] = useState('');

  const laadPersoneel = useCallback(async () => {
    if (!token) return;
    setFout(null);
    try {
      setPersoneel(await getStaff(token));
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Personeel laden is mislukt.');
    }
  }, [token]);

  // Alleen bij de allereerste keer de volle-scherm spinner tonen — bij
  // terugkomst van bv. personeel/nieuw ververst dit stil op de achtergrond.
  const eersteLaadGedaan = useRef(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (!eersteLaadGedaan.current) {
          setLaden(true);
          await laadPersoneel();
          setLaden(false);
          eersteLaadGedaan.current = true;
        } else {
          await laadPersoneel();
        }
      })();
    }, [laadPersoneel])
  );

  const onRefresh = useCallback(async () => {
    setVerversen(true);
    await laadPersoneel();
    setVerversen(false);
  }, [laadPersoneel]);

  const gefilterd = useMemo(() => {
    const term = zoek.trim().toLowerCase();
    if (!term) return personeel;
    return personeel.filter(
      (m) => m.naam.toLowerCase().includes(term) || m.rol.toLowerCase().includes(term)
    );
  }, [personeel, zoek]);

  const groepen = useMemo(() => {
    const perAfdeling = new Map<string, ApiStaffMember[]>();
    for (const lid of gefilterd) {
      const lijst = perAfdeling.get(lid.afdeling) ?? [];
      lijst.push(lid);
      perAfdeling.set(lid.afdeling, lijst);
    }
    return [...perAfdeling.entries()];
  }, [gefilterd]);

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
            <Text style={[styles.headerTitle, { color: p.text }]}>Personeel</Text>
            <Text style={[styles.headerSub, { color: p.textMuted }]}>
              {isFiliaalbreed ? 'Hele filiaal' : 'Eigen afdeling'} · {personeel.length}{' '}
              {personeel.length === 1 ? 'medewerker' : 'medewerkers'}
            </Text>
          </View>
          {magAanmaken && (
            <TouchableOpacity
              onPress={() => router.push('/personeel/nieuw' as never)}
              style={[styles.iconBtn, { backgroundColor: p.accentSoft, borderColor: p.accent }]}
              accessibilityLabel="Medewerker uitnodigen"
            >
              <Ionicons name="person-add-outline" size={17} color={p.accent} />
            </TouchableOpacity>
          )}
        </View>

        {/* Zoeken */}
        <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md }}>
          <View style={[styles.zoekBalk, { backgroundColor: p.surface, borderColor: p.border }]}>
            <Ionicons name="search-outline" size={16} color={p.textMuted} />
            <TextInput
              value={zoek}
              onChangeText={setZoek}
              placeholder="Zoek op naam of functie…"
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
            refreshControl={
              <RefreshControl refreshing={verversen} onRefresh={onRefresh} tintColor={p.textMuted} />
            }
          >
            {groepen.length === 0 ? (
              <View style={styles.leeg}>
                <Ionicons name="people-outline" size={28} color={p.textMuted} />
                <Text style={[styles.leegTxt, { color: p.textSecondary }]}>
                  {zoek ? 'Geen medewerkers gevonden' : 'Geen medewerkers in beeld'}
                </Text>
              </View>
            ) : (
              groepen.map(([afdeling, leden]) => (
                <View key={afdeling} style={styles.sectie}>
                  {isFiliaalbreed && (
                    <Text style={[styles.sectieTitel, { color: p.textMuted }]}>
                      {getDepartementInfo(afdeling as Department).label} · {leden.length}
                    </Text>
                  )}
                  <Surface style={styles.sectionCard}>
                    {leden.map((lid, idx) => (
                      <TouchableOpacity
                        key={lid.id}
                        style={[
                          styles.rij,
                          idx < leden.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: p.divider },
                        ]}
                        activeOpacity={0.7}
                        onPress={() => router.push(`/profile/${lid.id}` as never)}
                      >
                        {lid.profielfoto ? (
                          <Image source={{ uri: lid.profielfoto }} style={styles.avatar} />
                        ) : (
                          <View style={[styles.avatar, { backgroundColor: p.accentSoft }]}>
                            <Text style={[styles.avatarTxt, { color: p.accent }]}>{lid.initialen}</Text>
                          </View>
                        )}
                        <View style={styles.rijBody}>
                          <Text style={[styles.naam, { color: p.text }]} numberOfLines={1}>
                            {lid.naam}
                          </Text>
                          <Text style={[styles.rol, { color: p.textSecondary }]} numberOfLines={1}>
                            {lid.rol}
                          </Text>
                        </View>
                        <StatusBadge status={lid.status} palette={p} />
                        <TouchableOpacity
                          onPress={() => router.push(`/personeel/${lid.id}` as never)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={[styles.beheerBtn, { backgroundColor: p.surfaceAlt }]}
                        >
                          <Ionicons name="settings-outline" size={15} color={p.textSecondary} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </Surface>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function StatusBadge({ status, palette }: { status: AccountStatus; palette: Palette }) {
  const kleur = STATUS_KLEUR[status];
  const bg = kleur === 'muted'
    ? palette.surfaceAlt
    : kleur === 'success' ? palette.successSoft
    : kleur === 'warning' ? palette.warningSoft
    : palette.dangerSoft;
  const fg = kleur === 'muted'
    ? palette.textMuted
    : kleur === 'success' ? palette.success
    : kleur === 'warning' ? palette.warning
    : palette.danger;

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

  content: { padding: Spacing.lg, paddingBottom: 36, gap: Spacing.lg },

  sectie: { gap: Spacing.sm },
  sectieTitel: {
    fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8,
    fontFamily: F, paddingHorizontal: 2,
  },
  sectionCard: { borderRadius: Radius.lg, overflow: 'hidden' },

  rij: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.md + 2, paddingVertical: 11,
  },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 13, fontWeight: '700', fontFamily: F },
  rijBody: { flex: 1, minWidth: 0, gap: 1 },
  naam: { fontSize: 13.5, fontWeight: '600', fontFamily: F },
  rol: { fontSize: 11.5, fontFamily: F },

  badge: { borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  badgeTxt: { fontSize: 10, fontWeight: '700', fontFamily: F },
  beheerBtn: { width: 28, height: 28, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  leeg: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl },
  leegTxt: { fontSize: 12.5, fontFamily: F },
});

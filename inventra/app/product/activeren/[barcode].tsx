import { ThemedView } from '@/components/themed-view';
import { FontFamily, getPalette, Radius, Shadow, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ApiSchap, activeerProductBranch, getProductLookups } from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const F = FontFamily;
type Palette = ReturnType<typeof getPalette>;

/** Native keuzemenu — iOS: echte ActionSheet, Android: systeem-dialoogvenster. */
function toonNativeKeuze(
  titel: string,
  opties: { id: string; label: string }[],
  onKies: (id: string) => void
) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: titel,
        options: [...opties.map((o) => o.label), 'Annuleren'],
        cancelButtonIndex: opties.length,
      },
      (index) => {
        if (index < opties.length) onKies(opties[index].id);
      }
    );
  } else {
    Alert.alert(titel, undefined, [
      ...opties.map((o) => ({ text: o.label, onPress: () => onKies(o.id) })),
      { text: 'Annuleren', style: 'cancel' as const },
    ]);
  }
}

export default function ProductActiverenScreen() {
  const { barcode, naam, afbeelding } = useLocalSearchParams<{ barcode: string; naam?: string; afbeelding?: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);
  const { token, user } = useAuth();

  const [schappen, setSchappen] = useState<ApiSchap[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  const laadSchappen = useCallback(async () => {
    if (!token) return;
    setLaden(true);
    setFout(null);
    try {
      const lookups = await getProductLookups(token);
      setSchappen(lookups.schappen);
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Schappen laden is mislukt.');
    } finally {
      setLaden(false);
    }
  }, [token]);

  useEffect(() => {
    laadSchappen();
  }, [laadSchappen]);

  const [schapId, setSchapId] = useState<number | null>(null);
  const [opSchap, setOpSchap] = useState('0');
  const [magazijn, setMagazijn] = useState('0');
  const [minimum, setMinimum] = useState('0');
  const [schapGrootte, setSchapGrootte] = useState('0');
  const [kortsteTht, setKortsteTht] = useState('');
  const [opslaanBezig, setOpslaanBezig] = useState(false);

  const gekozenSchap = schappen.find((s) => s.id === schapId) ?? null;

  const kanOpslaan = schapId !== null;

  const handleOpslaan = async () => {
    if (!token || !barcode || schapId === null) return;
    if (kortsteTht.trim() !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(kortsteTht.trim())) {
      Alert.alert('Ongeldige datum', 'Gebruik het formaat JJJJ-MM-DD, bijv. 2025-06-15.');
      return;
    }

    setOpslaanBezig(true);
    try {
      await activeerProductBranch(token, {
        barcode,
        schapId,
        opSchap: Number(opSchap) || 0,
        magazijn: Number(magazijn) || 0,
        minimum: Number(minimum) || 0,
        schapGrootte: Number(schapGrootte) || 0,
        kortsteTht: kortsteTht.trim() || null,
      });
      Alert.alert('Opgeslagen', `${naam ?? 'Product'} is nu zichtbaar in de voorraad van ${user?.filiaal?.naam ?? 'dit filiaal'}.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Opslaan mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
    } finally {
      setOpslaanBezig(false);
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
          <Text style={[styles.headerTitle, { color: p.text }]} numberOfLines={1}>
            Product aanvullen
          </Text>
        </View>

        {laden ? (
          <View style={styles.center}>
            <ActivityIndicator color={p.accent} />
          </View>
        ) : fout ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={40} color={p.textMuted} />
            <Text style={[styles.foutTekst, { color: p.text }]}>{fout}</Text>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: p.accent }]} onPress={laadSchappen}>
              <Text style={styles.primaryButtonText}>Opnieuw proberen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xxl }}
            >
              <View style={styles.hero}>
                {afbeelding ? (
                  <Image source={{ uri: afbeelding }} style={styles.heroFoto} />
                ) : (
                  <View style={[styles.heroFoto, styles.heroFotoPlaceholder, { backgroundColor: p.surfaceAlt }]}>
                    <Ionicons name="cube-outline" size={22} color={p.textMuted} />
                  </View>
                )}
                <Text style={[styles.heroNaam, { color: p.text }]} numberOfLines={2}>{naam ?? barcode}</Text>
                <Text style={[styles.heroSub, { color: p.textSecondary }]}>{barcode}</Text>
              </View>

              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionLabel, { color: p.textMuted }]}>
                  Op dit filiaal{user?.filiaal?.naam ? ` — ${user.filiaal.naam}` : ''}
                </Text>
                <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                  <FieldRow
                    icon="grid-outline"
                    label="Schap"
                    value={gekozenSchap ? `${gekozenSchap.naam} (${gekozenSchap.afdeling})` : 'Kies schap'}
                    onPress={() =>
                      toonNativeKeuze(
                        'Schap',
                        schappen.map((s) => ({ id: String(s.id), label: `${s.naam} (${s.afdeling})` })),
                        (id) => setSchapId(Number(id))
                      )
                    }
                    p={p}
                  />
                  <View style={styles.dubbeleRij}>
                    <TextInput
                      value={opSchap}
                      onChangeText={setOpSchap}
                      placeholder="Voorraad schap"
                      placeholderTextColor={p.textMuted}
                      keyboardType="number-pad"
                      style={[styles.input, styles.inputHalf, { color: p.text, borderColor: p.border }]}
                    />
                    <TextInput
                      value={magazijn}
                      onChangeText={setMagazijn}
                      placeholder="Voorraad magazijn"
                      placeholderTextColor={p.textMuted}
                      keyboardType="number-pad"
                      style={[styles.input, styles.inputHalf, { color: p.text, borderColor: p.border }]}
                    />
                  </View>
                  <View style={styles.dubbeleRij}>
                    <TextInput
                      value={minimum}
                      onChangeText={setMinimum}
                      placeholder="Minimumvoorraad"
                      placeholderTextColor={p.textMuted}
                      keyboardType="number-pad"
                      style={[styles.input, styles.inputHalf, { color: p.text, borderColor: p.border }]}
                    />
                    <TextInput
                      value={schapGrootte}
                      onChangeText={setSchapGrootte}
                      placeholder="Schapgrootte"
                      placeholderTextColor={p.textMuted}
                      keyboardType="number-pad"
                      style={[styles.input, styles.inputHalf, { color: p.text, borderColor: p.border }]}
                    />
                  </View>
                  <TextInput
                    value={kortsteTht}
                    onChangeText={setKortsteTht}
                    placeholder="Kortste THT: JJJJ-MM-DD (optioneel)"
                    placeholderTextColor={p.textMuted}
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                    style={[styles.input, styles.inputLast, { color: p.text, borderColor: p.border }]}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  { backgroundColor: kanOpslaan ? p.accent : p.border, opacity: opslaanBezig ? 0.7 : 1 },
                ]}
                onPress={handleOpslaan}
                disabled={!kanOpslaan || opslaanBezig}
              >
                {opslaanBezig ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Opslaan</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function FieldRow({
  icon, label, value, onPress, last, p,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  onPress: () => void;
  last?: boolean;
  p: Palette;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.fieldRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.divider },
      ]}
    >
      <View style={[styles.fieldIconWrap, { backgroundColor: p.surfaceAlt }]}>
        <Ionicons name={icon} size={15} color={p.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.fieldLabel, { color: p.textMuted }]}>{label}</Text>
        <Text style={[styles.fieldValue, { color: p.text }]}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={p.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, gap: Spacing.md },
  foutTekst: { fontSize: 14, fontWeight: '600', fontFamily: F, textAlign: 'center' },

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
  heroFoto: { width: 72, height: 72, borderRadius: Radius.lg, marginBottom: Spacing.sm },
  heroFotoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  heroNaam: { fontSize: 16, fontWeight: '700', fontFamily: F, textAlign: 'center' },
  heroSub: { fontSize: 12, fontFamily: F },

  sectionWrap: { marginBottom: Spacing.xl },
  sectionLabel: {
    fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: Spacing.sm, paddingHorizontal: 2, fontFamily: F,
  },
  card: { borderRadius: Radius.lg, borderWidth: 0.5, overflow: 'hidden', padding: 0 },

  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  fieldIconWrap: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: F },
  fieldValue: { fontSize: 14, fontWeight: '600', marginTop: 1, fontFamily: F },

  input: {
    borderWidth: 0.5, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: 13.5, fontFamily: F, margin: Spacing.md, marginBottom: 0,
  },
  inputLast: { marginBottom: Spacing.md },
  dubbeleRij: { flexDirection: 'row', gap: Spacing.sm, marginHorizontal: Spacing.md },
  inputHalf: { flex: 1, margin: 0, marginTop: Spacing.md },

  submitBtn: {
    borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, fontFamily: F },

  primaryButton: { borderRadius: Radius.md, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 13.5, fontFamily: F },
});

import ScannerModal from '@/components/scanner-modal';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, getPalette, Radius, Shadow, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { magRecallsAanmaken } from '@/data/session';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  ApiBranch,
  ApiProductZoekresultaat,
  createRecall,
  getBranches,
  searchProducts,
} from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const F = FontFamily;
type Palette = ReturnType<typeof getPalette>;

const formatDate = (date: Date): string => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}-${m}-${date.getFullYear()}`;
};

const parseDate = (value?: string | null): Date => {
  if (!value) return new Date();
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
};

const formatDateTime = (date: Date): string => {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(date)} ${hh}:${mm}`;
};

/** Verwacht "JJJJ-MM-DD UU:MM(:SS)" — het formaat dat recalls/create.php opslaat. */
const parseDateTime = (value?: string | null): Date => {
  if (!value) return new Date();
  const [datumDeel, tijdDeel] = value.split(' ');
  const [y, m, d] = (datumDeel ?? '').split('-').map(Number);
  if (!y || !m || !d) return new Date();
  const [hh, mm] = (tijdDeel ?? '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0);
};

const naarDateTimeString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:00`;
};

export default function RecallNieuwScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);
  const { user, token } = useAuth();
  const magAanmaken = magRecallsAanmaken(user);

  // ── Product zoeken ───────────────────────────────────────────────────────
  const [zoekTerm, setZoekTerm] = useState('');
  const [zoekResultaten, setZoekResultaten] = useState<ApiProductZoekresultaat[]>([]);
  const [zoekBezig, setZoekBezig] = useState(false);
  const [zoekFout, setZoekFout] = useState<string | null>(null);
  const [gekozenProduct, setGekozenProduct] = useState<ApiProductZoekresultaat | null>(null);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    if (!token || gekozenProduct || zoekTerm.trim().length < 2) {
      setZoekResultaten([]);
      setZoekFout(null);
      return;
    }
    let actief = true;
    setZoekBezig(true);
    const timer = setTimeout(async () => {
      try {
        const resultaten = await searchProducts(token, zoekTerm.trim());
        if (actief) { setZoekResultaten(resultaten); setZoekFout(null); }
      } catch (e) {
        if (actief) {
          setZoekResultaten([]);
          setZoekFout(e instanceof Error ? e.message : 'Zoeken is mislukt.');
        }
      } finally {
        if (actief) setZoekBezig(false);
      }
    }, 350);
    return () => { actief = false; clearTimeout(timer); };
  }, [zoekTerm, token, gekozenProduct]);

  const handleScan = async (code: string) => {
    setScanOpen(false);
    if (!token) return;
    setZoekTerm(code);
    setZoekBezig(true);
    setZoekFout(null);
    try {
      const resultaten = await searchProducts(token, code);
      const exact = resultaten.find((r) => r.barcode === code);
      if (exact) {
        setGekozenProduct(exact);
        setZoekResultaten([]);
      } else {
        setZoekResultaten(resultaten);
      }
    } catch (e) {
      setZoekResultaten([]);
      setZoekFout(e instanceof Error ? e.message : 'Zoeken is mislukt.');
    } finally {
      setZoekBezig(false);
    }
  };

  // ── Formuliervelden ──────────────────────────────────────────────────────
  const [titel, setTitel] = useState('');
  const [criteriaNotitie, setCriteriaNotitie] = useState('');
  const [thtVan, setThtVan] = useState('');
  const [thtTot, setThtTot] = useState('');
  const [thtVanPicker, setThtVanPicker] = useState(false);
  const [thtTotPicker, setThtTotPicker] = useState(false);

  const [startTime, setStartTime] = useState('');
  const [deadline, setDeadline] = useState('');
  const [startTimePicker, setStartTimePicker] = useState(false);
  const [deadlinePicker, setDeadlinePicker] = useState(false);

  const [alleFilialen, setAlleFilialen] = useState(true);
  const [branches, setBranches] = useState<ApiBranch[]>([]);
  const [branchesLaden, setBranchesLaden] = useState(false);
  const [gekozenBranchIds, setGekozenBranchIds] = useState<number[]>([]);

  const laadBranches = useCallback(async () => {
    if (!token || branches.length > 0) return;
    setBranchesLaden(true);
    try {
      setBranches(await getBranches(token));
    } finally {
      setBranchesLaden(false);
    }
  }, [token, branches.length]);

  useEffect(() => {
    if (!alleFilialen) laadBranches();
  }, [alleFilialen, laadBranches]);

  function toggleBranch(id: number) {
    setGekozenBranchIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  }

  const [opslaanBezig, setOpslaanBezig] = useState(false);

  const kanOpslaan =
    gekozenProduct !== null &&
    titel.trim() !== '' &&
    (alleFilialen || gekozenBranchIds.length > 0);

  const handleOpslaan = async () => {
    if (!token || !kanOpslaan || !gekozenProduct) return;

    if (thtVan && thtTot && thtVan > thtTot) {
      Alert.alert('Ongeldige periode', '"THT vanaf" kan niet na "THT tot" liggen.');
      return;
    }
    if (startTime && deadline && startTime > deadline) {
      Alert.alert('Ongeldige planning', 'Starttijd kan niet na de deadline liggen.');
      return;
    }

    setOpslaanBezig(true);
    try {
      const result = await createRecall(token, {
        productId: gekozenProduct.id,
        titel: titel.trim(),
        criteriaNotitie: criteriaNotitie.trim() || undefined,
        thtVan: thtVan || undefined,
        thtTot: thtTot || undefined,
        startTime: startTime || undefined,
        deadline: deadline || undefined,
        alleFilialen,
        branchIds: alleFilialen ? undefined : gekozenBranchIds,
      });
      Alert.alert(
        'Recall aangemaakt',
        `${result.aangemaakt} taak/taken aangemaakt.${result.overgeslagen > 0 ? `\n${result.overgeslagen} filiaal/filialen overgeslagen (voert dit product niet).` : ''}`,
        [{ text: 'OK', onPress: () => router.replace({ pathname: '/recalls/[id]', params: { id: String(result.id) } }) }]
      );
    } catch (e) {
      Alert.alert('Aanmaken mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
    } finally {
      setOpslaanBezig(false);
    }
  };

  if (!magAanmaken) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
        <SafeAreaView style={styles.center}>
          <Ionicons name="lock-closed-outline" size={40} color={p.textMuted} />
          <Text style={[styles.foutTekst, { color: p.text }]}>Geen toegang</Text>
          <Text style={[styles.foutSub, { color: p.textSecondary }]}>
            Alleen Regiomanager, Inkoper, Logistiek Coördinator (of medewerkers met deze permissie) kunnen recalls aanmaken.
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
          <Text style={[styles.headerTitle, { color: p.text }]} numberOfLines={1}>
            Nieuwe recall
          </Text>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xxl }}
          >
            {/* PRODUCT */}
            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Product</Text>
              <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                {gekozenProduct ? (
                  <View style={styles.gekozenProductRow}>
                    <View style={[styles.icoonWrap, { backgroundColor: p.dangerSoft }]}>
                      <Ionicons name="warning" size={16} color={p.danger} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldValue, { color: p.text }]} numberOfLines={1}>{gekozenProduct.naam}</Text>
                      <Text style={[styles.fieldLabelSub, { color: p.textMuted }]} numberOfLines={1}>
                        {gekozenProduct.merk} · {gekozenProduct.barcode}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => { setGekozenProduct(null); setZoekTerm(''); }} hitSlop={8}>
                      <Ionicons name="close-circle" size={20} color={p.textMuted} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.scanBlock, { backgroundColor: p.accent, margin: Spacing.md, marginBottom: 0 }]}
                      onPress={() => setScanOpen(true)}
                    >
                      <Ionicons name="camera-outline" size={18} color="#fff" />
                      <Text style={styles.scanBlockText}>Scan barcode</Text>
                    </TouchableOpacity>

                    <View style={[styles.dividerRow, { marginHorizontal: Spacing.md, marginVertical: Spacing.md }]}>
                      <View style={[styles.dividerLine, { backgroundColor: p.divider }]} />
                      <Text style={[styles.dividerLabel, { color: p.textMuted }]}>of</Text>
                      <View style={[styles.dividerLine, { backgroundColor: p.divider }]} />
                    </View>

                    <TextInput
                      value={zoekTerm}
                      onChangeText={setZoekTerm}
                      placeholder="Zoek op naam, barcode of sku"
                      placeholderTextColor={p.textMuted}
                      style={[styles.input, styles.inputLast, { color: p.text, borderColor: p.border }]}
                    />
                    {zoekBezig && (
                      <View style={{ paddingBottom: Spacing.md }}>
                        <ActivityIndicator size="small" color={p.accent} />
                      </View>
                    )}
                    {!zoekBezig && zoekFout && (
                      <View style={[styles.errorBox, { backgroundColor: p.dangerSoft }]}>
                        <Ionicons name="alert-circle-outline" size={14} color={p.danger} />
                        <Text style={[styles.errorText, { color: p.danger }]}>{zoekFout}</Text>
                      </View>
                    )}
                    {!zoekBezig && !zoekFout && zoekTerm.trim().length >= 2 && zoekResultaten.length === 0 && (
                      <Text style={[styles.geenResultaten, { color: p.textMuted }]}>Niets gevonden.</Text>
                    )}
                    {zoekResultaten.map((res) => (
                      <TouchableOpacity
                        key={res.id}
                        style={[styles.zoekResultaat, { borderTopColor: p.divider }]}
                        onPress={() => { setGekozenProduct(res); setZoekResultaten([]); }}
                      >
                        <Text style={[styles.fieldValue, { color: p.text }]} numberOfLines={1}>{res.naam}</Text>
                        <Text style={[styles.fieldLabelSub, { color: p.textMuted }]} numberOfLines={1}>
                          {res.merk} · {res.barcode}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </View>
            </View>

            {/* REDEN & CRITERIA */}
            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Reden & criteria</Text>
              <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                <TextInput
                  value={titel}
                  onChangeText={setTitel}
                  placeholder="Reden voor de recall"
                  placeholderTextColor={p.textMuted}
                  style={[styles.input, { color: p.text, borderColor: p.border }]}
                />
                <TextInput
                  value={criteriaNotitie}
                  onChangeText={setCriteriaNotitie}
                  placeholder="Overige criteria (kleur, formaat/gram, partijnummer, optioneel)"
                  placeholderTextColor={p.textMuted}
                  multiline
                  style={[styles.input, styles.inputMultiline, styles.inputLast, { color: p.text, borderColor: p.border }]}
                />

                <DatumVeld
                  label="THT vanaf (optioneel)"
                  waarde={thtVan}
                  open={thtVanPicker}
                  onToggle={() => setThtVanPicker((v) => !v)}
                  onChange={setThtVan}
                  p={p}
                  borderTop
                />
                <DatumVeld
                  label="THT tot (optioneel)"
                  waarde={thtTot}
                  open={thtTotPicker}
                  onToggle={() => setThtTotPicker((v) => !v)}
                  onChange={setThtTot}
                  p={p}
                  last
                />
              </View>
            </View>

            {/* PLANNING */}
            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Planning van de taak</Text>
              <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                <DatumVeld
                  label="Starttijd (optioneel)"
                  waarde={startTime}
                  open={startTimePicker}
                  onToggle={() => setStartTimePicker((v) => !v)}
                  onChange={setStartTime}
                  p={p}
                  metTijd
                />
                <DatumVeld
                  label="Deadline (optioneel)"
                  waarde={deadline}
                  open={deadlinePicker}
                  onToggle={() => setDeadlinePicker((v) => !v)}
                  onChange={setDeadline}
                  p={p}
                  metTijd
                  last
                />
              </View>
            </View>

            {/* FILIALEN */}
            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Filialen</Text>
              <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                <View style={[styles.switchRow, !alleFilialen && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.divider }]}>
                  <Text style={[styles.fieldValue, { color: p.text }]}>Alle filialen</Text>
                  <Switch value={alleFilialen} onValueChange={setAlleFilialen} trackColor={{ true: p.accent }} />
                </View>

                {!alleFilialen && (
                  branchesLaden ? (
                    <View style={{ paddingVertical: Spacing.lg, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={p.accent} />
                    </View>
                  ) : (
                    branches.map((b, idx) => {
                      const actief = gekozenBranchIds.includes(b.id);
                      return (
                        <TouchableOpacity
                          key={b.id}
                          style={[
                            styles.branchRow,
                            idx < branches.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.divider },
                          ]}
                          onPress={() => toggleBranch(b.id)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.fieldValue, { color: p.text }]}>{b.naam}</Text>
                            <Text style={[styles.fieldLabelSub, { color: p.textMuted }]}>{b.stad}</Text>
                          </View>
                          <Ionicons
                            name={actief ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={actief ? p.accent : p.textMuted}
                          />
                        </TouchableOpacity>
                      );
                    })
                  )
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: kanOpslaan ? p.danger : p.border, opacity: opslaanBezig ? 0.7 : 1 },
              ]}
              onPress={handleOpslaan}
              disabled={!kanOpslaan || opslaanBezig}
            >
              {opslaanBezig ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Recall aanmaken</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <ScannerModal
        visible={scanOpen}
        isFocused={scanOpen}
        onBarcodeScanned={handleScan}
        onClose={() => setScanOpen(false)}
      />
    </ThemedView>
  );
}

function DatumVeld({
  label, waarde, open, onToggle, onChange, p, borderTop, last, metTijd,
}: {
  label: string;
  waarde: string;
  open: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
  p: Palette;
  borderTop?: boolean;
  last?: boolean;
  /** Vraagt ook een tijdstip (niet alleen een datum) — waarde/onChange gebruiken dan "JJJJ-MM-DD UU:MM:SS". */
  metTijd?: boolean;
}) {
  const parse = metTijd ? parseDateTime : parseDate;
  const format = metTijd ? formatDateTime : formatDate;
  return (
    <View style={borderTop ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.divider } : undefined}>
      <TouchableOpacity
        style={[styles.fieldRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.divider }]}
        onPress={onToggle}
      >
        <View style={[styles.fieldIconWrap, { backgroundColor: p.surfaceAlt }]}>
          <Ionicons name={metTijd ? 'time-outline' : 'calendar-outline'} size={15} color={p.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.fieldLabel, { color: p.textMuted }]}>{label}</Text>
          <Text style={[styles.fieldValue, { color: p.text }]}>{waarde ? format(parse(waarde)) : 'Instellen'}</Text>
        </View>
        {!!waarde && (
          <TouchableOpacity onPress={() => onChange('')} hitSlop={8} style={{ marginRight: 4 }}>
            <Ionicons name="close-circle" size={18} color={p.textMuted} />
          </TouchableOpacity>
        )}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={p.textMuted} />
      </TouchableOpacity>
      {open && (
        <DateTimePicker
          value={parse(waarde)}
          mode={metTijd ? 'datetime' : 'date'}
          display={Platform.OS === 'ios' ? 'spinner' : metTijd ? 'default' : 'calendar'}
          onChange={(_, date) => {
            if (!date) return;
            if (metTijd) {
              onChange(naarDateTimeString(date));
              return;
            }
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            onChange(`${y}-${m}-${d}`);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, gap: Spacing.md },
  foutTekst: { fontSize: 14, fontWeight: '600', fontFamily: F, textAlign: 'center' },
  foutSub: { fontSize: 12, fontFamily: F, textAlign: 'center', lineHeight: 17 },

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

  sectionWrap: { marginBottom: Spacing.xl },
  sectionLabel: {
    fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: Spacing.sm, paddingHorizontal: 2, fontFamily: F,
  },
  card: { borderRadius: Radius.lg, borderWidth: 0.5, overflow: 'hidden', padding: 0 },

  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  fieldIconWrap: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: F },
  fieldLabelSub: { fontSize: 11, fontFamily: F, marginTop: 1 },
  fieldValue: { fontSize: 14, fontWeight: '600', marginTop: 1, fontFamily: F },

  input: {
    borderWidth: 0.5, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: 13.5, fontFamily: F, margin: Spacing.md, marginBottom: 0,
  },
  inputMultiline: { minHeight: 60, textAlignVertical: 'top' },
  inputLast: { marginBottom: Spacing.md },

  geenResultaten: { fontSize: 12, fontFamily: F, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2, borderRadius: Radius.md,
    padding: Spacing.sm + 2, marginHorizontal: Spacing.md, marginBottom: Spacing.md,
  },
  errorText: { flex: 1, fontSize: 11, fontFamily: F, fontWeight: '600' },
  zoekResultaat: { paddingHorizontal: Spacing.md, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },

  scanBlock: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    borderRadius: Radius.md, paddingVertical: 13,
  },
  scanBlockText: { fontSize: 13.5, fontWeight: '700', fontFamily: F, color: '#fff' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dividerLine: { flex: 1, height: 0.5 },
  dividerLabel: { fontSize: 10, fontFamily: F, fontWeight: '600' },

  gekozenProductRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  icoonWrap: { width: 34, height: 34, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  branchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },

  submitBtn: {
    borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, fontFamily: F },

  primaryButton: { borderRadius: Radius.md, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 13.5, fontFamily: F },
});

import ScannerModal from '@/components/scanner-modal';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, getPalette, Radius, Shadow, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { magProductenAanmaken } from '@/data/session';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  ApiProductLookups,
  NieuwProduct,
  Opslagwijze,
  createProduct,
  getProductLookups,
  uploadProductImage,
} from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
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
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const F = FontFamily;
type Palette = ReturnType<typeof getPalette>;

const OPSLAG_OPTIES: { id: Opslagwijze | ''; label: string }[] = [
  { id: '', label: 'Geen' },
  { id: 'ambient', label: 'Ambient' },
  { id: 'koel', label: 'Koel' },
  { id: 'vries', label: 'Vries' },
];

const EENHEID_OPTIES = ['stuk', 'kg', 'gram', 'liter', 'ml'];

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

export default function ProductenToevoegenScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);
  const { user, token } = useAuth();
  const magAanmaken = magProductenAanmaken(user);

  const [lookups, setLookups] = useState<ApiProductLookups | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  const laadLookups = useCallback(async () => {
    if (!token) return;
    setLaden(true);
    setFout(null);
    try {
      setLookups(await getProductLookups(token));
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Referentiegegevens laden is mislukt.');
    } finally {
      setLaden(false);
    }
  }, [token]);

  useEffect(() => {
    if (magAanmaken) laadLookups();
  }, [laadLookups, magAanmaken]);

  // ── Formuliervelden ──────────────────────────────────────────────────────
  const [scanOpen, setScanOpen] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [sku, setSku] = useState('');
  const [pluCode, setPluCode] = useState('');
  const [naam, setNaam] = useState('');
  const [shortName, setShortName] = useState('');
  const [description, setDescription] = useState('');

  const [categorieId, setCategorieId] = useState<number | null>(null);
  const [subcategorieId, setSubcategorieId] = useState<number | null>(null);
  const [merkId, setMerkId] = useState<number | null>(null);
  const [leverancierId, setLeverancierId] = useState<number | null>(null);

  const [eenheidType, setEenheidType] = useState('stuk');
  const [eenheidGrootte, setEenheidGrootte] = useState('1');
  const [colloGrootte, setColloGrootte] = useState('1');
  const [verkoopprijs, setVerkoopprijs] = useState('');

  const [opslag, setOpslag] = useState<Opslagwijze | ''>('');
  const [biologisch, setBiologisch] = useState(false);
  const [uitgelicht, setUitgelicht] = useState(false);

  // Lokale URI's — geüpload pas ná het aanmaken van het product (dan pas is er een productId).
  const [fotos, setFotos] = useState<string[]>([]);

  const [opslaanBezig, setOpslaanBezig] = useState(false);
  const [opslaanStap, setOpslaanStap] = useState('');

  const gekozenCategorie = lookups?.categorieen.find((c) => c.id === categorieId) ?? null;
  const gekozenSubcategorie = gekozenCategorie?.subcategorieen.find((s) => s.id === subcategorieId) ?? null;
  const gekozenMerk = lookups?.merken.find((m) => m.id === merkId) ?? null;
  const gekozenLeverancier = lookups?.leveranciers.find((l) => l.id === leverancierId) ?? null;

  const kanOpslaan =
    barcode.trim() !== '' &&
    sku.trim() !== '' &&
    pluCode.trim() !== '' &&
    naam.trim() !== '' &&
    shortName.trim() !== '' &&
    description.trim() !== '' &&
    subcategorieId !== null &&
    merkId !== null &&
    leverancierId !== null;

  async function voegFotoToe(bron: 'camera' | 'galerij') {
    const permissie =
      bron === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissie.granted) {
      Alert.alert('Geen toegang', `Geef Inventra toegang tot je ${bron === 'camera' ? 'camera' : "foto's"} om foto's toe te voegen.`);
      return;
    }

    const resultaat =
      bron === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: true });

    if (resultaat.canceled) return;
    setFotos((prev) => [...prev, ...resultaat.assets.map((a) => a.uri)]);
  }

  function kiesFotoBron() {
    toonNativeKeuze('Foto toevoegen', [
      { id: 'camera', label: 'Foto maken' },
      { id: 'galerij', label: "Kies uit galerij" },
    ], (id) => voegFotoToe(id as 'camera' | 'galerij'));
  }

  function verwijderFoto(uri: string) {
    setFotos((prev) => prev.filter((f) => f !== uri));
  }

  const handleOpslaan = async () => {
    if (!token || !kanOpslaan || subcategorieId === null || merkId === null || leverancierId === null) return;

    const payload: NieuwProduct = {
      barcode: barcode.trim(),
      sku: sku.trim(),
      pluCode: pluCode.trim(),
      naam: naam.trim(),
      shortName: shortName.trim(),
      description: description.trim(),
      subcategorieId,
      merkId,
      leverancierId,
      eenheidType,
      eenheidGrootte: Number(eenheidGrootte) || 0,
      colloGrootte: Number(colloGrootte) || 0,
      verkoopprijs: Number(verkoopprijs) || 0,
      opslag: opslag || null,
      biologisch,
      uitgelicht,
    };

    setOpslaanBezig(true);
    setOpslaanStap('Product aanmaken...');
    try {
      const result = await createProduct(token, payload);

      if (fotos.length > 0) {
        let gelukt = 0;
        for (let i = 0; i < fotos.length; i++) {
          setOpslaanStap(`Foto ${i + 1}/${fotos.length} uploaden...`);
          try {
            await uploadProductImage(token, result.id, fotos[i]);
            gelukt++;
          } catch {
            // Eén mislukte foto mag de rest niet blokkeren — het product bestaat al.
          }
        }
        if (gelukt < fotos.length) {
          Alert.alert('Let op', `${fotos.length - gelukt} van de ${fotos.length} foto's zijn niet geüpload.`);
        }
      }

      Alert.alert(
        'Product aangemaakt',
        `${naam.trim()} is toegevoegd aan de catalogus en klaargezet voor ${result.filialen} ${result.filialen === 1 ? 'filiaal' : 'filialen'} (voorraad op 0, nog geen schap).`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert('Aanmaken mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
    } finally {
      setOpslaanBezig(false);
      setOpslaanStap('');
    }
  };

  // ── Toegang alleen met de permissie "producten_aanmaken" ────────────────
  if (!magAanmaken) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
        <SafeAreaView style={styles.center}>
          <Ionicons name="lock-closed-outline" size={40} color={p.textMuted} />
          <Text style={[styles.foutTekst, { color: p.text }]}>Geen toegang</Text>
          <Text style={[styles.foutSub, { color: p.textSecondary }]}>
            Alleen de logistiek coördinator (of medewerkers met deze permissie) kunnen nieuwe producten aanmaken.
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
            Product toevoegen
          </Text>
        </View>

        {laden ? (
          <View style={styles.center}>
            <ActivityIndicator color={p.accent} />
          </View>
        ) : fout || !lookups ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={40} color={p.textMuted} />
            <Text style={[styles.foutTekst, { color: p.text }]}>{fout ?? 'Referentiegegevens niet gevonden'}</Text>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: p.accent }]} onPress={laadLookups}>
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
              {/* FOTO'S */}
              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Foto&apos;s</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fotoRij}>
                  {fotos.map((uri) => (
                    <View key={uri} style={styles.fotoThumbWrap}>
                      <Image source={{ uri }} style={[styles.fotoThumb, { borderColor: p.border }]} />
                      <TouchableOpacity
                        style={[styles.fotoVerwijder, { backgroundColor: p.danger }]}
                        onPress={() => verwijderFoto(uri)}
                        hitSlop={6}
                      >
                        <Ionicons name="close" size={12} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[styles.fotoToevoegen, { borderColor: p.border, backgroundColor: p.surface }]}
                    onPress={kiesFotoBron}
                  >
                    <Ionicons name="camera-outline" size={20} color={p.accent} />
                    <Text style={[styles.fotoToevoegenTxt, { color: p.accent }]}>Toevoegen</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* BASISGEGEVENS */}
              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Basisgegevens</Text>
                <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                  <View style={styles.rowWithBtn}>
                    <TextInput
                      value={barcode}
                      onChangeText={setBarcode}
                      placeholder="Barcode"
                      placeholderTextColor={p.textMuted}
                      keyboardType="number-pad"
                      style={[styles.input, styles.inputFlex, { color: p.text, borderColor: p.border }]}
                    />
                    <TouchableOpacity
                      style={[styles.scanBtn, { backgroundColor: p.accentSoft }]}
                      onPress={() => setScanOpen(true)}
                    >
                      <Ionicons name="camera-outline" size={18} color={p.accent} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={sku}
                    onChangeText={setSku}
                    placeholder="SKU"
                    placeholderTextColor={p.textMuted}
                    style={[styles.input, { color: p.text, borderColor: p.border }]}
                  />
                  <TextInput
                    value={pluCode}
                    onChangeText={setPluCode}
                    placeholder="Artikelnummer (PLU, 6 cijfers)"
                    placeholderTextColor={p.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={[styles.input, { color: p.text, borderColor: p.border }]}
                  />
                  <TextInput
                    value={naam}
                    onChangeText={setNaam}
                    placeholder="Productnaam"
                    placeholderTextColor={p.textMuted}
                    style={[styles.input, { color: p.text, borderColor: p.border }]}
                  />
                  <TextInput
                    value={shortName}
                    onChangeText={setShortName}
                    placeholder="Korte naam (voor schaplabels e.d.)"
                    placeholderTextColor={p.textMuted}
                    maxLength={60}
                    style={[styles.input, { color: p.text, borderColor: p.border }]}
                  />
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Omschrijving"
                    placeholderTextColor={p.textMuted}
                    multiline
                    style={[styles.input, styles.inputMultiline, styles.inputLast, { color: p.text, borderColor: p.border }]}
                  />
                </View>
              </View>

              {/* CATEGORIE & HERKOMST */}
              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Categorie & herkomst</Text>
                <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                  <FieldRow
                    icon="pricetags-outline"
                    label="Categorie"
                    value={gekozenCategorie?.naam ?? 'Kies categorie'}
                    onPress={() =>
                      toonNativeKeuze(
                        'Categorie',
                        lookups.categorieen.map((c) => ({ id: String(c.id), label: c.naam })),
                        (id) => { setCategorieId(Number(id)); setSubcategorieId(null); }
                      )
                    }
                    p={p}
                  />
                  <FieldRow
                    icon="apps-outline"
                    label="Subcategorie"
                    value={gekozenSubcategorie?.naam ?? (gekozenCategorie ? 'Kies subcategorie' : 'Kies eerst categorie')}
                    onPress={() => {
                      if (!gekozenCategorie || gekozenCategorie.subcategorieen.length === 0) return;
                      toonNativeKeuze(
                        'Subcategorie',
                        gekozenCategorie.subcategorieen.map((s) => ({ id: String(s.id), label: s.naam })),
                        (id) => setSubcategorieId(Number(id))
                      );
                    }}
                    p={p}
                  />
                  <FieldRow
                    icon="ribbon-outline"
                    label="Merk"
                    value={gekozenMerk?.naam ?? 'Kies merk'}
                    onPress={() =>
                      toonNativeKeuze(
                        'Merk',
                        lookups.merken.map((m) => ({ id: String(m.id), label: m.naam })),
                        (id) => setMerkId(Number(id))
                      )
                    }
                    p={p}
                  />
                  <FieldRow
                    icon="business-outline"
                    label="Leverancier"
                    value={gekozenLeverancier?.naam ?? 'Kies leverancier'}
                    onPress={() =>
                      toonNativeKeuze(
                        'Leverancier',
                        lookups.leveranciers.map((l) => ({ id: String(l.id), label: l.naam })),
                        (id) => setLeverancierId(Number(id))
                      )
                    }
                    last
                    p={p}
                  />
                </View>
              </View>

              {/* VERKOOP & EENHEID */}
              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Verkoop & eenheid</Text>
                <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                  <FieldRow
                    icon="cube-outline"
                    label="Eenheid"
                    value={eenheidType}
                    onPress={() =>
                      toonNativeKeuze(
                        'Eenheid',
                        EENHEID_OPTIES.map((e) => ({ id: e, label: e })),
                        setEenheidType
                      )
                    }
                    p={p}
                  />
                  <View style={styles.dubbeleRij}>
                    <TextInput
                      value={eenheidGrootte}
                      onChangeText={setEenheidGrootte}
                      placeholder="Eenheidgrootte"
                      placeholderTextColor={p.textMuted}
                      keyboardType="decimal-pad"
                      style={[styles.input, styles.inputHalf, { color: p.text, borderColor: p.border }]}
                    />
                    <TextInput
                      value={colloGrootte}
                      onChangeText={setColloGrootte}
                      placeholder="ColloGrootte"
                      placeholderTextColor={p.textMuted}
                      keyboardType="number-pad"
                      style={[styles.input, styles.inputHalf, { color: p.text, borderColor: p.border }]}
                    />
                  </View>
                  <TextInput
                    value={verkoopprijs}
                    onChangeText={setVerkoopprijs}
                    placeholder="Verkoopprijs (€)"
                    placeholderTextColor={p.textMuted}
                    keyboardType="decimal-pad"
                    style={[styles.input, styles.inputLast, { color: p.text, borderColor: p.border }]}
                  />
                </View>
              </View>

              {/* EIGENSCHAPPEN */}
              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Eigenschappen (voor alle filialen)</Text>
                <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                  <FieldRow
                    icon="snow-outline"
                    label="Opslagwijze"
                    value={OPSLAG_OPTIES.find((o) => o.id === opslag)?.label ?? 'Geen'}
                    onPress={() => toonNativeKeuze('Opslagwijze', OPSLAG_OPTIES.map((o) => ({ id: o.id, label: o.label })), (id) => setOpslag(id as Opslagwijze | ''))}
                    p={p}
                  />
                  <View style={[styles.switchRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.divider }]}>
                    <Text style={[styles.fieldValue, { color: p.text }]}>Biologisch</Text>
                    <Switch value={biologisch} onValueChange={setBiologisch} trackColor={{ true: p.accent }} />
                  </View>
                  <View style={[styles.switchRow, styles.switchRowLast]}>
                    <Text style={[styles.fieldValue, { color: p.text }]}>Uitgelicht</Text>
                    <Switch value={uitgelicht} onValueChange={setUitgelicht} trackColor={{ true: p.accent }} />
                  </View>
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
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    {!!opslaanStap && <Text style={styles.submitBtnText}>{opslaanStap}</Text>}
                  </>
                ) : (
                  <Text style={styles.submitBtnText}>Product aanmaken</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>

      <ScannerModal
        visible={scanOpen}
        isFocused={scanOpen}
        onBarcodeScanned={(code) => { setScanOpen(false); setBarcode(code); }}
        onClose={() => setScanOpen(false)}
      />
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
  fieldValue: { fontSize: 14, fontWeight: '600', marginTop: 1, fontFamily: F },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  switchRowLast: { borderBottomWidth: 0 },

  rowWithBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, margin: Spacing.md, marginBottom: 0 },
  scanBtn: { width: 42, height: 42, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },

  input: {
    borderWidth: 0.5, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: 13.5, fontFamily: F, margin: Spacing.md, marginBottom: 0,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  inputFlex: { flex: 1, margin: 0 },
  inputLast: { marginBottom: Spacing.md },
  dubbeleRij: { flexDirection: 'row', gap: Spacing.sm, marginHorizontal: Spacing.md },
  inputHalf: { flex: 1, margin: 0, marginTop: Spacing.md },

  // Foto's
  fotoRij: { flexGrow: 0 },
  fotoThumbWrap: { marginRight: Spacing.sm, position: 'relative' },
  fotoThumb: { width: 76, height: 76, borderRadius: Radius.md, borderWidth: 0.5 },
  fotoVerwijder: {
    position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  fotoToevoegen: {
    width: 76, height: 76, borderRadius: Radius.md, borderWidth: 1, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 3,
  },
  fotoToevoegenTxt: { fontSize: 9.5, fontWeight: '700', fontFamily: F },

  submitBtn: {
    borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.sm, flexDirection: 'row', gap: Spacing.sm,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, fontFamily: F },

  primaryButton: { borderRadius: Radius.md, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 13.5, fontFamily: F },
});

import ScannerModal from '@/components/scanner-modal';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, getPalette, Radius, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  ApiExpiringProduct,
  ApiProduct,
  getExpiringProducts,
  getProduct,
  getProductByPlu,
  updateProductBranch,
} from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const F = FontFamily;
type Palette = ReturnType<typeof getPalette>;
type Urgentie = 'danger' | 'warning' | 'success';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const THRESHOLD_DAYS = 5;
const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function daysUntil(tht: string): number {
  const diff = new Date(tht).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function urgentieVan(days: number): Urgentie {
  if (days <= 0) return 'danger';
  if (days <= 2) return 'warning';
  return 'success';
}

function urgentieKleur(p: Palette, urgentie: Urgentie): { fg: string; bg: string } {
  if (urgentie === 'danger') return { fg: p.danger, bg: p.dangerSoft };
  if (urgentie === 'warning') return { fg: p.warning, bg: p.warningSoft };
  return { fg: p.success, bg: p.successSoft };
}

function urgencyLabel(days: number): string {
  if (days <= 0) return 'Verlopen';
  if (days === 1) return 'Morgen';
  return `${days} dagen`;
}

/** Vult ontbrekende filiaal-velden aan met een lookup en werkt de THT bij. */
async function slaThtOp(token: string, product: ApiProduct, nieuweTht: string) {
  const f = product.filiaal;
  await updateProductBranch(token, {
    barcode: product.barcode,
    opSchap: f.opSchap,
    magazijn: f.magazijn,
    kortsteTht: nieuweTht,
    opslag: f.opslag,
    biologisch: f.biologisch,
    uitgelicht: f.uitgelicht,
    notities: f.notities,
  });
}

// ─── Pagina 0 — Scannen / zoeken (altijd eerst) ───────────────────────────────

function ScanPage({
  width,
  token,
  onOpslaan,
  onScanOpen,
  scanResult,
  onScanHandled,
  p,
}: {
  width: number;
  token: string | null;
  onOpslaan: (barcode: string, nieuweTht: string) => Promise<void>;
  onScanOpen: () => void;
  scanResult: string | null;
  onScanHandled: () => void;
  p: Palette;
}) {
  const [invoer, setInvoer] = useState('');
  const [zoekBezig, setZoekBezig] = useState(false);
  const [zoekError, setZoekError] = useState<string | null>(null);
  const [verified, setVerified] = useState<ApiProduct | null>(null);
  const [ntht, setNtht] = useState('');
  const [opslaanBezig, setOpslaanBezig] = useState(false);

  const zoek = useCallback(async (code: string) => {
    if (!token) return;
    setZoekError(null);
    setZoekBezig(true);
    try {
      const found = /^[0-9]{6}$/.test(code)
        ? await getProductByPlu(token, code).catch(() => getProduct(token, code))
        : await getProduct(token, code);
      setVerified(found);
      setNtht(found.filiaal.kortsteTht ?? '');
    } catch (e) {
      setZoekError(e instanceof Error ? e.message : `Geen product gevonden met "${code}".`);
    } finally {
      setZoekBezig(false);
    }
  }, [token]);

  // Resultaat van de camera-scanner verwerken zodra deze pagina actief is.
  useEffect(() => {
    if (scanResult) {
      setInvoer(scanResult);
      zoek(scanResult);
      onScanHandled();
    }
  }, [scanResult, zoek, onScanHandled]);

  const reset = () => {
    setVerified(null);
    setInvoer('');
    setZoekError(null);
    setNtht('');
  };

  const handleOpslaan = async () => {
    if (!verified) return;
    if (ntht !== '' && !DATE_RE.test(ntht)) {
      Alert.alert('Ongeldige datum', 'Gebruik het formaat JJJJ-MM-DD, bijv. 2025-06-15.');
      return;
    }
    setOpslaanBezig(true);
    try {
      await onOpslaan(verified.barcode, ntht);
      Alert.alert('Opgeslagen', ntht ? `THT bijgewerkt naar ${ntht}` : 'THT verwijderd.');
      reset();
    } catch (e) {
      Alert.alert('Opslaan mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
    } finally {
      setOpslaanBezig(false);
    }
  };

  if (verified) {
    const days = verified.filiaal.kortsteTht ? daysUntil(verified.filiaal.kortsteTht) : null;
    const { fg, bg } = days !== null
      ? urgentieKleur(p, urgentieVan(days))
      : { fg: p.textMuted, bg: p.surfaceAlt };
    return (
      <View style={[scanStyles.page, { width }]}>
        <View style={[scanStyles.badge, { backgroundColor: bg }]}>
          <View style={[scanStyles.badgeDot, { backgroundColor: fg }]} />
          <Text style={[scanStyles.badgeText, { color: fg }]}>{days !== null ? urgencyLabel(days) : 'Geen THT'}</Text>
        </View>

        <Text style={[scanStyles.name, { color: p.text }]} numberOfLines={2}>{verified.naam}</Text>
        <Text style={[scanStyles.sub, { color: p.textSecondary }]} numberOfLines={1}>
          {verified.barcode}{verified.filiaal.schapNaam ? ` · ${verified.filiaal.schapNaam}` : ''}
        </Text>

        <View style={[scanStyles.updateBlock, { borderColor: p.border, backgroundColor: p.surfaceAlt }]}>
          <View style={scanStyles.currentRow}>
            <Ionicons name="calendar-outline" size={13} color={p.textMuted} />
            <Text style={[scanStyles.currentText, { color: p.textMuted }]}>
              Huidig: <Text style={{ color: fg, fontWeight: '700' }}>{verified.filiaal.kortsteTht ?? '—'}</Text>
            </Text>
          </View>

          <TextInput
            value={ntht}
            onChangeText={setNtht}
            placeholder="Nieuwe THT: JJJJ-MM-DD (optioneel)"
            placeholderTextColor={p.textMuted}
            editable={!opslaanBezig}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            returnKeyType="done"
            onSubmitEditing={handleOpslaan}
            style={[scanStyles.input, { borderColor: p.border, backgroundColor: p.bg, color: p.text }]}
          />

          <TouchableOpacity
            style={[scanStyles.saveBtn, { backgroundColor: p.accent, opacity: opslaanBezig ? 0.7 : 1 }]}
            onPress={handleOpslaan}
            disabled={opslaanBezig}
          >
            {opslaanBezig ? <ActivityIndicator size="small" color="#fff" /> : <Text style={scanStyles.saveBtnText}>Opslaan</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={reset} disabled={opslaanBezig} style={scanStyles.resetBtn}>
          <Ionicons name="arrow-undo-outline" size={13} color={p.textSecondary} />
          <Text style={[scanStyles.resetText, { color: p.textSecondary }]}>Opnieuw zoeken</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[scanStyles.page, { width }]}>
      <View style={[scanStyles.iconWrap, { backgroundColor: p.accentSoft }]}>
        <Ionicons name="scan-outline" size={26} color={p.accent} />
      </View>
      <Text style={[scanStyles.title, { color: p.text }]}>Artikel controleren</Text>
      <Text style={[scanStyles.titleSub, { color: p.textSecondary }]}>
        Scan de barcode, of vul de barcode/het artikelnummer handmatig in.
      </Text>

      <TouchableOpacity
        style={[scanStyles.scanBlock, { backgroundColor: p.accent }]}
        onPress={onScanOpen}
      >
        <Ionicons name="camera-outline" size={19} color="#fff" />
        <Text style={scanStyles.scanBlockText}>Scan barcode</Text>
      </TouchableOpacity>

      <View style={scanStyles.dividerRow}>
        <View style={[scanStyles.dividerLine, { backgroundColor: p.divider }]} />
        <Text style={[scanStyles.dividerLabel, { color: p.textMuted }]}>of</Text>
        <View style={[scanStyles.dividerLine, { backgroundColor: p.divider }]} />
      </View>

      <TextInput
        placeholder="Barcode of 6-cijferig artikelnummer"
        placeholderTextColor={p.textMuted}
        keyboardType="number-pad"
        value={invoer}
        editable={!zoekBezig}
        onChangeText={(v) => { setInvoer(v); setZoekError(null); }}
        style={[scanStyles.input, { borderColor: p.border, backgroundColor: p.surfaceAlt, color: p.text, width: '100%', maxWidth: 340 }]}
        returnKeyType="done"
        onSubmitEditing={() => invoer.trim() && zoek(invoer.trim())}
      />

      {!!zoekError && (
        <View style={[scanStyles.errorBox, { backgroundColor: p.dangerSoft }]}>
          <Ionicons name="alert-circle-outline" size={14} color={p.danger} />
          <Text style={[scanStyles.errorText, { color: p.danger }]}>{zoekError}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[scanStyles.primaryBtn, { borderColor: p.accent, opacity: zoekBezig ? 0.7 : 1 }]}
        onPress={() => invoer.trim() ? zoek(invoer.trim()) : setZoekError('Vul een barcode of artikelnummer in.')}
        disabled={zoekBezig}
      >
        {zoekBezig ? <ActivityIndicator size="small" color={p.accent} /> : <Text style={[scanStyles.primaryBtnText, { color: p.accent }]}>Controleren</Text>}
      </TouchableOpacity>
    </View>
  );
}

const scanStyles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  title: { fontSize: 18, fontWeight: '700', fontFamily: F },
  titleSub: { fontSize: 12, fontFamily: F, textAlign: 'center', marginTop: 4, marginBottom: Spacing.lg, lineHeight: 17 },

  scanBlock: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    borderRadius: Radius.md, paddingVertical: 15, width: '100%', maxWidth: 340,
  },
  scanBlockText: { fontSize: 14, fontWeight: '700', fontFamily: F, color: '#fff' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, width: '100%', maxWidth: 340, marginVertical: Spacing.md },
  dividerLine: { flex: 1, height: 0.5 },
  dividerLabel: { fontSize: 10, fontFamily: F, fontWeight: '600' },

  input: { borderWidth: 0.5, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 11, fontSize: 13, fontFamily: F },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2, borderRadius: Radius.md, padding: Spacing.sm + 2, width: '100%', maxWidth: 340, marginTop: Spacing.sm },
  errorText: { flex: 1, fontSize: 11, fontFamily: F, fontWeight: '600' },

  primaryBtn: { paddingVertical: 11, borderRadius: Radius.md, alignItems: 'center', width: '100%', maxWidth: 340, marginTop: Spacing.sm, borderWidth: 1.5 },
  primaryBtnText: { fontWeight: '700', fontFamily: F, fontSize: 13 },

  // Gevonden-product weergave (deelt de meeste stijlen met ExpiringPage)
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill, gap: 5, marginBottom: Spacing.sm + 2 },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700', fontFamily: F },
  name: { fontSize: 18, fontWeight: '700', fontFamily: F, textAlign: 'center', lineHeight: 23 },
  sub: { fontSize: 12, fontFamily: F, marginTop: 3, marginBottom: Spacing.lg },
  updateBlock: { width: '100%', maxWidth: 340, borderWidth: 0.5, borderRadius: Radius.lg, padding: Spacing.md + 2, gap: Spacing.sm },
  currentRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  currentText: { fontSize: 11.5, fontFamily: F },
  saveBtn: { paddingVertical: 10, borderRadius: Radius.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontFamily: F, fontSize: 13 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.md },
  resetText: { fontSize: 12, fontFamily: F, fontWeight: '600' },
});

// ─── Verlopende producten — full-screen swipe-pagina's ────────────────────────

function ExpiringPage({
  product,
  width,
  onOpslaan,
  p,
}: {
  product: ApiExpiringProduct;
  width: number;
  onOpslaan: (barcode: string, nieuweTht: string) => Promise<void>;
  p: Palette;
}) {
  const [ntht, setNtht] = useState(product.kortsteTht);
  const [bezig, setBezig] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = daysUntil(product.kortsteTht);
  const urgentie = urgentieVan(days);
  const { fg, bg } = urgentieKleur(p, urgentie);

  const handleOpslaan = async () => {
    if (!DATE_RE.test(ntht)) {
      setError('Gebruik het formaat JJJJ-MM-DD.');
      return;
    }
    setError(null);
    setBezig(true);
    try {
      await onOpslaan(product.barcode, ntht);
      Alert.alert('Opgeslagen', `THT bijgewerkt naar ${ntht}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt.');
    } finally {
      setBezig(false);
    }
  };

  return (
    <View style={[pageStyles.page, { width }]}>
      <View style={[pageStyles.badge, { backgroundColor: bg }]}>
        <View style={[pageStyles.badgeDot, { backgroundColor: fg }]} />
        <Text style={[pageStyles.badgeText, { color: fg }]}>{urgencyLabel(days)}</Text>
      </View>

      <Text style={[pageStyles.name, { color: p.text }]} numberOfLines={2}>
        {product.naam}
      </Text>
      <Text style={[pageStyles.sub, { color: p.textSecondary }]} numberOfLines={1}>
        {product.barcode}{product.pluCode ? ` · art. ${product.pluCode}` : ''}
      </Text>

      <View style={[pageStyles.updateBlock, { borderColor: p.border, backgroundColor: p.surfaceAlt }]}>
        <View style={pageStyles.currentRow}>
          <Ionicons name="calendar-outline" size={13} color={p.textMuted} />
          <Text style={[pageStyles.currentText, { color: p.textMuted }]}>
            Huidig: <Text style={{ color: fg, fontWeight: '700' }}>{product.kortsteTht}</Text>
          </Text>
        </View>

        <TextInput
          value={ntht}
          onChangeText={(v) => { setNtht(v); setError(null); }}
          placeholder="JJJJ-MM-DD"
          placeholderTextColor={p.textMuted}
          editable={!bezig}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          returnKeyType="done"
          onSubmitEditing={handleOpslaan}
          style={[pageStyles.input, { borderColor: p.border, backgroundColor: p.bg, color: p.text }]}
        />

        {!!error && <Text style={[pageStyles.error, { color: p.danger }]}>{error}</Text>}

        <TouchableOpacity
          style={[pageStyles.saveBtn, { backgroundColor: p.accent, opacity: bezig ? 0.7 : 1 }]}
          onPress={handleOpslaan}
          disabled={bezig}
        >
          {bezig ? <ActivityIndicator size="small" color="#fff" /> : <Text style={pageStyles.saveBtnText}>Opslaan</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const pageStyles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  badge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: Radius.pill, gap: 5, marginBottom: Spacing.sm + 2,
  },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700', fontFamily: F },
  name: { fontSize: 18, fontWeight: '700', fontFamily: F, textAlign: 'center', lineHeight: 23 },
  sub: { fontSize: 12, fontFamily: F, marginTop: 3, marginBottom: Spacing.lg },
  updateBlock: {
    width: '100%', maxWidth: 340, borderWidth: 0.5, borderRadius: Radius.lg,
    padding: Spacing.md + 2, gap: Spacing.sm,
  },
  currentRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  currentText: { fontSize: 11.5, fontFamily: F },
  input: {
    borderWidth: 0.5, borderRadius: Radius.md, paddingHorizontal: Spacing.md,
    paddingVertical: 9, fontSize: 13, fontFamily: F,
  },
  error: { fontSize: 11, fontFamily: F, fontWeight: '600' },
  saveBtn: { paddingVertical: 10, borderRadius: Radius.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontFamily: F, fontSize: 13 },
});

// ─── Pagination Dots ──────────────────────────────────────────────────────────

function PaginationDots({ count, activeIndex, p }: { count: number; activeIndex: number; p: Palette }) {
  if (count <= 1) return null;
  return (
    <View style={dotStyles.row} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            dotStyles.dot,
            { backgroundColor: i === activeIndex ? p.accent : p.border, width: i === activeIndex ? 16 : 5 },
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { position: 'absolute', bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { height: 5, borderRadius: 3 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ThtScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const p = getPalette(isDark);
  const { token } = useAuth();
  const { width } = Dimensions.get('window');

  const [expiring, setExpiring] = useState<ApiExpiringProduct[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);

  const [scanOpen, setScanOpen] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const laadExpiring = useCallback(async () => {
    if (!token) return;
    try {
      setExpiring(await getExpiringProducts(token, THRESHOLD_DAYS));
    } catch {
      // Stil falen — scannen/zoeken blijft altijd bruikbaar.
    }
  }, [token]);

  useEffect(() => { laadExpiring(); }, [laadExpiring]);

  const totaalPaginas = 1 + expiring.length;

  useEffect(() => {
    setActiveIndex((i) => Math.min(i, totaalPaginas - 1));
  }, [totaalPaginas]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const handleOpslaan = useCallback(async (barcode: string, nieuweTht: string) => {
    if (!token) throw new Error('Niet ingelogd.');
    const found = await getProduct(token, barcode);
    await slaThtOp(token, found, nieuweTht);
    await laadExpiring();
  }, [token, laadExpiring]);

  return (
    <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
      <ScreenHeader title="THT Controle" />

      <View style={styles.content}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          style={styles.pager}
          keyboardShouldPersistTaps="handled"
        >
          <ScanPage
            width={width}
            token={token}
            onOpslaan={handleOpslaan}
            onScanOpen={() => setScanOpen(true)}
            scanResult={scanResult}
            onScanHandled={() => setScanResult(null)}
            p={p}
          />
          {expiring.map((product) => (
            <ExpiringPage key={product.barcode} product={product} width={width} onOpslaan={handleOpslaan} p={p} />
          ))}
        </ScrollView>
        <PaginationDots count={totaalPaginas} activeIndex={activeIndex} p={p} />
      </View>

      <ScannerModal
        visible={scanOpen}
        isFocused={scanOpen}
        onBarcodeScanned={(code) => { setScanOpen(false); setScanResult(code); }}
        onClose={() => setScanOpen(false)}
      />
    </ThemedView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  pager: { flex: 1 },
});

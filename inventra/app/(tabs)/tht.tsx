import { DrawerMenu } from '@/components/drawer-menu';
import ScannerModal from '@/components/scanner-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { products, updateProduct } from '@/data/products';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const THRESHOLD_DAYS = 5;

function daysUntil(tht: string): number {
  const diff = new Date(tht).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function urgencyColor(days: number): string {
  if (days <= 0) return '#E24B4A';
  if (days <= 2) return '#BA7517';
  return '#639922';
}

function urgencyLabel(days: number): string {
  if (days <= 0) return 'Verlopen';
  if (days === 1) return 'Morgen';
  return `${days} dagen`;
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  isActive,
  width,
  surface,
  border,
  textPrimary,
  textSecondary,
}: {
  product: ReturnType<typeof Object.values<any>>[0];
  isActive: boolean;
  width: number;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
}) {
  const days = daysUntil(product.tht);
  const color = urgencyColor(days);
  const label = urgencyLabel(days);

  return (
    <View style={[cardStyles.page, { width }]}>
      <View
        style={[
          cardStyles.card,
          {
            backgroundColor: surface,
            borderColor: isActive ? color : border,
            borderWidth: isActive ? 1.5 : 0.5,
          },
        ]}
      >
        {/* Urgency badge */}
        <View style={[cardStyles.badge, { backgroundColor: color + '14' }]}>
          <View style={[cardStyles.badgeDot, { backgroundColor: color }]} />
          <Text style={[cardStyles.badgeText, { color }]}>{label}</Text>
        </View>

        <Text style={[cardStyles.name, { color: textPrimary }]} numberOfLines={2}>
          {product.name}
        </Text>

        <View style={cardStyles.metaRow}>
          <View style={cardStyles.metaItem}>
            <Text style={[cardStyles.metaLabel, { color: textSecondary }]}>Art.nr</Text>
            <Text style={[cardStyles.metaValue, { color: textPrimary }]}>
              {product.articleNumber ?? '—'}
            </Text>
          </View>
          <View style={cardStyles.metaItem}>
            <Text style={[cardStyles.metaLabel, { color: textSecondary }]}>Barcode</Text>
            <Text style={[cardStyles.metaValue, { color: textPrimary }]}>{product.barcode}</Text>
          </View>
          <View style={cardStyles.metaItem}>
            <Text style={[cardStyles.metaLabel, { color: textSecondary }]}>THT datum</Text>
            <Text style={[cardStyles.metaValue, { color, fontWeight: '600' }]}>{product.tht}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  page: {
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 20,
    padding: 20,
    width: '100%',
    gap: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 5,
  },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '500', fontFamily: 'Montserrat' },
  name: { fontSize: 18, fontWeight: '500', fontFamily: 'Montserrat', lineHeight: 24 },
  metaRow: { flexDirection: 'row', gap: 18, flexWrap: 'wrap' },
  metaItem: { gap: 2 },
  metaLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaValue: { fontSize: 13, fontFamily: 'Montserrat', fontWeight: '500' },
});

// ─── Pagination Dots ──────────────────────────────────────────────────────────

function PaginationDots({
  count,
  activeIndex,
  tint,
  inactive,
}: {
  count: number;
  activeIndex: number;
  tint: string;
  inactive: string;
}) {
  if (count <= 1) return null;
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            dotStyles.dot,
            {
              backgroundColor: i === activeIndex ? tint : inactive,
              width: i === activeIndex ? 16 : 5,
            },
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  dot: { height: 5, borderRadius: 3 },
});

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ textSecondary }: { textSecondary: string }) {
  return (
    <View style={emptyStyles.wrap}>
      <View style={emptyStyles.iconWrap}>
        <Text style={emptyStyles.emoji}>✓</Text>
      </View>
      <Text style={[emptyStyles.title, { color: textSecondary }]}>Alles in orde</Text>
      <Text style={[emptyStyles.sub, { color: textSecondary }]}>
        Geen producten verlopen binnen {THRESHOLD_DAYS} dagen.
      </Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 40,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#63992218',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emoji: { fontSize: 24, color: '#639922' },
  title: { fontSize: 16, fontWeight: '500', fontFamily: 'Montserrat' },
  sub: {
    fontSize: 12,
    fontFamily: 'Montserrat',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 18,
  },
});

// ─── Divider Row ──────────────────────────────────────────────────────────────

function DividerRow({ border, textSecondary }: { border: string; textSecondary: string }) {
  return (
    <View style={divStyles.row}>
      <View style={[divStyles.line, { backgroundColor: border }]} />
      <Text style={[divStyles.label, { color: textSecondary }]}>of</Text>
      <View style={[divStyles.line, { backgroundColor: border }]} />
    </View>
  );
}

const divStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  line: { flex: 1, height: 0.5 },
  label: { fontSize: 10, fontFamily: 'Montserrat', fontWeight: '500' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ThtScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // ── Colors ───────────────────────────────────────────────────────────────
  const surface       = isDark ? '#2c2c2e' : '#ffffff';
  const pageBg        = isDark ? '#1c1c1e' : '#f2f2f7';
  const textPrimary   = isDark ? '#ffffff' : '#1a1a1a';
  const textSecondary = isDark ? '#8e8e93' : '#6c6c70';
  const border        = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const tint          = '#534AB7';
  const inputBg       = isDark ? '#3a3a3c' : '#f8f8f8';
  const inactive      = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';

  // ── State ────────────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen]           = useState(false);
  const [scanOpen, setScanOpen]               = useState(false);
  const [verifyBarcode, setVerifyBarcode]     = useState('');
  const [verifyArticle, setVerifyArticle]     = useState('');
  const [verifiedProduct, setVerifiedProduct] = useState<ReturnType<typeof Object.values<any>>[0] | null>(null);
  const [verifyError, setVerifyError]         = useState<string | null>(null);
  const [newTht, setNewTht]                   = useState('');
  const [activeIndex, setActiveIndex]         = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const { width } = Dimensions.get('window');

  // ── Derived data ─────────────────────────────────────────────────────────
  const threshold = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + THRESHOLD_DAYS);
    return d;
  }, []);

  const expiring = useMemo(() => {
    return Object.values(products)
      .filter((p) => {
        if (!p.tht || p.tht === 'n.v.t.') return false;
        return new Date(p.tht) <= threshold;
      })
      .sort((a, b) => new Date(a.tht).getTime() - new Date(b.tht).getTime());
  }, [threshold]);

  const expiredCount = useMemo(
    () => expiring.filter((p) => daysUntil(p.tht) <= 0).length,
    [expiring],
  );
  const urgentCount = useMemo(
    () => expiring.filter((p) => daysUntil(p.tht) > 0).length,
    [expiring],
  );

  // ── Scroll to first card on mount ────────────────────────────────────────
  useEffect(() => {
    if (expiring.length > 0) {
      setActiveIndex(0);
      setTimeout(() => scrollRef.current?.scrollTo({ x: 0, animated: false }), 50);
    }
  }, [expiring]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const scrollToProduct = (barcode: string) => {
    const idx = expiring.findIndex((e) => e.barcode === barcode);
    if (idx >= 0) {
      setActiveIndex(idx);
      scrollRef.current?.scrollTo({ x: idx * width, animated: true });
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleVerify = () => {
    setVerifyError(null);
    const barcodeInput = verifyBarcode.trim();
    const articleInput = verifyArticle.trim();

    if (!barcodeInput && !articleInput) {
      setVerifyError('Vul de barcode of het artikelnummer in.');
      return;
    }

    if (barcodeInput) {
      const found = products[barcodeInput];
      if (!found) {
        setVerifyError(`Geen product gevonden met barcode "${barcodeInput}".`);
        return;
      }
      setVerifiedProduct(found);
      setNewTht(found.tht === 'n.v.t.' ? '' : found.tht);
      scrollToProduct(found.barcode);
      return;
    }

    if (articleInput) {
      if (!/^[0-9]{6}$/.test(articleInput)) {
        setVerifyError('Artikelnummer moet precies 6 cijfers bevatten.');
        return;
      }
      const found = Object.values(products).find((p) => p.articleNumber === articleInput);
      if (!found) {
        setVerifyError(`Geen product gevonden met artikelnummer "${articleInput}".`);
        return;
      }
      setVerifiedProduct(found);
      setNewTht(found.tht === 'n.v.t.' ? '' : found.tht);
      scrollToProduct(found.barcode);
    }
  };

  const handleScan = (code: string) => {
    setScanOpen(false);
    setVerifyError(null);
    const found = products[code] ?? Object.values(products).find((p) => p.articleNumber === code);
    if (!found) {
      setVerifyError(`Geen product gevonden met gescande code "${code}".`);
      return;
    }
    setVerifiedProduct(found);
    setVerifyBarcode(code);
    setVerifyArticle('');
    setNewTht(found.tht === 'n.v.t.' ? '' : found.tht);
    scrollToProduct(found.barcode);
  };

  const handleSaveTht = () => {
    if (!verifiedProduct) return;
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(newTht)) {
      Alert.alert('Ongeldige datum', 'Gebruik het formaat JJJJ-MM-DD, bijv. 2025-06-15.');
      return;
    }
    verifiedProduct.tht = newTht;
    updateProduct(verifiedProduct);
    Alert.alert('Opgeslagen', `THT bijgewerkt naar ${newTht}`);
    setVerifiedProduct(null);
    setVerifyBarcode('');
    setVerifyArticle('');
    setNewTht('');
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    const p = expiring[idx];
    if (p) setActiveIndex(idx);
  };

  const handleReset = () => {
    setVerifiedProduct(null);
    setVerifyBarcode('');
    setVerifyArticle('');
    setVerifyError(null);
    setNewTht('');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ThemedView style={[styles.container, { backgroundColor: pageBg }]}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: pageBg }}>
        <View style={[styles.header, { backgroundColor: pageBg }]}>
          <TouchableOpacity
            onPress={() => setDrawerOpen(true)}
            style={styles.hamburgerBtn}
            accessibilityLabel="Open menu"
          >
            <View style={[styles.bar, { backgroundColor: textPrimary }]} />
            <View style={[styles.bar, { backgroundColor: textPrimary }]} />
            <View style={[styles.bar, { backgroundColor: textPrimary, width: 12 }]} />
          </TouchableOpacity>

          <ThemedText style={styles.headerTitle}>THT Controle</ThemedText>

          <View
            style={[
              styles.countBadge,
              { backgroundColor: expiredCount > 0 ? '#E24B4A' : tint },
            ]}
          >
            <Text style={styles.countBadgeText}>{expiring.length}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Summary strip */}
      {expiring.length > 0 && (
        <View style={[styles.summaryCard, { backgroundColor: surface, borderColor: border }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#E24B4A' }]}>{expiredCount}</Text>
            <Text style={[styles.summaryLabel, { color: textSecondary }]}>Verlopen</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#BA7517' }]}>{urgentCount}</Text>
            <Text style={[styles.summaryLabel, { color: textSecondary }]}>Bijna verlopen</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: textPrimary }]}>{expiring.length}</Text>
            <Text style={[styles.summaryLabel, { color: textSecondary }]}>Totaal</Text>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.content, { backgroundColor: pageBg }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cards swiper */}
        {expiring.length === 0 ? (
          <EmptyState textSecondary={textSecondary} />
        ) : (
          <View style={styles.swiperWrapper}>
            <ScrollView
              ref={(r) => (scrollRef.current = r)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={[styles.swiper, { width }]}
              onMomentumScrollEnd={handleScroll}
              contentContainerStyle={{ alignItems: 'center' }}
            >
              {expiring.map((p, i) => (
                <ProductCard
                  key={p.barcode}
                  product={p}
                  isActive={i === activeIndex}
                  width={width}
                  surface={surface}
                  border={border}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                />
              ))}
            </ScrollView>

            <PaginationDots
              count={expiring.length}
              activeIndex={activeIndex}
              tint={tint}
              inactive={inactive}
            />
          </View>
        )}

        {/* ── Stap 1: Verificatie ─────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>
            Stap 1 — Verificeer artikel
          </Text>
          <Text style={[styles.sectionSub, { color: textSecondary }]}>
            Scan, barcode of artikelnummer — gebruik één methode.
          </Text>

          {/* Scan knop */}
          <TouchableOpacity
            style={[styles.scanBlock, { backgroundColor: tint + '12', borderColor: tint }]}
            onPress={() => setScanOpen(true)}
            accessibilityLabel="Scan barcode"
          >
            <Text style={[styles.scanIcon]}>📷</Text>
            <Text style={[styles.scanBlockText, { color: tint }]}>Scan barcode</Text>
          </TouchableOpacity>

          <DividerRow border={border} textSecondary={textSecondary} />

          {/* Barcode invoer */}
          <TextInput
            placeholder="Barcode (numeriek)"
            placeholderTextColor={textSecondary}
            keyboardType="number-pad"
            value={verifyBarcode}
            onChangeText={(v) => {
              setVerifyBarcode(v);
              setVerifyArticle('');
              setVerifyError(null);
              setVerifiedProduct(null);
            }}
            style={[
              styles.input,
              { borderColor: border, backgroundColor: inputBg, color: textPrimary },
            ]}
            returnKeyType="done"
            onSubmitEditing={handleVerify}
          />

          <DividerRow border={border} textSecondary={textSecondary} />

          {/* Artikelnummer invoer */}
          <TextInput
            placeholder="6-cijferig artikelnummer"
            placeholderTextColor={textSecondary}
            keyboardType="number-pad"
            value={verifyArticle}
            onChangeText={(v) => {
              setVerifyArticle(v);
              setVerifyBarcode('');
              setVerifyError(null);
              setVerifiedProduct(null);
            }}
            style={[
              styles.input,
              { borderColor: border, backgroundColor: inputBg, color: textPrimary },
            ]}
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={handleVerify}
          />

          {/* Foutmelding */}
          {verifyError && (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: '#E24B4A0f', borderColor: '#E24B4A50' },
              ]}
            >
              <Text style={styles.errorText}>⚠️ {verifyError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: tint }]}
            onPress={handleVerify}
            accessibilityLabel="Controleer artikel"
          >
            <Text style={styles.primaryBtnText}>Controleer artikel</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stap 2: THT bijwerken ────────────────────────────────────────── */}
        {verifiedProduct && (
          <View
            style={[
              styles.card,
              { backgroundColor: surface, borderColor: tint, borderWidth: 1.5 },
            ]}
          >
            <View style={styles.verifiedHeader}>
              <View style={[styles.checkCircle, { backgroundColor: '#63992218' }]}>
                <Text style={{ fontSize: 16, color: '#639922' }}>✓</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: textPrimary }]}>
                  Stap 2 — THT bijwerken
                </Text>
                <Text
                  style={[styles.verifiedName, { color: textSecondary }]}
                  numberOfLines={1}
                >
                  {verifiedProduct.name}
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionSub, { color: textSecondary }]}>
              Nieuwe THT (JJJJ-MM-DD)
            </Text>
            <TextInput
              value={newTht}
              onChangeText={setNewTht}
              placeholder="2025-06-30"
              placeholderTextColor={textSecondary}
              style={[
                styles.input,
                { borderColor: border, backgroundColor: inputBg, color: textPrimary },
              ]}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={handleSaveTht}
            />

            <View style={styles.saveRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: border }]}
                onPress={handleReset}
              >
                <Text style={[styles.cancelBtnText, { color: textSecondary }]}>Annuleren</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: tint }]}
                onPress={handleSaveTht}
              >
                <Text style={styles.saveBtnText}>Opslaan</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <ScannerModal
        visible={scanOpen}
        isFocused={scanOpen}
        onBarcodeScanned={handleScan}
        onClose={() => setScanOpen(false)}
      />
    </ThemedView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  hamburgerBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 4,
  },
  bar: { height: 1.5, borderRadius: 2, width: 18 },
  headerTitle: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.1,
    fontFamily: 'Montserrat',
  },
  countBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'Montserrat',
  },

  // Summary card
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 0.5,
    paddingVertical: 14,
  },
  summaryItem: { alignItems: 'center', gap: 2 },
  summaryValue: { fontSize: 20, fontWeight: '500', fontFamily: 'Montserrat' },
  summaryLabel: { fontSize: 10, fontFamily: 'Montserrat', textTransform: 'uppercase', letterSpacing: 0.3 },
  summaryDivider: { width: 0.5, marginVertical: 4 },

  // Content scroll
  content: { paddingBottom: 40, gap: 10 },

  // Swiper
  swiperWrapper: { marginTop: 6 },
  swiper: { height: 210 },

  // Cards (controls)
  card: {
    marginHorizontal: 14,
    borderRadius: 16,
    borderWidth: 0.5,
    padding: 16,
    gap: 10,
  },
  sectionTitle: { fontSize: 13, fontWeight: '500', fontFamily: 'Montserrat' },
  sectionSub: { fontSize: 11, fontFamily: 'Montserrat', lineHeight: 16 },

  // Scan block
  scanBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingVertical: 13,
  },
  scanIcon: { fontSize: 18 },
  scanBlockText: { fontSize: 13, fontWeight: '500', fontFamily: 'Montserrat' },

  // Input
  input: {
    borderWidth: 0.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: 'Montserrat',
  },

  // Error
  errorBox: { borderWidth: 0.5, borderRadius: 10, padding: 10 },
  errorText: { fontSize: 11, fontFamily: 'Montserrat', fontWeight: '500', color: '#A32D2D' },

  // Primary button
  primaryBtn: {
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '500',
    fontFamily: 'Montserrat',
    fontSize: 13,
  },

  // Verified header
  verifiedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  verifiedName: { fontSize: 11, fontFamily: 'Montserrat', marginTop: 1 },

  // Save row
  saveRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontWeight: '500', fontFamily: 'Montserrat', fontSize: 12 },
  saveBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '500', fontFamily: 'Montserrat', fontSize: 13 },
});
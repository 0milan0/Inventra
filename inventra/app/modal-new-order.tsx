import ScannerModal from '@/components/scanner-modal';
import { ThemedView } from '@/components/themed-view';
import { products } from '@/data/products';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

type Quantities = Record<string, number>;

// ─── Suppliers mapping ────────────────────────────────────────────────────────

const SUPPLIER_CONFIG: Record<string, { label: string; icon: string; iconBg: string; accent: string }> = {
  'Unilever': { label: 'Unilever', icon: '🧴', iconBg: '#EEEDFE', accent: '#534AB7' },
  'FrieslandCampina': { label: 'FrieslandCampina', icon: '🥛', iconBg: '#FAEEDA', accent: '#EF9F27' },
  'Danone': { label: 'Danone', icon: '🥛', iconBg: '#FAEEDA', accent: '#EF9F27' },
  'Coca-Cola Europacific': { label: 'Coca-Cola', icon: '🥤', iconBg: '#FFE5E5', accent: '#D32F2F' },
  'Nestlé': { label: 'Nestlé', icon: '🍫', iconBg: '#F5E6D3', accent: '#8B7355' },
  'Balea': { label: 'Balea', icon: '🧼', iconBg: '#E8F5E9', accent: '#4CAF50' },
  'Stelz': { label: 'Stelz', icon: '🥃', iconBg: '#FFF3E0', accent: '#FF9800' },
};

const SUPPLIERS = Object.entries(SUPPLIER_CONFIG).map(([key, config]) => ({
  key,
  ...config,
}));

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ModalNewOrder() {
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Quantities>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const searchRef = useRef<TextInput>(null);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // ── Handle barcode scan ────────────────────────────────────────────────────

  const handleBarcodeScan = (barcode: string) => {
    setSearchQuery(barcode);
  };

  const openScanner = () => {
    setScannerOpen(true);
  };

  const surface       = isDark ? '#2c2c2e' : '#ffffff';
  const pageBg        = isDark ? '#1c1c1e' : '#f2f2f7';
  const textPrimary   = isDark ? '#ffffff' : '#1a1a1a';
  const textSecondary = isDark ? '#aaaaaa' : '#666666';
  const border        = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  // ── Filtered products ──────────────────────────────────────────────────────

  const allProducts = Object.values(products);

  const filtered = (() => {
    const base = selectedSupplier
      ? allProducts.filter((p) => p.meta?.supplier === selectedSupplier)
      : allProducts;
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.meta?.brand.toLowerCase().includes(q) ||
        p.barcode.includes(q)
    );
  })();

  // ── Quantity helpers ───────────────────────────────────────────────────────

  const changeQty = (barcode: string, delta: number) =>
    setQuantities((prev) => ({ ...prev, [barcode]: Math.max(0, (prev[barcode] ?? 0) + delta) }));

  const totalItems = Object.values(quantities).reduce((s, v) => s + v, 0);
  const totalPrice = allProducts.reduce((s, p) => s + (p.price ?? 0) * (quantities[p.barcode] ?? 0), 0);

  // ── Place order ────────────────────────────────────────────────────────────

  const handlePlace = () => {
    if (totalItems === 0) return;

    const summaryItems = allProducts.reduce((acc: any[], p) => {
      const qty = quantities[p.barcode] ?? 0;
      if (qty > 0) acc.push({ name: p.name, qty, price: p.price ?? 0 });
      return acc;
    }, []);

    const itemsParam = encodeURIComponent(JSON.stringify(summaryItems));

    router.replace({
      pathname: '/modal-order-contact' as any,
      params: {
        items: itemsParam,
        totalItems: String(totalItems),
        totalPrice: String(totalPrice),
      },
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ThemedView style={[styles.container, { backgroundColor: pageBg }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: pageBg, borderBottomColor: border }]}>
          <Link href="/orders-screen" dismissTo style={styles.closeBtn}>
            <View style={[styles.closeBtnInner, { backgroundColor: isDark ? '#2c2c2e' : '#EEEDFE' }]}>
              <Text style={styles.closeBtnText}>✕</Text>
            </View>
          </Link>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Nieuwe bestelling</Text>
          <View style={{ width: 80 }} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
        >
          {/* Supplier filter chips */}
          <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 8 }}>
            <Text style={[styles.subLabel, { color: textSecondary }]}>Leverancier</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
                {/* "Alle" chip */}
                <TouchableOpacity
                  style={[
                    styles.chip,
                    {
                      borderColor: selectedSupplier === null ? '#534AB7' : border,
                      backgroundColor: selectedSupplier === null ? '#EEEDFE' : 'transparent',
                    },
                  ]}
                  onPress={() => setSelectedSupplier(null)}
                >
                  <Text style={[styles.chipText, { color: selectedSupplier === null ? '#534AB7' : textSecondary }]}>
                    Alle
                  </Text>
                </TouchableOpacity>

                {SUPPLIERS.map((s) => {
                  const active = selectedSupplier === s.key;
                  return (
                    <TouchableOpacity
                      key={s.key}
                      style={[
                        styles.chip,
                        {
                          borderColor: active ? s.accent : border,
                          backgroundColor: active ? s.iconBg : 'transparent',
                          flexDirection: 'row',
                          gap: 4,
                        },
                      ]}
                      onPress={() => setSelectedSupplier(active ? null : s.key)}
                    >
                      <Text style={{ fontSize: 12 }}>{s.icon}</Text>
                      <Text style={[styles.chipText, { color: active ? s.accent : textSecondary }]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Search bar */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
            <View style={[styles.searchBar, { backgroundColor: surface, borderColor: border }]}>
              <Text style={{ fontSize: 15, color: textSecondary }}>🔍</Text>
              <TextInput
                ref={searchRef}
                style={[styles.searchInput, { color: textPrimary }]}
                placeholder="Zoek op merk, productnaam of barcode…"
                placeholderTextColor={textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => { setSearchQuery(''); searchRef.current?.focus(); }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={{ fontSize: 13, color: textSecondary }}>✕</Text>
                </TouchableOpacity>
              )}
              {/* Camera icon */}
              <TouchableOpacity style={[styles.scannerButton, { backgroundColor: surface, borderColor: border }]} onPress={openScanner} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                {/* Camera body */}
                <View style={[styles.camBody, { borderColor: '#534AB7' }]}>
                  <View style={[styles.camLens, { borderColor: '#534AB7' }]} />
                </View>
                <View style={[styles.camNotch, { backgroundColor: '#534AB7' }]} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Result count */}
          <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
            <Text style={[styles.resultCount, { color: textSecondary }]}>
              {filtered.length === 0
                ? 'Geen producten gevonden'
                : `${filtered.length} product${filtered.length !== 1 ? 'en' : ''}`}
            </Text>
          </View>

          {/* Product cards */}
          <View style={{ paddingHorizontal: 16, gap: 8 }}>
            {filtered.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: surface, borderColor: border }]}>
                <Text style={{ fontSize: 32 }}>🔍</Text>
                <Text style={[styles.emptyTitle, { color: textPrimary }]}>Geen resultaten</Text>
                <Text style={[styles.emptyBody, { color: textSecondary }]}>
                  Probeer een andere zoekterm of leverancier.
                </Text>
              </View>
            ) : (
              filtered.map((p) => {
                const qty = quantities[p.barcode] ?? 0;
                const supplierKey = p.meta?.supplier || '';
                const sup = SUPPLIER_CONFIG[supplierKey];
                const supData = sup ? { key: supplierKey, ...sup } : { key: '', label: 'Onbekend', icon: '📦', iconBg: '#F0F0F0', accent: '#999' };

                return (
                  <View
                    key={p.barcode}
                    style={[
                      styles.productCard,
                      {
                        backgroundColor: surface,
                        borderColor: qty > 0 ? supData.accent + '55' : border,
                      },
                    ]}
                  >
                    {/* Left */}
                    <View style={{ flex: 1, gap: 2 }}>
                      {/* Supplier badge — only shown when "Alle" is active */}
                      {!selectedSupplier && (
                        <View style={[styles.supplierBadge, { backgroundColor: supData.iconBg }]}>
                          <Text style={{ fontSize: 10 }}>{supData.icon}</Text>
                          <Text style={[styles.supplierBadgeText, { color: supData.accent }]}>
                            {supData.label}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.productBrand, { color: textSecondary }]}>
                        {p.meta?.brand}
                      </Text>
                      <Text style={[styles.productName, { color: textPrimary }]}>{p.name}</Text>
                      <Text style={[styles.productBarcode, { color: textSecondary }]}>
                        {p.barcode}
                      </Text>
                    </View>

                    {/* Right */}
                    <View style={{ alignItems: 'flex-end', gap: 8 }}>
                      <Text style={[styles.productPrice, { color: textSecondary }]}>
                        €{(p.price ?? 0).toFixed(2)}
                      </Text>
                      <View style={styles.qtyCtrl}>
                        <TouchableOpacity
                          style={[styles.qtyBtn, { borderColor: border }]}
                          onPress={() => changeQty(p.barcode, -1)}
                        >
                          <Text style={[styles.qtyBtnText, { color: textPrimary }]}>−</Text>
                        </TouchableOpacity>
                        <Text style={[styles.qtyNum, { color: textPrimary }]}>{qty}</Text>
                        <TouchableOpacity
                          style={[
                            styles.qtyBtn,
                            { borderColor: supData.accent, backgroundColor: supData.iconBg },
                          ]}
                          onPress={() => changeQty(p.barcode, 1)}
                        >
                          <Text style={[styles.qtyBtnText, { color: supData.accent }]}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

        {/* ── Sticky footer ── */}
        <View style={[styles.footer, { backgroundColor: surface, borderTopColor: border }]}>
          <View style={styles.footerSummary}>
            <View>
              <Text style={[styles.footerLabel, { color: textSecondary }]}>Artikelen</Text>
              <Text style={[styles.footerVal, { color: textPrimary }]}>{totalItems} stuks</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.footerLabel, { color: textSecondary }]}>Totaalprijs</Text>
              <Text style={[styles.footerVal, { color: textPrimary }]}>
                €{totalPrice.toFixed(2).replace('.', ',')}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.placeBtn, { backgroundColor: totalItems > 0 ? '#534AB7' : '#aaa' }]}
            onPress={handlePlace}
            disabled={totalItems === 0}
          >
            <Text style={styles.placeBtnText}>
              {totalItems > 0
                ? `Bestelling plaatsen · ${totalItems} artikel${totalItems !== 1 ? 'en' : ''}`
                : 'Bestelling plaatsen'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Scanner Modal ── */}
        <ScannerModal
          visible={scannerOpen}
          onBarcodeScanned={handleBarcodeScan}
          onClose={() => setScannerOpen(false)}
        />
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scannerButton: {
    width: 36, height: 36, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5,
    position: 'relative',
  },
  camBody: {
    width: 16, height: 13,
    borderWidth: 1.5, borderRadius: 3,
    justifyContent: 'center', alignItems: 'center',
  },
  camLens: {
    width: 6, height: 6,
    borderWidth: 1.5, borderRadius: 3,
  },
  camNotch: {
    position: 'absolute', top: 8, left: '50%',
    marginLeft: -2,
    width: 4, height: 2, borderRadius: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  cancelBtn: { minWidth: 80, justifyContent: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', fontFamily: 'Montserrat', color: '#534AB7' },
  closeBtn: { minWidth: 80, justifyContent: 'center', alignItems: 'flex-end' },
  closeBtnText: { fontSize: 18, fontWeight: '700', fontFamily: 'Montserrat', color: '#534AB7' },
  closeBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  headerTitle: { fontSize: 16, fontWeight: '600', fontFamily: 'Montserrat', flex: 1, textAlign: 'center' },

  subLabel: {
    fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5,
    fontFamily: 'Montserrat',
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5,
  },
  chipText: { fontSize: 12, fontWeight: '600', fontFamily: 'Montserrat' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 0.5,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  searchInput: {
    flex: 1, fontSize: 14, fontFamily: 'Montserrat', padding: 0,
  },

  resultCount: { fontSize: 12, fontFamily: 'Montserrat' },

  productCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 0.5,
    padding: 12, gap: 12,
  },
  supplierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
    marginBottom: 2,
  },
  supplierBadgeText: { fontSize: 10, fontWeight: '700', fontFamily: 'Montserrat' },
  productBrand: { fontSize: 11, fontWeight: '600', fontFamily: 'Montserrat', textTransform: 'uppercase', letterSpacing: 0.3 },
  productName: { fontSize: 14, fontWeight: '600', fontFamily: 'Montserrat' },
  productBarcode: { fontSize: 11, fontFamily: 'Montserrat' },
  productPrice: { fontSize: 13, fontWeight: '600', fontFamily: 'Montserrat' },

  qtyCtrl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 8, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  qtyBtnText: { fontSize: 16, fontWeight: '700', fontFamily: 'Montserrat' },
  qtyNum: { fontSize: 14, fontWeight: '700', fontFamily: 'Montserrat', minWidth: 20, textAlign: 'center' },

  emptyCard: {
    borderRadius: 16, borderWidth: 0.5, padding: 32,
    alignItems: 'center', gap: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', fontFamily: 'Montserrat', textAlign: 'center' },
  emptyBody: { fontSize: 13, fontFamily: 'Montserrat', textAlign: 'center', lineHeight: 20 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 0.5,
    gap: 10,
  },
  footerSummary: { flexDirection: 'row', justifyContent: 'space-between' },
  footerLabel: { fontSize: 12, fontFamily: 'Montserrat' },
  footerVal: { fontSize: 15, fontWeight: '700', fontFamily: 'Montserrat' },
  placeBtn: {
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  placeBtnText: { color: '#fff', fontSize: 13, fontWeight: '600', fontFamily: 'Montserrat' },
});
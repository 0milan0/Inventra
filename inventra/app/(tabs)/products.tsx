import { StyleSheet, ScrollView, TouchableOpacity, View, Text, TextInput, Vibration } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrawerMenu } from '@/components/drawer-menu';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Product, getProductByBarcode, recentScans } from '@/data/products';

type ScanStatus = 'idle' | 'scanning' | 'found' | 'not_found';

export default function ScanScreen() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [history, setHistory] = useState<Product[]>(recentScans);
  const [permission, requestPermission] = useCameraPermissions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const isFocused = useIsFocused();
  const scanCooldownRef = useRef(0);

  useEffect(() => {
    if (!isFocused) {
      setScanStatus('idle');
    }
  }, [isFocused]);

  const runScan = (barcode: string) => {
    if (!barcode) return;

    const now = Date.now();
    if (now - scanCooldownRef.current < 1200) return;
    scanCooldownRef.current = now;

    setScanStatus('scanning');
    setScannedProduct(null);

    setTimeout(() => {
      const product = getProductByBarcode(barcode);
      if (product) {
        setScanStatus('found');
        setScannedProduct(product);
        Vibration.vibrate(80);
        setHistory((prev) => [product, ...prev.filter((p) => p.barcode !== product.barcode)]);
        router.push({ pathname: '/product/[barcode]', params: { barcode } });
      } else {
        setScanStatus('not_found');
        Vibration.vibrate([0, 80, 60, 80]);
      }
    }, 250);
  };

  const handleScan = (code?: string) => {
    const barcode = code ?? barcodeInput.trim();
    if (!barcode) return;
    runScan(barcode);
    setBarcodeInput('');
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!isFocused) return;
    runScan(data);
  };

  const statusColor = (s: Product['status']) => {
    if (s === 'ok') return '#22c55e';
    if (s === 'warning') return '#f59e0b';
    return '#ef4444';
  };

  const statusLabel = (s: Product['status']) => {
    if (s === 'ok') return 'OK';
    if (s === 'warning') return 'Bijna verlopen';
    return 'Verlopen';
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => setDrawerOpen(true)}
            style={styles.hamburgerBtn}
            accessibilityLabel="Open menu"
          >
            <View style={[styles.bar, { backgroundColor: colors.text }]} />
            <View style={[styles.bar, { backgroundColor: colors.text }]} />
            <View style={[styles.bar, { backgroundColor: colors.text }]} />
          </TouchableOpacity>

          <ThemedText style={styles.headerTitle}>Producten scannen</ThemedText>

          <View style={[styles.avatar, { backgroundColor: colors.tint + '22' }]}>
            <Text style={[styles.avatarText, { color: colors.tint }]}>JD</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Scanner viewfinder */}
        <View style={[styles.scannerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.viewfinderWrap}>
            {!permission ? (
              <View style={[styles.permissionCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.permissionText, { color: colors.textSecondary }]}>Camera toegang laden...</Text>
              </View>
            ) : permission.granted && isFocused ? (
              <View style={styles.cameraFrame}>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  onBarcodeScanned={handleBarcodeScanned}
                />

                <View style={[styles.corner, styles.topLeft, { borderColor: colors.tint }]} />
                <View style={[styles.corner, styles.topRight, { borderColor: colors.tint }]} />
                <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.tint }]} />
                <View style={[styles.corner, styles.bottomRight, { borderColor: colors.tint }]} />

                {scanStatus === 'scanning' && <View style={[styles.scanLine, { backgroundColor: colors.tint }]} />}
              </View>
            ) : (
              <View style={[styles.permissionCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.permissionText, { color: colors.textSecondary }]}>Camera is gepauzeerd of toegang nodig om te scannen.</Text>
                <TouchableOpacity
                  style={[styles.permissionBtn, { backgroundColor: colors.tint }]}
                  onPress={requestPermission}
                  activeOpacity={0.85}
                >
                  <Text style={styles.permissionBtnText}>Geef toegang</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text style={[styles.scannerHint, { color: colors.textSecondary }]}>
            {scanStatus === 'idle' && 'Richt de camera op een barcode'}
            {scanStatus === 'scanning' && 'Scannen...'}
            {scanStatus === 'found' && 'Product gevonden!'}
            {scanStatus === 'not_found' && 'Barcode niet herkend'}
          </Text>
        </View>

        {/* Manual barcode input */}
        <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ThemedText style={styles.inputLabel}>Handmatig invoeren</ThemedText>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.barcodeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Voer barcode in..."
              placeholderTextColor={colors.textSecondary}
              value={barcodeInput}
              onChangeText={setBarcodeInput}
              keyboardType="numeric"
              onSubmitEditing={() => handleScan()}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={[styles.searchBtn, { backgroundColor: colors.tint }]}
              onPress={() => handleScan()}
              activeOpacity={0.8}
            >
              <Text style={styles.searchBtnText}>Zoek</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Scan result */}
        {scannedProduct && scanStatus === 'found' && (
          <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.resultHeader}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.resultName}>{scannedProduct.name}</ThemedText>
                <Text style={[styles.resultCategory, { color: colors.textSecondary }]}>{scannedProduct.category}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(scannedProduct.status) + '20' }]}>
                <Text style={[styles.statusText, { color: statusColor(scannedProduct.status) }]}>
                  {statusLabel(scannedProduct.status)}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.resultGrid}>
              {[
                { label: 'Barcode', value: scannedProduct.barcode },
                { label: 'THT datum', value: scannedProduct.tht },
                { label: 'Voorraad', value: `${scannedProduct.stock} stuks` },
                { label: 'Locatie', value: scannedProduct.location },
              ].map((item) => (
                <View key={item.label} style={styles.resultGridItem}>
                  <Text style={[styles.resultGridLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                  <ThemedText style={styles.resultGridValue}>{item.value}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        {scanStatus === 'not_found' && (
          <View style={[styles.notFoundCard, { backgroundColor: '#ef444415', borderColor: '#ef444430' }]}>
            <Text style={[styles.notFoundText, { color: '#ef4444' }]}>
              Geen product gevonden voor deze barcode. Probeer opnieuw of voeg het toe aan het systeem.
            </Text>
          </View>
        )}

        {/* Recent scans */}
        <ThemedText style={styles.sectionTitle}>Recente scans</ThemedText>
        <View style={styles.historyList}>
          {history.map((product) => (
            <TouchableOpacity
              key={product.barcode}
              style={[styles.historyItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => {
                setScannedProduct(product);
                setScanStatus('found');
                router.push({ pathname: '/product/[barcode]', params: { barcode: product.barcode } });
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.historyDot, { backgroundColor: statusColor(product.status) }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.historyName, { color: colors.text }]}>{product.name}</Text>
                <Text style={[styles.historyMeta, { color: colors.textSecondary }]}>
                  {product.location} · THT {product.tht}
                </Text>
              </View>
              <View style={[styles.historyBadge, { backgroundColor: statusColor(product.status) + '20' }]}>
                <Text style={[styles.historyBadgeText, { color: statusColor(product.status) }]}>
                  {statusLabel(product.status)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hamburgerBtn: {
    width: 36, height: 36,
    justifyContent: 'center', alignItems: 'center',
    gap: 5, borderRadius: 8,
  },
  bar: { width: 18, height: 2, borderRadius: 2 },
  headerTitle: { fontSize: 17, fontWeight: '500' },
  avatar: {
    width: 32, height: 32,
    borderRadius: 16, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '500' },

  content: { padding: 16, paddingBottom: 40 },

  // Scanner card
  scannerCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  viewfinderWrap: { width: '100%', alignItems: 'center', marginBottom: 10 },
  cameraFrame: {
    width: '100%',
    height: 190,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  permissionCard: {
    width: '100%',
    minHeight: 190,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  permissionText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  permissionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  viewfinder: {
    width: 220,
    height: 160,
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderWidth: 3,
  },
  topLeft: { top: -1, left: -1, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  topRight: { top: -1, right: -1, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  bottomLeft: { bottom: -1, left: -1, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  bottomRight: { bottom: -1, right: -1, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  scanLine: {
    position: 'absolute',
    left: 10, right: 10,
    height: 2,
    borderRadius: 2,
    opacity: 0.8,
    top: '50%',
  },
  scannerHint: { fontSize: 13, marginBottom: 14 },

  // Manual input
  inputCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 12,
  },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  inputRow: { flexDirection: 'row', gap: 8 },
  barcodeInput: {
    flex: 1,
    height: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  searchBtn: {
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // Result card
  resultCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 12,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  resultName: { fontSize: 16, fontWeight: '700' },
  resultCategory: { fontSize: 12, marginTop: 2 },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  resultGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  resultGridItem: { width: '47%' },
  resultGridLabel: { fontSize: 11, marginBottom: 2 },
  resultGridValue: { fontSize: 14, fontWeight: '600' },

  notFoundCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  notFoundText: { fontSize: 13, lineHeight: 20 },

  sectionTitle: { fontSize: 15, fontWeight: '500', marginBottom: 8, marginTop: 4 },
  historyList: { gap: 8 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
  historyName: { fontSize: 14, fontWeight: '500' },
  historyMeta: { fontSize: 11, marginTop: 2 },
  historyBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  historyBadgeText: { fontSize: 10, fontWeight: '700' },
});
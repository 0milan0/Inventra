import { DrawerMenu } from '@/components/drawer-menu';
import ScannerModal from '@/components/scanner-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { getProductByBarcode } from '@/data/products';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ScanScreen() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const isFocused = useIsFocused();
  const scanCooldownRef = useRef(0);

  useEffect(() => {
    if (!isFocused) {
      setCameraOpen(false);
    }
  }, [isFocused]);

  const runScan = (barcode: string) => {
    if (!barcode) return;
    const now = Date.now();
    if (now - scanCooldownRef.current < 1200) return;
    scanCooldownRef.current = now;
    const product = getProductByBarcode(barcode);
    if (product) {
      Vibration.vibrate(80);
      setCameraOpen(false);
      router.push({ pathname: '/product/[barcode]', params: { barcode } });
    } else {
      Vibration.vibrate([0, 80, 60, 80]);
    }
  };

  const handleBarcodeScanned = (barcode: string) => {
    if (!isFocused || !cameraOpen) return;
    runScan(barcode);
  };

  const openCamera = () => {
    setCameraOpen(true);
  };

  const tintAlpha = (opacity: string) => colors.tint + opacity;

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
            <View style={[styles.bar, { backgroundColor: colors.text, width: 12 }]} />
          </TouchableOpacity>

          <ThemedText style={styles.headerTitle}>Scannen</ThemedText>

          <TouchableOpacity
            onPress={openCamera}
            style={[styles.cameraBtn, { backgroundColor: tintAlpha('20') }]}
            accessibilityLabel="Open scanner"
          >
            {/* Camera body */}
            <View style={[styles.camBody, { borderColor: colors.tint }]}>
              <View style={[styles.camLens, { borderColor: colors.tint }]} />
            </View>
            <View style={[styles.camNotch, { backgroundColor: colors.tint }]} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Page body — empty placeholder with centered prompt */}
      <View style={styles.body}>
        <View style={[styles.emptyCard, { borderColor: colors.border }]}>
          <View style={[styles.emptyIconRing, { borderColor: tintAlpha('30'), backgroundColor: tintAlpha('0D') }]}>
            {/* Camera SVG-style icon built from Views */}
            <View style={[styles.emptyIconBody, { borderColor: colors.tint }]}>
              <View style={[styles.emptyIconLens, { borderColor: colors.tint }]} />
            </View>
            <View style={[styles.emptyIconNotch, { backgroundColor: colors.tint }]} />
          </View>
          <ThemedText style={styles.emptyTitle}>Scan een product</ThemedText>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Tik op het camera-icoon rechtsboven{'\n'}om een barcode te scannen
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: colors.tint }]}
            onPress={openCamera}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyBtnText}>Open scanner</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scanner modal */}
      <ScannerModal
        visible={cameraOpen}
        onBarcodeScanned={handleBarcodeScanned}
        onClose={() => setCameraOpen(false)}
        isFocused={isFocused}
      />

      <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Header */
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hamburgerBtn: {
    width: 36, height: 36,
    justifyContent: 'center', alignItems: 'flex-start',
    gap: 5,
  },
  bar: { height: 2, borderRadius: 2, width: 18 },
  headerTitle: { fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },

  /* Camera button */
  cameraBtn: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
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

  /* Empty state */
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyCard: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
    padding: 32,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyIconRing: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  emptyIconBody: {
    width: 28, height: 22,
    borderWidth: 2, borderRadius: 4,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyIconLens: {
    width: 10, height: 10,
    borderWidth: 2, borderRadius: 5,
  },
  emptyIconNotch: {
    position: 'absolute', top: 14,
    width: 6, height: 4, borderRadius: 1,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, marginTop: 4 },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 8,
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
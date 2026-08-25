import ScannerModal from '@/components/scanner-modal';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getPalette, Shadow } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getProduct } from '@/lib/api';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';

export default function ScanScreen() {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [bezig, setBezig] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const p = getPalette(isDark);
  const router = useRouter();
  const { token } = useAuth();
  const isFocused = useIsFocused();
  const scanCooldownRef = useRef(0);

  useEffect(() => {
    if (!isFocused) {
      setCameraOpen(false);
    }
  }, [isFocused]);

  const runScan = async (barcode: string): Promise<boolean> => {
    if (!barcode || !token) return true;
    const now = Date.now();
    if (now - scanCooldownRef.current < 1200) return true;
    scanCooldownRef.current = now;

    setBezig(true);
    try {
      await getProduct(token, barcode);
      Vibration.vibrate(80);
      setCameraOpen(false);
      router.push({ pathname: '/product/[barcode]', params: { barcode } });
      return true;
    } catch {
      Vibration.vibrate([0, 80, 60, 80]);
      return false;
    } finally {
      setBezig(false);
    }
  };

  const handleBarcodeScanned = (barcode: string): Promise<boolean> => {
    if (!isFocused || !cameraOpen || bezig) return Promise.resolve(true);
    return runScan(barcode);
  };

  const openCamera = () => {
    setCameraOpen(true);
  };

  const tintAlpha = (opacity: string) => p.accent + opacity;

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Scannen" />

      {/* Page body — empty placeholder with centered prompt, of laad-status na het scannen */}
      <View style={styles.body}>
        {bezig ? (
          <View style={[styles.emptyCard, { borderColor: p.border }]}>
            <ActivityIndicator size="large" color={p.accent} />
            <ThemedText style={[styles.emptyTitle, { marginTop: 14 }]}>Product opzoeken…</ThemedText>
          </View>
        ) : (
          <View style={[styles.emptyCard, { borderColor: p.border }]}>
            <View style={[styles.emptyIconRing, { borderColor: tintAlpha('30'), backgroundColor: tintAlpha('0D') }]}>
              {/* Camera SVG-style icon built from Views */}
              <View style={[styles.emptyIconBody, { borderColor: p.accent }]}>
                <View style={[styles.emptyIconLens, { borderColor: p.accent }]} />
              </View>
              <View style={[styles.emptyIconNotch, { backgroundColor: p.accent }]} />
            </View>
            <ThemedText style={styles.emptyTitle}>Scan een product</ThemedText>
            <Text style={[styles.emptySubtitle, { color: p.textSecondary }]}>
              Tik op de knop hieronder{'\n'}om een barcode te scannen
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: p.accent }]}
              onPress={openCamera}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyBtnText}>Open scanner</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Scanner modal */}
      <ScannerModal
        visible={cameraOpen}
        onBarcodeScanned={handleBarcodeScanned}
        onClose={() => setCameraOpen(false)}
        isFocused={isFocused}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

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
    ...(Shadow.card as object),
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
import { getPalette } from '@/constants/design-tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ScanStatus = 'idle' | 'scanning' | 'found' | 'not_found';
type ManualStatus = 'idle' | 'searching' | 'not_found';

interface ScannerModalProps {
  visible: boolean;
  /**
   * `false` teruggeven (of een Promise die naar `false` resolvet) houdt de
   * camera open en toont "Barcode niet herkend" — voor schermen die zelf een
   * opzoeking doen. Alles anders (`void`/`true`) sluit de camera zoals
   * voorheen, meteen na de scan.
   */
  onBarcodeScanned: (barcode: string) => void | boolean | Promise<boolean | void>;
  onClose: () => void;
  isFocused?: boolean;
}

export default function ScannerModal({
  visible,
  onBarcodeScanned,
  onClose,
  isFocused = true,
}: ScannerModalProps) {
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [permission, requestPermission] = useCameraPermissions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const p = getPalette(isDark);
  const scanCooldownRef = useRef(0);

  const [manualMode, setManualMode] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [manualStatus, setManualStatus] = useState<ManualStatus>('idle');

  useEffect(() => {
    if (!visible) {
      setScanStatus('idle');
      setManualMode(false);
      setManualBarcode('');
      setManualStatus('idle');
    }
  }, [visible]);

  const runScan = (barcode: string) => {
    if (!barcode) return;
    const now = Date.now();
    if (now - scanCooldownRef.current < 1200) return;
    scanCooldownRef.current = now;
    setScanStatus('scanning');
    setTimeout(async () => {
      const resultaat = await onBarcodeScanned(barcode);

      if (resultaat === false) {
        // Camera blijft open zodat de gebruiker het nog eens kan proberen —
        // status keert vanzelf terug naar "Richt op een barcode".
        setScanStatus('not_found');
        setTimeout(() => setScanStatus((s) => (s === 'not_found' ? 'idle' : s)), 1500);
        return;
      }

      setScanStatus('found');
      onClose();
    }, 250);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!isFocused || !visible) return;
    runScan(data);
  };

  const submitManual = async () => {
    const code = manualBarcode.trim();
    if (!code) return;
    setManualStatus('searching');
    const resultaat = await onBarcodeScanned(code);

    if (resultaat === false) {
      setManualStatus('not_found');
      return;
    }

    setManualBarcode('');
    setManualStatus('idle');
    setManualMode(false);
    onClose();
  };

  const openCamera = async () => {
    if (!permission?.granted) await requestPermission();
    setScanStatus('idle');
  };

  const tintAlpha = (opacity: string) => p.accent + opacity;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        onClose();
        setScanStatus('idle');
      }}
    >
      <View style={styles.modalContainer}>
        {/* Modal header */}
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#0a0a0a' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                onClose();
                setScanStatus('idle');
              }}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Barcode scannen</Text>
            <TouchableOpacity
              onPress={() => {
                setManualStatus('idle');
                setManualMode((v) => !v);
              }}
              style={styles.closeBtn}
              accessibilityLabel={manualMode ? 'Camera gebruiken' : 'Barcode handmatig invoeren'}
            >
              <Text style={styles.closeBtnText}>{manualMode ? '▦' : '⌨'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {manualMode ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.manualWrap}
          >
            <View style={styles.manualCard}>
              <Text style={styles.manualTitle}>Barcode handmatig invoeren</Text>
              <Text style={styles.manualSub}>Bijvoorbeeld als de barcode beschadigd of onleesbaar is.</Text>
              <TextInput
                value={manualBarcode}
                onChangeText={(v) => { setManualBarcode(v); if (manualStatus === 'not_found') setManualStatus('idle'); }}
                placeholder="Voer barcode in…"
                placeholderTextColor="#ffffff55"
                keyboardType="number-pad"
                autoFocus
                style={[styles.manualInput, { borderColor: manualStatus === 'not_found' ? p.danger : '#ffffff33' }]}
                onSubmitEditing={submitManual}
                returnKeyType="search"
              />
              {manualStatus === 'not_found' && (
                <Text style={[styles.manualFeedback, { color: p.danger }]}>Barcode niet herkend.</Text>
              )}
              <TouchableOpacity
                style={[styles.manualSubmitBtn, { backgroundColor: p.accent, opacity: manualBarcode.trim() ? 1 : 0.5 }]}
                onPress={submitManual}
                disabled={!manualBarcode.trim() || manualStatus === 'searching'}
              >
                <Text style={styles.manualSubmitTxt}>
                  {manualStatus === 'searching' ? 'Zoeken…' : 'Zoeken'}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        ) : permission?.granted ? (
          <View style={styles.fullCamera}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              onBarcodeScanned={handleBarcodeScanned}
            />

            {/* Dimmed overlay — top + bottom + sides */}
            <View style={styles.overlayTop} />
            <View style={styles.overlayBottom} />
            <View style={styles.overlaySideLeft} />
            <View style={styles.overlaySideRight} />

            {/* Viewfinder box */}
            <View style={styles.viewfinderBox}>
              {/* Animated corner brackets */}
              <View style={[styles.corner, styles.cTL, { borderColor: p.accent }]} />
              <View style={[styles.corner, styles.cTR, { borderColor: p.accent }]} />
              <View style={[styles.corner, styles.cBL, { borderColor: p.accent }]} />
              <View style={[styles.corner, styles.cBR, { borderColor: p.accent }]} />

              {/* Scan line */}
              {scanStatus === 'scanning' && (
                <View style={[styles.scanLine, { backgroundColor: p.accent }]} />
              )}

              {/* Found flash */}
              {scanStatus === 'found' && (
                <View style={[styles.foundFlash, { backgroundColor: p.accent + '33' }]} />
              )}
            </View>

            {/* Bottom status strip */}
            <View style={styles.statusStrip}>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor:
                      scanStatus === 'not_found'
                        ? p.dangerSoft
                        : scanStatus === 'found'
                          ? p.successSoft
                          : '#00000066',
                    borderColor:
                      scanStatus === 'not_found'
                        ? p.danger
                        : scanStatus === 'found'
                          ? p.success
                          : 'transparent',
                    borderWidth: 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        scanStatus === 'not_found'
                          ? p.danger
                          : scanStatus === 'found'
                            ? p.success
                            : scanStatus === 'scanning'
                              ? p.accent
                              : '#ffffff66',
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        scanStatus === 'not_found'
                          ? p.danger
                          : scanStatus === 'found'
                            ? p.success
                            : '#fff',
                    },
                  ]}
                >
                  {scanStatus === 'idle' && 'Richt op een barcode'}
                  {scanStatus === 'scanning' && 'Scannen…'}
                  {scanStatus === 'found' && 'Product gevonden'}
                  {scanStatus === 'not_found' && 'Barcode niet herkend'}
                </Text>
              </View>

              <Text style={styles.scanHint}>Houd de barcode stil in het kader</Text>
            </View>
          </View>
        ) : (
          <View style={styles.permissionWrap}>
            <View
              style={[
                styles.permissionIcon,
                { backgroundColor: p.accent + '20', borderColor: p.accent + '33' },
              ]}
            >
              <View style={[styles.permIconBody, { borderColor: p.accent }]}>
                <View style={[styles.permIconLens, { borderColor: p.accent }]} />
              </View>
            </View>
            <Text style={styles.permissionTitle}>Cameratoegang nodig</Text>
            <Text style={styles.permissionText}>
              Om barcodes te scannen heeft de app toegang tot de camera nodig.
            </Text>
            <TouchableOpacity
              style={[styles.permissionBtn, { backgroundColor: p.accent }]}
              onPress={requestPermission}
              activeOpacity={0.85}
            >
              <Text style={styles.permissionBtnText}>Geef toegang</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.permissionManualBtn}
              onPress={() => setManualMode(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.permissionManualBtnText}>Of voer de barcode handmatig in</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const VF_TOP = '22%';
const VF_SIDE = '8%';
const VF_HEIGHT = '36%';

const styles = StyleSheet.create({
  /* Modal */
  modalContainer: { flex: 1, backgroundColor: '#0a0a0a' },
  modalHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: 0.1 },

  /* Camera view */
  fullCamera: { flex: 1 },

  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: VF_TOP,
    backgroundColor: '#000000AA',
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: `${100 - 22 - 36}%`,
    backgroundColor: '#000000AA',
  },
  overlaySideLeft: {
    position: 'absolute',
    top: VF_TOP,
    left: 0,
    width: VF_SIDE,
    height: VF_HEIGHT,
    backgroundColor: '#000000AA',
  },
  overlaySideRight: {
    position: 'absolute',
    top: VF_TOP,
    right: 0,
    width: VF_SIDE,
    height: VF_HEIGHT,
    backgroundColor: '#000000AA',
  },

  /* Viewfinder */
  viewfinderBox: {
    position: 'absolute',
    top: VF_TOP,
    left: VF_SIDE,
    right: VF_SIDE,
    height: VF_HEIGHT,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderWidth: 3,
  },
  cTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 10 },
  cTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 10 },
  cBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 10 },
  cBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 10 },

  scanLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '50%',
    height: 2,
    borderRadius: 2,
    opacity: 0.9,
  },
  foundFlash: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 4,
  },

  /* Status strip */
  statusStrip: {
    position: 'absolute',
    bottom: 52,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 13, fontWeight: '600' },
  scanHint: { color: '#ffffff55', fontSize: 12 },

  /* Permission */
  permissionWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    padding: 32,
  },
  permissionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  permIconBody: {
    width: 30,
    height: 24,
    borderWidth: 2,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permIconLens: {
    width: 11,
    height: 11,
    borderWidth: 2,
    borderRadius: 5.5,
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  permissionText: {
    color: '#ffffff88',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionBtn: {
    marginTop: 6,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 12,
  },
  permissionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  permissionManualBtn: { marginTop: 4, paddingVertical: 8, paddingHorizontal: 12 },
  permissionManualBtnText: { color: '#ffffff99', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },

  /* Manual entry */
  manualWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  manualCard: {
    width: '100%',
    maxWidth: 360,
    gap: 12,
    backgroundColor: '#ffffff0d',
    borderWidth: 1,
    borderColor: '#ffffff1f',
    borderRadius: 16,
    padding: 20,
  },
  manualTitle: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  manualSub: { color: '#ffffff88', fontSize: 12.5, lineHeight: 18, marginTop: -6 },
  manualInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.5,
  },
  manualFeedback: { fontSize: 12.5, fontWeight: '600', marginTop: -4 },
  manualSubmitBtn: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualSubmitTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

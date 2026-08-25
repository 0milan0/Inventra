import { ThemedView } from '@/components/themed-view';
import { FontFamily, getPalette, Palette, Radius, Shadow, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  ApiGerelateerdProduct,
  ApiProduct,
  ApiProductVerkoopStats,
  getGerelateerdeProducten,
  getProduct,
  getProductVerkoopStats,
  Opslagwijze,
  updateProductBranch,
} from '@/lib/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

type PrintModal = 'schapkaart' | 'promo' | 'afprijs' | null;
type ProductStatus = 'ok' | 'warning' | 'expired';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (date: Date): string => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}-${m}-${date.getFullYear()}`;
};

const parseDate = (value?: string): Date => {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

const daysUntil = (isoDate?: string): number | null => {
  if (!isoDate) return null;
  const diff = parseDate(isoDate).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const formatEuro = (bedrag: number): string => `€ ${bedrag.toFixed(2).replace('.', ',')}`;

const berekenStatus = (dagen: number | null): ProductStatus => {
  if (dagen === null) return 'ok';
  if (dagen < 0) return 'expired';
  if (dagen <= 30) return 'warning';
  return 'ok';
};

// ─── Config ───────────────────────────────────────────────────────────────────

type Palette = ReturnType<typeof getPalette>;

const statusConfig = (p: Palette): Record<ProductStatus, { color: string; bg: string; label: string }> => ({
  ok:      { color: p.success, bg: p.successSoft, label: 'Op voorraad' },
  warning: { color: p.warning, bg: p.warningSoft, label: 'Bijna verlopen' },
  expired: { color: p.danger,  bg: p.dangerSoft,  label: 'Verlopen' },
});

const STORAGE_LABEL: Record<Opslagwijze, string> = {
  ambient: 'Kamertemperatuur',
  koel:    'Koelkast (2–7°C)',
  vries:   'Diepvries (−18°C)',
};

const STORAGE_ICON: Record<Opslagwijze, string> = {
  ambient: 'home-thermometer-outline',
  koel:    'snowflake',
  vries:   'snowflake-variant',
};

const OPSLAG_OPTIES: { id: Opslagwijze; label: string }[] = [
  { id: 'ambient', label: 'Kamertemperatuur' },
  { id: 'koel', label: 'Koelkast (2–7°C)' },
  { id: 'vries', label: 'Diepvries (−18°C)' },
];

function kiesOpslag(huidig: Opslagwijze | null, onKies: (v: Opslagwijze) => void) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Opslagwijze',
        options: [...OPSLAG_OPTIES.map((o) => o.label), 'Annuleren'],
        cancelButtonIndex: OPSLAG_OPTIES.length,
      },
      (index) => {
        if (index < OPSLAG_OPTIES.length) onKies(OPSLAG_OPTIES[index].id);
      }
    );
  } else {
    Alert.alert('Opslagwijze', undefined, [
      ...OPSLAG_OPTIES.map((o) => ({ text: o.label, onPress: () => onKies(o.id) })),
      { text: 'Annuleren', style: 'cancel' as const },
    ]);
  }
}

// ─── Print HTML generators ────────────────────────────────────────────────────

function generateSchapkaartHtml(product: ApiProduct, tht: string, opslag: Opslagwijze | null): string {
  const thtStr = tht ? formatDate(parseDate(tht)) : '';
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',Arial,sans-serif;background:#fff}
  .card{width:148mm;height:105mm;border:2.5px solid #1e293b;border-radius:8px;overflow:hidden;display:flex;flex-direction:column}
  .header{background:#1e293b;color:#fff;padding:10px 14px 8px;display:flex;align-items:center;justify-content:space-between}
  .brand{font-size:9px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px}
  .category{font-size:10px;color:#cbd5e1;margin-top:2px}
  .store-badge{background:rgba(255,255,255,0.12);border-radius:6px;padding:4px 10px;font-size:10px;font-weight:700;color:#fff}
  .body{flex:1;padding:12px 14px 0;display:flex;flex-direction:column;gap:6px}
  .product-name{font-size:20px;font-weight:900;color:#0f172a;line-height:1.15;letter-spacing:-0.5px}
  .meta-row{display:flex;gap:8px;margin-top:2px}
  .chip{background:#f1f5f9;border-radius:4px;padding:3px 8px;font-size:9px;font-weight:600;color:#475569}
  .divider{height:1px;background:#e2e8f0;margin:4px 0}
  .info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
  .info-cell{display:flex;flex-direction:column;gap:1px}
  .info-label{font-size:7.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px}
  .info-value{font-size:13px;font-weight:700;color:#1e293b}
  .info-value.blue{color:#2563eb}
  .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:7px 14px;display:flex;align-items:center;justify-content:space-between;margin-top:auto}
  .barcode-num{font-size:9px;color:#64748b;font-weight:600;letter-spacing:2px}
  .tht-badge{background:${thtStr ? '#fef3c7' : '#f1f5f9'};border:1px solid ${thtStr ? '#fcd34d' : '#e2e8f0'};border-radius:6px;padding:4px 10px;text-align:center}
  .tht-label{font-size:7px;color:#92400e;font-weight:600;text-transform:uppercase}
  .tht-value{font-size:11px;color:#92400e;font-weight:800}
  .sku-value{font-size:10px;color:#475569;font-weight:700;text-align:right}
</style></head><body>
<div class="card">
  <div class="header">
    <div><div class="brand">${product.merk}</div><div class="category">${product.categorie}</div></div>
    <span class="store-badge">Winkel</span>
  </div>
  <div class="body">
    <div class="product-name">${product.naam}</div>
    <div class="meta-row">
      ${opslag ? `<span class="chip">${STORAGE_LABEL[opslag]}</span>` : ''}
      <span class="chip">${product.eenheidType}</span>
    </div>
    <div class="divider"></div>
    <div class="info-grid">
      <div class="info-cell"><span class="info-label">Voorraad</span><span class="info-value blue">${product.filiaal.opSchap} ${product.eenheidType}</span></div>
      <div class="info-cell"><span class="info-label">Locatie</span><span class="info-value">${product.filiaal.schapNaam || '—'}</span></div>
      <div class="info-cell"><span class="info-label">Herbestel</span><span class="info-value">${product.filiaal.minimum || '—'}</span></div>
      <div class="info-cell"><span class="info-label">Max voorraad</span><span class="info-value">${product.filiaal.schapGrootte || '—'}</span></div>
      <div class="info-cell"><span class="info-label">Leverancier</span><span class="info-value" style="font-size:10px">${product.leverancier || '—'}</span></div>
    </div>
  </div>
  <div class="footer">
    <div><div style="font-size:7px;color:#94a3b8">BARCODE</div><div class="barcode-num">${product.barcode}</div></div>
    ${thtStr ? `<div class="tht-badge"><div class="tht-label">THT</div><div class="tht-value">${thtStr}</div></div>` : ''}
    <div style="text-align:right"><div style="font-size:7px;color:#94a3b8">SKU</div><div class="sku-value">${product.sku || '—'}</div></div>
  </div>
</div></body></html>`;
}

function generatePromoHtml(product: ApiProduct, vanPrijs: string, voorPrijs: string, formaat: 'A4' | 'Barker'): string {
  const isBarker = formaat === 'Barker';
  const saving = vanPrijs && voorPrijs
    ? (parseFloat(vanPrijs.replace(',', '.')) - parseFloat(voorPrijs.replace(',', '.'))).toFixed(2).replace('.', ',')
    : null;
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',Arial,sans-serif;background:#fff}
  .page{width:${isBarker ? '148mm' : '210mm'};height:${isBarker ? '148mm' : '297mm'};overflow:hidden;display:flex;flex-direction:column}
  .top-band{background:#dc2626;padding:${isBarker ? '18px 24px 14px' : '28px 36px 22px'};position:relative;overflow:hidden}
  .promo-flag{position:absolute;top:${isBarker ? '12px' : '18px'};right:${isBarker ? '16px' : '28px'};background:#fbbf24;color:#7c2d12;font-size:${isBarker ? '10px' : '13px'};font-weight:900;padding:${isBarker ? '5px 12px' : '7px 18px'};border-radius:999px;text-transform:uppercase;letter-spacing:1px}
  .top-label{font-size:${isBarker ? '10px' : '13px'};font-weight:700;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:2px;margin-bottom:${isBarker ? '6px' : '10px'}}
  .product-name{font-size:${isBarker ? '36px' : '54px'};font-weight:900;color:#fff;line-height:1.05;letter-spacing:-1px;max-width:85%}
  .price-section{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${isBarker ? '24px' : '40px 36px'}}
  .van-price{font-size:${isBarker ? '22px' : '32px'};font-weight:700;color:#9ca3af;text-decoration:line-through}
  .voor-price{font-size:${isBarker ? '72px' : '110px'};font-weight:900;color:#dc2626;line-height:0.9;letter-spacing:-3px}
  .saving-badge{margin-top:${isBarker ? '12px' : '18px'};background:#fef3c7;border:2px solid #fbbf24;border-radius:999px;padding:${isBarker ? '6px 20px' : '9px 30px'};font-size:${isBarker ? '12px' : '16px'};font-weight:800;color:#92400e}
  .footer{border-top:2px dashed #e5e7eb;padding:${isBarker ? '10px 20px' : '14px 30px'};display:flex;align-items:center;justify-content:space-between;background:#f9fafb}
  .barcode-num{font-size:${isBarker ? '9px' : '11px'};color:#64748b;font-weight:700;letter-spacing:2px}
</style></head><body>
<div class="page">
  <div class="top-band">
    <span class="promo-flag">AANBIEDING</span>
    <div class="top-label">${product.categorie}</div>
    <div class="product-name">${product.naam}</div>
  </div>
  <div class="price-section">
    ${vanPrijs ? `<div style="margin-bottom:8px"><span style="font-size:${isBarker?'12px':'16px'};font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-right:8px">Was</span><span class="van-price">€ ${vanPrijs}</span></div>` : ''}
    <div style="display:flex;align-items:flex-start;gap:${isBarker?'4px':'6px'}">
      <span style="font-size:${isBarker?'38px':'58px'};font-weight:900;color:#dc2626;line-height:1;margin-top:${isBarker?'8px':'12px'}">€</span>
      <span class="voor-price">${voorPrijs || '??'}</span>
    </div>
    ${saving && parseFloat(saving.replace(',', '.')) > 0 ? `<div class="saving-badge">Je bespaart € ${saving}</div>` : ''}
  </div>
  <div class="footer">
    <div><div style="font-size:${isBarker?'7px':'9px'};color:#94a3b8;text-transform:uppercase">Barcode</div><div class="barcode-num">${product.barcode}</div></div>
    <span style="font-size:${isBarker?'13px':'17px'};font-weight:900;color:#1e293b">${product.leverancier || product.merk || 'Winkel'}</span>
    <div style="font-size:${isBarker?'8px':'10px'};color:#9ca3af">Op = Op</div>
  </div>
</div></body></html>`;
}

function generateAfprijsStickerHtml(product: ApiProduct, vanPrijs: string, voorPrijs: string): string {
  const saving = vanPrijs && voorPrijs
    ? (parseFloat(vanPrijs.replace(',', '.')) - parseFloat(voorPrijs.replace(',', '.'))).toFixed(2).replace('.', ',')
    : null;
  const sticker = `<div class="sticker"><div class="sticker-inner">
    <div class="sticker-name">${product.naam}</div>
    <div style="height:1px;background:linear-gradient(to right,#ef4444,transparent);margin:4px 0"></div>
    <div style="display:flex;align-items:center;gap:12px">
      ${vanPrijs ? `<div style="display:flex;flex-direction:column;align-items:center"><span style="font-size:7px;color:#9ca3af;font-weight:700;text-transform:uppercase">Was</span><span style="font-size:15px;font-weight:700;color:#9ca3af;text-decoration:line-through">€${vanPrijs}</span></div>` : ''}
      <div style="display:flex;flex-direction:column;align-items:center"><span style="font-size:7px;color:#dc2626;font-weight:700;text-transform:uppercase">Nu</span><span style="font-size:26px;font-weight:900;color:#dc2626;line-height:1;letter-spacing:-1px">€${voorPrijs}</span></div>
    </div>
    ${saving && parseFloat(saving.replace(',', '.')) > 0 ? `<div style="font-size:9px;font-weight:700;color:#92400e;background:#fef3c7;border-radius:4px;padding:3px 8px;align-self:flex-start">Voordeel: € ${saving}</div>` : ''}
    <div style="font-size:8px;color:#94a3b8;font-weight:600;letter-spacing:2px;margin-top:auto">${product.barcode}</div>
  </div></div>`;
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',Arial,sans-serif;background:#fff}
  .page{width:210mm;min-height:297mm;padding:8mm;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(4,1fr);gap:4mm}
  .sticker{border:2px dashed #ef4444;border-radius:6px;overflow:hidden}
  .sticker-inner{flex:1;background:#fff;padding:10px 12px 8px;display:flex;flex-direction:column;gap:5px;position:relative}
  .sticker-inner::before{content:'AFPRIJS';position:absolute;top:6px;right:8px;font-size:7px;font-weight:900;color:#ef4444;letter-spacing:2px;opacity:0.5}
  .sticker-name{font-size:13px;font-weight:800;color:#1e293b;line-height:1.2;max-width:85%}
</style></head><body>
<div class="page">${Array(8).fill(sticker).join('')}</div>
</body></html>`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProductDetailScreen() {
  const navigation    = useNavigation();
  const colorScheme   = useColorScheme();
  const isDark        = colorScheme === 'dark';
  const p              = getPalette(isDark);
  const colors        = p;
  const { barcode }   = useLocalSearchParams<{ barcode: string }>();
  const barcodeValue  = Array.isArray(barcode) ? barcode[0] : barcode;
  const { token } = useAuth();

  const router = useRouter();
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [laden, setLaden] = useState(true);
  const [foutmelding, setFoutmelding] = useState<string | null>(null);

  const [verkoopStats, setVerkoopStats] = useState<ApiProductVerkoopStats | null>(null);
  const [gerelateerdeProducten, setGerelateerdeProducten] = useState<ApiGerelateerdProduct[]>([]);

  // ── Alleen de editbare velden als state ──
  const [tht,            setThtLocal]      = useState('');
  const [stockWinkel,    setStockWinkel]   = useState('0');
  const [stockMagazijn,  setStockMagazijn] = useState('0');
  const [notes,          setNotes]         = useState('');
  const [featured,       setFeatured]      = useState(false);
  const [organic,        setOrganic]       = useState(false);
  const [opslag,         setOpslag]        = useState<Opslagwijze | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hasChanges,     setHasChanges]     = useState(false);
  const [saveMessage,    setSaveMessage]    = useState('');
  const [saving,         setSaving]         = useState(false);
  const saveAnim = useRef(new Animated.Value(0)).current;

  // Print state
  const [printModal,   setPrintModal]   = useState<PrintModal>(null);
  const [promoFormaat, setPromoFormaat] = useState<'A4' | 'Barker'>('A4');
  const [vanPrijs,     setVanPrijs]     = useState('');
  const [voorPrijs,    setVoorPrijs]    = useState('');
  const [isPrinting,   setIsPrinting]   = useState(false);

  const vulVeldenIn = (data: ApiProduct) => {
    setThtLocal(data.filiaal.kortsteTht ?? '');
    setStockWinkel(String(data.filiaal.opSchap));
    setStockMagazijn(String(data.filiaal.magazijn));
    setNotes(data.filiaal.notities ?? '');
    setFeatured(data.filiaal.uitgelicht);
    setOrganic(data.filiaal.biologisch);
    setOpslag(data.filiaal.opslag);
  };

  const laadProduct = useCallback(async () => {
    if (!token || !barcodeValue) return;
    setLaden(true);
    setFoutmelding(null);
    try {
      const data = await getProduct(token, barcodeValue);
      setProduct(data);
      vulVeldenIn(data);
    } catch (e) {
      setFoutmelding(e instanceof Error ? e.message : 'Product laden is mislukt.');
    } finally {
      setLaden(false);
    }
  }, [token, barcodeValue]);

  useEffect(() => {
    laadProduct();
  }, [laadProduct]);

  // Verkoopcijfers + gerelateerde producten laden zodra het product bekend is
  // (apart van laadProduct — mag falen zonder de rest van de pagina te blokkeren).
  useEffect(() => {
    if (!token || !product) return;
    let actief = true;
    getProductVerkoopStats(token, product.id)
      .then((stats) => { if (actief) setVerkoopStats(stats); })
      .catch(() => { if (actief) setVerkoopStats(null); });
    getGerelateerdeProducten(token, product.id)
      .then((lijst) => { if (actief) setGerelateerdeProducten(lijst); })
      .catch(() => { if (actief) setGerelateerdeProducten([]); });
    return () => { actief = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, product?.id]);

  // Detecteer wijzigingen
  useEffect(() => {
    if (!product) return;
    const f = product.filiaal;
    const changed =
      tht !== (f.kortsteTht ?? '') ||
      stockWinkel !== String(f.opSchap) ||
      stockMagazijn !== String(f.magazijn) ||
      notes !== (f.notities ?? '') ||
      featured !== f.uitgelicht ||
      organic !== f.biologisch ||
      opslag !== f.opslag;
    setHasChanges(changed);
  }, [product, tht, stockWinkel, stockMagazijn, notes, featured, organic, opslag]);

  const resetChanges = () => {
    if (!product) return;
    vulVeldenIn(product);
  };

  const shareProduct = async () => {
    if (!product) return;
    try {
      await Share.share({
        message: `${product.naam}\nBarcode: ${product.barcode}\nVoorraad: ${stockWinkel} winkel · ${stockMagazijn} magazijn\nLocatie: ${product.filiaal.schapNaam || '—'}${tht ? `\nTHT: ${formatDate(parseDate(tht))}` : ''}`,
      });
    } catch (e) {
      console.error('Delen mislukt:', e);
    }
  };

  // Toast animatie
  useEffect(() => {
    if (!saveMessage) return;
    Animated.sequence([
      Animated.timing(saveAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(saveAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setSaveMessage(''));
  }, [saveMessage]);

  const handleSave = async () => {
    if (!product || !token) return;
    setSaving(true);
    try {
      await updateProductBranch(token, {
        barcode: product.barcode,
        opSchap: parseInt(stockWinkel, 10) || 0,
        magazijn: parseInt(stockMagazijn, 10) || 0,
        kortsteTht: tht,
        opslag,
        biologisch: organic,
        uitgelicht: featured,
        notities: notes || null,
      });
      setProduct((prev) => prev ? {
        ...prev,
        filiaal: {
          ...prev.filiaal,
          opSchap: parseInt(stockWinkel, 10) || 0,
          magazijn: parseInt(stockMagazijn, 10) || 0,
          kortsteTht: tht,
          opslag,
          biologisch: organic,
          uitgelicht: featured,
          notities: notes || null,
        },
      } : prev);
      setHasChanges(false);
      setSaveMessage('Wijzigingen opgeslagen');
    } catch (e) {
      Alert.alert('Opslaan mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
    } finally {
      setSaving(false);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerTransparent: true,
      headerRight: () =>
        hasChanges ? (
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.headerSaveBtn, { backgroundColor: p.accent, opacity: saving ? 0.7 : 1 }]}
            activeOpacity={0.85}
            disabled={saving}
          >
            <MaterialCommunityIcons name="content-save-outline" size={16} color="#fff" />
            <Text style={styles.headerSaveTxt}>Opslaan</Text>
          </TouchableOpacity>
        ) : null,
    });
  }, [navigation, hasChanges, saving]);

  const handlePrint = async () => {
    if (!product) return;
    setIsPrinting(true);
    try {
      let html = '';
      if (printModal === 'schapkaart') html = generateSchapkaartHtml(product, tht, opslag);
      else if (printModal === 'promo')  html = generatePromoHtml(product, vanPrijs, voorPrijs, promoFormaat);
      else if (printModal === 'afprijs') html = generateAfprijsStickerHtml(product, vanPrijs, voorPrijs);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      } else {
        await Print.printAsync({ uri });
      }
      setPrintModal(null);
    } catch (e) {
      console.error('Print fout:', e);
    } finally {
      setIsPrinting(false);
    }
  };

  if (laden) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
        <View style={styles.emptyState}>
          <ActivityIndicator color={p.accent} />
        </View>
      </ThemedView>
    );
  }

  if (foutmelding || !product) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="barcode-off" size={56} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {foutmelding ?? 'Product niet gevonden'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{barcodeValue}</Text>
        </View>
      </ThemedView>
    );
  }

  const thtDays     = daysUntil(tht);
  const status      = berekenStatus(thtDays);
  const statusCfg   = statusConfig(p)[status];
  const stockWinkelNum   = parseInt(stockWinkel, 10) || 0;
  const stockMagazijnNum = parseInt(stockMagazijn, 10) || 0;
  const maxStock    = product.filiaal.schapGrootte || 100;
  const reorderPoint = product.filiaal.minimum;
  const fillPct     = Math.min((stockWinkelNum / maxStock) * 100, 100);
  const reorderPct  = reorderPoint ? Math.min((reorderPoint / maxStock) * 100, 100) : 0;
  const totaalStock = stockWinkelNum + stockMagazijnNum;
  const onderHerbestel = reorderPoint > 0 && totaalStock <= reorderPoint;

  // THT kleur — semantisch, uit het palet
  const thtColor = thtDays === null
    ? colors.text
    : thtDays <= 7 ? p.danger
    : thtDays <= 30 ? p.warning
    : p.success;

  const thtBg = thtDays === null
    ? 'transparent'
    : thtDays <= 7 ? p.dangerSoft
    : thtDays <= 30 ? p.warningSoft
    : p.successSoft;

  // Kleur tokens
  const surface  = p.surface;
  const pageBg   = p.bg;
  const border   = p.border;
  const divider  = p.divider;
  const subBg    = p.surfaceAlt;
  const inputBg  = p.surfaceAlt;

  return (
    <ThemedView style={[styles.container, { backgroundColor: pageBg }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { backgroundColor: pageBg }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── HERO ── */}
        <View style={[styles.hero, { backgroundColor: surface, borderBottomColor: border }]}>
          {/* Eyebrow: categorie + status */}
          <View style={styles.eyebrowRow}>
            <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
              {product.categorie}
            </Text>
            <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
            <Text style={[styles.eyebrow, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>

          {/* Naam */}
          <Text style={[styles.heroName, { color: colors.text }]}>{product.naam}</Text>

          {/* Identificatie */}
          <View style={styles.barcodeRow}>
            <Text style={[styles.barcodeTxt, { color: colors.textSecondary }]}>{product.barcode}</Text>
            {product.sku ? (
              <>
                <Text style={[styles.barcodeSep, { color: colors.textMuted }]}>·</Text>
                <Text style={[styles.barcodeTxt, { color: colors.textSecondary }]}>SKU {product.sku}</Text>
              </>
            ) : null}
          </View>

          {/* Attribuut-chips */}
          {(opslag && opslag !== 'ambient') || organic || featured ? (
            <View style={styles.pillRow}>
              {opslag && opslag !== 'ambient' && (
                <View style={[styles.pill, { borderColor: border, backgroundColor: subBg }]}>
                  <MaterialCommunityIcons name={STORAGE_ICON[opslag] as any} size={12} color={colors.textSecondary} />
                  <Text style={[styles.pillTxt, { color: colors.textSecondary }]}>{STORAGE_LABEL[opslag]}</Text>
                </View>
              )}
              {organic && (
                <View style={[styles.pill, { borderColor: border, backgroundColor: subBg }]}>
                  <MaterialCommunityIcons name="leaf" size={12} color={colors.textSecondary} />
                  <Text style={[styles.pillTxt, { color: colors.textSecondary }]}>Biologisch</Text>
                </View>
              )}
              {featured && (
                <View style={[styles.pill, { borderColor: border, backgroundColor: subBg }]}>
                  <MaterialCommunityIcons name="star-outline" size={12} color={colors.textSecondary} />
                  <Text style={[styles.pillTxt, { color: colors.textSecondary }]}>Featured</Text>
                </View>
              )}
            </View>
          ) : null}

          {/* Snelle acties */}
          <View style={styles.quickActionsRow}>
            <TouchableOpacity onPress={shareProduct} style={[styles.quickActionBtn, { borderColor: border }]} activeOpacity={0.7}>
              <MaterialCommunityIcons name="share-variant-outline" size={15} color={colors.text} />
              <Text style={[styles.quickActionTxt, { color: colors.text }]}>Delen</Text>
            </TouchableOpacity>
            {hasChanges && (
              <TouchableOpacity onPress={resetChanges} style={[styles.quickActionBtn, { borderColor: border }]} activeOpacity={0.7}>
                <MaterialCommunityIcons name="undo-variant" size={15} color={colors.text} />
                <Text style={[styles.quickActionTxt, { color: colors.text }]}>Herstel</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Stat strip */}
          <View style={[styles.statStrip, { borderTopColor: border }]}>
            <View style={styles.statCell}>
              <Text style={[styles.statVal, { color: colors.text }]}>{stockWinkelNum}</Text>
              <Text style={[styles.statLbl, { color: colors.textMuted }]}>Winkel</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: border }]} />
            <View style={styles.statCell}>
              <Text style={[styles.statVal, { color: colors.text }]}>{stockMagazijnNum}</Text>
              <Text style={[styles.statLbl, { color: colors.textMuted }]}>Magazijn</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: border }]} />
            <View style={styles.statCell}>
              <Text
                style={[
                  styles.statValSm,
                  { color: thtDays !== null && thtDays <= 30 ? thtColor : colors.text },
                ]}
              >
                {tht ? formatDate(parseDate(tht)) : '—'}
              </Text>
              <Text style={[styles.statLbl, { color: colors.textMuted }]}>THT</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: border }]} />
            <View style={styles.statCell}>
              <Text style={[styles.statValSm, { color: colors.text }]} numberOfLines={1}>
                {product.filiaal.schapNaam || '—'}
              </Text>
              <Text style={[styles.statLbl, { color: colors.textMuted }]}>Locatie</Text>
            </View>
          </View>
        </View>

        {/* ── THT WAARSCHUWING ── */}
        {thtDays !== null && thtDays <= 30 && (
          <View style={[styles.warnBanner, { backgroundColor: thtBg }]}>
            <MaterialCommunityIcons
              name={thtDays < 0 ? 'close-circle-outline' : 'clock-alert-outline'}
              size={17}
              color={thtColor}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.warnTitle, { color: thtColor }]}>
                {thtDays < 0
                  ? `Verlopen ${Math.abs(thtDays)} dagen geleden`
                  : thtDays === 0
                  ? 'Vervalt vandaag'
                  : `Vervalt over ${thtDays} dag${thtDays === 1 ? '' : 'en'}`}
              </Text>
              <Text style={[styles.warnSub, { color: thtColor, opacity: 0.8 }]}>
                {thtDays < 0 ? 'Verwijder uit schapruimte' : thtDays <= 7 ? 'Afprijs of retour overwegen' : 'Plan herbestelling in'}
              </Text>
            </View>
          </View>
        )}

        {/* ── TOAST ── */}
        {!!saveMessage && (
          <Animated.View style={[styles.toast, { opacity: saveAnim, backgroundColor: p.success }]}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#fff" />
            <Text style={styles.toastTxt}>{saveMessage}</Text>
          </Animated.View>
        )}

        {/* ── VERKOOP ── */}
        {verkoopStats && (
          <Section title="Verkoop" surface={surface} border={border} colors={colors}>
            <View style={styles.verkoopRow}>
              <VerkoopStatCel label="Vorige week" aantal={verkoopStats.vorigeWeek.aantal} omzet={verkoopStats.vorigeWeek.omzet} colors={colors} />
              <View style={[styles.statDivider, { backgroundColor: border }]} />
              <VerkoopStatCel label="Deze week" aantal={verkoopStats.huidigeWeek.aantal} omzet={verkoopStats.huidigeWeek.omzet} colors={colors} nadruk />
              <View style={[styles.statDivider, { backgroundColor: border }]} />
              <VerkoopStatCel label="Prognose/week" aantal={verkoopStats.prognose.aantal} omzet={verkoopStats.prognose.omzet} colors={colors} />
            </View>
          </Section>
        )}

        {/* ── GERELATEERDE PRODUCTEN ── */}
        {gerelateerdeProducten.length > 0 && (
          <Section title="Vaak samen gekocht" surface={surface} border={border} colors={colors}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.relatedRow}
            >
              {gerelateerdeProducten.map((rp) => (
                <TouchableOpacity
                  key={rp.id}
                  style={[styles.relatedCard, { borderColor: border, backgroundColor: p.surfaceAlt }]}
                  activeOpacity={0.75}
                  onPress={() => router.push({ pathname: '/product/[barcode]', params: { barcode: rp.barcode } })}
                >
                  <View style={[styles.relatedImgWrap, { backgroundColor: surface }]}>
                    {rp.afbeelding ? (
                      <Image source={{ uri: rp.afbeelding }} style={styles.relatedImg} resizeMode="contain" />
                    ) : (
                      <MaterialCommunityIcons name="package-variant" size={22} color={colors.textMuted} />
                    )}
                  </View>
                  <Text style={[styles.relatedNaam, { color: colors.text }]} numberOfLines={2}>{rp.naam}</Text>
                  <View style={[styles.relatedBadge, { backgroundColor: p.accentSoft }]}>
                    <Text style={[styles.relatedBadgeTxt, { color: p.accent }]}>{rp.percentage}% samen</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Section>
        )}

        {/* ── EDITBARE VELDEN ── */}
        <Section title="Voorraad bijwerken" surface={surface} border={border} colors={colors}>

          {/* Winkel voorraad */}
          <View style={[styles.editRow, { borderBottomWidth: 0.5, borderBottomColor: divider }]}>
            <View style={styles.editRowLeft}>
              <Text style={[styles.editLbl, { color: colors.text }]}>Winkel</Text>
              <Text style={[styles.editSub, { color: colors.textSecondary }]}>Stuks op de winkelvloer</Text>
            </View>
            <Stepper
              value={stockWinkel}
              onChange={setStockWinkel}
              palette={p}
              inputBg={inputBg}
            />
          </View>

          {/* Magazijn voorraad */}
          <View style={[styles.editRow, { borderBottomWidth: 0.5, borderBottomColor: divider }]}>
            <View style={styles.editRowLeft}>
              <Text style={[styles.editLbl, { color: colors.text }]}>Magazijn</Text>
              <Text style={[styles.editSub, { color: colors.textSecondary }]}>Stuks op voorraad depot</Text>
            </View>
            <Stepper
              value={stockMagazijn}
              onChange={setStockMagazijn}
              palette={p}
              inputBg={inputBg}
            />
          </View>

          {/* THT */}
          <View style={styles.editRow}>
            <View style={styles.editRowLeft}>
              <Text style={[styles.editLbl, { color: colors.text }]}>THT datum</Text>
              <Text style={[styles.editSub, { color: colors.textSecondary }]}>Tenminste houdbaar tot</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowDatePicker(v => !v)}
              style={[
                styles.datePill,
                {
                  backgroundColor: inputBg,
                  borderColor: thtDays !== null && thtDays <= 30 ? thtColor : border,
                },
              ]}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="calendar-outline"
                size={14}
                color={thtDays !== null && thtDays <= 30 ? thtColor : colors.textSecondary}
              />
              <Text
                style={[
                  styles.datePillTxt,
                  { color: thtDays !== null && thtDays <= 30 ? thtColor : colors.text },
                ]}
              >
                {tht ? formatDate(parseDate(tht)) : 'Instellen'}
              </Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <View style={[styles.datePickerWrap, { borderTopColor: divider }]}>
              <DateTimePicker
                value={parseDate(tht)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                onChange={(_, date) => {
                  if (!date) return;
                  const y = date.getFullYear();
                  const m = String(date.getMonth() + 1).padStart(2, '0');
                  const d = String(date.getDate()).padStart(2, '0');
                  setThtLocal(`${y}-${m}-${d}`);
                }}
                style={{ alignSelf: 'stretch' }}
              />
              <TouchableOpacity
                onPress={() => setShowDatePicker(false)}
                style={[styles.donePill, { backgroundColor: p.accent }]}
                activeOpacity={0.85}
              >
                <Text style={styles.donePillTxt}>Gereed</Text>
              </TouchableOpacity>
            </View>
          )}
        </Section>

        {/* ── VOORRAADNIVEAU ── */}
        <Section
          title="Voorraadniveau"
          surface={surface}
          border={border}
          colors={colors}
          trailing={
            onderHerbestel ? (
              <View style={[styles.sectionFlag, { backgroundColor: p.dangerSoft }]}>
                <Text style={[styles.sectionFlagTxt, { color: p.danger }]}>Onder herbestelpunt</Text>
              </View>
            ) : null
          }
        >
          <View style={styles.stockWrap}>
            <View style={styles.stockLabels}>
              <Text style={[styles.stockLabelTxt, { color: colors.textMuted }]}>0</Text>
              {reorderPoint > 0 && (
                <Text style={[styles.stockLabelTxt, { color: colors.textMuted }]}>
                  herbestelpunt {reorderPoint}
                </Text>
              )}
              <Text style={[styles.stockLabelTxt, { color: colors.textMuted }]}>{maxStock} max</Text>
            </View>
            <View style={[styles.stockTrack, { backgroundColor: p.surfaceAlt }]}>
              <View
                style={[
                  styles.stockFill,
                  {
                    width: `${fillPct}%` as any,
                    backgroundColor: onderHerbestel ? p.danger : p.accent,
                  },
                ]}
              />
              {reorderPoint > 0 && (
                <View style={[styles.stockMarker, { left: `${reorderPct}%` as any, backgroundColor: p.textMuted }]} />
              )}
            </View>
            <View style={[styles.stockStats, { borderColor: border }]}>
              <StockStat label="Winkel"   value={stockWinkelNum}   color={colors.text}     colors={colors} />
              <View style={[styles.stockStatDiv, { backgroundColor: divider }]} />
              <StockStat label="Magazijn" value={stockMagazijnNum} color={colors.text}     colors={colors} />
              <View style={[styles.stockStatDiv, { backgroundColor: divider }]} />
              <StockStat label="Totaal"   value={totaalStock}      color={p.accent}        colors={colors} />
              <View style={[styles.stockStatDiv, { backgroundColor: divider }]} />
              <StockStat label="Herbestel" value={reorderPoint || 0} color={onderHerbestel ? p.danger : colors.textSecondary} colors={colors} />
            </View>
          </View>
        </Section>

        {/* ── PRODUCTINFO (read-only) ── */}
        <Section title="Productinformatie" surface={surface} border={border} colors={colors}>
          <InfoRow label="Categorie"     value={product.categorie}                 divider={divider} colors={colors} />
          <InfoRow label="Subcategorie"  value={product.subcategorie}              divider={divider} colors={colors} />
          <InfoRow label="Merk"          value={product.merk || '—'}               divider={divider} colors={colors} />
          <InfoRow label="Leverancier"   value={product.leverancier || '—'}        divider={divider} colors={colors} />
          <InfoRow label="Eenheid"       value={`${product.eenheidType} · ${product.eenheidGrootte}`} divider={divider} colors={colors} />
          <InfoRow label="Colli-grootte" value={String(product.colloGrootte)}      divider={divider} colors={colors} last />
        </Section>

        {/* ── OPSLAG & LOCATIE (read-only, op laatste levering na) ── */}
        <Section title="Opslag & locatie" surface={surface} border={border} colors={colors}>
          <InfoRow label="Locatie"          value={product.filiaal.schapNaam || '—'} divider={divider} colors={colors} />
          <InfoRow label="Laatste levering" value={product.filiaal.laatsteLevering ? formatDate(new Date(product.filiaal.laatsteLevering)) : '—'} divider={divider} colors={colors} last />
        </Section>

        {/* ── KENMERKEN (tik om te wisselen) ── */}
        <Section title="Kenmerken" surface={surface} border={border} colors={colors}>
          <FlagInfoRow label="Featured"   icon="star-outline" active={featured} palette={p} divider={divider} colors={colors} onPress={() => setFeatured(v => !v)} />
          <FlagInfoRow label="Biologisch" icon="leaf"         active={organic}  palette={p} divider={divider} colors={colors} onPress={() => setOrganic(v => !v)} />
          <TouchableOpacity
            style={styles.flagRow}
            onPress={() => kiesOpslag(opslag, setOpslag)}
            activeOpacity={0.6}
          >
            <MaterialCommunityIcons
              name={(opslag ? STORAGE_ICON[opslag] : 'home-thermometer-outline') as any}
              size={16}
              color={colors.text}
            />
            <Text style={[styles.flagLbl, { color: colors.text }]}>Opslag</Text>
            <Text style={[styles.opslagWaarde, { color: colors.textSecondary }]}>
              {opslag ? STORAGE_LABEL[opslag] : 'Instellen'}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </Section>

        {/* ── OPMERKINGEN (bewerkbaar) ── */}
        <Section title="Opmerkingen" surface={surface} border={border} colors={colors}>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Voeg een opmerking toe over dit product…"
            placeholderTextColor={colors.textMuted}
            multiline
            style={[styles.notesInput, { color: colors.text }]}
            selectionColor={p.accent}
          />
        </Section>

        {/* ── AFDRUKKEN ── */}
        <Section title="Afdrukken" surface={surface} border={border} colors={colors}>
          <PrintRow icon="card-text-outline" title="Schapkaart"       sub="A6 · Naam, barcode, locatie, THT" palette={p} divider={divider} colors={colors} onPress={() => setPrintModal('schapkaart')} />
          <PrintRow icon="tag-outline"       title="Promotiekaart"    sub="A4 / Barker · Van/voor prijs"     palette={p} divider={divider} colors={colors} onPress={() => setPrintModal('promo')} />
          <PrintRow icon="sticker-outline"   title="Afprijs stickers" sub="8× per A4 · Was/voor prijs"       palette={p} divider={divider} colors={colors} onPress={() => setPrintModal('afprijs')} last />
        </Section>

      </ScrollView>

      {/* ── MODAL: SCHAPKAART ── */}
      <PrintSheetModal
        visible={printModal === 'schapkaart'}
        onClose={() => setPrintModal(null)}
        title="Schapkaart"
        accentColor={p.accent}
        palette={p}
        colors={colors}
        isPrinting={isPrinting}
        onPrint={handlePrint}
        printLabel="Afdrukken (A6)"
      >
        <View style={[styles.previewBox, { backgroundColor: p.surfaceAlt, borderColor: border }]}>
          <Text style={[styles.previewName, { color: colors.text }]}>{product.naam}</Text>
          <Text style={[styles.previewSub, { color: colors.textSecondary }]}>{product.categorie} · {product.merk || product.leverancier || '—'}</Text>
          <View style={styles.previewStats}>
            <PreviewStat label="Voorraad" value={`${product.filiaal.opSchap} ${product.eenheidType}`} colors={colors} />
            <PreviewStat label="Locatie"  value={product.filiaal.schapNaam || '—'}         colors={colors} />
            <PreviewStat label="THT"      value={tht ? formatDate(parseDate(tht)) : '—'} colors={colors} />
          </View>
        </View>
      </PrintSheetModal>

      {/* ── MODAL: PROMO ── */}
      <PrintSheetModal
        visible={printModal === 'promo'}
        onClose={() => setPrintModal(null)}
        title={`Promotiekaart (${promoFormaat})`}
        accentColor={p.accent}
        palette={p}
        colors={colors}
        isPrinting={isPrinting}
        onPrint={handlePrint}
        printLabel={`Afdrukken (${promoFormaat})`}
      >
        <View style={styles.formatRow}>
          {(['A4', 'Barker'] as const).map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setPromoFormaat(f)}
              style={[styles.formatChip, {
                borderColor: promoFormaat === f ? p.accent : border,
                backgroundColor: promoFormaat === f ? p.accent : 'transparent',
              }]}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name={f === 'A4' ? 'file-outline' : 'card-outline'} size={16} color={promoFormaat === f ? '#fff' : colors.text} />
              <Text style={[styles.formatChipTxt, { color: promoFormaat === f ? '#fff' : colors.text }]}>
                {f === 'A4' ? 'A4 Poster' : 'Barker (vierkant)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <PriceInputRow vanPrijs={vanPrijs} setVanPrijs={setVanPrijs} voorPrijs={voorPrijs} setVoorPrijs={setVoorPrijs} accentColor={p.accent} palette={p} colors={colors} border={border} />
      </PrintSheetModal>

      {/* ── MODAL: AFPRIJS ── */}
      <PrintSheetModal
        visible={printModal === 'afprijs'}
        onClose={() => setPrintModal(null)}
        title="Afprijs stickers"
        accentColor={p.danger}
        palette={p}
        colors={colors}
        isPrinting={isPrinting}
        onPrint={handlePrint}
        printLabel="Afdrukken (8× per A4)"
      >
        <PriceInputRow vanPrijs={vanPrijs} setVanPrijs={setVanPrijs} voorPrijs={voorPrijs} setVoorPrijs={setVoorPrijs} accentColor={p.danger} palette={p} colors={colors} border={border} />
      </PrintSheetModal>

    </ThemedView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, surface, border, colors, trailing, children }: {
  title: string; surface: string; border: string; colors: any;
  trailing?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionWrap}>
      <View style={styles.sectionLabelRow}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{title}</Text>
        {trailing}
      </View>
      <View style={[styles.section, { backgroundColor: surface, borderColor: border }]}>
        {children}
      </View>
    </View>
  );
}

function Stepper({ value, onChange, palette, inputBg }: {
  value: string; onChange: (updater: (v: string) => string) => void;
  palette: Palette; inputBg: string;
}) {
  const num = parseInt(value, 10) || 0;
  return (
    <View style={[styles.stepper, { backgroundColor: inputBg, borderColor: palette.border }]}>
      <TouchableOpacity
        onPress={() => onChange(v => String(Math.max(0, (parseInt(v, 10) || 0) - 1)))}
        style={styles.stepBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        disabled={num === 0}
      >
        <MaterialCommunityIcons
          name="minus"
          size={15}
          color={num === 0 ? palette.textMuted : palette.text}
        />
      </TouchableOpacity>
      <TextInput
        value={value}
        onChangeText={v => onChange(() => v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        style={[styles.stepField, { color: palette.text }]}
        selectionColor={palette.accent}
      />
      <TouchableOpacity
        onPress={() => onChange(v => String((parseInt(v, 10) || 0) + 1))}
        style={styles.stepBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialCommunityIcons name="plus" size={15} color={palette.text} />
      </TouchableOpacity>
    </View>
  );
}

function InfoRow({ label, value, valueColor, divider, colors, last }: {
  label: string; value: string; valueColor?: string; divider: string; colors: any; last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && { borderBottomWidth: 0.5, borderBottomColor: divider }]}>
      <Text style={[styles.infoLbl, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoVal, { color: valueColor ?? colors.text }]}>{value}</Text>
    </View>
  );
}

function FlagInfoRow({ label, icon, active, palette, divider, colors, onPress, last }: {
  label: string; icon: string; active: boolean; palette: Palette; divider: string; colors: any;
  onPress?: () => void; last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.flagRow, !last && { borderBottomWidth: 0.5, borderBottomColor: divider }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
    >
      <MaterialCommunityIcons
        name={icon as any}
        size={16}
        color={active ? palette.accent : colors.textMuted}
      />
      <Text style={[styles.flagLbl, { color: colors.text }]}>{label}</Text>
      <View
        style={[
          styles.switchTrack,
          {
            backgroundColor: active ? palette.accent : palette.surfaceAlt,
            borderColor: active ? palette.accent : palette.border,
          },
        ]}
      >
        <View
          style={[
            styles.switchThumb,
            {
              backgroundColor: active ? '#fff' : palette.textMuted,
              alignSelf: active ? 'flex-end' : 'flex-start',
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

function StockStat({ label, value, color, colors }: {
  label: string; value: number; color: string; colors: any;
}) {
  return (
    <View style={styles.stockStatCell}>
      <Text style={[styles.stockStatVal, { color }]}>{value}</Text>
      <Text style={[styles.stockStatLbl, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function PrintRow({ icon, title, sub, palette, divider, colors, onPress, last }: {
  icon: string; title: string; sub: string; palette: Palette;
  divider: string; colors: any; onPress: () => void; last?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.printRow, !last && { borderBottomWidth: 0.5, borderBottomColor: divider }]}
      activeOpacity={0.7}
    >
      <View style={[styles.printRowIcon, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.printRowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.printRowSub, { color: colors.textSecondary }]}>{sub}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function VerkoopStatCel({ label, aantal, omzet, colors, nadruk }: {
  label: string; aantal: number; omzet: number; colors: any; nadruk?: boolean;
}) {
  return (
    <View style={styles.verkoopCel}>
      <Text style={[styles.verkoopLbl, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.verkoopVal, { color: nadruk ? colors.accent : colors.text }]}>{aantal}</Text>
      <Text style={[styles.verkoopOmzet, { color: colors.textSecondary }]}>{formatEuro(omzet)}</Text>
    </View>
  );
}

function PreviewStat({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={{ flex: 1, gap: 3 }}>
      <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{value}</Text>
    </View>
  );
}

function PrintSheetModal({ visible, onClose, title, accentColor, palette, colors, isPrinting, onPrint, printLabel, children }: {
  visible: boolean; onClose: () => void; title: string; accentColor: string;
  palette: Palette; colors: any; isPrinting: boolean; onPrint: () => void;
  printLabel: string; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: palette.bg }]}>
        <View style={[styles.modalHdr, { backgroundColor: palette.surface, borderBottomColor: palette.border }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={[styles.modalCloseBtn, { backgroundColor: palette.surfaceAlt }]}>
            <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        <View style={[styles.modalFooter, { backgroundColor: palette.surface, borderTopColor: palette.border }]}>
          <TouchableOpacity onPress={onClose} style={[styles.cancelBtn, { borderColor: palette.border }]}>
            <Text style={[styles.cancelTxt, { color: colors.textSecondary }]}>Annuleren</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onPrint}
            disabled={isPrinting}
            style={[styles.printBtn, { backgroundColor: accentColor, opacity: isPrinting ? 0.7 : 1 }]}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="printer" size={18} color="#fff" />
            <Text style={styles.printBtnTxt}>{isPrinting ? 'Bezig...' : printLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function PriceInputRow({ vanPrijs, setVanPrijs, voorPrijs, setVoorPrijs, accentColor, palette, colors, border }: {
  vanPrijs: string; setVanPrijs: (v: string) => void;
  voorPrijs: string; setVoorPrijs: (v: string) => void;
  accentColor: string; palette: Palette; colors: any; border: string;
}) {
  return (
    <View style={styles.priceRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.priceLbl, { color: colors.textMuted }]}>Was-prijs</Text>
        <View style={[styles.priceInput, { backgroundColor: palette.surfaceAlt, borderColor: border }]}>
          <Text style={[styles.priceEuro, { color: colors.textMuted }]}>€</Text>
          <TextInput value={vanPrijs} onChangeText={setVanPrijs} placeholder="0,00" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" style={[styles.priceInputTxt, { color: colors.text }]} selectionColor={accentColor} />
        </View>
      </View>
      <MaterialCommunityIcons name="arrow-right" size={16} color={colors.textMuted} style={{ marginTop: 22 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.priceLbl, { color: colors.textMuted }]}>Voor-prijs</Text>
        <View style={[styles.priceInput, { backgroundColor: palette.surfaceAlt, borderColor: accentColor }]}>
          <Text style={[styles.priceEuro, { color: accentColor }]}>€</Text>
          <TextInput value={voorPrijs} onChangeText={setVoorPrijs} placeholder="0,00" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" style={[styles.priceInputTxt, { color: accentColor, fontWeight: '700' }]} selectionColor={accentColor} />
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const F = FontFamily;

const styles = StyleSheet.create({
  container:  { flex: 1 },
  scroll:     { paddingBottom: 56 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', fontFamily: F },
  emptySubtitle: { fontSize: 13, fontFamily: F },

  // Header save btn
  headerSaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Palette.light.accent, paddingHorizontal: 13, paddingVertical: 7, borderRadius: Radius.pill },
  headerSaveTxt: { color: '#fff', fontSize: 12.5, fontWeight: '600', fontFamily: F },

  // Hero
  hero:        { paddingTop: 104, paddingHorizontal: Spacing.lg + 2, paddingBottom: 0, borderBottomWidth: 0.5 },
  eyebrowRow:  { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  eyebrow:     { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, fontFamily: F },
  statusDot:   { width: 4, height: 4, borderRadius: 2 },
  heroName:    { fontSize: 21, fontWeight: '700', lineHeight: 27, letterSpacing: -0.4, marginBottom: 5, fontFamily: F },
  barcodeRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md + 2 },
  barcodeTxt:  { fontSize: 11.5, fontWeight: '500', letterSpacing: 0.6, fontFamily: F },
  barcodeSep:  { fontSize: 11.5, fontFamily: F },

  // Attribuut-chips
  pillRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.md + 2 },
  pill:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: Radius.sm - 2, borderWidth: 0.5 },
  pillTxt:     { fontSize: 11, fontWeight: '500', fontFamily: F },

  // Quick actions
  quickActionsRow: { flexDirection: 'row', gap: 7, marginBottom: Spacing.lg },
  quickActionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 0.5, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 7 },
  quickActionTxt:  { fontSize: 12, fontWeight: '500', fontFamily: F },

  // Stat strip
  statStrip:   { flexDirection: 'row', borderTopWidth: 0.5 },
  statCell:    { flex: 1, alignItems: 'center', paddingVertical: Spacing.md + 2, gap: 3 },
  statDivider: { width: 0.5 },
  statVal:     { fontSize: 19, fontWeight: '600', textAlign: 'center', letterSpacing: -0.3, fontFamily: F },
  statValSm:   { fontSize: 12.5, fontWeight: '600', textAlign: 'center', fontFamily: F },
  statLbl:     { fontSize: 9.5, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '500', fontFamily: F },

  // Warn banner
  warnBanner:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginHorizontal: Spacing.lg, marginTop: Spacing.lg, borderRadius: Radius.md, padding: Spacing.md + 2 },
  warnTitle:   { fontSize: 13, fontWeight: '600', fontFamily: F },
  warnSub:     { fontSize: 11.5, marginTop: 1, fontFamily: F },

  // Toast
  toast:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.lg, marginTop: Spacing.md, backgroundColor: Palette.light.success, borderRadius: Radius.md, paddingHorizontal: Spacing.md + 2, paddingVertical: 10 },
  toastTxt:    { color: '#fff', fontSize: 12.5, fontWeight: '600', fontFamily: F },

  // Verkoop
  verkoopRow:      { flexDirection: 'row', paddingVertical: Spacing.md + 2 },
  verkoopCel:      { flex: 1, alignItems: 'center', gap: 3 },
  verkoopLbl:      { fontSize: 9.5, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '500', fontFamily: F },
  verkoopVal:      { fontSize: 19, fontWeight: '600', textAlign: 'center', letterSpacing: -0.3, fontFamily: F },
  verkoopOmzet:    { fontSize: 11, fontFamily: F },
  verkoopFootnote: { fontSize: 10.5, fontFamily: F, paddingHorizontal: Spacing.md + 2, paddingBottom: Spacing.md, marginTop: -4 },

  // Gerelateerde producten
  relatedRow:     { gap: Spacing.sm, padding: Spacing.md + 2 },
  relatedCard:    { width: 110, borderWidth: 0.5, borderRadius: Radius.md, padding: Spacing.sm + 2, gap: 6, alignItems: 'center' },
  relatedImgWrap: { width: 52, height: 52, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  relatedImg:     { width: '100%', height: '100%' },
  relatedNaam:    { fontSize: 11.5, fontWeight: '600', fontFamily: F, textAlign: 'center' },
  relatedBadge:   { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  relatedBadgeTxt:{ fontSize: 10, fontWeight: '700', fontFamily: F },

  // Section
  sectionWrap:     { marginHorizontal: Spacing.lg, marginTop: Spacing.xl },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9, paddingHorizontal: 3 },
  sectionLabel:    { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, fontFamily: F },
  sectionFlag:     { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  sectionFlagTxt:  { fontSize: 10, fontWeight: '600', fontFamily: F },
  section:         { borderRadius: Radius.lg, borderWidth: 0.5, overflow: 'hidden', ...(Shadow.card as object) },

  // Editable rows
  editRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md + 1, gap: Spacing.md },
  editRowLeft: { flex: 1, gap: 2 },
  editLbl:     { fontSize: 13.5, fontWeight: '600', fontFamily: F },
  editSub:     { fontSize: 11.5, fontFamily: F },

  // Stepper
  stepper:     { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.sm, borderWidth: 0.5, overflow: 'hidden' },
  stepBtn:     { paddingHorizontal: 11, paddingVertical: 8 },
  stepField:   { fontSize: 15, fontWeight: '600', textAlign: 'center', minWidth: 40, paddingVertical: 6, fontFamily: F },

  // Date pill
  datePill:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.sm, borderWidth: 0.5, paddingHorizontal: 12, paddingVertical: 9 },
  datePillTxt: { fontSize: 13, fontWeight: '600', fontFamily: F },
  datePickerWrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md + 2, gap: Spacing.md, borderTopWidth: 0.5 },
  donePill:    { alignSelf: 'flex-start', paddingHorizontal: Spacing.lg + 2, paddingVertical: 8, borderRadius: Radius.pill },
  donePillTxt: { color: '#fff', fontSize: 12.5, fontWeight: '600', fontFamily: F },

  // Info rows
  infoRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md },
  infoLbl:     { fontSize: 13, flex: 1, fontFamily: F },
  infoVal:     { fontSize: 13, fontWeight: '600', textAlign: 'right', maxWidth: '60%', fontFamily: F },

  // Flag rows
  flagRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  flagLbl:     { flex: 1, fontSize: 13.5, fontWeight: '500', fontFamily: F },
  switchTrack: { width: 38, height: 22, borderRadius: 11, borderWidth: 0.5, padding: 2, justifyContent: 'center' },
  switchThumb: { width: 16, height: 16, borderRadius: 8 },
  opslagWaarde: { fontSize: 12.5, fontFamily: F },

  // Notes
  notesInput:  { fontSize: 13, lineHeight: 20, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md + 2, minHeight: 84, textAlignVertical: 'top', fontFamily: F },

  // Stock bar
  stockWrap:       { padding: Spacing.lg, gap: 10 },
  stockLabels:     { flexDirection: 'row', justifyContent: 'space-between' },
  stockLabelTxt:   { fontSize: 10.5, fontWeight: '500', fontFamily: F },
  stockTrack:      { height: 8, borderRadius: Radius.pill, overflow: 'visible', position: 'relative' },
  stockFill:       { height: '100%', borderRadius: Radius.pill },
  stockMarker:     { position: 'absolute', top: -3, height: 14, width: 1.5, borderRadius: 1 },
  stockStats:      { flexDirection: 'row', borderWidth: 0.5, borderRadius: Radius.sm, overflow: 'hidden', marginTop: 5 },
  stockStatCell:   { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2 },
  stockStatDiv:    { width: 0.5 },
  stockStatVal:    { fontSize: 16, fontWeight: '600', letterSpacing: -0.2, fontFamily: F },
  stockStatLbl:    { fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '500', fontFamily: F },

  // Print rows
  printRow:        { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md + 1 },
  printRowIcon:    { width: 36, height: 36, borderRadius: Radius.sm, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  printRowTitle:   { fontSize: 13.5, fontWeight: '600', fontFamily: F },
  printRowSub:     { fontSize: 11.5, marginTop: 1, fontFamily: F },

  // Preview box
  previewBox:      { borderRadius: Radius.md, borderWidth: 0.5, padding: Spacing.lg, gap: 6 },
  previewName:     { fontSize: 15.5, fontWeight: '700', letterSpacing: -0.3, fontFamily: F },
  previewSub:      { fontSize: 12.5, fontFamily: F },
  previewStats:    { flexDirection: 'row', gap: Spacing.md, marginTop: 8 },

  // Modal
  modalContainer:  { flex: 1 },
  modalHdr:        { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg + 2, paddingVertical: Spacing.md + 2, paddingTop: Spacing.lg + 2, borderBottomWidth: 0.5 },
  modalTitle:      { flex: 1, fontSize: 16, fontWeight: '700', letterSpacing: -0.2, fontFamily: F },
  modalCloseBtn:   { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  modalBody:       { padding: Spacing.lg + 2, gap: Spacing.lg },
  modalFooter:     { flexDirection: 'row', gap: Spacing.sm + 2, padding: Spacing.lg + 2, borderTopWidth: 0.5 },
  cancelBtn:       { flex: 1, borderWidth: 0.5, borderRadius: Radius.md, paddingVertical: Spacing.md + 2, alignItems: 'center', justifyContent: 'center' },
  cancelTxt:       { fontSize: 13.5, fontWeight: '600', fontFamily: F },
  printBtn:        { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: Radius.md, paddingVertical: Spacing.md + 2 },
  printBtnTxt:     { color: '#fff', fontSize: 13.5, fontWeight: '600', fontFamily: F },

  // Format chips (promo modal)
  formatRow:       { flexDirection: 'row', gap: Spacing.sm + 2 },
  formatChip:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: Spacing.md, borderRadius: Radius.sm, borderWidth: 0.5 },
  formatChipTxt:   { fontSize: 12.5, fontWeight: '600', fontFamily: F },

  // Price inputs
  priceRow:        { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm + 2 },
  priceLbl:        { fontSize: 10, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: F },
  priceInput:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 0.5, borderRadius: Radius.sm, paddingHorizontal: 11, paddingVertical: 9 },
  priceEuro:       { fontSize: 15, fontWeight: '600', fontFamily: F },
  priceInputTxt:   { flex: 1, fontSize: 17, fontWeight: '600', padding: 0, fontFamily: F },
});

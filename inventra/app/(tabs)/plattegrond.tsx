import { AnimatedPressable } from '@/components/plattegrond/AnimatedPressable';
import { Sheet } from '@/components/plattegrond/Sheet';
import { SegmentedControl } from '@/components/plattegrond/SegmentedControl';
import { ScreenHeader } from '@/components/screen-header';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { cardShadow, groundedShadow, pickTheme, SCHAP_ACCENTS, Theme } from '@/constants/plattegrond-theme';
import { useAuth } from '@/contexts/auth-context';
import {
  Department,
  Shelf,
  departementen,
  getDepartementInfo,
  getShelvesByBranch,
  getStockForShelf,
} from '@/data/store-map';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ApiBranch } from '@/lib/api';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  LayoutChangeEvent,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type SchapMetType = Shelf;

// ─── Plattegrond­schaal ────────────────────────────────────────────────────

const WERELD_BREEDTE = 600;
const WERELD_HOOGTE = 360;
const SCHAAL = WERELD_BREEDTE / 50;
const MIN_ZOOM_FACTOR = 1;
const MAX_ZOOM_FACTOR = 3;

type Laag = 'alle' | 'voorraad' | 'temperatuur' | 'taken';

const LAGEN: { id: Laag; label: string }[] = [
  { id: 'alle', label: 'Alle lagen' },
  { id: 'voorraad', label: 'Voorraad' },
  { id: 'temperatuur', label: 'Temperatuur' },
  { id: 'taken', label: 'Taken' },
];

function clamp(waarde: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, waarde));
}

function tik(stijl: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  Haptics.impactAsync(stijl).catch(() => {});
}

function selectieTik() {
  Haptics.selectionAsync().catch(() => {});
}

function statusLabel(status: ApiBranch['status']): { label: string; kleur: (t: Theme) => string } | null {
  if (status === 'verbouwing') return { label: 'In verbouwing', kleur: (t) => t.warning };
  if (status === 'gesloten') return { label: 'Gesloten', kleur: (t) => t.danger };
  return null;
}

interface MarkerWeergave {
  accent: string;
  badge: number | null;
  badgeKleur: string;
  gedimd: boolean;
}

function bepaalMarkerWeergave(
  schap: Shelf,
  items: ReturnType<typeof getStockForShelf>,
  laag: Laag,
  actieveDepts: Department[] | null,
  theme: Theme
): MarkerWeergave {
  const laag_ondermin = items.filter((i) => i.shelfStock < i.minimumStock).length;
  const buitenDeptFilter = !!actieveDepts && !actieveDepts.includes(schap.department);

  if (laag === 'temperatuur') {
    const isGekoeld = schap.shortLabel === 'Vries';
    return {
      accent: isGekoeld ? theme.accent : theme.textMuted,
      badge: items.length === 0 ? null : items.length,
      badgeKleur: isGekoeld ? theme.accent : theme.textMuted,
      gedimd: !isGekoeld || buitenDeptFilter,
    };
  }

  if (laag === 'taken') {
    return {
      accent: theme.textMuted,
      badge: items.length === 0 ? null : items.length,
      badgeKleur: theme.textMuted,
      gedimd: true || buitenDeptFilter,
    };
  }

  if (laag === 'voorraad') {
    let accent = theme.good;
    if (laag_ondermin > 0 && laag_ondermin < items.length) accent = theme.warning;
    if (laag_ondermin > 0 && laag_ondermin === items.length && items.length > 0) accent = theme.danger;
    return {
      accent,
      badge: items.length === 0 ? null : (laag_ondermin > 0 ? laag_ondermin : items.length),
      badgeKleur: laag_ondermin > 0 ? theme.danger : accent,
      gedimd: buitenDeptFilter,
    };
  }

  const accent = SCHAP_ACCENTS[schap.shortLabel] ?? theme.accent;
  return {
    accent,
    badge: items.length === 0 ? null : (laag_ondermin > 0 ? laag_ondermin : items.length),
    badgeKleur: laag_ondermin > 0 ? theme.danger : accent,
    gedimd: buitenDeptFilter,
  };
}

// ─── Schap-marker ───────────────────────────────────────────────────────────
// Losse, gememoized component. Reageert alleen op long-press (opties-menu),
// heeft een korte "indruk"-animatie voor tactiele feedback tijdens het
// vasthouden, en verschijnt met een subtiele pop-in wanneer het filiaal wisselt.

interface ShelfMarkerProps {
  schap: SchapMetType;
  weergave: MarkerWeergave;
  index: number;
  theme: Theme;
  onLongPress: (schap: SchapMetType) => void;
}

const ShelfMarker = React.memo(function ShelfMarker({ schap, weergave, index, theme, onLongPress }: ShelfMarkerProps) {
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));

  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(380)
        .onBegin(() => {
          pressScale.value = withTiming(0.95, { duration: 90 });
        })
        .onStart(() => {
          runOnJS(onLongPress)(schap);
        })
        .onFinalize(() => {
          pressScale.value = withTiming(1, { duration: 120 });
        }),
    [schap, onLongPress]
  );

  const isApparatuur = schap.type === 'equipment';
  const breedtePx = schap.width * SCHAAL;
  const hoogtePx = schap.height * SCHAAL;
  // Eén verdeellijn per ~6 wereld-eenheden breedte — suggereert losse vakken
  // in een lang schap-blok, zonder dat het een exacte plankentelling is.
  const verdeellijnen = Math.max(0, Math.round(schap.width / 6) - 1);

  return (
    <GestureDetector gesture={longPressGesture}>
      <Animated.View
        entering={FadeIn.delay(Math.min(index, 12) * 10).duration(160)}
        accessible
        accessibilityRole="button"
        accessibilityLabel={
          weergave.badge !== null ? `${schap.name}, ${weergave.badge} producten` : schap.name
        }
        accessibilityHint="Lang indrukken voor opties"
        accessibilityActions={[{ name: 'longpress', label: 'Toon opties' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'longpress') onLongPress(schap);
        }}
        style={[
          styles.marker,
          pressStyle,
          {
            left: schap.x * SCHAAL - breedtePx / 2,
            top: schap.y * SCHAAL - hoogtePx / 2,
            width: breedtePx,
            opacity: weergave.gedimd ? 0.35 : 1,
          },
        ]}
      >
        <View style={groundedShadow(theme)}>
          <View
            style={[
              styles.blok,
              {
                width: breedtePx,
                height: hoogtePx,
                backgroundColor: weergave.accent + '22',
                borderColor: weergave.accent + '55',
              },
            ]}
          >
            {Array.from({ length: verdeellijnen }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.blokVerdeellijn,
                  { left: ((i + 1) * breedtePx) / (verdeellijnen + 1), backgroundColor: weergave.accent + '33' },
                ]}
              />
            ))}

            {isApparatuur && (
              <View style={[styles.equipmentDot, { backgroundColor: theme.equipment }]}>
                <IconSymbol name="bolt.fill" size={7} color="#fff" />
              </View>
            )}

            <Text style={[styles.blokLabel, { color: weergave.accent }]} numberOfLines={1}>
              {schap.shortLabel}
            </Text>

            {weergave.badge !== null && (
              <View style={[styles.badge, styles.badgeHoek, { backgroundColor: weergave.badgeKleur }]}>
                <Text style={styles.badgeText}>{weergave.badge}</Text>
              </View>
            )}
          </View>

          {/* Dieptevlak: donkerdere "zijkant" onder het blok, alsof het schap
              fysiek dikte heeft en op de vloer staat i.p.v. er plat op te liggen. */}
          <View style={[styles.rackDepth, { width: breedtePx - 6, backgroundColor: theme.rackDepthFill }]} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlattegrondScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const isDark = colorScheme === 'dark';
  const theme = useMemo(() => pickTheme(isDark), [isDark]);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { user, branches } = useAuth();
  // Nog geen branch_id ingesteld op het account? Dan terugvallen op filiaal 1
  // i.p.v. een leeg scherm te tonen.
  const branchId = user?.branchId ?? 1;
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [zoekterm, setZoekterm] = useState('');
  const [activeDepts, setActiveDepts] = useState<Department[] | null>(null);
  const [laag, setLaag] = useState<Laag>('alle');
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(null);

  const branch = useMemo(() => branches.find((b) => b.id === branchId), [branches, branchId]);
  const schappen = useMemo(() => getShelvesByBranch(branchId) as SchapMetType[], [branchId]);
  const badge = branch ? statusLabel(branch.status) : null;

  const stockMap = useMemo(() => {
    const map = new Map<number, ReturnType<typeof getStockForShelf>>();
    schappen.forEach((s) => map.set(s.id, getStockForShelf(s.id)));
    return map;
  }, [schappen]);

  const laagOndermin = useMemo(
    () =>
      schappen.reduce((totaal, s) => {
        const items = stockMap.get(s.id) ?? [];
        return totaal + items.filter((i) => i.shelfStock < i.minimumStock).length;
      }, 0),
    [schappen, stockMap]
  );

  const fitSchaal = useMemo(() => {
    if (!viewport) return 0.5;
    return Math.min(viewport.w / WERELD_BREEDTE, viewport.h / WERELD_HOOGTE);
  }, [viewport]);

  // ── Pan & zoom ──
  const scale = useSharedValue(0.5);
  const savedScale = useSharedValue(0.5);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const viewportWidth = useSharedValue(0);
  const viewportHeight = useSharedValue(0);

  useEffect(() => {
    if (!viewport) return;
    scale.value = fitSchaal;
    savedScale.value = fitSchaal;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSchaal, viewport]);

  const onMapLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    viewportWidth.value = width;
    viewportHeight.value = height;
    setViewport((prev) => (prev && prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, fitSchaal * MIN_ZOOM_FACTOR, fitSchaal * MAX_ZOOM_FACTOR);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      const marginX = Math.max(0, (WERELD_BREEDTE * scale.value - viewportWidth.value) / 2);
      const marginY = Math.max(0, (WERELD_HOOGTE * scale.value - viewportHeight.value) / 2);
      translateX.value = clamp(translateX.value, -marginX, marginX);
      translateY.value = clamp(translateY.value, -marginY, marginY);
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const panGesture = Gesture.Pan()
    .minDistance(6)
    .onUpdate((e) => {
      const marginX = Math.max(0, (WERELD_BREEDTE * scale.value - viewportWidth.value) / 2);
      const marginY = Math.max(0, (WERELD_HOOGTE * scale.value - viewportHeight.value) / 2);
      translateX.value = clamp(savedTranslateX.value + e.translationX, -marginX, marginX);
      translateY.value = clamp(savedTranslateY.value + e.translationY, -marginY, marginY);
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const wereldStijl = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const zoomMet = (factor: number) => {
    tik();
    const volgende = clamp(scale.value * factor, fitSchaal * MIN_ZOOM_FACTOR, fitSchaal * MAX_ZOOM_FACTOR);
    scale.value = withTiming(volgende, { duration: 180 });
    savedScale.value = volgende;
  };

  const centreren = () => {
    tik(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withTiming(fitSchaal, { duration: 220 });
    translateX.value = withTiming(0, { duration: 220 });
    translateY.value = withTiming(0, { duration: 220 });
    savedScale.value = fitSchaal;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  // ── Navigatie naar detailpagina ──
  const naarSchapDetail = (schap: SchapMetType, tab?: 'metadata') => {
    router.push({
      pathname: '/schap/[id]',
      params: { id: String(schap.id), ...(tab ? { tab } : {}) },
    });
  };

  const meldProbleem = (schap: SchapMetType) => {
    // TODO: koppel aan echte meldingsflow zodra beschikbaar (bv. n8n-webhook).
    Alert.alert('Probleem melden', `Meldingsflow voor "${schap.name}" is nog niet gekoppeld.`);
  };

  const openMarkerMenu = (schap: SchapMetType) => {
    tik(Haptics.ImpactFeedbackStyle.Medium);

    const isApparatuur = schap.type === 'equipment';
    const opties: { label: string; actie: () => void }[] = [
      { label: 'Bekijk schap', actie: () => naarSchapDetail(schap) },
      { label: 'Meld probleem', actie: () => meldProbleem(schap) },
    ];
    if (isApparatuur) {
      opties.push({ label: 'Bekijk metadata', actie: () => naarSchapDetail(schap, 'metadata') });
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: schap.name,
          options: [...opties.map((o) => o.label), 'Annuleren'],
          cancelButtonIndex: opties.length,
        },
        (index) => {
          if (index < opties.length) opties[index].actie();
        }
      );
    } else {
      Alert.alert(schap.name, undefined, [
        ...opties.map((o) => ({ text: o.label, onPress: o.actie })),
        { text: 'Annuleren', style: 'cancel' as const },
      ]);
    }
  };

  const toggleDept = (id: Department) => {
    selectieTik();
    setActiveDepts((cur) => {
      if (!cur) return departementen.filter((d) => d.id !== id).map((d) => d.id);
      const bevat = cur.includes(id);
      const volgende = bevat ? cur.filter((d) => d !== id) : [...cur, id];
      return volgende.length === departementen.length ? null : volgende;
    });
  };

  const zoekresultaten = useMemo(() => {
    const q = zoekterm.trim().toLowerCase();
    if (!q) return [];
    return schappen.filter(
      (s) => s.name.toLowerCase().includes(q) || s.department.toLowerCase().includes(q) || s.shortLabel.toLowerCase().includes(q)
    );
  }, [zoekterm, schappen]);

  const laagCaption =
    laag === 'temperatuur'
      ? 'Temperatuursensoren zijn nog niet aan schappen gekoppeld — alleen koeling/vries is aangeduid.'
      : laag === 'taken'
      ? 'Taken zijn nog niet aan een locatie op de kaart gekoppeld.'
      : null;

  if (!branch) {
    return (
      <View style={[styles.container, { backgroundColor: theme.pageBg }]}>
        <SafeAreaView edges={['top']} style={styles.leegState}>
          <Text style={[styles.leegStateTekst, { color: theme.textSecondary }]}>
            {branches.length === 0
              ? 'Filialen laden…'
              : 'Geen filiaal gevonden voor dit account.'}
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.pageBg }]}>
      <ScreenHeader title="Winkelkaart" />

      <View style={{ backgroundColor: theme.pageBg }}>
        <View style={styles.bannerStack}>
          {badge && (
            <View style={styles.statusBanner}>
              <View style={[styles.statusDot, { backgroundColor: badge.kleur(theme) }]} />
              <Text style={[styles.statusBannerText, { color: badge.kleur(theme) }]}>
                {branch.naam} · {badge.label}
              </Text>
            </View>
          )}
          {laagOndermin > 0 && (
            <View style={styles.statusBanner}>
              <View style={[styles.statusDot, { backgroundColor: theme.warning }]} />
              <Text style={[styles.statusBannerText, { color: theme.warning }]}>
                {laagOndermin} {laagOndermin === 1 ? 'product' : 'producten'} onder minimum
              </Text>
            </View>
          )}
        </View>

        {/* ── Lagen (segmented control) ── */}
        <View style={styles.lagenWrap}>
          <SegmentedControl
            options={LAGEN.map((l) => ({ id: l.id, label: l.label }))}
            value={laag}
            onChange={(id) => {
              selectieTik();
              setLaag(id);
            }}
            theme={theme}
          />
        </View>
        {laagCaption && <Text style={[styles.laagCaption, { color: theme.textMuted }]}>{laagCaption}</Text>}
      </View>

      {/* ── Kaart ── */}
      <View style={styles.mapOuter}>
        <View
          style={[styles.mapViewport, { borderColor: theme.border }]}
          onLayout={onMapLayout}
        >
          <LinearGradient
            colors={[theme.floorFrom, theme.floorTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {viewport && (
            <GestureDetector gesture={composedGesture}>
              <Animated.View style={[styles.wereld, wereldStijl]}>
                <View style={styles.grid} pointerEvents="none">
                  {Array.from({ length: Math.floor(WERELD_BREEDTE / 40) + 1 }).map((_, i) => (
                    <View
                      key={`v${i}`}
                      style={[styles.gridLineV, { left: i * 40, backgroundColor: theme.floorGridLine }]}
                    />
                  ))}
                  {Array.from({ length: Math.floor(WERELD_HOOGTE / 40) + 1 }).map((_, i) => (
                    <View
                      key={`h${i}`}
                      style={[styles.gridLineH, { top: i * 40, backgroundColor: theme.floorGridLine }]}
                    />
                  ))}
                </View>

                {schappen.map((schap, idx) => {
                  const items = stockMap.get(schap.id) ?? [];
                  const weergave = bepaalMarkerWeergave(schap, items, laag, activeDepts, theme);
                  return (
                    <ShelfMarker
                      key={schap.id}
                      schap={schap}
                      weergave={weergave}
                      index={idx}
                      theme={theme}
                      onLongPress={openMarkerMenu}
                    />
                  );
                })}

                <View
                  style={[styles.entreePill, { backgroundColor: theme.good + '26', borderColor: theme.good + '55' }]}
                >
                  <View style={[styles.statusDot, { backgroundColor: theme.good, marginRight: 0 }]} />
                  <Text style={[styles.entreeText, { color: theme.good }]}>Entree</Text>
                </View>
              </Animated.View>
            </GestureDetector>
          )}

          {/* ── Zoeken & filteren ── */}
          <View style={styles.mapActionStack}>
            <AnimatedPressable
              style={[styles.mapActionBtn, cardShadow(theme), { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}
              onPress={() => setSearchOpen(true)}
              accessibilityLabel="Zoeken"
              accessibilityRole="button"
            >
              <IconSymbol name="magnifyingglass" size={16} color={theme.text} />
            </AnimatedPressable>
            <AnimatedPressable
              style={[styles.mapActionBtn, cardShadow(theme), { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}
              onPress={() => setFilterSheetOpen(true)}
              accessibilityLabel="Filters"
              accessibilityRole="button"
            >
              <IconSymbol name="line.3.horizontal.decrease" size={16} color={theme.text} />
              {activeDepts && <View style={[styles.filterDot, { backgroundColor: theme.accent }]} />}
            </AnimatedPressable>
          </View>

          {/* ── Zoom­bediening ── */}
          <View style={styles.zoomStack}>
            <View style={[styles.zoomCombo, cardShadow(theme), { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
              <AnimatedPressable
                style={styles.zoomComboBtn}
                onPress={() => zoomMet(1.4)}
                accessibilityRole="button"
                accessibilityLabel="Inzoomen"
              >
                <Text style={[styles.zoomComboText, { color: theme.text }]}>+</Text>
              </AnimatedPressable>
              <View style={[styles.zoomDivider, { backgroundColor: theme.border }]} />
              <AnimatedPressable
                style={styles.zoomComboBtn}
                onPress={() => zoomMet(1 / 1.4)}
                accessibilityRole="button"
                accessibilityLabel="Uitzoomen"
              >
                <Text style={[styles.zoomComboText, { color: theme.text }]}>−</Text>
              </AnimatedPressable>
            </View>
            <AnimatedPressable
              style={[styles.locateBtn, cardShadow(theme), { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}
              onPress={centreren}
              accessibilityRole="button"
              accessibilityLabel="Kaart centreren"
            >
              <IconSymbol name="location.fill" size={16} color={theme.text} />
            </AnimatedPressable>
          </View>
        </View>
      </View>

      {/* ── Filters (animated sheet) ── */}
      <Sheet visible={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} theme={theme}>
        <View style={styles.sheetHeaderRow}>
          <Text style={[styles.sheetTitle, { color: theme.text }]}>Afdelingen</Text>
          {activeDepts && (
            <AnimatedPressable onPress={() => setActiveDepts(null)} accessibilityRole="button">
              <Text style={[styles.sheetReset, { color: theme.accent }]}>Alles tonen</Text>
            </AnimatedPressable>
          )}
        </View>
        {departementen.map((d) => {
          const actief = !activeDepts || activeDepts.includes(d.id);
          return (
            <AnimatedPressable
              key={d.id}
              scaleTo={0.98}
              style={[styles.deptRow, { borderTopColor: theme.border }]}
              onPress={() => toggleDept(d.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: actief }}
            >
              <View style={[styles.deptDot, { backgroundColor: d.tekst }]} />
              <Text style={[styles.deptRowLabel, { color: theme.text }]}>{d.label}</Text>
              <View
                style={[
                  styles.checkbox,
                  { borderColor: theme.borderStrong },
                  actief && { backgroundColor: theme.accent, borderColor: theme.accent },
                ]}
              >
                {actief && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
            </AnimatedPressable>
          );
        })}
      </Sheet>

      {/* ── Zoeken ── */}
      <Modal visible={searchOpen} transparent animationType="slide" onRequestClose={() => setSearchOpen(false)}>
        <View style={[styles.searchOverlay, { backgroundColor: theme.pageBg }]}>
          {/* Modal-inhoud draait op een eigen native root — SafeAreaView pikt
              daar de insets niet betrouwbaar op (zie components/drawer-menu.tsx
              voor dezelfde workaround), dus de top-inset hier handmatig toepassen. */}
          <View style={{ flex: 1, width: '100%', paddingTop: insets.top }}>
            <View style={[styles.searchBar, { backgroundColor: theme.surface }]}>
              <IconSymbol name="magnifyingglass" size={16} color={theme.textSecondary} />
              <TextInput
                autoFocus
                placeholder="Zoek een schap of afdeling…"
                placeholderTextColor={theme.textMuted}
                value={zoekterm}
                onChangeText={setZoekterm}
                style={[styles.searchInput, { color: theme.text }]}
              />
              <AnimatedPressable
                onPress={() => { setSearchOpen(false); setZoekterm(''); }}
                accessibilityRole="button"
                accessibilityLabel="Zoeken sluiten"
              >
                <IconSymbol name="xmark" size={16} color={theme.textSecondary} />
              </AnimatedPressable>
            </View>

            <ScrollView
              style={[styles.searchResults, { flex: 1 }]}
              contentContainerStyle={styles.searchResultsContent}
              keyboardShouldPersistTaps="handled"
              bounces={zoekresultaten.length > 0}
            >
              {zoekresultaten.map((s) => {
                const info = getDepartementInfo(s.department);
                return (
                  <AnimatedPressable
                    key={s.id}
                    scaleTo={0.98}
                    style={[styles.searchResultRow, { borderBottomColor: theme.border }]}
                    onPress={() => {
                      selectieTik();
                      setSearchOpen(false);
                      setZoekterm('');
                      naarSchapDetail(s);
                    }}
                    accessibilityRole="button"
                  >
                    <View style={[styles.deptDot, { backgroundColor: SCHAP_ACCENTS[s.shortLabel] ?? theme.accent }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.searchResultNaam, { color: theme.text }]}>{s.name}</Text>
                      <Text style={[styles.searchResultMeta, { color: theme.textSecondary }]}>{info.label}</Text>
                    </View>
                  </AnimatedPressable>
                );
              })}
              {zoekterm.trim().length > 0 && zoekresultaten.length === 0 && (
                <View style={styles.searchLeegWrap}>
                  <IconSymbol name="magnifyingglass" size={22} color={theme.textMuted} />
                  <Text style={[styles.searchLeeg, { color: theme.textSecondary }]}>
                    Geen schappen gevonden voor “{zoekterm}”.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles (alleen lay-out; kleuren worden per thema inline toegepast) ───────

const styles = StyleSheet.create({
  container: { flex: 1 },

  leegState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  leegStateTekst: { fontSize: 13, fontFamily: 'Montserrat', textAlign: 'center' },

  filterDot: { position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: 4 },

  bannerStack: { gap: 4, marginHorizontal: 16, marginBottom: 8 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 2 },
  statusBannerText: { fontSize: 11, fontWeight: '600', fontFamily: 'Montserrat' },

  lagenWrap: { marginHorizontal: 16 },
  laagCaption: { fontSize: 10.5, fontFamily: 'Montserrat', marginHorizontal: 16, marginTop: 6 },

  mapOuter: { flex: 1, padding: 16, paddingTop: 12 },
  mapViewport: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  wereld: { width: WERELD_BREEDTE, height: WERELD_HOOGTE },

  grid: StyleSheet.absoluteFillObject,
  gridLineV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  gridLineH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },

  marker: { position: 'absolute' },
  blok: {
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blokVerdeellijn: { position: 'absolute', top: 4, bottom: 4, width: StyleSheet.hairlineWidth },
  blokLabel: { fontSize: 10, fontWeight: '800', fontFamily: 'Montserrat' },
  equipmentDot: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeHoek: { position: 'absolute', top: -6, right: -6 },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#fff', fontFamily: 'Montserrat' },

  rackDepth: {
    height: 5,
    marginTop: -3,
    alignSelf: 'center',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },

  entreePill: {
    position: 'absolute',
    bottom: 10,
    left: '50%',
    marginLeft: -34,
    width: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  entreeText: { fontSize: 9.5, fontWeight: '800', fontFamily: 'Montserrat' },

  mapActionStack: { position: 'absolute', right: 14, top: 14, alignItems: 'center', gap: 8 },
  mapActionBtn: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },

  zoomStack: { position: 'absolute', right: 14, bottom: 14, alignItems: 'center', gap: 8 },
  zoomCombo: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  zoomComboBtn: { width: 38, height: 34, alignItems: 'center', justifyContent: 'center' },
  zoomComboText: { fontSize: 17, fontWeight: '700', lineHeight: 19 },
  zoomDivider: { height: 1 },
  locateBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  sheetHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '700', fontFamily: 'Montserrat' },
  sheetReset: { fontSize: 12, fontWeight: '600', fontFamily: 'Montserrat' },

  deptRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 0.5 },
  deptDot: { width: 8, height: 8, borderRadius: 4 },
  deptRowLabel: { flex: 1, fontSize: 13, fontWeight: '600', fontFamily: 'Montserrat' },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkboxMark: { fontSize: 11, color: '#fff', fontWeight: '800' },

  searchOverlay: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Montserrat', paddingVertical: 0 },
  searchResults: { marginTop: 8, paddingHorizontal: 16 },
  searchResultsContent: { flexGrow: 1 },
  searchResultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 0.5 },
  searchResultNaam: { fontSize: 13, fontWeight: '600', fontFamily: 'Montserrat' },
  searchResultMeta: { fontSize: 11, marginTop: 1, fontFamily: 'Montserrat' },
  searchLeegWrap: { alignItems: 'center', gap: 8, marginTop: 40 },
  searchLeeg: { fontSize: 12, textAlign: 'center', fontFamily: 'Montserrat' },
});

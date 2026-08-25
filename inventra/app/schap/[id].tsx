import { AnimatedPressable } from '@/components/plattegrond/AnimatedPressable';
import { SegmentedControl } from '@/components/plattegrond/SegmentedControl';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { cardShadow, groundedShadow, pickTheme } from '@/constants/plattegrond-theme';
import { useAuth } from '@/contexts/auth-context';
import {
  Shelf,
  ShelfStockItem,
  getDepartementInfo,
  getEquipmentMetadata,
  getShelfById,
  getStockForShelf,
} from '@/data/store-map';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

type SchapMetType = Shelf;
type ProductRegel = ShelfStockItem;

function formatDatum(iso: string) {
  const d = new Date(iso);
  const nu = new Date();
  const opties: Intl.DateTimeFormatOptions =
    d.getFullYear() !== nu.getFullYear()
      ? { day: 'numeric', month: 'short', year: 'numeric' }
      : { day: 'numeric', month: 'short' };
  return d.toLocaleDateString('nl-NL', opties);
}

type Tab = 'voorraad' | 'metadata';

export default function SchapDetailScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const isDark = colorScheme === 'dark';
  const theme = useMemo(() => pickTheme(isDark), [isDark]);
  const router = useRouter();

  const { branches } = useAuth();
  const params = useLocalSearchParams<{ id: string; tab?: string }>();
  // Route-params zijn altijd strings; Shelf.id is een number, dus casten.
  const shelfId = Number(params.id);

  const schap = useMemo(() => (getShelfById(shelfId) as SchapMetType) ?? null, [shelfId]);
  const branch = useMemo(() => branches.find((b) => b.id === schap?.branchId), [branches, schap]);

  const isApparatuur = schap?.type === 'equipment';
  const [tab, setTab] = useState<Tab>(params.tab === 'metadata' && isApparatuur ? 'metadata' : 'voorraad');

  const dept = schap ? getDepartementInfo(schap.department) : null;
  const producten = useMemo(() => {
    if (!schap) return [];
    return getStockForShelf(schap.id) as ProductRegel[];
  }, [schap]);

  const ondermin = useMemo(() => producten.filter((p) => p.shelfStock < p.minimumStock).length, [producten]);

  const perPlank = useMemo(() => {
    const groepen = new Map<number, ProductRegel[]>();
    producten.forEach((p) => {
      const plank = p.plankNummer ?? 1;
      if (!groepen.has(plank)) groepen.set(plank, []);
      groepen.get(plank)!.push(p);
    });
    return Array.from(groepen.entries()).sort(([a], [b]) => a - b);
  }, [producten]);

  if (!schap) {
    return (
      <View style={[styles.container, { backgroundColor: theme.pageBg }]}>
        <SafeAreaView edges={['top']} style={styles.center}>
          <IconSymbol name="questionmark.circle" size={28} color={theme.textMuted} />
          <Text style={{ color: theme.text, fontFamily: 'Montserrat', marginTop: 8 }}>Schap niet gevonden.</Text>
          <AnimatedPressable onPress={() => router.back()} style={{ marginTop: 12 }}>
            <Text style={{ color: theme.accent, fontFamily: 'Montserrat', fontWeight: '600' }}>Terug</Text>
          </AnimatedPressable>
        </SafeAreaView>
      </View>
    );
  }

  const metadata = isApparatuur ? getEquipmentMetadata(schap.id) : undefined;
  const deptColor = dept?.tekst ?? theme.accent;

  return (
    <View style={[styles.container, { backgroundColor: theme.pageBg }]}>
      {/* ── Hero ── */}
      <LinearGradient
        colors={[deptColor + '33', theme.pageBg]}
        style={styles.hero}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <AnimatedPressable
              onPress={() => router.back()}
              style={[styles.backBtn, cardShadow(theme), { backgroundColor: theme.surfaceRaised }]}
              accessibilityRole="button"
              accessibilityLabel="Terug naar plattegrond"
            >
              <IconSymbol name="chevron.left" size={18} color={theme.text} />
            </AnimatedPressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
                {schap.name}
              </Text>
              <Text style={[styles.headerSub, { color: theme.textSecondary }]} numberOfLines={1}>
                {branch?.naam ?? 'Filiaal wordt geladen…'} {branch ? `· ${branch.stad}` : ''}
              </Text>
            </View>
            {isApparatuur && (
              <View style={[styles.equipmentPill, { backgroundColor: theme.equipment + '22', borderColor: theme.equipment + '55' }]}>
                <IconSymbol name="bolt.fill" size={11} color={theme.equipment} />
                <Text style={[styles.equipmentPillText, { color: theme.equipment }]}>Apparatuur</Text>
              </View>
            )}
          </View>

          <View style={styles.chipRow}>
            {dept && (
              <View style={[styles.chip, { backgroundColor: dept.tekst + '1f' }]}>
                <Text style={[styles.chipText, { color: dept.tekst }]}>{dept.label}</Text>
              </View>
            )}
            {!isApparatuur && (
              <View style={[styles.chip, { backgroundColor: theme.surfaceRaised }]}>
                <Text style={[styles.chipText, { color: theme.textSecondary }]}>
                  {producten.length} {producten.length === 1 ? 'product' : 'producten'}
                </Text>
              </View>
            )}
            {ondermin > 0 && (
              <View style={[styles.chip, { backgroundColor: theme.danger + '1f' }]}>
                <Text style={[styles.chipText, { color: theme.danger }]}>{ondermin} onder minimum</Text>
              </View>
            )}
          </View>

          {isApparatuur && (
            <View style={styles.tabWrap}>
              <SegmentedControl
                options={[
                  { id: 'voorraad' as Tab, label: 'Planken & voorraad' },
                  { id: 'metadata' as Tab, label: 'Metadata' },
                ]}
                value={tab}
                onChange={setTab}
                theme={theme}
              />
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>

      {tab === 'metadata' && metadata ? (
        <Animated.View key="metadata" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={{ flex: 1 }}>
          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 32 }}>
            <View style={[styles.metaCard, cardShadow(theme), { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <MetaRow icon="number" label="Serienummer" waarde={metadata.serienummer} theme={theme} />
              <MetaRow
                icon="wrench.and.screwdriver.fill"
                label="Laatste onderhoud"
                waarde={metadata.laatsteOnderhoud ? formatDatum(metadata.laatsteOnderhoud) : undefined}
                theme={theme}
              />
              {/* temperatuur is alleen relevant voor koeling/vries, niet bv. kassa's */}
              {metadata.temperatuur && (
                <MetaRow icon="thermometer" label="Ingestelde temperatuur" waarde={metadata.temperatuur} theme={theme} />
              )}
            </View>
            {metadata.opmerking && (
              <View style={[styles.opmerkingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <IconSymbol name="info.circle" size={14} color={theme.textMuted} />
                <Text style={[styles.metaOpmerking, { color: theme.textMuted }]}>{metadata.opmerking}</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      ) : (
        <Animated.View key="voorraad" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={{ flex: 1 }}>
          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 32 }}>
            {perPlank.length === 0 && (
              <View style={styles.leegWrap}>
                <IconSymbol name="shippingbox" size={26} color={theme.textMuted} />
                <Text style={[styles.leegTekst, { color: theme.textSecondary }]}>
                  Geen producten toegewezen aan dit schap.
                </Text>
              </View>
            )}
            {perPlank.map(([plankNummer, items], plankIdx) => {
              const plankOnderMinimum = items.filter((i) => i.shelfStock < i.minimumStock).length;
              return (
              <Animated.View
                key={plankNummer}
                entering={FadeIn.delay(plankIdx * 60).duration(220)}
                style={styles.plankBlok}
              >
                <View style={styles.plankTitelRij}>
                  <Text style={[styles.plankTitel, { color: theme.textSecondary }]}>Plank {plankNummer}</Text>
                  <Text style={[styles.plankStats, { color: theme.textMuted }]}>
                    {items.length} {items.length === 1 ? 'product' : 'producten'}
                    {plankOnderMinimum > 0 ? ` · ${plankOnderMinimum} onder minimum` : ''}
                  </Text>
                </View>

                {/* Visuele plank: laat zien wélke producten waar op dit schap staan,
                    i.p.v. alleen een tekstlijst. Volgorde in de data = positie op de plank. */}
                <View style={groundedShadow(theme)}>
                  <View style={[styles.plankBoard, { backgroundColor: theme.rackFill, borderColor: theme.rackBorder }]}>
                    {items.map((item, idx) => {
                      const onderMinimum = item.shelfStock < item.minimumStock;
                      const vulling = Math.min(1, item.shelfStock / Math.max(item.minimumStock * 2, 1));
                      const kleur = onderMinimum ? theme.danger : theme.good;
                      return (
                        <View
                          key={idx}
                          style={[
                            styles.plankItem,
                            { height: 22 + vulling * 20, backgroundColor: kleur + '26', borderColor: kleur + '66' },
                          ]}
                        >
                          {item.photoUrl ? (
                            <Image source={{ uri: item.photoUrl }} style={styles.plankItemFoto} />
                          ) : (
                            <IconSymbol name="photo" size={11} color={kleur} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                  <View style={[styles.plankBoardDepth, { backgroundColor: theme.rackDepthFill }]} />
                </View>

                {items.map((item, idx) => {
                  const onderMinimum = item.shelfStock < item.minimumStock;
                  const pct = Math.min(100, Math.round((item.shelfStock / Math.max(item.minimumStock * 2, 1)) * 100));
                  return (
                    <View
                      key={idx}
                      style={[styles.productCard, cardShadow(theme), { backgroundColor: theme.surface, borderColor: theme.border }]}
                    >
                      {item.photoUrl ? (
                        <Image source={{ uri: item.photoUrl }} style={styles.productFoto} />
                      ) : (
                        <View style={[styles.productFoto, styles.productFotoFallback, { backgroundColor: theme.imgFallback }]}>
                          <IconSymbol name="photo" size={20} color={theme.textMuted} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <View style={styles.productTopRij}>
                          <Text style={[styles.productNaam, { color: theme.text }]} numberOfLines={2}>
                            {item.productName}
                          </Text>
                          {onderMinimum && (
                            <View style={[styles.lowBadge, { backgroundColor: theme.danger + '26' }]}>
                              <Text style={[styles.lowBadgeText, { color: theme.danger }]}>Onder minimum</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.productMeta, { color: theme.textSecondary }]}>
                          {item.shelfStock} {item.unitType} op schap · min. {item.minimumStock} · THT{' '}
                          {formatDatum(item.shortestTht)}
                        </Text>
                        <View style={[styles.progressTrack, { backgroundColor: theme.rackFill }]}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${pct}%`, backgroundColor: onderMinimum ? theme.danger : theme.good },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </Animated.View>
              );
            })}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

function MetaRow({
  icon,
  label,
  waarde,
  theme,
}: {
  icon: string;
  label: string;
  waarde?: string;
  theme: ReturnType<typeof pickTheme>;
}) {
  return (
    <View style={styles.metaRow}>
      <View style={[styles.metaIconWrap, { backgroundColor: theme.rackFill }]}>
        <IconSymbol name={icon} size={14} color={theme.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[styles.metaWaarde, { color: theme.text }]}>{waarde ?? '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hero: { paddingBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Montserrat' },
  headerSub: { fontSize: 12, marginTop: 1, fontFamily: 'Montserrat' },

  equipmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  equipmentPillText: { fontSize: 10.5, fontWeight: '700', fontFamily: 'Montserrat' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginTop: 10 },
  chip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  chipText: { fontSize: 11.5, fontWeight: '700', fontFamily: 'Montserrat' },

  tabWrap: { paddingHorizontal: 16, marginTop: 14, paddingBottom: 12 },

  body: { flex: 1, paddingHorizontal: 16, marginTop: 12 },

  leegWrap: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  leegTekst: { fontSize: 13, fontFamily: 'Montserrat', textAlign: 'center' },

  plankBlok: { marginBottom: 18, gap: 8 },
  plankTitelRij: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  plankTitel: { fontSize: 12, fontWeight: '700', fontFamily: 'Montserrat', textTransform: 'uppercase', letterSpacing: 0.4 },
  plankStats: { fontSize: 10.5, fontFamily: 'Montserrat' },

  plankBoard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 4,
    minHeight: 48,
  },
  plankItem: {
    width: 22,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plankItemFoto: { width: '100%', height: '100%', borderRadius: 4 },
  plankBoardDepth: {
    height: 4,
    marginTop: -2,
    marginHorizontal: 4,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },

  productCard: { flexDirection: 'row', gap: 12, borderRadius: 16, borderWidth: 1, padding: 10, alignItems: 'center' },
  productFoto: { width: 52, height: 52, borderRadius: 12 },
  productFotoFallback: { alignItems: 'center', justifyContent: 'center' },
  productTopRij: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  productNaam: { fontSize: 14, fontWeight: '600', fontFamily: 'Montserrat', flex: 1 },
  productMeta: { fontSize: 11, fontFamily: 'Montserrat', marginTop: 3 },
  progressTrack: { height: 5, borderRadius: 999, overflow: 'hidden', marginTop: 7 },
  progressFill: { height: '100%', borderRadius: 999 },

  lowBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  lowBadgeText: { fontSize: 9, fontWeight: '700', fontFamily: 'Montserrat' },

  metaCard: { borderRadius: 18, borderWidth: 1, padding: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 10 },
  metaIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metaLabel: { fontSize: 10.5, fontFamily: 'Montserrat', textTransform: 'uppercase', letterSpacing: 0.3 },
  metaWaarde: { fontSize: 14, fontWeight: '600', fontFamily: 'Montserrat', marginTop: 1 },

  opmerkingCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  metaOpmerking: { flex: 1, fontSize: 11.5, fontFamily: 'Montserrat', lineHeight: 16 },
});

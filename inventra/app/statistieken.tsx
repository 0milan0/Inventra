import { ScreenHeader } from '@/components/screen-header';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, getPalette, Radius, Shadow, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  Afdeling,
  ALLE_AFDELINGEN,
  ApiCategorie,
  ApiStatsBreakdownItem,
  ApiStatsOverview,
  getProductLookups,
  getStatsOverview,
  StatsGroepering,
  StatsMetric,
} from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const F = FontFamily;
type Palette = ReturnType<typeof getPalette>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatEuro = (bedrag: number): string => `€ ${bedrag.toFixed(2).replace('.', ',')}`;

const fmt = (d: Date): string => d.toISOString().split('T')[0];

function hapticLight() {
  if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

type RangePreset = 'vandaag' | 'week' | 'maand' | 'kwartaal' | 'jaar' | 'aangepast';

const RANGE_OPTIES: { id: RangePreset; label: string }[] = [
  { id: 'vandaag', label: 'Vandaag' },
  { id: 'week', label: 'Deze week' },
  { id: 'maand', label: 'Deze maand' },
  { id: 'kwartaal', label: 'Dit kwartaal' },
  { id: 'jaar', label: 'Dit jaar' },
  { id: 'aangepast', label: 'Aangepast' },
];

function berekenRange(preset: RangePreset, customVan: string, customTot: string): { van: string; tot: string } {
  const vandaag = new Date();
  const tot = fmt(vandaag);
  if (preset === 'aangepast') {
    return { van: customVan || tot, tot: customTot || tot };
  }
  if (preset === 'vandaag') return { van: tot, tot };
  if (preset === 'week') {
    const dag = vandaag.getDay();
    const maandag = new Date(vandaag);
    maandag.setDate(vandaag.getDate() - (dag === 0 ? 6 : dag - 1));
    return { van: fmt(maandag), tot };
  }
  if (preset === 'maand') {
    const eersteVanMaand = new Date(vandaag.getFullYear(), vandaag.getMonth(), 1);
    return { van: fmt(eersteVanMaand), tot };
  }
  if (preset === 'kwartaal') {
    const kwartaalStartMaand = Math.floor(vandaag.getMonth() / 3) * 3;
    const eersteVanKwartaal = new Date(vandaag.getFullYear(), kwartaalStartMaand, 1);
    return { van: fmt(eersteVanKwartaal), tot };
  }
  // jaar
  const eersteVanJaar = new Date(vandaag.getFullYear(), 0, 1);
  return { van: fmt(eersteVanJaar), tot };
}

const AFDELING_KLEUR: Record<string, { bg: string; text: string; border: string }> = {
  KW:                { bg: '#E6F1FB', text: '#0C447C', border: '#90C4F0' },
  Vers:              { bg: '#E1F5EE', text: '#085041', border: '#7ECFB3' },
  AGF:               { bg: '#EEEDFE', text: '#3C3489', border: '#AFA9EC' },
  'Kassa & Boetiek':  { bg: '#FAEEDA', text: '#633806', border: '#EF9F27' },
  Brood:             { bg: '#FBEAF0', text: '#72243E', border: '#ED93B1' },
};

const GROEPERING_OPTIES: { id: StatsGroepering; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { id: 'afdeling', label: 'Afdeling', icon: 'business-outline' },
  { id: 'categorie', label: 'Categorie', icon: 'pricetags-outline' },
  { id: 'product', label: 'Product', icon: 'cube-outline' },
];

const parseDate = (value?: string): Date => {
  if (!value) return new Date();
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
};

const formatDateShort = (value: string): string => {
  const d = parseDate(value);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ─── Scherm ───────────────────────────────────────────────────────────────────

export default function StatistiekenScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);
  const { token } = useAuth();

  const [metric, setMetric] = useState<StatsMetric>('verkoop');
  const [rangePreset, setRangePreset] = useState<RangePreset>('week');
  const [customVan, setCustomVan] = useState('');
  const [customTot, setCustomTot] = useState('');
  const [datePickerVeld, setDatePickerVeld] = useState<'van' | 'tot' | null>(null);

  const [groepering, setGroepering] = useState<StatsGroepering>('afdeling');
  const [afdelingFilter, setAfdelingFilter] = useState<Afdeling | null>(null);
  const [categorieFilter, setCategorieFilter] = useState<{ id: number; naam: string } | null>(null);
  const [categoriePickerOpen, setCategoriePickerOpen] = useState(false);

  const [categorieen, setCategorieen] = useState<ApiCategorie[]>([]);
  const [data, setData] = useState<ApiStatsOverview | null>(null);
  const [laden, setLaden] = useState(true);
  const [verversen, setVerversen] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const eersteLaadGedaan = useRef(false);

  const { van, tot } = useMemo(() => berekenRange(rangePreset, customVan, customTot), [rangePreset, customVan, customTot]);

  useEffect(() => {
    if (!token) return;
    getProductLookups(token).then((d) => setCategorieen(d.categorieen)).catch(() => {});
  }, [token]);

  const laadData = useCallback(async () => {
    if (!token) return;
    if (eersteLaadGedaan.current) setVerversen(true); else setLaden(true);
    setFout(null);
    try {
      const result = await getStatsOverview(token, {
        metric, groepering, van, tot,
        afdeling: afdelingFilter ?? undefined,
        categorieId: categorieFilter?.id,
      });
      setData(result);
      eersteLaadGedaan.current = true;
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Statistieken laden is mislukt.');
    } finally {
      setLaden(false);
      setVerversen(false);
    }
  }, [token, metric, groepering, van, tot, afdelingFilter, categorieFilter]);

  useEffect(() => { laadData(); }, [laadData]);

  // ── Metric wisselen: reden alleen geldig bij derving ──────────────────────
  const wisselMetric = (m: StatsMetric) => {
    if (m === metric) return;
    hapticLight();
    setMetric(m);
    if (m === 'verkoop' && groepering === 'reden') setGroepering('afdeling');
  };

  // ── Drill-down: tikken op een uitsplitsings-rij zoomt één niveau dieper ──────
  const tikOpBreakdownRij = (item: ApiStatsBreakdownItem) => {
    // "Niet ingedeeld" (product zonder schap/categorie) heeft geen echte
    // afdeling/categorie-waarde om op te filteren — verder inzoomen zou een
    // filter zetten die nooit iets matcht (een permanente lege uitsplitsing).
    if (item.id === '_geen') return;
    hapticLight();
    if (groepering === 'afdeling') {
      setAfdelingFilter(item.id as Afdeling);
      setGroepering('categorie');
    } else if (groepering === 'categorie') {
      setCategorieFilter({ id: Number(item.id), naam: item.naam });
      setGroepering('product');
    } else if (groepering === 'product') {
      if (item.barcode) {
        router.push({ pathname: '/product/[barcode]', params: { barcode: item.barcode } });
      }
    }
  };

  const wisNaarGroepering = (nieuw: StatsGroepering) => {
    if (nieuw === groepering) return;
    hapticLight();
    setGroepering(nieuw);
  };

  const kiesAfdeling = (afd: Afdeling | null) => {
    hapticLight();
    setAfdelingFilter((huidig) => (huidig === afd ? null : afd));
  };

  const kiesCategorie = (cat: { id: number; naam: string } | null) => {
    hapticLight();
    setCategorieFilter(cat);
    setCategoriePickerOpen(false);
  };

  const onRefresh = useCallback(async () => {
    setVerversen(true);
    await laadData();
  }, [laadData]);

  // Data + weergave-groepering komen ALTIJD samen uit de server-response, zodat
  // er tijdens het verversen nooit een oude uitsplitsing onder een nieuw
  // geselecteerd chip-label komt te staan (data.groepering kan even achterlopen
  // op de lokale `groepering`-state terwijl een nieuwe fetch loopt).
  const weergaveGroepering = data?.groepering ?? groepering;

  const totaal = data?.totaal ?? { aantal: 0, bedrag: 0 };
  const vorige = data?.vorige ?? { aantal: 0, bedrag: 0 };
  const isNieuw = vorige.bedrag === 0 && totaal.bedrag > 0;
  const deltaPercentage = vorige.bedrag > 0 ? Math.round(((totaal.bedrag - vorige.bedrag) / vorige.bedrag) * 100) : null;
  const maxTrendBedrag = Math.max(1, ...(data?.trend.map((t) => t.bedrag) ?? [1]));
  const groeperingOpties = metric === 'derving' ? [...GROEPERING_OPTIES, { id: 'reden' as const, label: 'Reden', icon: 'help-circle-outline' as const }] : GROEPERING_OPTIES;

  const stijgingIsPositief = (gestegen: boolean) => (metric === 'verkoop' ? gestegen : !gestegen);

  return (
    <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
      <ScreenHeader title="Statistieken" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={verversen && eersteLaadGedaan.current} onRefresh={onRefresh} tintColor={p.textMuted} />}
      >
        {/* ── Metric ── */}
        <View style={[styles.segmented, { backgroundColor: p.surface, borderColor: p.border }]}>
          {(['verkoop', 'derving'] as StatsMetric[]).map((m) => {
            const actief = metric === m;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.segmentedItem, actief && { backgroundColor: p.accent, borderRadius: Radius.sm }]}
                onPress={() => wisselMetric(m)}
              >
                <Text style={[styles.segmentedTxt, { color: actief ? '#fff' : p.textSecondary, fontWeight: actief ? '700' : '500' }]}>
                  {m === 'verkoop' ? 'Verkoop' : 'Derving'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Range ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {RANGE_OPTIES.map((r) => {
            const actief = rangePreset === r.id;
            return (
              <TouchableOpacity
                key={r.id}
                style={[styles.chip, { backgroundColor: actief ? p.accent : p.surface, borderColor: actief ? p.accent : p.border }]}
                onPress={() => { hapticLight(); setRangePreset(r.id); }}
              >
                <Text style={[styles.chipTxt, { color: actief ? '#fff' : p.textSecondary }]}>{r.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {rangePreset === 'aangepast' ? (
          <View style={styles.customRangeRow}>
            <TouchableOpacity style={[styles.dateBtn, { backgroundColor: p.surface, borderColor: p.border }]} onPress={() => setDatePickerVeld('van')}>
              <Ionicons name="calendar-outline" size={13} color={p.textSecondary} />
              <Text style={[styles.dateBtnTxt, { color: p.text }]}>{formatDateShort(van)}</Text>
            </TouchableOpacity>
            <Text style={{ color: p.textMuted, fontSize: 12 }}>t/m</Text>
            <TouchableOpacity style={[styles.dateBtn, { backgroundColor: p.surface, borderColor: p.border }]} onPress={() => setDatePickerVeld('tot')}>
              <Ionicons name="calendar-outline" size={13} color={p.textSecondary} />
              <Text style={[styles.dateBtnTxt, { color: p.text }]}>{formatDateShort(tot)}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={[styles.periodeLabel, { color: p.textMuted }]}>
            {formatDateShort(van)} – {formatDateShort(tot)}
          </Text>
        )}

        {datePickerVeld && (
          <DateTimePicker
            value={parseDate(datePickerVeld === 'van' ? (customVan || van) : (customTot || tot))}
            mode="date"
            maximumDate={new Date()}
            display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
            onChange={(_, date) => {
              const sluiten = Platform.OS !== 'ios';
              if (sluiten) setDatePickerVeld(null);
              if (!date) return;
              const iso = fmt(date);
              if (datePickerVeld === 'van') {
                setCustomVan(iso);
                if (customTot && iso > customTot) setCustomTot(iso);
              } else {
                setCustomTot(iso);
                if (customVan && iso < customVan) setCustomVan(iso);
              }
            }}
          />
        )}
        {Platform.OS === 'ios' && datePickerVeld && (
          <TouchableOpacity style={[styles.dateDoneBtn, { backgroundColor: p.accent }]} onPress={() => setDatePickerVeld(null)}>
            <Text style={styles.dateDoneTxt}>Klaar</Text>
          </TouchableOpacity>
        )}

        {/* ── Filters: altijd beschikbaar, ongeacht groepering ── */}
        <Section title="Filters" p={p}>
          <Text style={[styles.filterGroupLbl, { color: p.textMuted }]}>Afdeling</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
            <FilterOptieChip label="Alle" actief={afdelingFilter === null} p={p} onPress={() => kiesAfdeling(null)} />
            {ALLE_AFDELINGEN.map((afd) => (
              <FilterOptieChip
                key={afd}
                label={afd}
                actief={afdelingFilter === afd}
                kleur={AFDELING_KLEUR[afd]}
                p={p}
                onPress={() => kiesAfdeling(afd)}
              />
            ))}
          </ScrollView>

          <Text style={[styles.filterGroupLbl, { color: p.textMuted, marginTop: Spacing.md }]}>Categorie</Text>
          <TouchableOpacity
            style={[styles.categorieBtn, { backgroundColor: categorieFilter ? p.accentSoft : p.surfaceAlt, borderColor: categorieFilter ? p.accent : p.border }]}
            onPress={() => { hapticLight(); setCategoriePickerOpen(true); }}
          >
            <Ionicons name="pricetags-outline" size={14} color={categorieFilter ? p.accent : p.textSecondary} />
            <Text style={[styles.categorieBtnTxt, { color: categorieFilter ? p.accent : p.text }]} numberOfLines={1}>
              {categorieFilter ? categorieFilter.naam : 'Alle categorieën'}
            </Text>
            {categorieFilter ? (
              <TouchableOpacity onPress={() => kiesCategorie(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={p.accent} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-forward" size={14} color={p.textMuted} />
            )}
          </TouchableOpacity>
        </Section>

        {laden ? (
          <View style={styles.laadWrap}><ActivityIndicator color={p.accent} /></View>
        ) : fout ? (
          <View style={styles.laadWrap}>
            <Ionicons name="alert-circle-outline" size={32} color={p.danger} />
            <Text style={[styles.foutTekst, { color: p.danger }]}>{fout}</Text>
            <TouchableOpacity style={[styles.retryBtn, { borderColor: p.border }]} onPress={laadData}>
              <Text style={[styles.retryBtnTxt, { color: p.accent }]}>Opnieuw proberen</Text>
            </TouchableOpacity>
          </View>
        ) : data ? (
          <View style={{ opacity: verversen ? 0.55 : 1 }}>
            {/* ── KPI hero ── */}
            <View style={[styles.heroCard, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
              <View style={styles.heroTopRow}>
                <Text style={[styles.heroLabel, { color: p.textMuted }]}>
                  {metric === 'verkoop' ? 'Omzet' : 'Derving-kosten'}
                </Text>
                {verversen && <ActivityIndicator size="small" color={p.textMuted} />}
              </View>
              <View style={styles.heroRow}>
                <Text style={[styles.heroBedrag, { color: p.text }]}>{formatEuro(totaal.bedrag)}</Text>
                {isNieuw ? (
                  <View style={[styles.deltaBadge, { backgroundColor: p.accentSoft }]}>
                    <Text style={[styles.deltaTxt, { color: p.accent }]}>Nieuw</Text>
                  </View>
                ) : deltaPercentage !== null && deltaPercentage !== 0 ? (
                  <View style={[styles.deltaBadge, { backgroundColor: stijgingIsPositief(deltaPercentage >= 0) ? p.successSoft : p.dangerSoft }]}>
                    <Ionicons
                      name={deltaPercentage >= 0 ? 'arrow-up' : 'arrow-down'}
                      size={10}
                      color={stijgingIsPositief(deltaPercentage >= 0) ? p.success : p.danger}
                    />
                    <Text style={[styles.deltaTxt, { color: stijgingIsPositief(deltaPercentage >= 0) ? p.success : p.danger }]}>
                      {Math.abs(deltaPercentage)}%
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={[styles.heroSubRow, { borderTopColor: p.border }]}>
                <View style={styles.heroSubCel}>
                  <Text style={[styles.heroSubVal, { color: p.text }]}>{totaal.aantal}</Text>
                  <Text style={[styles.heroSubLbl, { color: p.textMuted }]}>{metric === 'verkoop' ? 'Stuks verkocht' : 'Stuks derving'}</Text>
                </View>
                <View style={[styles.heroSubDivider, { backgroundColor: p.border }]} />
                <View style={styles.heroSubCel}>
                  <Text style={[styles.heroSubVal, { color: p.text }]}>{formatEuro(vorige.bedrag)}</Text>
                  <Text style={[styles.heroSubLbl, { color: p.textMuted }]}>Vorige periode</Text>
                </View>
                {metric === 'derving' && data.dervingPercentageVanOmzet !== null && data.dervingPercentageVanOmzet !== undefined && (
                  <>
                    <View style={[styles.heroSubDivider, { backgroundColor: p.border }]} />
                    <View style={styles.heroSubCel}>
                      <Text style={[styles.heroSubVal, { color: p.danger }]}>{data.dervingPercentageVanOmzet}%</Text>
                      <Text style={[styles.heroSubLbl, { color: p.textMuted }]}>Van omzet</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* ── Trend ── */}
            {data.trend.length > 0 && (
              <Section title="Trend" p={p}>
                {data.trend.every((t) => t.bedrag === 0) ? (
                  <EmptyRow tekst="Geen data om te tonen in deze periode." p={p} />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendScroll}>
                    {data.trend.map((t, i) => (
                      <View key={i} style={styles.trendBarWrap}>
                        <Text style={[styles.trendVal, { color: p.textMuted }]} numberOfLines={1}>
                          {t.bedrag > 0 ? Math.round(t.bedrag) : ''}
                        </Text>
                        <View style={styles.trendTrack}>
                          <View
                            style={[
                              styles.trendBar,
                              {
                                height: `${Math.max(3, (t.bedrag / maxTrendBedrag) * 100)}%`,
                                backgroundColor: metric === 'verkoop' ? p.accent : p.danger,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.trendLbl, { color: p.textMuted }]} numberOfLines={1}>{t.label}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </Section>
            )}

            {/* ── Groepering ── */}
            <Section title="Uitsplitsing" p={p}>
              <View style={styles.groeperingRow}>
                {groeperingOpties.map((g) => {
                  const actief = groepering === g.id;
                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.groeperingChip, { backgroundColor: actief ? p.accentSoft : p.surfaceAlt, borderColor: actief ? p.accent : p.border }]}
                      onPress={() => wisNaarGroepering(g.id)}
                    >
                      <Ionicons name={g.icon} size={13} color={actief ? p.accent : p.textSecondary} />
                      <Text style={[styles.groeperingTxt, { color: actief ? p.accent : p.textSecondary }]}>{g.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {data.breakdown.length === 0 ? (
                <EmptyRow tekst="Geen data in deze periode of met deze filters." p={p} />
              ) : (
                data.breakdown.map((item) => (
                  <BreakdownRij
                    key={item.id}
                    item={item}
                    groepering={weergaveGroepering}
                    metric={metric}
                    p={p}
                    onPress={() => tikOpBreakdownRij(item)}
                  />
                ))
              )}
            </Section>

            {/* ── Top producten ── */}
            {weergaveGroepering !== 'product' && data.topProducten.length > 0 && (
              <Section title={metric === 'verkoop' ? 'Bestverkocht' : 'Meeste derving'} p={p}>
                {data.topProducten.map((item, idx) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.topRow, idx < data.topProducten.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: p.divider }]}
                    onPress={() => item.barcode && router.push({ pathname: '/product/[barcode]', params: { barcode: item.barcode } })}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.topRank, { color: p.textMuted }]}>{idx + 1}</Text>
                    <Text style={[styles.topNaam, { color: p.text }]} numberOfLines={1}>{item.naam}</Text>
                    <Text style={[styles.topAantal, { color: p.textSecondary }]}>{item.aantal}×</Text>
                    <Text style={[styles.topBedrag, { color: p.text }]}>{formatEuro(item.bedrag)}</Text>
                  </TouchableOpacity>
                ))}
              </Section>
            )}

            <View style={{ height: 24 }} />
          </View>
        ) : null}
      </ScrollView>

      <CategoriePickerModal
        visible={categoriePickerOpen}
        categorieen={categorieen}
        gekozenId={categorieFilter?.id ?? null}
        p={p}
        onClose={() => setCategoriePickerOpen(false)}
        onKies={(cat) => kiesCategorie(cat)}
      />
    </ThemedView>
  );
}

// ─── Subcomponenten ─────────────────────────────────────────────────────────

function Section({ title, trailing, p, children }: { title: string; trailing?: React.ReactNode; p: Palette; children: React.ReactNode }) {
  return (
    <View style={styles.sectionWrap}>
      <View style={styles.sectionHdrRow}>
        <Text style={[styles.sectionLabel, { color: p.textMuted }]}>{title}</Text>
        {trailing}
      </View>
      <View style={[styles.sectionCard, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
        {children}
      </View>
    </View>
  );
}

function EmptyRow({ tekst, p }: { tekst: string; p: Palette }) {
  return (
    <View style={styles.leegWrap}>
      <Ionicons name="stats-chart-outline" size={22} color={p.textMuted} />
      <Text style={[styles.leegTekst, { color: p.textMuted }]}>{tekst}</Text>
    </View>
  );
}

function FilterOptieChip({ label, actief, kleur, p, onPress }: {
  label: string; actief: boolean; kleur?: { bg: string; text: string; border: string }; p: Palette; onPress: () => void;
}) {
  const bg = actief ? (kleur?.bg ?? p.accentSoft) : p.surfaceAlt;
  const border = actief ? (kleur?.border ?? p.accent) : p.border;
  const txt = actief ? (kleur?.text ?? p.accent) : p.textSecondary;
  return (
    <TouchableOpacity style={[styles.filterOptieChip, { backgroundColor: bg, borderColor: border }]} onPress={onPress}>
      <Text style={[styles.filterOptieTxt, { color: txt }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function BreakdownRij({ item, groepering, metric, p, onPress }: {
  item: ApiStatsBreakdownItem; groepering: StatsGroepering; metric: StatsMetric; p: Palette; onPress: () => void;
}) {
  const afdKleur = groepering === 'afdeling' ? AFDELING_KLEUR[item.naam] : null;
  const klikbaar = groepering !== 'reden' && item.id !== '_geen' && (groepering !== 'product' || !!item.barcode);
  return (
    <TouchableOpacity
      style={[styles.breakdownRow, { borderBottomColor: p.divider }]}
      onPress={onPress}
      disabled={!klikbaar}
      activeOpacity={0.65}
    >
      <View style={styles.breakdownTop}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {afdKleur ? (
            <View style={[styles.afdDot, { backgroundColor: afdKleur.border }]} />
          ) : null}
          <Text style={[styles.breakdownNaam, { color: p.text }]} numberOfLines={1}>{item.naam}</Text>
        </View>
        <Text style={[styles.breakdownBedrag, { color: metric === 'verkoop' ? p.text : p.danger }]}>{formatEuro(item.bedrag)}</Text>
        {klikbaar && <Ionicons name="chevron-forward" size={14} color={p.textMuted} />}
      </View>
      <View style={styles.breakdownBottom}>
        <View style={[styles.breakdownTrack, { backgroundColor: p.surfaceAlt }]}>
          <View style={[styles.breakdownFill, { width: `${item.percentage}%`, backgroundColor: afdKleur?.border ?? p.accent }]} />
        </View>
        <Text style={[styles.breakdownMeta, { color: p.textMuted }]}>{item.percentage}% · {item.aantal}×</Text>
      </View>
    </TouchableOpacity>
  );
}

function CategoriePickerModal({ visible, categorieen, gekozenId, p, onClose, onKies }: {
  visible: boolean; categorieen: ApiCategorie[]; gekozenId: number | null; p: Palette;
  onClose: () => void; onKies: (cat: { id: number; naam: string } | null) => void;
}) {
  const [zoek, setZoek] = useState('');
  useEffect(() => { if (!visible) setZoek(''); }, [visible]);

  const gefilterd = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    if (!q) return categorieen;
    return categorieen.filter((c) => c.naam.toLowerCase().includes(q));
  }, [categorieen, zoek]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: p.bg }}>
        <View style={[styles.modalHdr, { borderBottomColor: p.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.modalHdrBtn}>
            <Text style={[styles.modalHdrBtnTxt, { color: p.accent }]}>Sluiten</Text>
          </TouchableOpacity>
          <Text style={[styles.modalHdrTitle, { color: p.text }]}>Categorie</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={[styles.searchWrap, { backgroundColor: p.surfaceAlt, borderColor: p.border }]}>
          <Ionicons name="search" size={15} color={p.textMuted} />
          <TextInput
            value={zoek}
            onChangeText={setZoek}
            placeholder="Zoek categorie…"
            placeholderTextColor={p.textMuted}
            style={[styles.searchInput, { color: p.text }]}
          />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={[styles.modalRow, { borderBottomColor: p.divider }]} onPress={() => onKies(null)}>
            <Text style={[styles.modalRowTxt, { color: p.text, fontWeight: gekozenId === null ? '700' : '500' }]}>Alle categorieën</Text>
            {gekozenId === null && <Ionicons name="checkmark" size={17} color={p.accent} />}
          </TouchableOpacity>
          {gefilterd.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.modalRow, { borderBottomColor: p.divider }]}
              onPress={() => onKies({ id: c.id, naam: c.naam })}
            >
              <Text style={[styles.modalRowTxt, { color: p.text, fontWeight: gekozenId === c.id ? '700' : '500' }]}>{c.naam}</Text>
              {gekozenId === c.id && <Ionicons name="checkmark" size={17} color={p.accent} />}
            </TouchableOpacity>
          ))}
          {gefilterd.length === 0 && (
            <Text style={[styles.leegTekst, { color: p.textMuted, paddingVertical: 24 }]}>Geen categorieën gevonden.</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 40 },

  segmented: { flexDirection: 'row', borderRadius: Radius.md, borderWidth: 0.5, padding: 3, marginBottom: Spacing.md },
  segmentedItem: { flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  segmentedTxt: { fontSize: 13, fontFamily: F },

  chipRow: { gap: 6, paddingBottom: Spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 0.5 },
  chipTxt: { fontSize: 12, fontWeight: '500', fontFamily: F },

  periodeLabel: { fontSize: 11.5, fontFamily: F, marginBottom: Spacing.md, paddingHorizontal: 2 },
  customRangeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 0.5, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 7 },
  dateBtnTxt: { fontSize: 12.5, fontWeight: '500', fontFamily: F },
  dateDoneBtn: { alignSelf: 'flex-end', borderRadius: Radius.sm, paddingHorizontal: 16, paddingVertical: 8, marginBottom: Spacing.md },
  dateDoneTxt: { color: '#fff', fontWeight: '700', fontSize: 13, fontFamily: F },

  filterGroupLbl: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: F, marginBottom: 6 },
  filterChipRow: { gap: 6, paddingBottom: 2 },
  filterOptieChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, borderWidth: 0.5 },
  filterOptieTxt: { fontSize: 11.5, fontWeight: '600', fontFamily: F },
  categorieBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 0.5, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 10 },
  categorieBtnTxt: { flex: 1, fontSize: 13, fontWeight: '500', fontFamily: F },

  laadWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
  foutTekst: { fontSize: 13, fontFamily: F, textAlign: 'center', paddingHorizontal: 24 },
  retryBtn: { borderWidth: 0.5, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 8, marginTop: 4 },
  retryBtnTxt: { fontSize: 12.5, fontWeight: '600', fontFamily: F },

  heroCard: { borderRadius: Radius.lg, borderWidth: 0.5, padding: Spacing.lg, marginBottom: Spacing.lg },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: F },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  heroBedrag: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5, fontFamily: F },
  deltaBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  deltaTxt: { fontSize: 11.5, fontWeight: '700', fontFamily: F },
  heroSubRow: { flexDirection: 'row', borderTopWidth: 0.5, marginTop: Spacing.md, paddingTop: Spacing.md },
  heroSubCel: { flex: 1, alignItems: 'center', gap: 2 },
  heroSubDivider: { width: 0.5 },
  heroSubVal: { fontSize: 15, fontWeight: '700', fontFamily: F },
  heroSubLbl: { fontSize: 9.5, fontFamily: F, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },

  sectionWrap: { marginBottom: Spacing.lg },
  sectionHdrRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm, paddingHorizontal: 2 },
  sectionLabel: { fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: F },
  sectionCard: { borderRadius: Radius.lg, borderWidth: 0.5, padding: Spacing.md },

  trendScroll: { gap: 10, alignItems: 'flex-end', paddingVertical: 4, minWidth: '100%' },
  trendBarWrap: { alignItems: 'center', width: 40, gap: 4 },
  trendVal: { fontSize: 9, fontFamily: F },
  trendTrack: { width: 18, height: 90, borderRadius: 5, justifyContent: 'flex-end', overflow: 'hidden', backgroundColor: 'rgba(128,128,128,0.08)' },
  trendBar: { width: '100%', borderRadius: 5 },
  trendLbl: { fontSize: 9, fontFamily: F, textAlign: 'center' },

  groeperingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.md },
  groeperingChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 0.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  groeperingTxt: { fontSize: 12, fontWeight: '600', fontFamily: F },

  leegWrap: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 20 },
  leegTekst: { fontSize: 12.5, fontFamily: F, textAlign: 'center' },

  breakdownRow: { paddingVertical: 10, borderBottomWidth: 0.5, gap: 6 },
  breakdownTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  afdDot: { width: 7, height: 7, borderRadius: 3.5 },
  breakdownNaam: { fontSize: 13, fontWeight: '600', fontFamily: F, flexShrink: 1 },
  breakdownBedrag: { fontSize: 13, fontWeight: '700', fontFamily: F },
  breakdownBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  breakdownFill: { height: '100%', borderRadius: 3 },
  breakdownMeta: { fontSize: 10.5, fontFamily: F, width: 74, textAlign: 'right' },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  topRank: { fontSize: 12, fontWeight: '700', fontFamily: F, width: 16 },
  topNaam: { flex: 1, fontSize: 13, fontWeight: '600', fontFamily: F },
  topAantal: { fontSize: 11.5, fontFamily: F },
  topBedrag: { fontSize: 13, fontWeight: '700', fontFamily: F, minWidth: 64, textAlign: 'right' },

  modalHdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 0.5 },
  modalHdrBtn: { width: 60 },
  modalHdrBtnTxt: { fontSize: 14, fontWeight: '600', fontFamily: F },
  modalHdrTitle: { fontSize: 15, fontWeight: '700', fontFamily: F },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.lg, marginVertical: Spacing.md, borderWidth: 0.5, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: F },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: 13, borderBottomWidth: 0.5 },
  modalRowTxt: { fontSize: 14, fontFamily: F },
});

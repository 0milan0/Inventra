import { ScreenHeader } from '@/components/screen-header';
import { ThemedView } from '@/components/themed-view';
import { Surface } from '@/components/ui/surface';
import { FontFamily, getPalette, Radius, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { getVerkoopVandaag } from '@/data/sales';
import { getRolNiveau } from '@/data/session';
import { Department, getDepartementInfo } from '@/data/store-map';
import { verlofSamenvatting } from '@/data/verlofaanvragen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  ALLE_AFDELINGEN,
  ApiAandachtsartikel,
  ApiNieuweProductVoorFiliaal,
  ApiProductDashboardStats,
  ApiSchapVulling,
  ApiStaffMember,
  ApiTaakSamenvatting,
  ApiUurVerkoop,
  ApiVerlofaanvraag,
  getAandachtsartikelen,
  getNieuweProductenVoorFiliaal,
  getProductDashboardStats,
  getSchapVulling,
  getStaff,
  getTasks,
  getVerkoopPerUur,
  getVerlofaanvragen,
  Prioriteit,
} from '@/lib/api';
import { checkExpoPushReceipt, sendExpoPushNotification } from '@/lib/push-notifications';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const F = FontFamily;

const euro = (n: number) =>
  n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const euroPrecies = (n: number) =>
  n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });

function begroeting(): string {
  const u = new Date().getHours();
  if (u < 6)  return 'Goedenacht';
  if (u < 12) return 'Goedemorgen';
  if (u < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

function huidigeDatum(): string {
  const d = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  return d.charAt(0).toUpperCase() + d.slice(1);
}

const PRIO_KEY: Record<Prioriteit, 'danger' | 'warning' | 'success'> = {
  hoog: 'danger',
  midden: 'warning',
  laag: 'success',
};

function toewijzingLabel(taak: ApiTaakSamenvatting): string | undefined {
  const namen = [
    ...(taak.toegewezenAan ? [taak.toegewezenAan.naam] : []),
    ...taak.extraToegewezenen.map((t) => t.naam),
  ];
  return namen.length > 0 ? namen.join(', ') : undefined;
}

type TaakFilter = 'mij' | 'afdeling';

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [refreshing, setRefreshing]   = useState(false);
  const [notificatieBezig, setNotificatieBezig] = useState(false);
  const [taakFilter, setTaakFilter]   = useState<TaakFilter>('mij');
  const [gekozenUur, setGekozenUur]   = useState<number | null>(null);
  // Startwaarde uit de schermbreedte (content- en cardpadding eraf), zodat de
  // tooltip ook klopt als onLayout niet vuurt; onLayout verfijnt hem daarna.
  const [grafiekBreedte, setGrafiekBreedte] = useState(
    () => Math.max(Dimensions.get('window').width - Spacing.lg * 4, 200)
  );
  const isDark                        = useColorScheme() === 'dark';
  const router                        = useRouter();
  const p                             = getPalette(isDark);
  const { user, refresh, token } = useAuth();

  // ── Verkoop van vandaag (echte data uit de sales-tabel) ──
  const [verkoopPerUur, setVerkoopPerUur] = useState<ApiUurVerkoop[]>([]);

  const laadVerkoop = useCallback(async () => {
    if (!token) return;
    try {
      setVerkoopPerUur(await getVerkoopPerUur(token));
    } catch {
      // Stil falen: dashboard toont dan gewoon geen verkoopdata voor vandaag.
    }
  }, [token]);

  useEffect(() => {
    laadVerkoop();
  }, [laadVerkoop]);

  // ── Schapvulling (echte data uit product_branch/shelves) ──
  const [schapData, setSchapData] = useState<ApiSchapVulling>({
    perCategorie: [],
    totaal: { totaal: 0, opSchap: 0, percentage: 100 },
  });

  const laadSchapvulling = useCallback(async () => {
    if (!token) return;
    try {
      setSchapData(await getSchapVulling(token));
    } catch {
      // Stil falen: sectie toont dan gewoon geen schapdata.
    }
  }, [token]);

  useEffect(() => {
    laadSchapvulling();
  }, [laadSchapvulling]);

  // ── Voorraad-KPI's uit de echte productdata (product_branch van eigen filiaal) ──
  const [stats, setStats] = useState<ApiProductDashboardStats>({
    totaal: 0, verlopen: 0, bijnaVerlopen: 0, lageVoorraad: 0,
  });

  const laadStats = useCallback(async () => {
    if (!token) return;
    try {
      setStats(await getProductDashboardStats(token));
    } catch {
      // Stil falen: KPI-tegels tonen dan gewoon nullen.
    }
  }, [token]);

  useEffect(() => {
    laadStats();
  }, [laadStats]);

  // ── Aandachtsartikelen (langst niet verkocht, eigen filiaal) ──
  const [aandacht, setAandacht] = useState<ApiAandachtsartikel[]>([]);

  const laadAandacht = useCallback(async () => {
    if (!token) return;
    try {
      setAandacht(await getAandachtsartikelen(token, 30, 5));
    } catch {
      // Stil falen: sectie toont dan gewoon geen aandachtsartikelen.
    }
  }, [token]);

  useEffect(() => {
    laadAandacht();
  }, [laadAandacht]);

  // ── Nieuwe producten zonder filiaalgegevens (centraal aangemaakt, wachten op schap/voorraad/THT) ──
  const [nieuweProducten, setNieuweProducten] = useState<ApiNieuweProductVoorFiliaal[]>([]);

  const laadNieuweProducten = useCallback(async () => {
    if (!token) return;
    try {
      setNieuweProducten(await getNieuweProductenVoorFiliaal(token));
    } catch {
      // Stil falen: sectie toont dan gewoon geen nieuwe producten.
    }
  }, [token]);

  // useFocusEffect i.p.v. useEffect: ná het activeren van een product op
  // product/activeren/[barcode] moet dit lijstje bij terugkeer meteen kloppen.
  useFocusEffect(
    useCallback(() => {
      laadNieuweProducten();
    }, [laadNieuweProducten])
  );

  const verkoop = useMemo(() => getVerkoopVandaag(verkoopPerUur), [verkoopPerUur]);

  // ── Taken van mij / mijn afdeling (echte data uit de tasks-tabel) ──
  const [taken, setTaken] = useState<ApiTaakSamenvatting[]>([]);

  const laadTaken = useCallback(async () => {
    if (!token) return;
    try {
      setTaken(await getTasks(token));
    } catch {
      // Stil falen: takensectie toont dan gewoon geen taken.
    }
  }, [token]);

  useEffect(() => {
    laadTaken();
  }, [laadTaken]);

  const isVoorMij = useCallback(
    (taak: ApiTaakSamenvatting) =>
      !!user && (taak.toegewezenAan?.id === Number(user.id) || taak.extraToegewezenen.some(t => t.id === Number(user.id))),
    [user]
  );

  const mijnTaken = useMemo(
    () => taken.filter(t => t.status !== 'finish' && isVoorMij(t)),
    [taken, isVoorMij]
  );
  const afdelingTaken = useMemo(
    () => taken.filter(t => t.status !== 'finish' && t.afdeling === user?.afdelingId),
    [taken, user?.afdelingId]
  );

  const zichtbareTaken = useMemo(() => {
    const bron = taakFilter === 'mij' ? mijnTaken : afdelingTaken;
    const rang = { hoog: 0, midden: 1, laag: 2 } as const;
    return [...bron].sort((a, b) => (a.prioriteit ? rang[a.prioriteit] : 3) - (b.prioriteit ? rang[b.prioriteit] : 3)).slice(0, 4);
  }, [taakFilter, mijnTaken, afdelingTaken]);

  // ── Rolgebonden dashboard-onderdelen: teamleider ziet verlofaanvragen van
  // zijn afdeling, filiaalmanager ziet ze filiaalbreed plus een overzicht.
  // De server bepaalt zelf wat de rol mag zien (php-api/leave-requests/list.php) —
  // de client hoeft hier niet zelf nog eens op afdeling te filteren. ──
  const rolNiveau = getRolNiveau(user?.rol ?? '');

  const [verlofaanvragen, setVerlofaanvragen] = useState<ApiVerlofaanvraag[]>([]);
  const [verlofFout, setVerlofFout] = useState<string | null>(null);

  const laadVerlofaanvragen = useCallback(async () => {
    if (!token || rolNiveau === 'medewerker') return;
    try {
      setVerlofaanvragen(await getVerlofaanvragen(token));
      setVerlofFout(null);
    } catch (e) {
      // Zichtbaar maken i.p.v. stil negeren — anders is een lege lijst niet
      // te onderscheiden van "de aanroep is mislukt".
      setVerlofFout(e instanceof Error ? e.message : 'Laden is mislukt.');
    }
  }, [token, rolNiveau]);

  // useFocusEffect i.p.v. useEffect: ná het beslissen op /verlof/[id] moet
  // dit lijstje bij terugkeer meteen kloppen.
  useFocusEffect(
    useCallback(() => {
      laadVerlofaanvragen();
    }, [laadVerlofaanvragen])
  );

  // ── Filiaaloverzicht: medewerkers + taken per afdeling (alleen filiaalmanager) ──
  const [staff, setStaff] = useState<ApiStaffMember[]>([]);

  const laadStaff = useCallback(async () => {
    if (!token || rolNiveau !== 'filiaalmanager') return;
    try {
      setStaff(await getStaff(token));
    } catch {
      // Stil falen: "Medewerkers"-telling toont dan gewoon 0.
    }
  }, [token, rolNiveau]);

  useEffect(() => {
    laadStaff();
  }, [laadStaff]);

  const filiaaloverzicht = useMemo(() => {
    return ALLE_AFDELINGEN.map((afdeling) => {
      const items = taken.filter(t => t.afdeling === afdeling);
      const afgerond = items.filter(t => t.status === 'finish').length;
      const pct = items.length === 0 ? 0 : Math.round((afgerond / items.length) * 100);
      return { afdeling, totaal: items.length, afgerond, pct };
    });
  }, [taken]);


  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refresh().catch(() => {}),
      laadVerkoop(),
      laadVerlofaanvragen(),
      laadSchapvulling(),
      laadStats(),
      laadAandacht(),
      laadTaken(),
      laadStaff(),
      laadNieuweProducten(),
    ]);
    setRefreshing(false);
  }, [refresh, laadVerkoop, laadVerlofaanvragen, laadSchapvulling, laadStats, laadAandacht, laadTaken, laadStaff, laadNieuweProducten]);

  const stuurTestNotificatie = useCallback(async () => {
    if (notificatieBezig) return;
    setNotificatieBezig(true);
    try {
      const ticket = await sendExpoPushNotification(
        'ExponentPushToken[ZhjXNEAV4aGNUAaxIGTUIa]',
        'Inventra',
        'Dit is een testnotificatie vanuit de app.',
      );

      if (!ticket.id) {
        Alert.alert('Verstuurd', 'Expo heeft het verzoek geaccepteerd, maar gaf geen ticket-id terug om te bevestigen.');
        return;
      }

      // Direct na versturen is de afleverstatus nog niet bekend bij Expo —
      // even wachten voordat we het "receipt" opvragen.
      await new Promise(resolve => setTimeout(resolve, 2500));
      const receipt = await checkExpoPushReceipt(ticket.id);

      if (!receipt) {
        Alert.alert(
          'Status nog niet bekend',
          'Expo heeft het geaccepteerd, maar de bevestiging is nog niet beschikbaar. Probeer het zo nog eens.',
        );
      } else if (receipt.status === 'error') {
        const foutcode = receipt.details?.error;
        Alert.alert(
          'Niet afgeleverd',
          foutcode === 'DeviceNotRegistered'
            ? 'Dit push-token is niet (meer) geldig voor dit apparaat — waarschijnlijk verlopen of van een andere installatie.'
            : (foutcode ? `${foutcode}: ${receipt.message}` : receipt.message) ?? 'Onbekende fout.',
        );
      } else {
        Alert.alert(
          'Afgeleverd',
          'Expo bevestigt dat de notificatie is afgeleverd. Zie je niets op het toestel, dan ondersteunt de huidige app-omgeving (bv. Expo Go op Android) mogelijk geen remote push-notificaties — test dan met een development build.',
        );
      }
    } catch (e) {
      Alert.alert('Mislukt', e instanceof Error ? e.message : 'Versturen is mislukt.');
    } finally {
      setNotificatieBezig(false);
    }
  }, [notificatieBezig]);

  const problemen = stats.verlopen + stats.bijnaVerlopen;
  const uurMax = Math.max(...verkoopPerUur.map(u => u.transacties), 1);
  const nuUur = new Date().getHours();

  const schapKleur = (pct: number) =>
    pct >= 95 ? p.success : pct >= 85 ? p.warning : p.danger;

  if (!user) return null;

  return (
    <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
      <ScreenHeader title="Dashboard" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.textMuted} />
        }
      >
        {/* Welkomst */}
        <View style={styles.welkomst}>
          <Text style={[styles.welkomstTitel, { color: p.text }]}>
            {begroeting()} {user.voornaam}
          </Text>
          <Text style={[styles.welkomstDatum, { color: p.textSecondary }]}>
            {huidigeDatum()} · {user.rol}
          </Text>
        </View>

        {/* Alert */}
        {problemen > 0 && (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => router.push('/tht')}
            style={[styles.alert, { backgroundColor: p.dangerSoft, borderColor: p.danger + '33' }]}
          >
            <Ionicons name="alert-circle" size={16} color={p.danger} />
            <View style={styles.alertBody}>
              <Text style={[styles.alertTitel, { color: p.danger }]}>
                {problemen} {problemen === 1 ? 'artikel vraagt' : 'artikelen vragen'} aandacht
              </Text>
              <Text style={[styles.alertSub, { color: p.danger }]}>
                {stats.verlopen} verlopen · {stats.bijnaVerlopen} bijna verlopen
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={p.danger} />
          </TouchableOpacity>
        )}

        {/* ── Nieuwe producten: centraal aangemaakt, wachten op schap/voorraad/THT van dit filiaal ── */}
        {nieuweProducten.length > 0 && (
          <>
            <SectieLabel titel="Nieuwe producten" meta={`${nieuweProducten.length} in te vullen`} palette={p} />
            <Surface style={styles.sectionCard}>
              {nieuweProducten.map((prod, idx) => (
                <TouchableOpacity
                  key={prod.barcode}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({
                      pathname: '/product/activeren/[barcode]',
                      params: { barcode: prod.barcode, naam: prod.naam, afbeelding: prod.afbeelding ?? '' },
                    })
                  }
                  style={[
                    styles.rij,
                    idx < nieuweProducten.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: p.divider },
                  ]}
                >
                  {prod.afbeelding ? (
                    <Image source={{ uri: prod.afbeelding }} style={styles.nieuwFoto} />
                  ) : (
                    <View style={[styles.nieuwFoto, styles.nieuwFotoPlaceholder, { backgroundColor: p.surfaceAlt }]}>
                      <Ionicons name="cube-outline" size={16} color={p.textMuted} />
                    </View>
                  )}
                  <View style={styles.rijBody}>
                    <Text style={[styles.rijTitel, { color: p.text }]} numberOfLines={1}>
                      {prod.naam}
                    </Text>
                    <Text style={[styles.rijMeta, { color: p.textSecondary }]}>
                      {prod.merk} · {prod.categorie}
                    </Text>
                  </View>
                  <View style={[styles.nieuwBadge, { backgroundColor: p.warningSoft }]}>
                    <Text style={[styles.nieuwBadgeTxt, { color: p.warning }]}>Aanvullen</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={p.textMuted} />
                </TouchableOpacity>
              ))}
            </Surface>
          </>
        )}

        {/* ── Verkoop vandaag ── */}
        <SectieLabel titel="Verkoop vandaag" meta="per uur" palette={p} />
        <Surface style={styles.card}>
          <View style={styles.verkoopKop}>
            <View>
              <Text style={[styles.label, { color: p.textMuted }]}>Omzet</Text>
              <Text style={[styles.heroGetal, { color: p.text }]}>{euro(verkoop.omzet)}</Text>
            </View>
            <View style={styles.verkoopRechts}>
              <Text style={[styles.verkoopTrans, { color: p.text }]}>{verkoop.transacties}</Text>
              <Text style={[styles.label, { color: p.textMuted }]}>transacties</Text>
            </View>
          </View>

          <View
            style={styles.grafiekWrap}
            onLayout={e => setGrafiekBreedte(e.nativeEvent.layout.width)}
          >
            <UurTooltip
              uur={gekozenUur}
              grafiekBreedte={grafiekBreedte}
              verkoopPerUur={verkoopPerUur}
              palette={p}
              onSluit={() => setGekozenUur(null)}
            />

            <View style={styles.uurGrafiek}>
              {verkoopPerUur.map(u => {
                const benadrukt =
                  gekozenUur !== null ? u.uur === gekozenUur : u.uur === nuUur;
                return (
                  <TouchableOpacity
                    key={u.uur}
                    style={styles.uurKolom}
                    activeOpacity={0.6}
                    onPress={() => setGekozenUur(prev => (prev === u.uur ? null : u.uur))}
                    accessibilityLabel={`${u.uur}:00 — ${u.transacties} transacties, ${euroPrecies(u.omzet)}`}
                  >
                    <View style={styles.uurTrack}>
                      <View
                        style={[
                          styles.uurBar,
                          {
                            height: `${Math.max((u.transacties / uurMax) * 100, 5)}%` as any,
                            backgroundColor: benadrukt ? p.accent : p.accentSoft,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.uurLabel,
                        {
                          color: benadrukt ? p.accent : p.textMuted,
                          fontWeight: benadrukt ? '700' : '500',
                        },
                      ]}
                    >
                      {u.uur}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={[styles.verkoopVoet, { borderTopColor: p.divider }]}>
            {gekozenUur !== null ? (
              <>
                <Ionicons name="information-circle-outline" size={13} color={p.accent} />
                <Text style={[styles.verkoopVoetTxt, { color: p.textSecondary }]}>
                  Tik nogmaals om te sluiten
                </Text>
              </>
            ) : verkoop.besteUur ? (
              <>
                <Ionicons name="trending-up" size={13} color={p.success} />
                <Text style={[styles.verkoopVoetTxt, { color: p.textSecondary }]}>
                  Piek om {verkoop.besteUur.uur}:00 · {verkoop.besteUur.transacties} transacties · tik op een balk
                </Text>
              </>
            ) : (
              <Text style={[styles.verkoopVoetTxt, { color: p.textSecondary }]}>
                Nog geen verkopen vandaag.
              </Text>
            )}
          </View>
        </Surface>

        {/* ── Schapvulling ── */}
        <SectieLabel
          titel="Volle schappen"
          meta={`${schapData.totaal.opSchap}/${schapData.totaal.totaal} artikelen`}
          palette={p}
        />
        <Surface style={styles.card}>
          <View style={styles.schapKop}>
            <Text style={[styles.schapTotaalPct, { color: schapKleur(schapData.totaal.percentage) }]}>
              {schapData.totaal.percentage}%
            </Text>
            <Text style={[styles.schapTotaalTxt, { color: p.textSecondary }]}>
              van het assortiment ligt in de winkel
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: p.divider }]} />

          <View style={styles.catLijst}>
            {schapData.perCategorie.map(cat => (
              <View key={cat.categorie} style={styles.catRij}>
                <Text style={[styles.catLabel, { color: p.textSecondary }]} numberOfLines={1}>
                  {cat.categorie}
                </Text>
                <View style={[styles.catTrack, { backgroundColor: p.surfaceAlt }]}>
                  <View
                    style={[
                      styles.catFill,
                      {
                        width: `${Math.max(cat.percentage, 3)}%` as any,
                        backgroundColor: schapKleur(cat.percentage),
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.catPct, { color: schapKleur(cat.percentage) }]}>
                  {cat.percentage}%
                </Text>
        
              </View>
            ))}
          </View>
        </Surface>

        {/* ── Aandachtsartikelen (lang niet verkocht) ── */}
        {aandacht.length > 0 && (
          <>
            <SectieLabel titel="Aandachtsartikelen" meta="lang niet verkocht" palette={p} />
            <Surface style={styles.sectionCard}>
              {aandacht.map((art, idx) => (
                <TouchableOpacity
                  key={art.barcode}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({ pathname: '/product/[barcode]', params: { barcode: art.barcode } })
                  }
                  style={[
                    styles.rij,
                    idx < aandacht.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: p.divider },
                  ]}
                >
                  <View style={[styles.dagenBadge, { backgroundColor: p.surfaceAlt, borderColor: p.border }]}>
                    <Text style={[styles.dagenGetal, { color: art.dagen >= 60 ? p.danger : p.warning }]}>
                      {art.dagen}
                    </Text>
                    <Text style={[styles.dagenLbl, { color: p.textMuted }]}>dgn</Text>
                  </View>
                  <View style={styles.rijBody}>
                    <Text style={[styles.rijTitel, { color: p.text }]} numberOfLines={1}>
                      {art.naam}
                    </Text>
                    <Text style={[styles.rijMeta, { color: p.textSecondary }]}>
                      {art.categorie} · {art.locatie} · {art.voorraadWinkel} op schap
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={p.textMuted} />
                </TouchableOpacity>
              ))}
            </Surface>
          </>
        )}

        {/* ── Taken: van mij / van mijn afdeling ── */}
        <SectieLabel titel="Openstaande taken" palette={p} />
        <View style={[styles.segment, { backgroundColor: p.surfaceAlt, borderColor: p.border }]}>
          <SegmentKnop
            label={`Voor mij (${mijnTaken.length})`}
            actief={taakFilter === 'mij'}
            palette={p}
            onPress={() => setTaakFilter('mij')}
          />
          <SegmentKnop
            label={`${getDepartementInfo(user.afdelingId as Department).label} (${afdelingTaken.length})`}
            actief={taakFilter === 'afdeling'}
            palette={p}
            onPress={() => setTaakFilter('afdeling')}
          />
        </View>

        <Surface style={styles.sectionCard}>
          {zichtbareTaken.length === 0 ? (
            <View style={styles.leeg}>
              <Ionicons name="checkmark-circle-outline" size={20} color={p.textMuted} />
              <Text style={[styles.leegTxt, { color: p.textSecondary }]}>
                Geen openstaande taken
              </Text>
            </View>
          ) : (
            zichtbareTaken.map((taak, idx) => {
              const key = taak.prioriteit ? PRIO_KEY[taak.prioriteit] : null;
              const bg = key === 'danger' ? p.dangerSoft : key === 'warning' ? p.warningSoft : p.successSoft;
              const fg = key === 'danger' ? p.danger : key === 'warning' ? p.warning : p.success;
              const label = toewijzingLabel(taak);
              return (
                <TouchableOpacity
                  key={taak.id}
                  style={[
                    styles.rij,
                    idx < zichtbareTaken.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: p.divider },
                  ]}
                  onPress={() => router.push({ pathname: '/tasks/[id]', params: { id: String(taak.id) } })}
                  activeOpacity={0.7}
                >
                  <View style={styles.rijBody}>
                    <View style={styles.rijTitelRij}>
                      <Text style={[styles.rijTitel, { color: p.text }]} numberOfLines={1}>
                        {taak.titel}
                      </Text>
                      {taak.prioriteit && (
                        <View style={[styles.prioBadge, { backgroundColor: bg }]}>
                          <Text style={[styles.prioBadgeTxt, { color: fg }]}>{taak.prioriteit}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.rijMeta, { color: p.textSecondary }]}>
                      {getDepartementInfo(taak.afdeling).label}
                      {taak.status === 'active' ? ' · bezig' : ''}
                      {label ? ` · ${label}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={p.textMuted} />
                </TouchableOpacity>
              );
            })
          )}
        </Surface>

        {/* ── Verlofaanvragen: teamleider ziet eigen afdeling, filiaalmanager filiaalbreed ── */}
        {rolNiveau !== 'medewerker' && (
          <>
            <SectieLabel
              titel="Verlofaanvragen"
              meta={rolNiveau === 'filiaalmanager' ? 'hele filiaal' : getDepartementInfo(user.afdelingId as Department).label}
              palette={p}
            />
            <Surface style={styles.sectionCard}>
              {verlofFout ? (
                <View style={styles.leeg}>
                  <Ionicons name="alert-circle-outline" size={20} color={p.danger} />
                  <Text style={[styles.leegTxt, { color: p.danger }]}>{verlofFout}</Text>
                </View>
              ) : verlofaanvragen.length === 0 ? (
                <View style={styles.leeg}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={p.textMuted} />
                  <Text style={[styles.leegTxt, { color: p.textSecondary }]}>
                    Geen openstaande aanvragen
                  </Text>
                </View>
              ) : (
                verlofaanvragen.map((aanvraag, idx) => (
                  <TouchableOpacity
                    key={aanvraag.id}
                    style={[
                      styles.rij,
                      idx < verlofaanvragen.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: p.divider },
                    ]}
                    onPress={() => router.push({ pathname: '/verlof/[id]', params: { id: String(aanvraag.id) } })}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.dagenBadge, { backgroundColor: p.accentSoft, borderColor: p.border }]}>
                      <Ionicons name="calendar-outline" size={15} color={p.accent} />
                    </View>
                    <View style={styles.rijBody}>
                      <Text style={[styles.rijTitel, { color: p.text }]} numberOfLines={1}>
                        {aanvraag.medewerkerNaam}
                      </Text>
                      <Text style={[styles.rijMeta, { color: p.textSecondary }]}>
                        {verlofSamenvatting(aanvraag)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color={p.textMuted} />
                  </TouchableOpacity>
                ))
              )}
            </Surface>
          </>
        )}

        {/* ── Voorraad-KPI's ── */}
        <SectieLabel titel="Voorraad" meta={`${stats.totaal} artikelen`} palette={p} />
        <Surface style={styles.card}>
          <View style={styles.subStatRij}>
            <KpiCel
              label="Verlopen"
              waarde={stats.verlopen}
              kleur={stats.verlopen > 0 ? p.danger : p.text}
              palette={p}
              onPress={() => router.push('/tht')}
            />
            <View style={[styles.vDivider, { backgroundColor: p.divider }]} />
            <KpiCel
              label="Bijna verlopen"
              waarde={stats.bijnaVerlopen}
              kleur={stats.bijnaVerlopen > 0 ? p.warning : p.text}
              palette={p}
              onPress={() => router.push('/tht')}
            />
            <View style={[styles.vDivider, { backgroundColor: p.divider }]} />
            <KpiCel
              label="Lage voorraad"
              waarde={stats.lageVoorraad}
              kleur={stats.lageVoorraad > 0 ? p.warning : p.text}
              palette={p}
              onPress={() => router.push('/products')}
            />
          </View>
        </Surface>

        {/* ── Filiaaloverzicht: alleen filiaalmanager ── */}
        {rolNiveau === 'filiaalmanager' && (
          <>
            <SectieLabel titel="Filiaaloverzicht" meta="per afdeling" palette={p} />
            <Surface style={styles.card}>
              <View style={styles.subStatRij}>
                <KpiCel label="Medewerkers" waarde={staff.length} kleur={p.text} palette={p} />
                <View style={[styles.vDivider, { backgroundColor: p.divider }]} />
                <KpiCel
                  label="Open taken"
                  waarde={filiaaloverzicht.reduce((s, c) => s + (c.totaal - c.afgerond), 0)}
                  kleur={p.text}
                  palette={p}
                  onPress={() => router.push('/taken')}
                />
                <View style={[styles.vDivider, { backgroundColor: p.divider }]} />
                <KpiCel
                  label="Verlofaanvragen"
                  waarde={verlofaanvragen.length}
                  kleur={verlofaanvragen.length > 0 ? p.warning : p.text}
                  palette={p}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: p.divider }]} />

              <View style={styles.catLijst}>
                {filiaaloverzicht.map(({ afdeling, totaal, afgerond, pct }) => (
                  <View key={afdeling} style={styles.catRij}>
                    <Text style={[styles.catLabel, { color: p.textSecondary }]} numberOfLines={1}>
                      {getDepartementInfo(afdeling).label} · {staff.filter(s => s.afdeling === afdeling).length}p
                    </Text>
                    <View style={[styles.catTrack, { backgroundColor: p.surfaceAlt }]}>
                      <View
                        style={[
                          styles.catFill,
                          { width: `${Math.max(pct, 3)}%` as any, backgroundColor: schapKleur(pct) },
                        ]}
                      />
                    </View>
                    <Text style={[styles.catPct, { color: schapKleur(pct) }]}>{afgerond}/{totaal}</Text>
                  </View>
                ))}
              </View>
            </Surface>
          </>
        )}

        {/* ── Snelkoppelingen ── */}
        <SectieLabel titel="Snelkoppelingen" palette={p} />
        <View style={styles.snelGrid}>
          <SnelKnop icon="scan-outline" label="Scannen"     palette={p} onPress={() => router.push('/products')} />
          <SnelKnop icon="time-outline" label="THT"         palette={p} onPress={() => router.push('/tht')} />
          <SnelKnop icon="list-outline" label="Taken"       palette={p} onPress={() => router.push('/taken')} />
          <SnelKnop icon="map-outline"  label="Plattegrond" palette={p} onPress={() => router.push('/plattegrond')} />
          <SnelKnop
            icon="notifications-outline"
            label={notificatieBezig ? 'Bezig...' : 'Testnotificatie'}
            palette={p}
            onPress={stuurTestNotificatie}
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type Palette = ReturnType<typeof getPalette>;

function SectieLabel({ titel, meta, palette }: { titel: string; meta?: string; palette: Palette }) {
  return (
    <View style={styles.sectieHeader}>
      <Text style={[styles.sectieTitel, { color: palette.textMuted }]}>{titel}</Text>
      {meta ? <Text style={[styles.sectieMeta, { color: palette.textMuted }]}>{meta}</Text> : null}
    </View>
  );
}

const TOOLTIP_BREEDTE = 152;

/** Zwevende tooltip boven de staafgrafiek, uitgelijnd op het gekozen uur. */
function UurTooltip({ uur, grafiekBreedte, verkoopPerUur, palette, onSluit }: {
  uur: number | null;
  grafiekBreedte: number;
  verkoopPerUur: ApiUurVerkoop[];
  palette: Palette;
  onSluit: () => void;
}) {
  if (uur === null || grafiekBreedte <= 0) return null;

  const index = verkoopPerUur.findIndex(u => u.uur === uur);
  const data = verkoopPerUur[index];
  if (!data) return null;

  const kolomBreedte = grafiekBreedte / verkoopPerUur.length;
  const midden = kolomBreedte * (index + 0.5);

  // Binnen de grafiek houden, ook bij de eerste/laatste balk
  const links = Math.max(0, Math.min(midden - TOOLTIP_BREEDTE / 2, grafiekBreedte - TOOLTIP_BREEDTE));
  const pijlLinks = Math.max(10, Math.min(midden - links - 5, TOOLTIP_BREEDTE - 20));

  const gemiddeldeBon = data.transacties > 0 ? data.omzet / data.transacties : 0;
  const aandeel = Math.round(
    (data.omzet / verkoopPerUur.reduce((s, u) => s + u.omzet, 0)) * 100
  );

  return (
    <View style={[styles.tooltipLaag, { left: links, width: TOOLTIP_BREEDTE }]} pointerEvents="none">
      <View style={[styles.tooltip, { backgroundColor: palette.text, borderColor: palette.text }]}>
        <Text style={[styles.tooltipKop, { color: palette.bg }]}>
          {String(data.uur).padStart(2, '0')}:00 – {String(data.uur + 1).padStart(2, '0')}:00
        </Text>

        <TooltipRegel label="Omzet"      waarde={euroPrecies(data.omzet)}      palette={palette} />
        <TooltipRegel label="Transacties" waarde={String(data.transacties)}    palette={palette} />
        <TooltipRegel label="Gem. bon"   waarde={euroPrecies(gemiddeldeBon)}   palette={palette} />
        <TooltipRegel label="Aandeel dag" waarde={`${aandeel}%`}               palette={palette} />
      </View>
      <View style={[styles.tooltipPijl, { left: pijlLinks, borderTopColor: palette.text }]} />
    </View>
  );
}

function TooltipRegel({ label, waarde, palette }: {
  label: string; waarde: string; palette: Palette;
}) {
  return (
    <View style={styles.tooltipRegel}>
      <Text style={[styles.tooltipLabel, { color: palette.bg, opacity: 0.65 }]}>{label}</Text>
      <Text style={[styles.tooltipWaarde, { color: palette.bg }]}>{waarde}</Text>
    </View>
  );
}

function SegmentKnop({ label, actief, palette, onPress }: {
  label: string; actief: boolean; palette: Palette; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.segmentKnop,
        actief && { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <Text
        style={[
          styles.segmentTxt,
          { color: actief ? palette.text : palette.textMuted, fontWeight: actief ? '600' : '500' },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function KpiCel({ label, waarde, kleur, palette, onPress }: {
  label: string; waarde: number; kleur: string; palette: Palette; onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.subStat} onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
      <Text style={[styles.subStatGetal, { color: kleur }]}>{waarde}</Text>
      <Text style={[styles.subStatLabel, { color: palette.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SnelKnop({ icon, label, palette, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; palette: Palette; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.snelKnop, { backgroundColor: palette.surface, borderColor: palette.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={18} color={palette.textSecondary} />
      <Text style={[styles.snelLabel, { color: palette.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Content
  content: { padding: Spacing.lg, paddingBottom: 36, gap: Spacing.md },

  // Welkomst
  welkomst:      { paddingHorizontal: 2, marginBottom: 2 },
  welkomstTitel: { fontSize: 19, fontWeight: '700', letterSpacing: -0.3, fontFamily: F },
  welkomstDatum: { fontSize: 12, marginTop: 2, fontFamily: F },

  // Alert
  alert: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 0.5, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md + 2, paddingVertical: 11,
  },
  alertBody:  { flex: 1 },
  alertTitel: { fontSize: 12.5, fontWeight: '600', fontFamily: F },
  alertSub:   { fontSize: 11, marginTop: 1, opacity: 0.8, fontFamily: F },

  // Cards
  card:        { borderRadius: Radius.lg, padding: Spacing.lg },
  sectionCard: { borderRadius: Radius.lg, overflow: 'hidden' },

  label:     { fontSize: 9.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: F },
  heroGetal: { fontSize: 26, fontWeight: '700', lineHeight: 30, letterSpacing: -0.6, marginTop: 2, fontFamily: F },
  divider:   { height: 0.5, marginVertical: Spacing.md },
  vDivider:  { width: 0.5, alignSelf: 'stretch' },

  // Verkoop
  verkoopKop:    { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: Spacing.lg },
  verkoopRechts: { alignItems: 'flex-end' },
  verkoopTrans:  { fontSize: 17, fontWeight: '600', fontFamily: F },
  grafiekWrap:   { position: 'relative' },
  uurGrafiek:    { flexDirection: 'row', gap: 4, height: 68, alignItems: 'flex-end' },

  // Tooltip
  tooltipLaag: { position: 'absolute', bottom: '100%', marginBottom: 8, zIndex: 20 },
  tooltip: {
    borderRadius: Radius.sm,
    borderWidth: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  tooltipKop: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2, marginBottom: 3, fontFamily: F },
  tooltipRegel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  tooltipLabel: { fontSize: 10, fontFamily: F },
  tooltipWaarde: { fontSize: 10.5, fontWeight: '700', fontFamily: F },
  tooltipPijl: {
    position: 'absolute', top: '100%',
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 5,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  uurKolom:      { flex: 1, alignItems: 'center', gap: 5 },
  uurTrack:      { flex: 1, width: '100%', justifyContent: 'flex-end' },
  uurBar:        { width: '100%', borderRadius: 3 },
  uurLabel:      { fontSize: 8.5, fontFamily: F },
  verkoopVoet:   { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 0.5, marginTop: Spacing.md, paddingTop: 9 },
  verkoopVoetTxt:{ fontSize: 11, fontFamily: F },

  // Schapvulling
  schapKop:       { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  schapTotaalPct: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6, fontFamily: F },
  schapTotaalTxt: { fontSize: 11.5, flex: 1, fontFamily: F },
  catLijst:  { gap: 9 },
  catRij:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catLabel:  { fontSize: 11.5, width: 100, fontFamily: F },
  catTrack:  { flex: 1, height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  catFill:   { height: '100%', borderRadius: Radius.pill },
  catPct:    { fontSize: 11.5, fontWeight: '700', width: 34, textAlign: 'right', fontFamily: F },
  catFractie:{ fontSize: 10, width: 32, textAlign: 'right', fontFamily: F },

  // Sectie-label
  sectieHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: Spacing.md, marginBottom: -2, paddingHorizontal: 3,
  },
  sectieTitel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, fontFamily: F },
  sectieMeta:  { fontSize: 10, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: F },

  // Segment
  segment: {
    flexDirection: 'row', gap: 3, padding: 3,
    borderRadius: Radius.sm, borderWidth: 0.5,
  },
  segmentKnop: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 7, borderRadius: Radius.sm - 3, borderWidth: 0.5, borderColor: 'transparent',
  },
  segmentTxt: { fontSize: 11.5, fontFamily: F },

  // Lijstrijen
  rij:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.md + 2, paddingVertical: 11 },
  rijBody:     { flex: 1, minWidth: 0, gap: 2 },
  rijTitelRij: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rijTitel:    { fontSize: 13, fontWeight: '600', fontFamily: F, flexShrink: 1 },
  rijMeta:     { fontSize: 11, fontFamily: F },
  prioBadge:   { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0 },
  prioBadgeTxt:{ fontSize: 9.5, fontWeight: '600', fontFamily: F },

  // Nieuwe producten
  nieuwFoto: { width: 38, height: 38, borderRadius: Radius.sm, flexShrink: 0 },
  nieuwFotoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  nieuwBadge: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, flexShrink: 0 },
  nieuwBadgeTxt: { fontSize: 9.5, fontWeight: '700', fontFamily: F },

  // Dagen-badge (aandachtsartikelen)
  dagenBadge: {
    width: 38, borderRadius: Radius.sm - 2, borderWidth: 0.5,
    alignItems: 'center', paddingVertical: 5, flexShrink: 0,
  },
  dagenGetal: { fontSize: 13, fontWeight: '700', fontFamily: F },
  dagenLbl:   { fontSize: 8.5, textTransform: 'uppercase', letterSpacing: 0.4, fontFamily: F },

  // Lege staat
  leeg:    { alignItems: 'center', gap: 6, paddingVertical: Spacing.xl },
  leegTxt: { fontSize: 12, fontFamily: F },

  // KPI
  subStatRij:   { flexDirection: 'row' },
  subStat:      { flex: 1, alignItems: 'center', paddingVertical: 2, gap: 3 },
  subStatGetal: { fontSize: 17, fontWeight: '600', fontFamily: F },
  subStatLabel: { fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '500', textAlign: 'center', fontFamily: F },

  // Snelkoppelingen
  snelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  snelKnop: {
    flexGrow: 1, flexBasis: '47%',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 0.5, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 11,
  },
  snelLabel: { fontSize: 12.5, fontWeight: '600', fontFamily: F },
});

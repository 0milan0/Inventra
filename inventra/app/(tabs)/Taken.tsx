import { ScreenHeader } from '@/components/screen-header';
import { ThemedView } from '@/components/themed-view';
import { Surface } from '@/components/ui/surface';
import { FontFamily, getPalette, Radius, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { departementen, getDepartementInfo } from '@/data/store-map';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  Afdeling,
  ALLE_AFDELINGEN,
  ApiStaffMember,
  ApiTaakSamenvatting,
  createTask,
  getStaff,
  getTasks,
  Prioriteit,
  RepeatDay,
  RepeatInterval,
  TaakStatus,
  updateTask,
} from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Config ───────────────────────────────────────────────────────────────────

const F = FontFamily;

const PRIO_KEY: Record<Prioriteit, 'danger' | 'warning' | 'success'> = {
  hoog: 'danger',
  midden: 'warning',
  laag: 'success',
};

const PRIO_LABEL: Record<Prioriteit, string> = {
  hoog: 'Hoog',
  midden: 'Midden',
  laag: 'Laag',
};

const STATUS_FILTERS: { id: 'alle' | TaakStatus; label: string }[] = [
  { id: 'alle', label: 'Alle' },
  { id: 'Todo', label: 'Open' },
  { id: 'active', label: 'Bezig' },
  { id: 'finish', label: 'Afgerond' },
];

const AFDELING_ICOON: Record<Afdeling, keyof typeof Ionicons.glyphMap> = {
  AGF: 'leaf-outline',
  Vers: 'restaurant-outline',
  Brood: 'cafe-outline',
  KW: 'cart-outline',
  'Kassa & Boetiek': 'receipt-outline',
};

const REPEAT_LABEL: Record<RepeatInterval, string> = {
  Yearly: 'Jaarlijks',
  quarterly: 'Elk kwartaal',
  monthly: 'Maandelijks',
  weekly: 'Wekelijks',
  daily: 'Dagelijks',
  specific_day: 'Specifieke dag',
};

const DAG_LABEL: Record<RepeatDay, string> = {
  Monday: 'Maandag',
  Tuesday: 'Dinsdag',
  Wednesday: 'Woensdag',
  Thursday: 'Donderdag',
  Friday: 'Vrijdag',
  Saturday: 'Zaterdag',
  Sunday: 'Zondag',
};

function formatDatum(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

function isVoorMij(taak: ApiTaakSamenvatting, userId: string): boolean {
  return taak.toegewezenAan?.id === Number(userId) || taak.extraToegewezenen.some((t) => t.id === Number(userId));
}

function toewijzingLabel(taak: ApiTaakSamenvatting): string | undefined {
  const namen = [
    ...(taak.toegewezenAan ? [taak.toegewezenAan.naam] : []),
    ...taak.extraToegewezenen.map((t) => t.naam),
  ];
  return namen.length > 0 ? namen.join(', ') : undefined;
}

function toonKeuze(titel: string, opties: { id: string; label: string }[], onKies: (id: string) => void) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: titel, options: [...opties.map((o) => o.label), 'Annuleren'], cancelButtonIndex: opties.length },
      (index) => {
        if (index < opties.length) onKies(opties[index].id);
      }
    );
  } else {
    Alert.alert(titel, undefined, [
      ...opties.map((o) => ({ text: o.label, onPress: () => onKies(o.id) })),
      { text: 'Annuleren', style: 'cancel' as const },
    ]);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TasksScreen() {
  const [taken, setTaken]                     = useState<ApiTaakSamenvatting[]>([]);
  const [laden, setLaden]                     = useState(true);
  const [fout, setFout]                       = useState<string | null>(null);
  const [statusFilter, setStatusFilter]       = useState<'alle' | TaakStatus>('alle');
  const [afdelingFilter, setAfdelingFilter]   = useState<Afdeling | null>(null);
  const [alleenVoorMij, setAlleenVoorMij]     = useState(false);
  const [zoek, setZoek]                       = useState('');
  const [nieuweTaakOpen, setNieuweTaakOpen]   = useState(false);

  const isDark = useColorScheme() === 'dark';
  const p      = getPalette(isDark);
  const router = useRouter();
  const { user, token } = useAuth();

  const laadTaken = useCallback(async () => {
    if (!token) return;
    setFout(null);
    try {
      setTaken(await getTasks(token));
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Taken laden is mislukt.');
    }
  }, [token]);

  useEffect(() => {
    (async () => {
      setLaden(true);
      await laadTaken();
      setLaden(false);
    })();
  }, [laadTaken]);

  async function toggleTaak(taak: ApiTaakSamenvatting) {
    if (!token || !taak.magBewerken) return;
    const nieuweStatus: TaakStatus = taak.status === 'finish' ? 'Todo' : 'finish';
    setTaken((prev) => prev.map((t) => (t.id === taak.id ? { ...t, status: nieuweStatus } : t)));
    try {
      await updateTask(token, { taskId: taak.id, status: nieuweStatus });
    } catch {
      // Terugdraaien bij een mislukte call.
      setTaken((prev) => prev.map((t) => (t.id === taak.id ? { ...t, status: taak.status } : t)));
    }
  }

  // ── Statistieken ──
  const stats = useMemo(() => ({
    open:      taken.filter(t => t.status === 'Todo').length,
    bezig:     taken.filter(t => t.status === 'active').length,
    afgerond:  taken.filter(t => t.status === 'finish').length,
    hoogPrio:  taken.filter(t => t.status !== 'finish' && t.prioriteit === 'hoog').length,
    voorMij:   user ? taken.filter(t => t.status !== 'finish' && isVoorMij(t, user.id)).length : 0,
  }), [taken, user]);

  const totaalPct = useMemo(() => {
    const klaar = taken.filter(t => t.status === 'finish').length;
    return taken.length === 0 ? 0 : Math.round((klaar / taken.length) * 100);
  }, [taken]);

  const aanwezigeAfdelingen = useMemo(
    () => ALLE_AFDELINGEN.filter((a) => taken.some((t) => t.afdeling === a)),
    [taken]
  );

  const gefilterdeTaken = useMemo(() => {
    const term = zoek.trim().toLowerCase();
    return taken.filter(t => {
      if (statusFilter !== 'alle' && t.status !== statusFilter) return false;
      if (afdelingFilter && t.afdeling !== afdelingFilter) return false;
      if (alleenVoorMij && (!user || !isVoorMij(t, user.id))) return false;
      if (term && !t.titel.toLowerCase().includes(term)
               && !(t.beschrijving ?? '').toLowerCase().includes(term)) return false;
      return true;
    });
  }, [taken, statusFilter, afdelingFilter, alleenVoorMij, zoek, user]);

  const openTaakDetail = (id: number) => router.push({ pathname: '/tasks/[id]', params: { id: String(id) } });

  const zichtbareAfdelingen = aanwezigeAfdelingen.filter(a => !afdelingFilter || a === afdelingFilter);

  if (!user) return null;

  return (
    <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
      <ScreenHeader title="Taken" />

      {laden ? (
        <View style={styles.center}>
          <ActivityIndicator color={p.accent} />
        </View>
      ) : fout ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={p.danger} />
          <Text style={[styles.foutTekst, { color: p.danger }]}>{fout}</Text>
        </View>
      ) : (
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Zoeken ── */}
        <View style={[styles.zoekBalk, { backgroundColor: p.surface, borderColor: p.border }]}>
          <Ionicons name="search-outline" size={16} color={p.textMuted} />
          <TextInput
            value={zoek}
            onChangeText={setZoek}
            placeholder="Zoek in taken…"
            placeholderTextColor={p.textMuted}
            style={[styles.zoekVeld, { color: p.text }]}
            selectionColor={p.accent}
            returnKeyType="search"
          />
          {zoek.length > 0 && (
            <TouchableOpacity onPress={() => setZoek('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={p.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Nieuwe taak ── */}
        <TouchableOpacity
          onPress={() => setNieuweTaakOpen(true)}
          style={[styles.nieuweTaakBtn, { backgroundColor: p.accent }]}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.nieuweTaakTxt}>Nieuwe taak</Text>
        </TouchableOpacity>

        {/* ── Voortgang ── */}
        <Surface style={styles.card}>
          <View style={styles.voortgangKop}>
            <View>
              <Text style={[styles.label, { color: p.textMuted }]}>Afgerond</Text>
              <Text style={[styles.voortgangPct, { color: p.text }]}>{totaalPct}%</Text>
            </View>
            <Text style={[styles.voortgangMeta, { color: p.textSecondary }]}>
              {stats.afgerond} van {taken.length} taken
            </Text>
          </View>

          <View style={[styles.balkTrack, { backgroundColor: p.surfaceAlt }]}>
            <View
              style={[
                styles.balkFill,
                { width: `${Math.max(totaalPct, 2)}%` as any, backgroundColor: p.accent },
              ]}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: p.divider }]} />

          <View style={styles.statRij}>
            <StatCel label="Open"      waarde={stats.open}     kleur={p.text}    palette={p} />
            <View style={[styles.vDivider, { backgroundColor: p.divider }]} />
            <StatCel label="Bezig"     waarde={stats.bezig}    kleur={p.warning} palette={p} />
            <View style={[styles.vDivider, { backgroundColor: p.divider }]} />
            <StatCel label="Hoge prio" waarde={stats.hoogPrio} kleur={stats.hoogPrio > 0 ? p.danger : p.text} palette={p} />
            <View style={[styles.vDivider, { backgroundColor: p.divider }]} />
            <StatCel label="Voor mij"  waarde={stats.voorMij}  kleur={p.accent}  palette={p} />
          </View>
        </Surface>

        {/* ── Toewijzing ── */}
        <View style={[styles.segment, { backgroundColor: p.surfaceAlt, borderColor: p.border }]}>
          <SegmentKnop
            label="Alle taken"
            actief={!alleenVoorMij}
            palette={p}
            onPress={() => setAlleenVoorMij(false)}
          />
          <SegmentKnop
            label={`Voor mij (${stats.voorMij})`}
            actief={alleenVoorMij}
            palette={p}
            onPress={() => setAlleenVoorMij(true)}
          />
        </View>

        {/* ── Status-filters ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRij}>
          {STATUS_FILTERS.map(f => {
            const actief = statusFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setStatusFilter(f.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: actief ? p.accent : p.surface,
                    borderColor: actief ? p.accent : p.border,
                  },
                ]}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipTxt, { color: actief ? '#fff' : p.textSecondary }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Afdeling-filters ── */}
        {aanwezigeAfdelingen.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRij}>
            {aanwezigeAfdelingen.map(a => {
              const actief = afdelingFilter === a;
              return (
                <TouchableOpacity
                  key={a}
                  onPress={() => setAfdelingFilter(cur => (cur === a ? null : a))}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: actief ? p.accent : p.surface,
                      borderColor: actief ? p.accent : p.border,
                    },
                  ]}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={AFDELING_ICOON[a] ?? 'ellipse-outline'}
                    size={13}
                    color={actief ? '#fff' : p.textMuted}
                  />
                  <Text style={[styles.chipTxt, { color: actief ? '#fff' : p.textSecondary }]}>
                    {getDepartementInfo(a).label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ── Takenlijst per afdeling ── */}
        {zichtbareAfdelingen.map(afdeling => {
          const items = gefilterdeTaken.filter(t => t.afdeling === afdeling);
          if (items.length === 0) return null;

          const alleInAfdeling = taken.filter(t => t.afdeling === afdeling);
          const afgerondInAfdeling = alleInAfdeling.filter(t => t.status === 'finish').length;

          return (
            <View key={afdeling} style={styles.groep}>
              <View style={styles.sectieHeader}>
                <Text style={[styles.sectieTitel, { color: p.textMuted }]}>{getDepartementInfo(afdeling).label}</Text>
                <Text style={[styles.sectieMeta, { color: p.textMuted }]}>
                  {afgerondInAfdeling}/{alleInAfdeling.length} klaar
                </Text>
              </View>

              <Surface style={styles.sectionCard}>
                {items.map((taak, idx) => {
                  const sleutel = taak.prioriteit ? PRIO_KEY[taak.prioriteit] : null;
                  const prioKleur =
                    sleutel === 'danger' ? p.danger : sleutel === 'warning' ? p.warning : p.success;
                  const prioBg =
                    sleutel === 'danger' ? p.dangerSoft : sleutel === 'warning' ? p.warningSoft : p.successSoft;
                  const gedaan = taak.status === 'finish';

                  return (
                    <TouchableOpacity
                      key={taak.id}
                      style={[
                        styles.taakRij,
                        idx < items.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: p.divider },
                      ]}
                      onPress={() => openTaakDetail(taak.id)}
                      activeOpacity={0.7}
                    >
                      <TouchableOpacity
                        onPress={() => toggleTaak(taak)}
                        disabled={!taak.magBewerken}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={[
                          styles.check,
                          { borderColor: gedaan ? p.accent : p.border, opacity: taak.magBewerken ? 1 : 0.4 },
                          gedaan && { backgroundColor: p.accent },
                        ]}
                      >
                        {gedaan && <Ionicons name="checkmark" size={13} color="#fff" />}
                      </TouchableOpacity>

                      <View style={styles.taakBody}>
                        <View style={styles.taakTitelRij}>
                          <Text
                            style={[
                              styles.taakTitel,
                              { color: gedaan ? p.textMuted : p.text },
                              gedaan && styles.taakGedaan,
                            ]}
                            numberOfLines={1}
                          >
                            {taak.titel}
                          </Text>
                          {!gedaan && taak.prioriteit && (
                            <View style={[styles.prioBadge, { backgroundColor: prioBg }]}>
                              <Text style={[styles.prioBadgeTxt, { color: prioKleur }]}>
                                {PRIO_LABEL[taak.prioriteit]}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.metaRij}>
                          {taak.status === 'active' && (
                            <View style={[styles.bezigStip, { backgroundColor: p.warning }]} />
                          )}
                          <Text style={[styles.taakMeta, { color: p.textSecondary }]} numberOfLines={1}>
                            {[
                              taak.status === 'active' ? 'Bezig' : null,
                              taak.deadline ? formatDatum(taak.deadline) : null,
                              taak.checklistTotaal > 0 ? `${taak.checklistAfgerond}/${taak.checklistTotaal} checklist` : null,
                              toewijzingLabel(taak),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        </View>
                      </View>

                      <Ionicons name="chevron-forward" size={15} color={p.textMuted} />
                    </TouchableOpacity>
                  );
                })}
              </Surface>
            </View>
          );
        })}

        {/* ── Lege staat ── */}
        {gefilterdeTaken.length === 0 && (
          <Surface style={styles.leegKaart}>
            <Ionicons name="checkmark-done-outline" size={26} color={p.textMuted} />
            <Text style={[styles.leegTitel, { color: p.text }]}>Geen taken gevonden</Text>
            <Text style={[styles.leegTxt, { color: p.textSecondary }]}>
              Pas je zoekopdracht of filters aan
            </Text>
            {(zoek || afdelingFilter || statusFilter !== 'alle' || alleenVoorMij) && (
              <TouchableOpacity
                onPress={() => {
                  setZoek('');
                  setAfdelingFilter(null);
                  setStatusFilter('alle');
                  setAlleenVoorMij(false);
                }}
                style={[styles.resetKnop, { borderColor: p.border }]}
                activeOpacity={0.75}
              >
                <Text style={[styles.resetTxt, { color: p.text }]}>Filters wissen</Text>
              </TouchableOpacity>
            )}
          </Surface>
        )}
      </ScrollView>
      )}

      <NieuweTaakModal
        visible={nieuweTaakOpen}
        onClose={() => setNieuweTaakOpen(false)}
        onAangemaakt={() => {
          setNieuweTaakOpen(false);
          laadTaken();
        }}
        eigenAfdeling={user.afdelingId as Afdeling}
        palette={p}
      />
    </ThemedView>
  );
}

// ─── Nieuwe taak — modal ────────────────────────────────────────────────────

type Palette = ReturnType<typeof getPalette>;

function NieuweTaakModal({
  visible, onClose, onAangemaakt, eigenAfdeling, palette: p,
}: {
  visible: boolean;
  onClose: () => void;
  onAangemaakt: () => void;
  eigenAfdeling: Afdeling;
  palette: Palette;
}) {
  const { token } = useAuth();

  const [titel, setTitel] = useState('');
  const [beschrijving, setBeschrijving] = useState('');
  const [afdeling, setAfdeling] = useState<Afdeling>(eigenAfdeling);
  const [prioriteit, setPrioriteit] = useState<Prioriteit>('midden');
  const [deadline, setDeadline] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [herhaalInterval, setHerhaalInterval] = useState<RepeatInterval | null>(null);
  const [herhaalDag, setHerhaalDag] = useState<RepeatDay | null>(null);

  const [staff, setStaff] = useState<ApiStaffMember[]>([]);
  const [staffGeladen, setStaffGeladen] = useState(false);
  const [toegewezenIds, setToegewezenIds] = useState<number[]>([]);
  const [aanmakenBezig, setAanmakenBezig] = useState(false);

  useEffect(() => {
    if (!visible || !token || staffGeladen) return;
    (async () => {
      try {
        setStaff(await getStaff(token));
      } catch {
        // Stil falen: toewijzen wordt dan gewoon overgeslagen.
      } finally {
        setStaffGeladen(true);
      }
    })();
  }, [visible, token, staffGeladen]);

  function reset() {
    setTitel('');
    setBeschrijving('');
    setAfdeling(eigenAfdeling);
    setPrioriteit('midden');
    setDeadline('');
    setShowDatePicker(false);
    setHerhaalInterval(null);
    setHerhaalDag(null);
    setToegewezenIds([]);
  }

  async function maakAan() {
    if (!token || !titel.trim()) return;
    setAanmakenBezig(true);
    try {
      await createTask(token, {
        title: titel.trim(),
        description: beschrijving.trim() || undefined,
        department: afdeling,
        assignedToId: toegewezenIds[0],
        assigneeIds: toegewezenIds.slice(1),
        priority: prioriteit,
        deadline: deadline || undefined,
        repeatInterval: herhaalInterval ?? undefined,
        repeatDay: herhaalDag ?? undefined,
      });
      reset();
      onAangemaakt();
    } catch (e) {
      Alert.alert('Aanmaken mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
    } finally {
      setAanmakenBezig(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[modalStyles.container, { backgroundColor: p.bg }]}>
        <View style={[modalStyles.hdr, { backgroundColor: p.surface, borderBottomColor: p.border }]}>
          <Text style={[modalStyles.title, { color: p.text }]}>Nieuwe taak</Text>
          <TouchableOpacity onPress={onClose} style={[modalStyles.closeBtn, { backgroundColor: p.surfaceAlt }]}>
            <Ionicons name="close" size={18} color={p.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={modalStyles.body} keyboardShouldPersistTaps="handled">
          <TextInput
            value={titel}
            onChangeText={setTitel}
            placeholder="Titel"
            placeholderTextColor={p.textMuted}
            style={[modalStyles.input, { borderColor: p.border, backgroundColor: p.surfaceAlt, color: p.text }]}
          />
          <TextInput
            value={beschrijving}
            onChangeText={setBeschrijving}
            placeholder="Beschrijving (optioneel)"
            placeholderTextColor={p.textMuted}
            multiline
            style={[modalStyles.input, modalStyles.textArea, { borderColor: p.border, backgroundColor: p.surfaceAlt, color: p.text }]}
          />

          <VeldRij
            label="Afdeling"
            waarde={getDepartementInfo(afdeling).label}
            palette={p}
            onPress={() =>
              toonKeuze('Afdeling', departementen.map(d => ({ id: d.id, label: d.label })), (id) => setAfdeling(id as Afdeling))
            }
          />

          <View style={modalStyles.chipRow}>
            {(['laag', 'midden', 'hoog'] as Prioriteit[]).map((prio) => {
              const actief = prioriteit === prio;
              return (
                <TouchableOpacity
                  key={prio}
                  onPress={() => setPrioriteit(prio)}
                  style={[
                    modalStyles.prioChip,
                    { borderColor: actief ? p.accent : p.border, backgroundColor: actief ? p.accentSoft : 'transparent' },
                  ]}
                >
                  <Text style={[modalStyles.prioChipTxt, { color: actief ? p.accent : p.textSecondary }]}>
                    {PRIO_LABEL[prio]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <VeldRij
            label="Deadline"
            waarde={deadline ? formatDatum(deadline) : 'Instellen'}
            palette={p}
            onPress={() => setShowDatePicker((v) => !v)}
          />
          {showDatePicker && (
            <DateTimePicker
              value={deadline ? new Date(deadline) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
              onChange={(_, date) => {
                if (!date) return;
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                setDeadline(`${y}-${m}-${d}`);
                if (Platform.OS !== 'ios') setShowDatePicker(false);
              }}
            />
          )}

          <VeldRij
            label="Herhaling"
            waarde={herhaalInterval ? REPEAT_LABEL[herhaalInterval] : 'Geen'}
            palette={p}
            onPress={() =>
              toonKeuze(
                'Herhaling',
                [{ id: '', label: 'Geen' }, ...Object.entries(REPEAT_LABEL).map(([id, label]) => ({ id, label }))],
                (id) => {
                  setHerhaalInterval(id === '' ? null : (id as RepeatInterval));
                  if (id !== 'weekly' && id !== 'specific_day') setHerhaalDag(null);
                }
              )
            }
          />
          {(herhaalInterval === 'weekly' || herhaalInterval === 'specific_day') && (
            <VeldRij
              label="Herhaaldag"
              waarde={herhaalDag ? DAG_LABEL[herhaalDag] : 'Instellen'}
              palette={p}
              onPress={() =>
                toonKeuze('Dag', Object.entries(DAG_LABEL).map(([id, label]) => ({ id, label })), (id) =>
                  setHerhaalDag(id as RepeatDay)
                )
              }
            />
          )}

          <Text style={[modalStyles.sectionLabel, { color: p.textMuted }]}>Toewijzen</Text>
          {!staffGeladen ? (
            <ActivityIndicator color={p.accent} style={{ marginVertical: Spacing.md }} />
          ) : (
            <View style={[modalStyles.staffCard, { borderColor: p.border }]}>
              {staff.length === 0 ? (
                <Text style={[modalStyles.emptyHint, { color: p.textMuted }]}>Geen collega&apos;s gevonden.</Text>
              ) : (
                staff.map((lid, idx) => {
                  const actief = toegewezenIds.includes(lid.id);
                  return (
                    <TouchableOpacity
                      key={lid.id}
                      onPress={() =>
                        setToegewezenIds((prev) =>
                          actief ? prev.filter((i) => i !== lid.id) : [...prev, lid.id]
                        )
                      }
                      style={[
                        modalStyles.staffRow,
                        idx < staff.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.divider },
                      ]}
                    >
                      <Text style={[modalStyles.staffNaam, { color: p.text }]}>{lid.naam}</Text>
                      <Ionicons
                        name={actief ? 'checkbox' : 'square-outline'}
                        size={19}
                        color={actief ? p.accent : p.textMuted}
                      />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>

        <View style={[modalStyles.footer, { backgroundColor: p.surface, borderTopColor: p.border }]}>
          <TouchableOpacity onPress={onClose} style={[modalStyles.cancelBtn, { borderColor: p.border }]}>
            <Text style={[modalStyles.cancelTxt, { color: p.textSecondary }]}>Annuleren</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={maakAan}
            disabled={!titel.trim() || aanmakenBezig}
            style={[modalStyles.submitBtn, { backgroundColor: p.accent, opacity: !titel.trim() || aanmakenBezig ? 0.6 : 1 }]}
          >
            {aanmakenBezig ? <ActivityIndicator size="small" color="#fff" /> : (
              <Text style={modalStyles.submitTxt}>Aanmaken</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function VeldRij({ label, waarde, palette: p, onPress }: {
  label: string; waarde: string; palette: Palette; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[modalStyles.veldRij, { borderColor: p.border, backgroundColor: p.surfaceAlt }]}
    >
      <Text style={[modalStyles.veldLabel, { color: p.textSecondary }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={[modalStyles.veldWaarde, { color: p.text }]}>{waarde}</Text>
        <Ionicons name="chevron-forward" size={14} color={p.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCel({ label, waarde, kleur, palette }: {
  label: string; waarde: number; kleur: string; palette: Palette;
}) {
  return (
    <View style={styles.statCel}>
      <Text style={[styles.statGetal, { color: kleur }]}>{waarde}</Text>
      <Text style={[styles.statLabel, { color: palette.textMuted }]}>{label}</Text>
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, padding: Spacing.xxl },
  foutTekst: { fontSize: 13, fontFamily: F, textAlign: 'center' },

  content: { padding: Spacing.lg, paddingBottom: 36, gap: Spacing.md },

  // Zoeken
  zoekBalk: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 0.5, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 9,
  },
  zoekVeld: { flex: 1, fontSize: 13, padding: 0, fontFamily: F },

  // Nieuwe taak
  nieuweTaakBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: Radius.sm, paddingVertical: 11,
  },
  nieuweTaakTxt: { color: '#fff', fontSize: 13.5, fontWeight: '700', fontFamily: F },

  // Kaarten
  card:        { borderRadius: Radius.lg, padding: Spacing.lg },
  sectionCard: { borderRadius: Radius.lg, overflow: 'hidden' },

  label:        { fontSize: 9.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: F },
  divider:      { height: 0.5, marginVertical: Spacing.md },
  vDivider:     { width: 0.5, alignSelf: 'stretch' },

  // Voortgang
  voortgangKop:  { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 },
  voortgangPct:  { fontSize: 26, fontWeight: '700', letterSpacing: -0.6, lineHeight: 30, marginTop: 2, fontFamily: F },
  voortgangMeta: { fontSize: 11.5, marginBottom: 3, fontFamily: F },
  balkTrack:     { height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  balkFill:      { height: '100%', borderRadius: Radius.pill },

  statRij:   { flexDirection: 'row' },
  statCel:   { flex: 1, alignItems: 'center', gap: 3 },
  statGetal: { fontSize: 17, fontWeight: '600', fontFamily: F },
  statLabel: { fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '500', textAlign: 'center', fontFamily: F },

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

  // Filterchips
  chipsRij: { flexDirection: 'row', gap: 6, paddingVertical: 1, paddingRight: Spacing.lg },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 0.5, borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  chipTxt: { fontSize: 11.5, fontWeight: '600', fontFamily: F },

  // Groep
  groep: { gap: 7 },
  sectieHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: Spacing.sm, paddingHorizontal: 3,
  },
  sectieTitel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, fontFamily: F },
  sectieMeta:  { fontSize: 10, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: F },

  // Taakrij
  taakRij: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.md + 2, paddingVertical: 11,
  },
  check: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  taakBody:     { flex: 1, minWidth: 0, gap: 3 },
  taakTitelRij: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taakTitel:    { fontSize: 13, fontWeight: '600', flexShrink: 1, fontFamily: F },
  taakGedaan:   { textDecorationLine: 'line-through' },
  metaRij:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bezigStip:    { width: 5, height: 5, borderRadius: 3 },
  taakMeta:     { fontSize: 11, flexShrink: 1, fontFamily: F },
  prioBadge:    { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0 },
  prioBadgeTxt: { fontSize: 9.5, fontWeight: '600', fontFamily: F },

  // Lege staat
  leegKaart:  { borderRadius: Radius.lg, alignItems: 'center', gap: 6, paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.lg },
  leegTitel:  { fontSize: 14, fontWeight: '600', marginTop: 2, fontFamily: F },
  leegTxt:    { fontSize: 12, textAlign: 'center', fontFamily: F },
  resetKnop:  { marginTop: 8, borderWidth: 0.5, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  resetTxt:   { fontSize: 12, fontWeight: '600', fontFamily: F },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1 },
  hdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg + 2, paddingVertical: Spacing.md + 2, paddingTop: Spacing.lg + 2,
    borderBottomWidth: 0.5,
  },
  title: { fontSize: 16, fontWeight: '700', fontFamily: F },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.lg + 2, gap: Spacing.md },

  input: { borderWidth: 0.5, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: 13.5, fontFamily: F },
  textArea: { minHeight: 70, textAlignVertical: 'top' },

  veldRij: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 0.5, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12,
  },
  veldLabel: { fontSize: 12.5, fontWeight: '600', fontFamily: F },
  veldWaarde: { fontSize: 13, fontFamily: F },

  chipRow: { flexDirection: 'row', gap: Spacing.sm },
  prioChip: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: Radius.sm, borderWidth: 1 },
  prioChipTxt: { fontSize: 12.5, fontWeight: '600', fontFamily: F },

  sectionLabel: { fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: Spacing.sm, fontFamily: F },
  staffCard: { borderWidth: 0.5, borderRadius: Radius.md, overflow: 'hidden' },
  staffRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 11 },
  staffNaam: { fontSize: 13, fontWeight: '500', fontFamily: F },
  emptyHint: { fontSize: 12.5, fontStyle: 'italic', padding: Spacing.md, fontFamily: F },

  footer: { flexDirection: 'row', gap: Spacing.sm + 2, padding: Spacing.lg + 2, borderTopWidth: 0.5 },
  cancelBtn: { flex: 1, borderWidth: 0.5, borderRadius: Radius.md, paddingVertical: Spacing.md + 2, alignItems: 'center', justifyContent: 'center' },
  cancelTxt: { fontSize: 13.5, fontWeight: '600', fontFamily: F },
  submitBtn: { flex: 2, borderRadius: Radius.md, paddingVertical: Spacing.md + 2, alignItems: 'center', justifyContent: 'center' },
  submitTxt: { color: '#fff', fontSize: 13.5, fontWeight: '600', fontFamily: F },
});

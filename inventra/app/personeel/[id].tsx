import { ThemedView } from '@/components/themed-view';
import { FontFamily, getPalette, Radius, Shadow, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { departementen } from '@/data/store-map';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  ALLE_RANGEN,
  Afdeling,
  ApiProfile,
  Rank,
  createTask,
  generateRegisterCode,
  getAccount,
  updateStaffMember,
} from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
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

type WijzigbareStatus = 'actief' | 'inactief' | 'geblokkeerd';

const STATUSSEN: { id: WijzigbareStatus; label: string }[] = [
  { id: 'actief', label: 'Actief' },
  { id: 'inactief', label: 'Inactief' },
  { id: 'geblokkeerd', label: 'Geblokkeerd' },
];

/** Native keuzemenu — iOS: echte ActionSheet, Android: systeem-dialoogvenster. */
function toonNativeKeuze(
  titel: string,
  opties: { id: string; label: string }[],
  onKies: (id: string) => void
) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: titel,
        options: [...opties.map((o) => o.label), 'Annuleren'],
        cancelButtonIndex: opties.length,
      },
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

export default function PersoneelBeheerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);
  const { token } = useAuth();

  const targetId = Number(id);

  const [profiel, setProfiel] = useState<ApiProfile | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  const [rangModal, setRangModal] = useState(false);
  const [bezig, setBezig] = useState(false);

  const [codeBezig, setCodeBezig] = useState(false);

  const [taakForm, setTaakForm] = useState(false);
  const [taakTitel, setTaakTitel] = useState('');
  const [taakBeschrijving, setTaakBeschrijving] = useState('');
  const [taakOpslaan, setTaakOpslaan] = useState(false);

  const laadProfiel = useCallback(async () => {
    if (!token || !Number.isFinite(targetId)) return;
    setLaden(true);
    setFout(null);
    try {
      const { user } = await getAccount(token, targetId);
      setProfiel(user);
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Profiel laden is mislukt.');
    } finally {
      setLaden(false);
    }
  }, [token, targetId]);

  useEffect(() => {
    laadProfiel();
  }, [laadProfiel]);

  async function wijzigVeld(data: { rank?: Rank; department?: Afdeling; status?: WijzigbareStatus }) {
    if (!token) return;
    setBezig(true);
    try {
      await updateStaffMember(token, targetId, data);
      await laadProfiel();
    } catch (e) {
      Alert.alert('Mislukt', e instanceof Error ? e.message : 'Bijwerken is mislukt.');
    } finally {
      setBezig(false);
    }
  }

  async function genereerKassacode() {
    if (!token) return;
    setCodeBezig(true);
    try {
      const { code } = await generateRegisterCode(token, targetId);
      Alert.alert(
        'Kassacode gegenereerd',
        `Code: ${code}\n\nGeef deze code door aan de medewerker — hij/zij vult hiermee bij de eerste keer inloggen op het kassasysteem zelf een wachtwoord in.`
      );
    } catch (e) {
      Alert.alert('Mislukt', e instanceof Error ? e.message : 'Genereren is mislukt.');
    } finally {
      setCodeBezig(false);
    }
  }

  async function maakTaakAan() {
    if (!token || !profiel) return;
    const titel = taakTitel.trim();
    if (!titel) return;
    setTaakOpslaan(true);
    try {
      await createTask(token, {
        title: titel,
        description: taakBeschrijving.trim() || undefined,
        department: profiel.afdeling as Afdeling,
        assignedToId: targetId,
      });
      setTaakTitel('');
      setTaakBeschrijving('');
      setTaakForm(false);
      Alert.alert('Taak aangemaakt', `Toegewezen aan ${profiel.naam}.`);
    } catch (e) {
      Alert.alert('Mislukt', e instanceof Error ? e.message : 'Aanmaken is mislukt.');
    } finally {
      setTaakOpslaan(false);
    }
  }

  if (laden) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator color={p.accent} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (fout || !profiel) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
        <SafeAreaView style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={p.textMuted} />
          <Text style={[styles.foutTekst, { color: p.text }]}>{fout ?? 'Profiel niet gevonden'}</Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: p.accent }]}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryButtonText}>Terug</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const afdelingInfo = departementen.find((d) => d.id === profiel.afdeling);

  return (
    <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: p.border }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.iconBtn, { backgroundColor: p.surface, borderColor: p.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={p.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: p.text }]} numberOfLines={1}>
            Beheer personeel
          </Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xxl }}
        >
          {/* HERO */}
          <View style={styles.hero}>
            {profiel.profielfoto ? (
              <Image source={{ uri: profiel.profielfoto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={[styles.avatarInitialen, { color: p.accent }]}>{profiel.initialen}</Text>
              </View>
            )}
            <Text style={[styles.naam, { color: p.text }]}>{profiel.naam}</Text>
            <Text style={[styles.subTekst, { color: p.textMuted }]}>{profiel.email}</Text>
          </View>

          {/* RANG / AFDELING / STATUS */}
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Rang, afdeling & status</Text>
            <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
              <FieldRow icon="ribbon-outline" label="Rang" value={profiel.rol} onPress={() => setRangModal(true)} p={p} disabled={bezig} />
              <FieldRow
                icon="business-outline"
                label="Afdeling"
                value={afdelingInfo ? `${afdelingInfo.icon} ${afdelingInfo.label}` : profiel.afdeling}
                onPress={() =>
                  toonNativeKeuze(
                    'Afdeling',
                    departementen.map((d) => ({ id: d.id, label: `${d.icon} ${d.label}` })),
                    (afdeling) => wijzigVeld({ department: afdeling as Afdeling })
                  )
                }
                p={p}
                disabled={bezig}
              />
              <FieldRow
                icon="shield-checkmark-outline"
                label="Status"
                value={profiel.status ? STATUSSEN.find((s) => s.id === profiel.status)?.label ?? profiel.status : '—'}
                onPress={() =>
                  toonNativeKeuze(
                    'Status',
                    STATUSSEN.map((s) => ({ id: s.id, label: s.label })),
                    (status) => wijzigVeld({ status: status as WijzigbareStatus })
                  )
                }
                last
                p={p}
                disabled={bezig}
              />
            </View>
          </View>

          {/* KASSACODE */}
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Kassacode</Text>
            <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
              <Text style={[styles.uitleg, { color: p.textSecondary }]}>
                Genereert een 6-cijferige code. Het wachtwoord blijft leeg totdat de medewerker
                daarmee voor het eerst inlogt op het kassasysteem.
              </Text>
              <TouchableOpacity
                style={[styles.actieKnop, { backgroundColor: p.accentSoft, opacity: codeBezig ? 0.6 : 1 }]}
                onPress={genereerKassacode}
                disabled={codeBezig}
              >
                {codeBezig ? (
                  <ActivityIndicator size="small" color={p.accent} />
                ) : (
                  <>
                    <Ionicons name="key-outline" size={16} color={p.accent} />
                    <Text style={[styles.actieKnopTxt, { color: p.accent }]}>Kassacode genereren</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* TAAK TOEWIJZEN */}
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Taak toewijzen</Text>
            <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
              {!taakForm ? (
                <TouchableOpacity
                  style={[styles.actieKnop, { backgroundColor: p.accentSoft }]}
                  onPress={() => setTaakForm(true)}
                >
                  <Ionicons name="add-circle-outline" size={16} color={p.accent} />
                  <Text style={[styles.actieKnopTxt, { color: p.accent }]}>Nieuwe taak aanmaken</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ gap: Spacing.sm }}>
                  <TextInput
                    value={taakTitel}
                    onChangeText={setTaakTitel}
                    placeholder="Titel"
                    placeholderTextColor={p.textMuted}
                    style={[styles.input, { color: p.text, borderColor: p.border }]}
                  />
                  <TextInput
                    value={taakBeschrijving}
                    onChangeText={setTaakBeschrijving}
                    placeholder="Omschrijving (optioneel)"
                    placeholderTextColor={p.textMuted}
                    style={[styles.input, styles.inputMultiline, { color: p.text, borderColor: p.border }]}
                    multiline
                  />
                  <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                    <TouchableOpacity
                      style={[styles.secondaryKnop, { borderColor: p.border }]}
                      onPress={() => {
                        setTaakForm(false);
                        setTaakTitel('');
                        setTaakBeschrijving('');
                      }}
                    >
                      <Text style={[styles.secondaryKnopTxt, { color: p.text }]}>Annuleren</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.primaryKnop,
                        { backgroundColor: p.accent, opacity: taakOpslaan || !taakTitel.trim() ? 0.6 : 1 },
                      ]}
                      onPress={maakTaakAan}
                      disabled={taakOpslaan || !taakTitel.trim()}
                    >
                      {taakOpslaan ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.primaryKnopTxt}>Aanmaken</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* PERMISSIES */}
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Permissies</Text>
            <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
              <TouchableOpacity
                style={[styles.fieldRow, { borderBottomWidth: 0 }]}
                onPress={() => router.push(`/personeel/${targetId}/permissies` as never)}
              >
                <View style={[styles.fieldIconWrap, { backgroundColor: p.surfaceAlt }]}>
                  <Ionicons name="key-outline" size={15} color={p.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldValue, { color: p.text }]}>Permissies beheren</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={p.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <KeuzeModal
        zichtbaar={rangModal}
        titel="Rang"
        opties={ALLE_RANGEN.map((r) => ({ id: r, label: r }))}
        huidig={profiel.rol}
        onKies={(rang) => {
          setRangModal(false);
          wijzigVeld({ rank: rang as Rank });
        }}
        onSluit={() => setRangModal(false)}
        p={p}
      />
    </ThemedView>
  );
}

function FieldRow({
  icon, label, value, onPress, last, p, disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  onPress: () => void;
  last?: boolean;
  p: Palette;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.fieldRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.divider },
      ]}
    >
      <View style={[styles.fieldIconWrap, { backgroundColor: p.surfaceAlt }]}>
        <Ionicons name={icon} size={15} color={p.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.fieldLabel, { color: p.textMuted }]}>{label}</Text>
        <Text style={[styles.fieldValue, { color: p.text }]}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={p.textMuted} />
    </TouchableOpacity>
  );
}

function KeuzeModal({
  zichtbaar, titel, opties, huidig, onKies, onSluit, p,
}: {
  zichtbaar: boolean;
  titel: string;
  opties: { id: string; label: string }[];
  huidig: string;
  onKies: (id: string) => void;
  onSluit: () => void;
  p: Palette;
}) {
  return (
    <Modal visible={zichtbaar} transparent animationType="slide" onRequestClose={onSluit}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onSluit}>
        <TouchableOpacity activeOpacity={1} style={[styles.modalKaart, { backgroundColor: p.surface }]}>
          <View style={[styles.modalGripBalkje, { backgroundColor: p.border }]} />
          <Text style={[styles.modalTitel, { color: p.textMuted }]}>{titel.toUpperCase()}</Text>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <View style={[styles.modalLijst, { backgroundColor: p.surfaceAlt, borderColor: p.border }]}>
              {opties.map((opt, idx) => {
                const actief = opt.id === huidig;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.modalOptie,
                      idx < opties.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.divider },
                    ]}
                    onPress={() => onKies(opt.id)}
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.modalOptieTxt, { color: p.text }]}>{opt.label}</Text>
                    {actief && <Ionicons name="checkmark" size={19} color={p.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          <TouchableOpacity style={[styles.modalAnnuleren, { backgroundColor: p.surfaceAlt }]} onPress={onSluit}>
            <Text style={[styles.modalAnnulerenTxt, { color: p.accent }]}>Annuleren</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, gap: Spacing.md },
  foutTekst: { fontSize: 14, fontWeight: '600', fontFamily: F, textAlign: 'center' },

  header: {
    height: 52,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBtn: {
    width: 32, height: 32, borderRadius: Radius.sm,
    justifyContent: 'center', alignItems: 'center', borderWidth: 0.5,
  },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: '700', fontFamily: F },

  hero: { alignItems: 'center', marginBottom: Spacing.xl, marginTop: Spacing.sm },
  avatar: { width: 76, height: 76, borderRadius: 38 },
  avatarInitialen: { fontSize: 22, fontWeight: '700', fontFamily: F },
  naam: { marginTop: Spacing.md, fontSize: 17, fontWeight: '700', fontFamily: F },
  subTekst: { marginTop: 2, fontSize: 12.5, fontFamily: F },

  sectionWrap: { marginBottom: Spacing.xl },
  sectionLabel: {
    fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: Spacing.sm, paddingHorizontal: 2, fontFamily: F,
  },
  card: { borderRadius: Radius.lg, borderWidth: 0.5, overflow: 'hidden', padding: 0 },

  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  fieldIconWrap: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: F },
  fieldValue: { fontSize: 14, fontWeight: '600', marginTop: 1, fontFamily: F },

  uitleg: { fontSize: 12, lineHeight: 17, fontFamily: F, padding: Spacing.md, paddingBottom: 0 },
  actieKnop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    margin: Spacing.md, paddingVertical: 11, borderRadius: Radius.md,
  },
  actieKnopTxt: { fontSize: 13, fontWeight: '700', fontFamily: F },

  input: {
    borderWidth: 0.5, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: 13.5, fontFamily: F, margin: Spacing.md, marginBottom: 0,
  },
  inputMultiline: { minHeight: 60, textAlignVertical: 'top' },

  secondaryKnop: {
    flex: 1, borderWidth: 1, borderRadius: Radius.md, height: 44,
    justifyContent: 'center', alignItems: 'center', marginHorizontal: Spacing.md, marginBottom: Spacing.md,
  },
  secondaryKnopTxt: { fontWeight: '600', fontSize: 13, fontFamily: F },
  primaryKnop: {
    flex: 1, height: 44, borderRadius: Radius.md,
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md, marginBottom: Spacing.md,
  },
  primaryKnopTxt: { color: '#fff', fontWeight: '600', fontSize: 13, fontFamily: F },

  primaryButton: { borderRadius: Radius.md, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 13.5, fontFamily: F },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalKaart: {
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.sm, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.lg,
  },
  modalGripBalkje: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: Spacing.md },
  modalTitel: {
    fontSize: 11, fontWeight: '600', fontFamily: F, textAlign: 'center',
    letterSpacing: 0.8, marginBottom: Spacing.sm,
  },
  modalLijst: { borderRadius: Radius.lg, borderWidth: 0.5, overflow: 'hidden' },
  modalOptie: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
  },
  modalOptieTxt: { fontSize: 15.5, fontFamily: F },
  modalAnnuleren: {
    marginTop: Spacing.md, borderRadius: Radius.lg,
    paddingVertical: 14, alignItems: 'center',
  },
  modalAnnulerenTxt: { fontSize: 15.5, fontWeight: '600', fontFamily: F },
});

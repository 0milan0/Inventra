import { ThemedView } from '@/components/themed-view';
import { FontFamily, getPalette, Radius, Shadow, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { magPersoneelAanmaken } from '@/data/session';
import { departementen, type Department } from '@/data/store-map';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ALLE_RANGEN, createStaffAccount, type Afdeling, type Rank } from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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

const formatDate = (date: Date): string => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}-${m}-${date.getFullYear()}`;
};

const parseDate = (value?: string | null): Date => {
  if (!value) return new Date(2000, 0, 1);
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return new Date(2000, 0, 1);
  return new Date(y, m - 1, d);
};

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

export default function PersoneelNieuwScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);
  const { user, token } = useAuth();
  const magAanmaken = magPersoneelAanmaken(user);

  const [voornaam, setVoornaam] = useState('');
  const [tussenvoegsel, setTussenvoegsel] = useState('');
  const [achternaam, setAchternaam] = useState('');
  const [email, setEmail] = useState('');
  const [telefoonnummer, setTelefoonnummer] = useState('');
  const [geboortedatum, setGeboortedatum] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [rang, setRang] = useState<Rank | null>(null);
  const [afdeling, setAfdeling] = useState<Department | null>(null);
  const [rangModal, setRangModal] = useState(false);
  const [opslaanBezig, setOpslaanBezig] = useState(false);

  const afdelingInfo = afdeling ? departementen.find((d) => d.id === afdeling) : null;

  const kanOpslaan =
    voornaam.trim() !== '' &&
    achternaam.trim() !== '' &&
    email.trim() !== '' &&
    telefoonnummer.trim() !== '' &&
    rang !== null &&
    afdeling !== null;

  const handleOpslaan = async () => {
    if (!token || !kanOpslaan || rang === null || afdeling === null) return;

    setOpslaanBezig(true);
    try {
      const { activatieCode } = await createStaffAccount(token, {
        voornaam: voornaam.trim(),
        tussenvoegsel: tussenvoegsel.trim() || undefined,
        achternaam: achternaam.trim(),
        email: email.trim(),
        telefoonnummer: telefoonnummer.trim(),
        geboortedatum: geboortedatum || undefined,
        rank: rang,
        department: afdeling as Afdeling,
      });
      Alert.alert(
        'Medewerker uitgenodigd',
        `Activatiecode: ${activatieCode}\n\nGeef deze code samen met het e-mailadres door aan ${voornaam.trim()} — hij/zij gebruikt ze op het inlogscherm ("Account activeren") om zelf een wachtwoord in te stellen.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert('Aanmaken mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
    } finally {
      setOpslaanBezig(false);
    }
  };

  if (!magAanmaken) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
        <SafeAreaView style={styles.center}>
          <Ionicons name="lock-closed-outline" size={40} color={p.textMuted} />
          <Text style={[styles.foutTekst, { color: p.text }]}>Geen toegang</Text>
          <Text style={[styles.foutSub, { color: p.textSecondary }]}>
            Alleen een filiaalmanager (of medewerkers met deze permissie) kunnen nieuwe medewerkers uitnodigen.
          </Text>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: p.accent }]} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Terug</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={[styles.header, { borderBottomColor: p.border }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.iconBtn, { backgroundColor: p.surface, borderColor: p.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={p.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: p.text }]} numberOfLines={1}>
            Medewerker uitnodigen
          </Text>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xxl }}
          >
            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Gegevens</Text>
              <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                <TextInput
                  value={voornaam}
                  onChangeText={setVoornaam}
                  placeholder="Voornaam"
                  placeholderTextColor={p.textMuted}
                  style={[styles.input, { color: p.text, borderColor: p.border }]}
                />
                <TextInput
                  value={tussenvoegsel}
                  onChangeText={setTussenvoegsel}
                  placeholder="Tussenvoegsel (optioneel)"
                  placeholderTextColor={p.textMuted}
                  style={[styles.input, { color: p.text, borderColor: p.border }]}
                />
                <TextInput
                  value={achternaam}
                  onChangeText={setAchternaam}
                  placeholder="Achternaam"
                  placeholderTextColor={p.textMuted}
                  style={[styles.input, { color: p.text, borderColor: p.border }]}
                />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="E-mailadres"
                  placeholderTextColor={p.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.input, { color: p.text, borderColor: p.border }]}
                />
                <TextInput
                  value={telefoonnummer}
                  onChangeText={setTelefoonnummer}
                  placeholder="Telefoonnummer"
                  placeholderTextColor={p.textMuted}
                  keyboardType="phone-pad"
                  style={[styles.input, styles.inputLast, { color: p.text, borderColor: p.border }]}
                />

                <View style={[styles.dateRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.divider }]}>
                  <TouchableOpacity
                    style={styles.fieldRow}
                    onPress={() => setShowDatePicker((v) => !v)}
                  >
                    <View style={[styles.fieldIconWrap, { backgroundColor: p.surfaceAlt }]}>
                      <Ionicons name="calendar-outline" size={15} color={p.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: p.textMuted }]}>Geboortedatum (optioneel)</Text>
                      <Text style={[styles.fieldValue, { color: p.text }]}>
                        {geboortedatum ? formatDate(parseDate(geboortedatum)) : 'Instellen'}
                      </Text>
                    </View>
                    <Ionicons name={showDatePicker ? 'chevron-up' : 'chevron-down'} size={16} color={p.textMuted} />
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={parseDate(geboortedatum)}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                      maximumDate={new Date()}
                      onChange={(_, date) => {
                        if (!date) return;
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, '0');
                        const d = String(date.getDate()).padStart(2, '0');
                        setGeboortedatum(`${y}-${m}-${d}`);
                      }}
                    />
                  )}
                </View>
              </View>
            </View>

            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Rang & afdeling</Text>
              <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                <FieldRow icon="ribbon-outline" label="Rang" value={rang ?? 'Kies rang'} onPress={() => setRangModal(true)} p={p} />
                <FieldRow
                  icon="business-outline"
                  label="Afdeling"
                  value={afdelingInfo ? `${afdelingInfo.icon} ${afdelingInfo.label}` : 'Kies afdeling'}
                  onPress={() =>
                    toonNativeKeuze(
                      'Afdeling',
                      departementen.map((d) => ({ id: d.id, label: `${d.icon} ${d.label}` })),
                      (id) => setAfdeling(id as Department)
                    )
                  }
                  last
                  p={p}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: kanOpslaan ? p.accent : p.border, opacity: opslaanBezig ? 0.7 : 1 },
              ]}
              onPress={handleOpslaan}
              disabled={!kanOpslaan || opslaanBezig}
            >
              {opslaanBezig ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Uitnodiging aanmaken</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <KeuzeModal
        zichtbaar={rangModal}
        titel="Rang"
        opties={ALLE_RANGEN.map((r) => ({ id: r, label: r }))}
        huidig={rang ?? ''}
        onKies={(r) => { setRangModal(false); setRang(r as Rank); }}
        onSluit={() => setRangModal(false)}
        p={p}
      />
    </ThemedView>
  );
}

function FieldRow({
  icon, label, value, onPress, last, p,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  onPress: () => void;
  last?: boolean;
  p: Palette;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
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
  foutSub: { fontSize: 12, fontFamily: F, textAlign: 'center', lineHeight: 17 },

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

  input: {
    borderWidth: 0.5, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: 13.5, fontFamily: F, margin: Spacing.md, marginBottom: 0,
  },
  inputLast: { marginBottom: Spacing.md },
  dateRow: {},

  submitBtn: {
    borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, fontFamily: F },

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

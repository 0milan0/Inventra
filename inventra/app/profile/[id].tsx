import { ThemedView } from '@/components/themed-view';
import { FontFamily, getPalette, Radius, Shadow, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import {
  AutoLockDelay,
  StartScreen,
  ThemePreference,
  useSettings,
} from '@/contexts/settings-context';
import { filiaalVoorBranch, getAfdelingLabel, magPersoneelBeheren } from '@/data/session';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ApiProfile, getAccount, updateProfile, updateStaffProfile, uploadProfilePhoto } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const F = FontFamily;
type Palette = ReturnType<typeof getPalette>;
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

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

interface FormState {
  voornaam: string;
  tussenvoegsel: string;
  achternaam: string;
  telefoonnummer: string;
  geboortedatum: string;
  emergencyTelefoon: string;
  emergencyEmail: string;
}

const THEME_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: 'system', label: 'Systeem' },
  { id: 'light', label: 'Licht' },
  { id: 'dark', label: 'Donker' },
];

const AUTOLOCK_OPTIONS: { id: AutoLockDelay; label: string }[] = [
  { id: 'direct', label: 'Direct' },
  { id: '1min', label: 'Na 1 min' },
  { id: '5min', label: 'Na 5 min' },
];

const START_SCHERM_OPTIONS: { id: StartScreen; label: string }[] = [
  { id: 'index', label: 'Dashboard' },
  { id: 'products', label: 'Scanner' },
  { id: 'taken', label: 'Taken' },
];

function naarFormState(p: ApiProfile): FormState {
  return {
    voornaam: p.voornaam ?? '',
    tussenvoegsel: p.tussenvoegsel ?? '',
    achternaam: p.achternaam ?? '',
    telefoonnummer: p.telefoonnummer ?? '',
    geboortedatum: p.geboortedatum ?? '',
    emergencyTelefoon: p.emergencyTelefoon ?? '',
    emergencyEmail: p.emergencyEmail ?? '',
  };
}

// ─── Field row ────────────────────────────────────────────────────────────────

function FieldRow({
  icon, label, value, onChangeText, editable, placeholder, keyboardType, last, p,
}: {
  icon: IoniconName;
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  editable?: boolean;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  last?: boolean;
  p: Palette;
}) {
  return (
    <View
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
        {editable ? (
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={p.textMuted}
            style={[styles.fieldInput, { color: p.text }]}
            keyboardType={keyboardType}
            autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
          />
        ) : (
          <Text style={[styles.fieldValue, { color: p.text }]}>{value || '—'}</Text>
        )}
      </View>
    </View>
  );
}

// ─── Switch row (aan/uit-instellingen) ─────────────────────────────────────────

function SwitchRow({
  icon, label, description, value, onValueChange, disabled, first, p,
}: {
  icon: IoniconName;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  first?: boolean;
  p: Palette;
}) {
  return (
    <View
      style={[
        styles.fieldRow,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.divider },
      ]}
    >
      <View style={[styles.fieldIconWrap, { backgroundColor: p.surfaceAlt }]}>
        <Ionicons name={icon} size={15} color={p.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.fieldValue, { color: p.text }]}>{label}</Text>
        {!!description && (
          <Text style={[styles.settingDescription, { color: p.textMuted }]}>{description}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: p.border, true: p.accent }}
        thumbColor="#fff"
      />
    </View>
  );
}

// ─── Choice row (3-keuze instellingen) ─────────────────────────────────────────

function ChoiceRow<T extends string>({
  icon, label, options, value, onChange, first, p,
}: {
  icon: IoniconName;
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  first?: boolean;
  p: Palette;
}) {
  return (
    <View
      style={[
        styles.choiceRow,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.divider },
      ]}
    >
      <View style={styles.choiceHeader}>
        <View style={[styles.fieldIconWrap, { backgroundColor: p.surfaceAlt }]}>
          <Ionicons name={icon} size={15} color={p.textSecondary} />
        </View>
        <Text style={[styles.fieldValue, { color: p.text }]}>{label}</Text>
      </View>
      <View style={styles.choiceChips}>
        {options.map((opt) => {
          const actief = opt.id === value;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => onChange(opt.id)}
              style={[
                styles.choiceChip,
                { borderColor: actief ? p.accent : p.border, backgroundColor: actief ? p.accentSoft : 'transparent' },
              ]}
            >
              <Text style={[styles.choiceChipText, { color: actief ? p.accent : p.textSecondary }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfielScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, token, branches, refresh, biometricEnabled, setBiometricEnabled } = useAuth();
  const {
    themePreference, setThemePreference,
    hapticsEnabled, setHapticsEnabled,
    autoLockDelay, setAutoLockDelay,
    startScreen, setStartScreen,
  } = useSettings();

  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);

  const targetId = Number(id);
  const isEigen = user !== null && String(targetId) === user.id;

  const [profiel, setProfiel] = useState<ApiProfile | null>(null);
  const [laden, setLaden] = useState(true);
  const [foutmelding, setFoutmelding] = useState<string | null>(null);

  const [bewerken, setBewerken] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [opslaan, setOpslaan] = useState(false);
  const [fotoBezig, setFotoBezig] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [biometricBezig, setBiometricBezig] = useState(false);

  async function wijzigBiometrie(waarde: boolean) {
    if (waarde) {
      const [heeftHardware, heeftEnrollment] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (!heeftHardware || !heeftEnrollment) {
        Alert.alert(
          'Niet beschikbaar',
          'Er is geen Face ID/vingerafdruk ingesteld op dit toestel. Stel dit eerst in via de systeeminstellingen.'
        );
        return;
      }
    }
    setBiometricBezig(true);
    try {
      await setBiometricEnabled(waarde);
    } finally {
      setBiometricBezig(false);
    }
  }

  function wachtwoordWijzigen() {
    Alert.alert(
      'Binnenkort beschikbaar',
      'Wachtwoord wijzigen vanuit de app kan nog niet. Neem contact op met je beheerder.'
    );
  }

  const laadProfiel = useCallback(async () => {
    if (!token || !Number.isFinite(targetId)) return;
    setLaden(true);
    setFoutmelding(null);
    try {
      const { user: opgehaald } = await getAccount(token, targetId);
      setProfiel(opgehaald);
    } catch (e) {
      setFoutmelding(e instanceof Error ? e.message : 'Profiel laden is mislukt.');
    } finally {
      setLaden(false);
    }
  }, [token, targetId]);

  useEffect(() => {
    laadProfiel();
  }, [laadProfiel]);

  function startBewerken() {
    if (!profiel) return;
    setForm(naarFormState(profiel));
    setBewerken(true);
  }

  function annuleerBewerken() {
    setBewerken(false);
    setShowDatePicker(false);
    setForm(null);
  }

  async function opslaanProfiel() {
    if (!token || !form) return;
    if (!form.voornaam.trim() || !form.achternaam.trim()) {
      Alert.alert('Ontbrekende gegevens', 'Voornaam en achternaam zijn verplicht.');
      return;
    }
    setOpslaan(true);
    try {
      const { user: bijgewerkt } = isEigen
        ? await updateProfile(token, {
            voornaam: form.voornaam.trim(),
            tussenvoegsel: form.tussenvoegsel.trim() || null,
            achternaam: form.achternaam.trim(),
            telefoonnummer: form.telefoonnummer.trim() || null,
            geboortedatum: form.geboortedatum || null,
            emergencyTelefoon: form.emergencyTelefoon.trim() || null,
            emergencyEmail: form.emergencyEmail.trim() || null,
          })
        : await updateStaffProfile(token, {
            accountId: targetId,
            voornaam: form.voornaam.trim(),
            tussenvoegsel: form.tussenvoegsel.trim() || null,
            achternaam: form.achternaam.trim(),
            telefoonnummer: form.telefoonnummer.trim() || null,
            geboortedatum: form.geboortedatum || null,
          });
      setProfiel(bijgewerkt);
      setBewerken(false);
      setShowDatePicker(false);
      await refresh().catch(() => {});
    } catch (e) {
      Alert.alert('Opslaan mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
    } finally {
      setOpslaan(false);
    }
  }

  async function wijzigFoto() {
    if (!token) return;
    const permissie = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissie.granted) {
      Alert.alert('Geen toegang', "Geef Inventra toegang tot je foto's om een profielfoto in te stellen.");
      return;
    }
    const resultaat = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (resultaat.canceled) return;

    setFotoBezig(true);
    try {
      const { profielfoto } = await uploadProfilePhoto(token, resultaat.assets[0].uri);
      setProfiel((prev) => (prev ? { ...prev, profielfoto } : prev));
      await refresh().catch(() => {});
    } catch (e) {
      Alert.alert('Uploaden mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
    } finally {
      setFotoBezig(false);
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

  if (foutmelding || !profiel) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
        <SafeAreaView style={styles.center}>
          <Ionicons name="alert-circle-outline" size={56} color={p.textMuted} />
          <Text style={[styles.notFoundText, { color: p.text }]}>
            {foutmelding ?? 'Profiel niet gevonden'}
          </Text>
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

  const weergaveNaam = bewerken && form
    ? [form.voornaam, form.tussenvoegsel, form.achternaam].filter(Boolean).join(' ')
    : profiel.naam;

  const filiaal = filiaalVoorBranch(profiel.branchId, branches);
  const magBeheren = !isEigen && magPersoneelBeheren(user, { branchId: profiel.branchId, afdelingId: profiel.afdeling });
  const magBewerken = isEigen || magBeheren;

  return (
    <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={[styles.header, { borderBottomColor: p.border }]}>
          <TouchableOpacity
            onPress={() => (bewerken ? annuleerBewerken() : router.back())}
            style={[styles.iconBtn, { backgroundColor: p.surface, borderColor: p.border }]}
          >
            <Ionicons name={bewerken ? 'close' : 'chevron-back'} size={20} color={p.text} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: p.text }]} numberOfLines={1}>
            {bewerken ? 'Profiel bewerken' : 'Profiel'}
          </Text>

          {magBewerken && !bewerken ? (
            <TouchableOpacity
              onPress={startBewerken}
              style={[styles.iconBtn, { backgroundColor: p.surface, borderColor: p.border }]}
            >
              <Ionicons name="create-outline" size={18} color={p.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconBtn} />
          )}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: bewerken ? 100 + insets.bottom : Spacing.xxl }}
        >
          {/* HERO */}
          <View style={styles.hero}>
            <TouchableOpacity
              onPress={isEigen ? wijzigFoto : undefined}
              activeOpacity={isEigen ? 0.75 : 1}
              disabled={!isEigen || fotoBezig}
              style={styles.avatarWrap}
            >
              {profiel.profielfoto ? (
                <Image source={{ uri: profiel.profielfoto }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={[styles.avatarInitialen, { color: p.accent }]}>{profiel.initialen}</Text>
                </View>
              )}

              {isEigen && (
                <View style={[styles.avatarBadge, { backgroundColor: p.accent, borderColor: p.bg }]}>
                  {fotoBezig ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="camera" size={13} color="#fff" />
                  )}
                </View>
              )}
            </TouchableOpacity>

            <Text style={[styles.naam, { color: p.text }]}>{weergaveNaam || '—'}</Text>

            <View style={styles.chipRow}>
              {!!profiel.rol && (
                <View style={[styles.chip, { backgroundColor: p.accentSoft }]}>
                  <Text style={[styles.chipText, { color: p.accent }]}>{profiel.rol}</Text>
                </View>
              )}
              {!!profiel.afdeling && (
                <View style={[styles.chip, { backgroundColor: p.surfaceAlt }]}>
                  <Text style={[styles.chipText, { color: p.textSecondary }]}>{getAfdelingLabel(profiel.afdeling)}</Text>
                </View>
              )}
            </View>

            <Text style={[styles.filiaalText, { color: p.textMuted }]}>{filiaal.naam}</Text>
          </View>

          {/* NAAM (alleen tijdens bewerken) */}
          {bewerken && form && (
            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Naam</Text>
              <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                <FieldRow icon="person-outline" label="Voornaam" value={form.voornaam} editable
                  onChangeText={(v) => setForm({ ...form, voornaam: v })} p={p} />
                <FieldRow icon="person-outline" label="Tussenvoegsel" value={form.tussenvoegsel} editable
                  onChangeText={(v) => setForm({ ...form, tussenvoegsel: v })} p={p} />
                <FieldRow icon="person-outline" label="Achternaam" value={form.achternaam} editable
                  onChangeText={(v) => setForm({ ...form, achternaam: v })} p={p} last />
              </View>
            </View>
          )}

          {/* CONTACT */}
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Contact</Text>
            <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
              <FieldRow icon="mail-outline" label="E-mail" value={profiel.email} p={p} />
              <FieldRow
                icon="call-outline"
                label="Telefoonnummer"
                value={bewerken && form ? form.telefoonnummer : profiel.telefoonnummer ?? ''}
                editable={bewerken}
                keyboardType="phone-pad"
                placeholder="Nog niet ingesteld"
                onChangeText={(v) => form && setForm({ ...form, telefoonnummer: v })}
                p={p}
                last={!bewerken}
              />

              {bewerken && form ? (
                <View style={[styles.fieldRow, { borderTopWidth: 0 }]}>
                  <View style={[styles.fieldIconWrap, { backgroundColor: p.surfaceAlt }]}>
                    <Ionicons name="calendar-outline" size={15} color={p.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: p.textMuted }]}>Geboortedatum</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker((v) => !v)}>
                      <Text style={[styles.fieldValue, { color: p.text }]}>
                        {form.geboortedatum ? formatDate(parseDate(form.geboortedatum)) : 'Instellen'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <FieldRow
                  icon="calendar-outline"
                  label="Geboortedatum"
                  value={profiel.geboortedatum ? formatDate(parseDate(profiel.geboortedatum)) : ''}
                  p={p}
                  last
                />
              )}

              {bewerken && showDatePicker && (
                <View style={[styles.datePickerWrap, { borderTopColor: p.divider }]}>
                  <DateTimePicker
                    value={parseDate(form?.geboortedatum)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                    maximumDate={new Date()}
                    onChange={(_, date) => {
                      if (!date || !form) return;
                      const y = date.getFullYear();
                      const m = String(date.getMonth() + 1).padStart(2, '0');
                      const d = String(date.getDate()).padStart(2, '0');
                      setForm({ ...form, geboortedatum: `${y}-${m}-${d}` });
                    }}
                  />
                </View>
              )}
            </View>
          </View>

          {/* WERK */}
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Werk</Text>
            <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
              <FieldRow icon="ribbon-outline" label="Rang" value={profiel.rol} p={p} />
              <FieldRow icon="business-outline" label="Afdeling" value={getAfdelingLabel(profiel.afdeling)} p={p} />
              <FieldRow icon="storefront-outline" label="Filiaal" value={filiaal.naam} p={p} last />
            </View>
          </View>

          {/* NOODCONTACT — alleen zichtbaar op je eigen profiel */}
          {isEigen && (
            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Noodcontact</Text>
              <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                <FieldRow
                  icon="call-outline"
                  label="Telefoonnummer"
                  value={bewerken && form ? form.emergencyTelefoon : profiel.emergencyTelefoon ?? ''}
                  editable={bewerken}
                  keyboardType="phone-pad"
                  placeholder="Nog niet ingesteld"
                  onChangeText={(v) => form && setForm({ ...form, emergencyTelefoon: v })}
                  p={p}
                />
                <FieldRow
                  icon="mail-outline"
                  label="E-mailadres"
                  value={bewerken && form ? form.emergencyEmail : profiel.emergencyEmail ?? ''}
                  editable={bewerken}
                  keyboardType="email-address"
                  placeholder="Nog niet ingesteld"
                  onChangeText={(v) => form && setForm({ ...form, emergencyEmail: v })}
                  p={p}
                  last
                />
              </View>
            </View>
          )}

          {/* INSTELLINGEN — alleen zichtbaar op je eigen profiel, en niet
              tijdens het bewerken van profielvelden (instellingen slaan
              direct op, dat hoort niet bij de Opslaan/Annuleren-balk). */}
          {isEigen && !bewerken && (
            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Instellingen</Text>
              <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                <SwitchRow
                  icon="finger-print-outline"
                  label="Face ID / vingerafdruk"
                  description="Vergrendel de app en ontgrendel met biometrie."
                  value={biometricEnabled}
                  onValueChange={wijzigBiometrie}
                  disabled={biometricBezig}
                  first
                  p={p}
                />
                {biometricEnabled && (
                  <ChoiceRow
                    icon="time-outline"
                    label="Automatisch vergrendelen"
                    options={AUTOLOCK_OPTIONS}
                    value={autoLockDelay}
                    onChange={setAutoLockDelay}
                    p={p}
                  />
                )}
                <ChoiceRow
                  icon="contrast-outline"
                  label="Thema"
                  options={THEME_OPTIONS}
                  value={themePreference}
                  onChange={setThemePreference}
                  p={p}
                />
                <SwitchRow
                  icon="phone-portrait-outline"
                  label="Haptische feedback"
                  description="Voel een trilling bij het wisselen van tabblad."
                  value={hapticsEnabled}
                  onValueChange={setHapticsEnabled}
                  p={p}
                />
                <ChoiceRow
                  icon="home-outline"
                  label="Startscherm bij openen"
                  options={START_SCHERM_OPTIONS}
                  value={startScreen}
                  onChange={setStartScreen}
                  p={p}
                />
                <TouchableOpacity
                  style={[styles.fieldRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.divider }]}
                  onPress={wachtwoordWijzigen}
                >
                  <View style={[styles.fieldIconWrap, { backgroundColor: p.surfaceAlt }]}>
                    <Ionicons name="key-outline" size={15} color={p.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldValue, { color: p.text }]}>Wachtwoord wijzigen</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={p.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* STICKY OPSLAAN-BALK */}
        {bewerken && (
          <View style={[styles.bottomBar, { backgroundColor: p.bg, borderTopColor: p.border, paddingBottom: insets.bottom + Spacing.md }]}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: p.border }]}
              onPress={annuleerBewerken}
              disabled={opslaan}
            >
              <Text style={[styles.secondaryButtonText, { color: p.text }]}>Annuleren</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBottomButton, { backgroundColor: p.accent, opacity: opslaan ? 0.7 : 1 }]}
              onPress={opslaanProfiel}
              disabled={opslaan}
            >
              {opslaan ? <ActivityIndicator size="small" color="#fff" /> : (
                <Text style={styles.primaryBottomButtonText}>Opslaan</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, gap: Spacing.md },
  notFoundText: { fontSize: 14, fontWeight: '600', fontFamily: F, textAlign: 'center' },

  header: {
    height: 52,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  iconBtn: {
    width: 32, height: 32, borderRadius: Radius.sm,
    justifyContent: 'center', alignItems: 'center', borderWidth: 0.5,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', fontFamily: F },

  hero: { alignItems: 'center', marginBottom: Spacing.xl, marginTop: Spacing.sm },
  avatarWrap: { position: 'relative' },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarInitialen: { fontSize: 26, fontWeight: '700', fontFamily: F },
  avatarBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 26, height: 26, borderRadius: 13, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  naam: { marginTop: Spacing.md, fontSize: 19, fontWeight: '700', fontFamily: F },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  chip: { borderRadius: Radius.pill, paddingHorizontal: 11, paddingVertical: 5 },
  chipText: { fontSize: 11.5, fontWeight: '700', fontFamily: F },
  filiaalText: { marginTop: Spacing.xs + 2, fontSize: 12.5, fontFamily: F },

  sectionWrap: { marginBottom: Spacing.xl },
  sectionLabel: {
    fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: Spacing.sm, paddingHorizontal: 2, fontFamily: F,
  },
  card: { borderRadius: Radius.lg, borderWidth: 0.5, overflow: 'hidden' },

  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  fieldIconWrap: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: F },
  fieldValue: { fontSize: 14, fontWeight: '600', marginTop: 1, fontFamily: F },
  fieldInput: { fontSize: 14, fontWeight: '600', marginTop: 1, fontFamily: F, padding: 0 },
  settingDescription: { fontSize: 11.5, marginTop: 2, fontFamily: F, lineHeight: 15 },

  choiceRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.sm },
  choiceHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  choiceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs + 2 },
  choiceChip: { borderRadius: Radius.pill, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  choiceChipText: { fontSize: 11.5, fontWeight: '600', fontFamily: F },

  datePickerWrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.sm },

  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', gap: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  secondaryButton: {
    flex: 1, borderWidth: 1, borderRadius: Radius.md, height: 48,
    justifyContent: 'center', alignItems: 'center',
  },
  secondaryButtonText: { fontWeight: '600', fontSize: 13.5, fontFamily: F },
  primaryBottomButton: {
    flex: 1, height: 48, borderRadius: Radius.md,
    justifyContent: 'center', alignItems: 'center',
  },
  primaryBottomButtonText: { color: '#fff', fontWeight: '600', fontSize: 13.5, fontFamily: F },

  primaryButton: { borderRadius: Radius.md, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 13.5, fontFamily: F },
});

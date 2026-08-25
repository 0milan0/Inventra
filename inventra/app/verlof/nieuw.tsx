import { ThemedView } from '@/components/themed-view';
import { FontFamily, getPalette, Radius, Shadow, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { maakVerlofaanvraag, VerlofType } from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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

const TYPE_OPTIES: { id: VerlofType; label: string }[] = [
  { id: 'vakantie', label: 'Vakantie' },
  { id: 'verlof', label: 'Verlof' },
  { id: 'ziekte', label: 'Ziekte' },
  { id: 'onbetaald_verlof', label: 'Onbetaald verlof' },
  { id: 'bijzonder_verlof', label: 'Bijzonder verlof' },
];

function toonNativeKeuze(titel: string, opties: { id: string; label: string }[], onKies: (id: string) => void) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: titel, options: [...opties.map((o) => o.label), 'Annuleren'], cancelButtonIndex: opties.length },
      (index) => { if (index < opties.length) onKies(opties[index].id); }
    );
  } else {
    Alert.alert(titel, undefined, [
      ...opties.map((o) => ({ text: o.label, onPress: () => onKies(o.id) })),
      { text: 'Annuleren', style: 'cancel' as const },
    ]);
  }
}

const formatDate = (date: Date): string => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}-${m}-${date.getFullYear()}`;
};

const formatDateTime = (date: Date): string => {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(date)} ${hh}:${mm}`;
};

/** Verwacht "JJJJ-MM-DD UU:MM(:SS)" — het formaat dat leave-requests/create.php opslaat. */
const parseDateTime = (value?: string | null): Date => {
  if (!value) return new Date();
  const [datumDeel, tijdDeel] = value.split(' ');
  const [y, m, d] = (datumDeel ?? '').split('-').map(Number);
  if (!y || !m || !d) return new Date();
  const [hh, mm] = (tijdDeel ?? '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0);
};

const naarDateTimeString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:00`;
};

export default function VerlofNieuwScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);
  const { token } = useAuth();

  const [type, setType] = useState<VerlofType | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startPicker, setStartPicker] = useState(false);
  const [endPicker, setEndPicker] = useState(false);
  const [reason, setReason] = useState('');
  const [opslaanBezig, setOpslaanBezig] = useState(false);

  const gekozenType = TYPE_OPTIES.find((o) => o.id === type) ?? null;

  const kanOpslaan = type !== null && startDate !== '' && endDate !== '' && endDate >= startDate;

  const handleOpslaan = async () => {
    if (!token || !kanOpslaan || !type) return;
    setOpslaanBezig(true);
    try {
      await maakVerlofaanvraag(token, {
        type,
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      });
      Alert.alert('Aanvraag ingediend', 'Je manager krijgt hier een melding van.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Indienen mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
    } finally {
      setOpslaanBezig(false);
    }
  };

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
            Verlof aanvragen
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
              <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Type & periode</Text>
              <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                <FieldRow
                  icon="pricetag-outline"
                  label="Type"
                  value={gekozenType?.label ?? 'Kies type'}
                  onPress={() => toonNativeKeuze('Type verlof', TYPE_OPTIES, (id) => setType(id as VerlofType))}
                  p={p}
                />
                <DatumVeld
                  label="Van"
                  waarde={startDate}
                  open={startPicker}
                  onToggle={() => setStartPicker((v) => !v)}
                  onChange={setStartDate}
                  p={p}
                  metTijd
                />
                <DatumVeld
                  label="Tot"
                  waarde={endDate}
                  open={endPicker}
                  onToggle={() => setEndPicker((v) => !v)}
                  onChange={setEndDate}
                  p={p}
                  metTijd
                  last
                />
              </View>
              {startDate !== '' && endDate !== '' && endDate < startDate && (
                <Text style={[styles.foutHint, { color: p.danger }]}>
                  &quot;Tot&quot; kan niet voor &quot;Van&quot; liggen.
                </Text>
              )}
            </View>

            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Toelichting (optioneel)</Text>
              <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Reden of extra informatie voor je manager…"
                  placeholderTextColor={p.textMuted}
                  multiline
                  style={[styles.input, styles.inputMultiline, styles.inputLast, { color: p.text, borderColor: p.border }]}
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
              {opslaanBezig ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>Aanvraag indienen</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
      style={[styles.fieldRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.divider }]}
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

function DatumVeld({
  label, waarde, open, onToggle, onChange, p, last, metTijd,
}: {
  label: string;
  waarde: string;
  open: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
  p: Palette;
  last?: boolean;
  /** Vraagt ook een tijdstip (niet alleen een datum) — waarde/onChange gebruiken dan "JJJJ-MM-DD UU:MM:SS". */
  metTijd?: boolean;
}) {
  const parse = metTijd ? parseDateTime : (value?: string | null) => {
    if (!value) return new Date();
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return new Date();
    return new Date(y, m - 1, d);
  };
  const format = metTijd ? formatDateTime : formatDate;
  return (
    <View>
      <TouchableOpacity
        style={[styles.fieldRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.divider }]}
        onPress={onToggle}
      >
        <View style={[styles.fieldIconWrap, { backgroundColor: p.surfaceAlt }]}>
          <Ionicons name={metTijd ? 'time-outline' : 'calendar-outline'} size={15} color={p.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.fieldLabel, { color: p.textMuted }]}>{label}</Text>
          <Text style={[styles.fieldValue, { color: p.text }]}>{waarde ? format(parse(waarde)) : 'Instellen'}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={p.textMuted} />
      </TouchableOpacity>
      {open && (
        <DateTimePicker
          value={parse(waarde)}
          mode={metTijd ? 'datetime' : 'date'}
          display={Platform.OS === 'ios' ? 'spinner' : metTijd ? 'default' : 'calendar'}
          onChange={(_, date) => {
            if (!date) return;
            if (metTijd) {
              onChange(naarDateTimeString(date));
              return;
            }
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            onChange(`${y}-${m}-${d}`);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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

  foutHint: { fontSize: 11, fontFamily: F, marginTop: Spacing.xs, paddingHorizontal: 2 },

  input: {
    borderWidth: 0.5, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: 13.5, fontFamily: F, margin: Spacing.md, marginBottom: 0,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  inputLast: { marginBottom: Spacing.md },

  submitBtn: { borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, fontFamily: F },
});

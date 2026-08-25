import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getPalette, Shadow } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { getRolNiveau } from '@/data/session';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  Afdeling,
  ALLE_AFDELINGEN,
  ApiGoedgekeurdVerlof,
  ApiRoosterMedewerker,
  ApiShift,
  createShift,
  deleteShift,
  getGoedgekeurdVerlof,
  getRoosterMedewerkers,
  getShifts,
  ShiftToeslag,
  updateShift,
} from '@/lib/api';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Types ────────────────────────────────────────────────────────────────────

type Toeslag =
  | 'Overuren'
  | 'Weekend'
  | 'Nacht'
  | 'Ziekte'
  | 'Avond eten'
  | 'Feestdag'
  | 'Avond';

type TabKey = 'dag' | 'week' | 'medewerker';

interface User {
  id: number;
  firstname: string;
  lastname: string;
  initials: string;
  color: string;
  colorBg: string;
  afdeling: Afdeling;
}

interface Shift {
  id: number;
  userId: number;
  date: string;
  start: string;
  end: string;
  toeslagen: Toeslag[];
  gewerkt?: boolean;
  notities: string;
}

interface ShiftForm {
  userId: number;
  date: string;
  start: string;
  end: string;
  toeslagen: Toeslag[];
  gewerkt: boolean;
  notities: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AFDELINGEN: Afdeling[] = ALLE_AFDELINGEN;

const AFDELING_COLORS: Record<Afdeling, { bg: string; text: string; border: string }> = {
  KW:               { bg: '#E6F1FB', text: '#0C447C', border: '#90C4F0' },
  Vers:             { bg: '#E1F5EE', text: '#085041', border: '#7ECFB3' },
  AGF:              { bg: '#EEEDFE', text: '#3C3489', border: '#AFA9EC' },
  'Kassa & Boetiek': { bg: '#FAEEDA', text: '#633806', border: '#EF9F27' },
  Brood:            { bg: '#FBEAF0', text: '#72243E', border: '#ED93B1' },
};

// Vaste kleur per medewerker, afgeleid van hun account-id (geen kleurveld op
// het account zelf — alleen cosmetisch, dus een simpele hash volstaat).
const USER_COLOR_PALETTE: { color: string; colorBg: string }[] = [
  { color: '#3C3489', colorBg: '#EEEDFE' },
  { color: '#085041', colorBg: '#E1F5EE' },
  { color: '#712B13', colorBg: '#FAECE7' },
  { color: '#0C447C', colorBg: '#E6F1FB' },
  { color: '#72243E', colorBg: '#FBEAF0' },
  { color: '#633806', colorBg: '#FAEEDA' },
];

function naarUser(m: ApiRoosterMedewerker): User {
  const voornaam = m.voornaam?.trim() || m.naam.split(' ')[0] || '?';
  const achternaam = m.achternaam?.trim() || m.naam.split(' ').slice(1).join(' ');
  const kleur = USER_COLOR_PALETTE[m.id % USER_COLOR_PALETTE.length];
  return {
    id: m.id,
    firstname: voornaam,
    lastname: achternaam,
    initials: m.initialen,
    color: kleur.color,
    colorBg: kleur.colorBg,
    afdeling: m.afdeling,
  };
}

function naarShift(s: ApiShift): Shift {
  return {
    id: s.id,
    userId: s.accountId,
    date: s.datum,
    start: s.start,
    end: s.eind,
    toeslagen: s.toeslagen as Toeslag[],
    gewerkt: s.gewerkt,
    notities: s.notities ?? '',
  };
}

const FEESTDAGEN = new Set([
  '2025-01-01', '2025-04-18', '2025-04-20', '2025-04-21', '2025-04-26',
  '2025-05-05', '2025-05-29', '2025-06-08', '2025-06-09', '2025-12-25', '2025-12-26',
  '2026-01-01', '2026-04-03', '2026-04-05', '2026-04-06', '2026-04-27',
  '2026-05-05', '2026-05-14', '2026-05-24', '2026-05-25', '2026-12-25', '2026-12-26',
]);

const MANUAL_TOESLAGEN: ShiftToeslag[] = ['Overuren', 'Weekend', 'Nacht', 'Ziekte'];

const TOESLAG_COLORS: Record<Toeslag, { bg: string; border: string; text: string }> = {
  Overuren:     { bg: '#FAEEDA', border: '#EF9F27', text: '#633806' },
  Weekend:      { bg: '#FBEAF0', border: '#ED93B1', text: '#72243E' },
  Nacht:        { bg: '#EEEDFE', border: '#AFA9EC', text: '#3C3489' },
  Ziekte:       { bg: '#FCEBEB', border: '#F09595', text: '#791F1F' },
  'Avond eten': { bg: '#FEF9EA', border: '#F5D76E', text: '#7A5B00' },
  Feestdag:     { bg: '#F0FBF0', border: '#7ECB7E', text: '#1A5C1A' },
  Avond:        { bg: '#F0EEFF', border: '#9B8FE8', text: '#2D1F8A' },
};

const TOESLAG_ICONS: Record<Toeslag, string> = {
  Overuren: '⏱', Weekend: '📅', Nacht: '🌙', Ziekte: '🤒',
  'Avond eten': '🍽', Feestdag: '🎉', Avond: '🌆',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date): string { return d.toISOString().split('T')[0]; }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function getWeekStart(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  return r;
}
function timeToMinutes(t: string): number { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function calcHours(start: string, end: string): number {
  let m = timeToMinutes(end) - timeToMinutes(start);
  if (m < 0) m += 1440;
  return m / 60;
}
function isPast(date: string, end: string): boolean { return new Date(`${date}T${end}`) < new Date(); }
function isToday(date: string): boolean { return date === fmt(new Date()); }

function computeAutoToeslagen(date: string, start: string, end: string): Toeslag[] {
  const result: Toeslag[] = [];
  const startMin = timeToMinutes(start);
  let endMin = timeToMinutes(end);
  if (endMin <= startMin) endMin += 1440;
  if (FEESTDAGEN.has(date)) result.push('Feestdag');
  if ((endMin - startMin) / 60 >= 4.5 && startMin > 990) result.push('Avond eten');
  if (endMin > 1320) result.push('Avond');
  return result;
}

// ─── Haptic helpers ───────────────────────────────────────────────────────────

function hapticLight() {
  if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
function hapticMedium() {
  if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}
function hapticSuccess() {
  if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

// ─── iOS Action Sheet helper ──────────────────────────────────────────────────

function showShiftActions(
  shift: Shift,
  medewerkerNaam: string,
  onEdit: () => void,
  onDelete: () => void,
  onToggleGewerkt: () => void,
) {
  if (Platform.OS === 'ios') {
    const past = isPast(shift.date, shift.end);
    const options = ['Bewerken', past ? (shift.gewerkt ? 'Markeer als niet gewerkt' : 'Markeer als gewerkt') : null, 'Verwijderen', 'Annuleren'].filter(Boolean) as string[];
    const destructiveIndex = options.indexOf('Verwijderen');
    const cancelIndex = options.indexOf('Annuleren');
    ActionSheetIOS.showActionSheetWithOptions(
      { options, destructiveButtonIndex: destructiveIndex, cancelButtonIndex: cancelIndex, title: `${medewerkerNaam}  •  ${shift.start}–${shift.end}` },
      (i) => {
        if (options[i] === 'Bewerken') { hapticLight(); onEdit(); }
        else if (options[i]?.includes('gewerkt')) { hapticMedium(); onToggleGewerkt(); }
        else if (options[i] === 'Verwijderen') { hapticMedium(); onDelete(); }
      },
    );
  } else {
    onEdit();
  }
}

// ─── Swipe hook ───────────────────────────────────────────────────────────────

function useSwipeNav(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold = 60,
) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        translateX.setValue(g.dx * 0.25); // subtle follow
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -threshold) {
          Animated.sequence([
            Animated.timing(translateX, { toValue: -30, duration: 80, useNativeDriver: true }),
            Animated.timing(translateX, { toValue: 0, duration: 120, useNativeDriver: true }),
          ]).start();
          hapticLight();
          onSwipeLeft();
        } else if (g.dx > threshold) {
          Animated.sequence([
            Animated.timing(translateX, { toValue: 30, duration: 80, useNativeDriver: true }),
            Animated.timing(translateX, { toValue: 0, duration: 120, useNativeDriver: true }),
          ]).start();
          hapticLight();
          onSwipeRight();
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  return { panResponder, translateX };
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ user, size = 36 }: { user: User; size?: number }) {
  return (
    <View style={[avStyles.c, { width: size, height: size, borderRadius: size / 2, backgroundColor: user.colorBg }]}>
      <Text style={[avStyles.t, { color: user.color, fontSize: size * 0.33 }]}>{user.initials}</Text>
    </View>
  );
}
const avStyles = StyleSheet.create({
  c: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  t: { fontWeight: '600', fontFamily: 'Montserrat' },
});

// ─── Toeslag Badge ────────────────────────────────────────────────────────────

function ToeslagBadge({ toeslag, size = 'normal' }: { toeslag: Toeslag; size?: 'normal' | 'small' }) {
  const c = TOESLAG_COLORS[toeslag];
  return (
    <View style={[tbStyles.pill, { backgroundColor: c.bg, borderColor: c.border }, size === 'small' && tbStyles.sm]}>
      <Text style={{ fontSize: size === 'small' ? 9 : 11 }}>{TOESLAG_ICONS[toeslag]}</Text>
      <Text style={[tbStyles.lbl, { color: c.text }, size === 'small' && tbStyles.lblSm]}>{toeslag}</Text>
    </View>
  );
}
const tbStyles = StyleSheet.create({
  pill: { borderWidth: 0.5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 },
  sm: { paddingHorizontal: 5, paddingVertical: 2, gap: 2 },
  lbl: { fontSize: 11, fontWeight: '500', fontFamily: 'Montserrat' },
  lblSm: { fontSize: 9 },
});

// ─── Afdeling Badge ───────────────────────────────────────────────────────────

function AfdelingBadge({ afdeling }: { afdeling: Afdeling }) {
  const c = AFDELING_COLORS[afdeling];
  return (
    <View style={[abStyles.b, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[abStyles.t, { color: c.text }]}>{afdeling}</Text>
    </View>
  );
}
const abStyles = StyleSheet.create({
  b: { borderWidth: 0.5, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  t: { fontSize: 10, fontWeight: '600', fontFamily: 'Montserrat', letterSpacing: 0.3 },
});

// ─── Afdeling Section Header ──────────────────────────────────────────────────

function AfdelingHeader({ afdeling }: { afdeling: Afdeling }) {
  const c = AFDELING_COLORS[afdeling];
  return (
    <View style={[ahStyles.row]}>
      <View style={[ahStyles.accent, { backgroundColor: c.border }]} />
      <Text style={[ahStyles.lbl, { color: c.text }]}>{afdeling}</Text>
    </View>
  );
}
const ahStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 6 },
  accent: { width: 3, height: 14, borderRadius: 2 },
  lbl: { fontSize: 11, fontWeight: '700', fontFamily: 'Montserrat', letterSpacing: 0.8, textTransform: 'uppercase' },
});

// ─── Timeline Bar ─────────────────────────────────────────────────────────────

function TimelineBar({ shift, userColor, userColorBg, isPastShift }: {
  shift: Shift | null; userColor: string; userColorBg: string; isPastShift: boolean;
}) {
  const seg = useMemo(() => {
    if (!shift) return null;
    const s = timeToMinutes(shift.start);
    let e = timeToMinutes(shift.end);
    if (e <= s) e += 1440;
    return { left: (s / 1440) * 100, width: Math.min(((e - s) / 1440) * 100, 100 - (s / 1440) * 100) };
  }, [shift]);

  return (
    <View style={tlStyles.wrap}>
      <View style={tlStyles.labelsRow}>
        {['0', '6', '12', '18', '24'].map((l, i) => (
          <Text key={l} style={[tlStyles.hourLbl, { left: `${i * 25}%` as any }]}>{l}</Text>
        ))}
      </View>
      <View style={tlStyles.track}>
        {[25, 50, 75].map((p) => <View key={p} style={[tlStyles.grid, { left: `${p}%` as any }]} />)}
        {seg && (
          <View style={[tlStyles.bar, {
            left: `${seg.left}%` as any,
            width: `${seg.width}%` as any,
            backgroundColor: isPastShift && shift?.gewerkt ? userColor : userColorBg,
            borderColor: userColor,
            opacity: isPastShift && !shift?.gewerkt ? 0.38 : 1,
          }]} />
        )}
      </View>
    </View>
  );
}
const tlStyles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 14 },
  labelsRow: { position: 'relative', height: 14, marginBottom: 2 },
  hourLbl: { position: 'absolute', fontSize: 9, color: 'rgba(128,128,128,0.55)', fontFamily: 'Montserrat', transform: [{ translateX: -4 }] },
  track: { height: 18, backgroundColor: 'rgba(128,128,128,0.08)', borderRadius: 4, overflow: 'hidden', position: 'relative' },
  grid: { position: 'absolute', top: 0, bottom: 0, width: 0.5, backgroundColor: 'rgba(128,128,128,0.14)' },
  bar: { position: 'absolute', top: 2, bottom: 2, borderRadius: 3, borderWidth: 0.5 },
});

// ─── Employee Row (dag-view) ───────────────────────────────────────────────────

function EmployeeRow({ user, shift, verlofLabel, surface, border, textPrimary, textSecondary, tint, readOnly, onPress, onAdd, onLongPress }: {
  user: User; shift: Shift | null; verlofLabel: string | null; surface: string; border: string;
  textPrimary: string; textSecondary: string; tint: string; readOnly: boolean;
  onPress: () => void; onAdd: () => void; onLongPress: () => void;
}) {
  const past = shift ? isPast(shift.date, shift.end) : false;
  const hours = shift ? calcHours(shift.start, shift.end) : 0;
  const autoT = shift ? computeAutoToeslagen(shift.date, shift.start, shift.end) : [];
  const allT = shift ? [...new Set([...shift.toeslagen, ...autoT])] : [];
  const geblokkeerd = !shift && !!verlofLabel;

  return (
    <TouchableOpacity
      style={[erStyles.card, { backgroundColor: surface, borderColor: border }, geblokkeerd && { opacity: 0.6 }]}
      onPress={shift ? onPress : (readOnly || geblokkeerd ? undefined : onAdd)}
      onLongPress={shift && !readOnly ? onLongPress : undefined}
      delayLongPress={350}
      activeOpacity={0.72}
      disabled={!shift && (readOnly || geblokkeerd)}
    >
      <View style={erStyles.left}>
        <Avatar user={user} size={34} />
        <View style={erStyles.nb}>
          <View style={erStyles.nr}>
            <Text style={[erStyles.name, { color: textPrimary }]} numberOfLines={1}>{user.firstname.split(' ')[0]}</Text>
            <AfdelingBadge afdeling={user.afdeling} />
          </View>
          {shift ? (
            <View style={erStyles.mr}>
              <Text style={[erStyles.meta, { color: textSecondary }]}>{shift.start}–{shift.end}</Text>
              <View style={[erStyles.hb, { backgroundColor: past && shift.gewerkt ? user.colorBg : 'rgba(128,128,128,0.08)' }]}>
                <Text style={[erStyles.ht, { color: past && shift.gewerkt ? user.color : textSecondary }]}>{hours.toFixed(1)}u</Text>
              </View>
              {shift.gewerkt && past && (
                <View style={erStyles.checkDot}><Text style={{ fontSize: 8, color: '#fff' }}>✓</Text></View>
              )}
            </View>
          ) : geblokkeerd ? (
            <View style={erStyles.mr}>
              <Text style={{ fontSize: 10 }}>🌴</Text>
              <Text style={[erStyles.meta, { color: textSecondary }]}>{verlofLabel}</Text>
            </View>
          ) : (
            <Text style={[erStyles.meta, { color: textSecondary, opacity: 0.45 }]}>Niet ingepland</Text>
          )}
        </View>
      </View>
      <TimelineBar shift={shift} userColor={user.color} userColorBg={user.colorBg} isPastShift={past} />
      {allT.length > 0 && (
        <View style={erStyles.tw}>{allT.map((t) => <ToeslagBadge key={t} toeslag={t} size="small" />)}</View>
      )}
      {!!shift?.notities && (
        <View style={erStyles.noteRow}>
          <Text style={{ fontSize: 10 }}>📝</Text>
          <Text style={[erStyles.noteTxt, { color: textSecondary }]} numberOfLines={1}>{shift.notities}</Text>
        </View>
      )}
      {!shift && !readOnly && !geblokkeerd && (
        <TouchableOpacity style={[erStyles.addBtn, { borderColor: border }]} onPress={onAdd}>
          <Text style={{ color: tint, fontSize: 17, lineHeight: 19 }}>+</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}
const erStyles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 0.5, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, marginBottom: 6, gap: 6, ...(Shadow.card as object) },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nb: { flex: 1, minWidth: 0 },
  nr: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 12, fontWeight: '600', fontFamily: 'Montserrat' },
  mr: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  meta: { fontSize: 11, fontFamily: 'Montserrat' },
  hb: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  ht: { fontSize: 10, fontWeight: '500', fontFamily: 'Montserrat' },
  checkDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#34C759', alignItems: 'center', justifyContent: 'center' },
  tw: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  noteTxt: { fontSize: 10.5, fontFamily: 'Montserrat', flexShrink: 1, fontStyle: 'italic' },
  addBtn: { position: 'absolute', right: 10, top: 10, width: 28, height: 28, borderRadius: 8, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
});

// ─── Day Strip ────────────────────────────────────────────────────────────────

function DayStrip({ weekStart, selectedDate, shifts, textPrimary, textSecondary, tint, border, surface, onSelect }: {
  weekStart: Date; selectedDate: string; shifts: Shift[]; textPrimary: string; textSecondary: string;
  tint: string; border: string; surface: string; onSelect: (d: string) => void;
}) {
  const days = Array.from({ length: 21 }, (_, i) => addDays(weekStart, i));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={dsStyles.content}>
      {days.map((d) => {
        const ds = fmt(d);
        const active = ds === selectedDate;
        const today = isToday(ds);
        return (
          <TouchableOpacity
            key={ds}
            style={[dsStyles.chip, { backgroundColor: active ? tint : surface, borderColor: active ? tint : border }, today && !active && { borderColor: tint, borderWidth: 1.5 }]}
            onPress={() => { hapticLight(); onSelect(ds); }}
          >
            <Text style={[dsStyles.dn, { color: active ? '#fff' : textSecondary }]}>
              {d.toLocaleDateString('nl-NL', { weekday: 'short' }).replace('.', '')}
            </Text>
            <Text style={[dsStyles.dd, { color: active ? '#fff' : textPrimary }]}>{d.getDate()}</Text>
            <View style={dsStyles.dotRow}>
              {shifts.some((s) => s.date === ds) && <View style={[dsStyles.dot, { backgroundColor: active ? '#fff' : tint }]} />}
              {FEESTDAGEN.has(ds) && <View style={[dsStyles.dot, { backgroundColor: active ? '#fff' : '#7ECB7E' }]} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
const dsStyles = StyleSheet.create({
  content: { paddingHorizontal: 14, gap: 5 },
  chip: { minWidth: 44, paddingVertical: 7, paddingHorizontal: 6, borderRadius: 10, borderWidth: 0.5, alignItems: 'center', gap: 2 },
  dn: { fontSize: 10, fontFamily: 'Montserrat', textTransform: 'capitalize' },
  dd: { fontSize: 14, fontWeight: '600', fontFamily: 'Montserrat' },
  dotRow: { flexDirection: 'row', gap: 2, height: 5, alignItems: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2 },
});

// ─── Summary Strip ────────────────────────────────────────────────────────────

function SummaryStrip({ shifts, date, surface, border, textPrimary, textSecondary }: {
  shifts: Shift[]; date?: string; surface: string; border: string; textPrimary: string; textSecondary: string;
}) {
  const totalH = shifts.reduce((a, s) => a + calcHours(s.start, s.end), 0);
  const autoT = shifts.flatMap((s) => computeAutoToeslagen(s.date, s.start, s.end));
  const totalT = shifts.reduce((a, s) => a + s.toeslagen.length, 0) + autoT.length;
  const isFeest = date ? FEESTDAGEN.has(date) : false;
  return (
    <View style={[ssStyles.wrap, { backgroundColor: surface, borderColor: border }]}>
      <View style={ssStyles.row}>
        {[{ val: String(shifts.length), lbl: 'Shifts' }, { val: `${totalH.toFixed(1)}u`, lbl: 'Uren' }, { val: String(totalT), lbl: 'Toeslagen' }].map((it, i) => (
          <View key={i} style={ssStyles.item}>
            <Text style={[ssStyles.val, { color: textPrimary }]}>{it.val}</Text>
            <Text style={[ssStyles.lbl, { color: textSecondary }]}>{it.lbl}</Text>
          </View>
        ))}
      </View>
      {isFeest && (
        <View style={ssStyles.feest}>
          <Text style={{ fontSize: 13 }}>🎉</Text>
          <Text style={ssStyles.feestTxt}>Feestdag — 200% salaris van toepassing</Text>
        </View>
      )}
    </View>
  );
}
const ssStyles = StyleSheet.create({
  wrap: { marginHorizontal: 14, borderRadius: 16, borderWidth: 0.5, marginBottom: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-evenly', paddingVertical: 12 },
  item: { alignItems: 'center', gap: 2 },
  val: { fontSize: 18, fontWeight: '600', fontFamily: 'Montserrat' },
  lbl: { fontSize: 10, fontFamily: 'Montserrat', textTransform: 'uppercase', letterSpacing: 0.4 },
  feest: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F0FBF0', borderTopWidth: 0.5, borderTopColor: '#7ECB7E' },
  feestTxt: { fontSize: 11, color: '#1A5C1A', fontFamily: 'Montserrat', fontWeight: '500' },
});

// ─── iOS-style Segmented Control ──────────────────────────────────────────────

function SegmentedControl({ tabs, active, surface, border, tint, textSecondary, onChange }: {
  tabs: { key: TabKey; label: string }[]; active: TabKey; surface: string; border: string;
  tint: string; textSecondary: string; onChange: (k: TabKey) => void;
}) {
  return (
    <View style={[scStyles.wrap, { backgroundColor: surface, borderColor: border }]}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <TouchableOpacity
            key={t.key}
            style={[scStyles.seg, on && { backgroundColor: tint, borderRadius: 8 }]}
            onPress={() => { hapticLight(); onChange(t.key); }}
            activeOpacity={0.7}
          >
            <Text style={[scStyles.lbl, { color: on ? '#fff' : textSecondary, fontWeight: on ? '600' : '400' }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const scStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', marginHorizontal: 14, borderRadius: 10, borderWidth: 0.5, padding: 3, marginBottom: 12 },
  seg: { flex: 1, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  lbl: { fontSize: 12, fontFamily: 'Montserrat', letterSpacing: 0.1 },
});

// ─── Shift Form Sheet ─────────────────────────────────────────────────────────

function ShiftFormSheet({ visible, mode, form, users, surface, border, textPrimary, textSecondary, tint, inputBg, onClose, onSave, onDelete, onChangeForm, opslaanBezig }: {
  visible: boolean; mode: 'add' | 'edit'; form: ShiftForm; users: User[];
  surface: string; border: string; textPrimary: string; textSecondary: string;
  tint: string; inputBg: string;
  onClose: () => void; onSave: () => void; onDelete: () => void;
  onChangeForm: (p: Partial<ShiftForm>) => void; opslaanBezig: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState('');

  // Reset search when modal closes
  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
    }
  }, [visible]);

  const userById = useCallback(
    (id: number): User => users.find((u) => u.id === id) ?? users[0] ?? {
      id: 0, firstname: '?', lastname: '', initials: '?', color: '#666', colorBg: '#eee', afdeling: 'AGF',
    },
    [users]
  );

  const toggleT = (t: ShiftToeslag) => {
    const next = form.toeslagen.includes(t) ? form.toeslagen.filter((x) => x !== t) : [...form.toeslagen, t];
    onChangeForm({ toeslagen: next });
  };
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter((u) => u.firstname.toLowerCase().includes(query) || u.lastname.toLowerCase().includes(query));
  }, [searchQuery, users]);
  const autoT = form.date && form.start && form.end ? computeAutoToeslagen(form.date, form.start, form.end) : [];
  const shiftPast = form.date && form.end ? isPast(form.date, form.end) : false;
  const gekozenUser = userById(form.userId);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'left', 'right']} style={[sfStyles.container, { backgroundColor: surface }]}>
        <View style={sfStyles.navBar}>
          <TouchableOpacity onPress={onClose} style={sfStyles.navBtn}>
            <Text style={[sfStyles.navBtnTxt, { color: tint }]}>Annuleren</Text>
          </TouchableOpacity>
          <Text style={[sfStyles.navTitle, { color: textPrimary }]}>
            {mode === 'add' ? 'Shift inplannen voor ' + gekozenUser.firstname : 'Shift bewerken voor ' + gekozenUser.firstname}
          </Text>
          <TouchableOpacity onPress={() => { hapticSuccess(); onSave(); }} style={sfStyles.navBtn} disabled={opslaanBezig}>
            {opslaanBezig ? (
              <ActivityIndicator size="small" color={tint} />
            ) : (
              <Text style={[sfStyles.navBtnTxt, { color: tint, fontWeight: '600' }]}>
                {mode === 'add' ? 'Voeg toe' : 'Sla op'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Medewerker section */}
            {mode === 'add' && (
              <>
                <Text style={[sfStyles.sectionHdr, { color: textSecondary }]}>MEDEWERKER</Text>
                <View style={[sfStyles.searchCard, { backgroundColor: inputBg, borderColor: border }]}>
                  <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Zoeken..."
                    placeholderTextColor={textSecondary}
                    style={[{ color: textPrimary, flex: 1, fontSize: 15, fontFamily: 'Montserrat' }]}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                      <Text style={{ fontSize: 16 }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={[sfStyles.groupedCard, { backgroundColor: inputBg, borderColor: border, maxHeight: 280, paddingHorizontal: 0 }]}>
                  <ScrollView nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
                    {filteredUsers.length > 0 ? filteredUsers.map((u) => {
                      const sel = form.userId === u.id;
                      return (
                        <TouchableOpacity
                          key={u.id}
                          style={[sfStyles.userRow, { backgroundColor: sel ? `${tint}15` : 'transparent', borderBottomColor: border }]}
                          onPress={() => { hapticLight(); onChangeForm({ userId: u.id }); setSearchQuery(''); }}
                        >
                          <Avatar user={u} size={32} />
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[sfStyles.rowLabel, { color: textPrimary }]}>{u.firstname}</Text>
                            <Text style={[{ fontSize: 11, color: textSecondary, fontFamily: 'Montserrat', marginTop: 2 }]}>{u.afdeling}</Text>
                          </View>
                          {sel && (
                            <View style={[sfStyles.checkCircle, { backgroundColor: tint }]}>
                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    }) : (
                      <View style={{ padding: 16, alignItems: 'center' }}>
                        <Text style={[{ fontSize: 13, color: textSecondary, fontFamily: 'Montserrat' }]}>Geen resultaten</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              </>
            )}

            {/* Grouped section: Datum & Tijd */}
            <Text style={[sfStyles.sectionHdr, { color: textSecondary }]}>DATUM & TIJD</Text>
            <View style={[sfStyles.groupedCard, { backgroundColor: inputBg, borderColor: border }]}>
              <View style={sfStyles.row}>
                <Text style={[sfStyles.rowLabel, { color: textPrimary }]}>Datum</Text>
                <TextInput value={form.date} onChangeText={(v) => onChangeForm({ date: v })} placeholder="JJJJ-MM-DD" placeholderTextColor={textSecondary}
                  style={[sfStyles.inlineInput, { color: tint }]} keyboardType="numbers-and-punctuation" maxLength={10} />
              </View>
              <View style={[sfStyles.divider, { backgroundColor: border }]} />
              <View style={sfStyles.row}>
                <Text style={[sfStyles.rowLabel, { color: textPrimary }]}>Begin</Text>
                <TextInput value={form.start} onChangeText={(v) => onChangeForm({ start: v })} placeholder="08:00" placeholderTextColor={textSecondary}
                  style={[sfStyles.inlineInput, { color: tint }]} keyboardType="numbers-and-punctuation" maxLength={5} />
              </View>
              <View style={[sfStyles.divider, { backgroundColor: border }]} />
              <View style={sfStyles.row}>
                <Text style={[sfStyles.rowLabel, { color: textPrimary }]}>Einde</Text>
                <TextInput value={form.end} onChangeText={(v) => onChangeForm({ end: v })} placeholder="16:00" placeholderTextColor={textSecondary}
                  style={[sfStyles.inlineInput, { color: tint }]} keyboardType="numbers-and-punctuation" maxLength={5} />
              </View>
            </View>

            {/* Auto-toeslagen */}
            {autoT.length > 0 && (
              <>
                <Text style={[sfStyles.sectionHdr, { color: textSecondary }]}>AUTOMATISCHE TOESLAGEN</Text>
                <View style={[sfStyles.groupedCard, { backgroundColor: inputBg, borderColor: border }]}>
                  <View style={[sfStyles.autoRow]}>
                    {autoT.map((t) => <ToeslagBadge key={t} toeslag={t} />)}
                  </View>
                </View>
              </>
            )}

            {/* Handmatige toeslagen */}
            {mode === 'edit' && (
              <>
                <Text style={[sfStyles.sectionHdr, { color: textSecondary }]}>HANDMATIGE TOESLAGEN</Text>
                <View style={[sfStyles.groupedCard, { backgroundColor: inputBg, borderColor: border, opacity: shiftPast ? 1 : 0.45 }]}>
                  {MANUAL_TOESLAGEN.map((t, i) => {
                    const sel = form.toeslagen.includes(t);
                    return (
                      <View key={t}>
                        {i > 0 && <View style={[sfStyles.divider, { backgroundColor: border }]} />}
                        <TouchableOpacity
                          style={sfStyles.row}
                          disabled={!shiftPast}
                          onPress={() => { hapticLight(); toggleT(t); }}
                        >
                          <Text style={{ fontSize: 15, marginRight: 4 }}>{TOESLAG_ICONS[t]}</Text>
                          <Text style={[sfStyles.rowLabel, { color: textPrimary, flex: 1 }]}>{t}</Text>
                          {sel ? (
                            <View style={[sfStyles.checkCircle, { backgroundColor: tint }]}>
                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>
                            </View>
                          ) : (
                            <View style={[sfStyles.emptyCircle, { borderColor: border }]} />
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
                {!shiftPast && (
                  <Text style={[sfStyles.footerNote, { color: textSecondary }]}>
                    🔒 Beschikbaar na afloop van de dienst
                  </Text>
                )}
              </>
            )}

            {/* Notitie */}
            <Text style={[sfStyles.sectionHdr, { color: textSecondary }]}>NOTITIE</Text>
            <View style={[sfStyles.groupedCard, { backgroundColor: inputBg, borderColor: border }]}>
              <TextInput
                value={form.notities}
                onChangeText={(v) => onChangeForm({ notities: v })}
                placeholder="Bv. &quot;vervangt Jan&quot; of &quot;eerder weg i.v.m. afspraak&quot; (optioneel)"
                placeholderTextColor={textSecondary}
                multiline
                style={[{ color: textPrimary, fontSize: 14, fontFamily: 'Montserrat', minHeight: 60, textAlignVertical: 'top', paddingVertical: 12 }]}
              />
            </View>

            {/* Gewerkt toggle */}
            {mode === 'edit' && shiftPast && (
              <>
                <Text style={[sfStyles.sectionHdr, { color: textSecondary }]}>STATUS</Text>
                <View style={[sfStyles.groupedCard, { backgroundColor: inputBg, borderColor: border }]}>
                  <TouchableOpacity style={sfStyles.row} onPress={() => { hapticMedium(); onChangeForm({ gewerkt: !form.gewerkt }); }}>
                    <Text style={[sfStyles.rowLabel, { color: textPrimary, flex: 1 }]}>Dienst gewerkt</Text>
                    <View style={[sfStyles.toggle, { backgroundColor: form.gewerkt ? '#34C759' : border }]}>
                      <Animated.View style={[sfStyles.thumb, { left: form.gewerkt ? 20 : 2 }]} />
                    </View>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Delete (edit mode) */}
            {mode === 'edit' && (
              <TouchableOpacity
                style={[sfStyles.deleteRow, { backgroundColor: '#FFF0F0', borderColor: '#FFCDD2' }]}
                onPress={() => { hapticMedium(); onDelete(); }}
              >
                <Text style={sfStyles.deleteTxt}>Shift verwijderen</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
  );
}
const sfStyles = StyleSheet.create({
  container: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.32)' },
  sheet: { borderRadius: 20, paddingBottom: 34, maxHeight: '90%' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.3)', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.1)' },
  navBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  navBtnTxt: { fontSize: 15, fontFamily: 'Montserrat' },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', fontFamily: 'Montserrat' },
  sectionHdr: { fontSize: 11, fontWeight: '500', fontFamily: 'Montserrat', letterSpacing: 0.6, marginLeft: 20, marginTop: 18, marginBottom: 6 },
  groupedCard: { marginHorizontal: 14, borderRadius: 12, borderWidth: 0.5, overflow: 'hidden', paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
  rowLabel: { fontSize: 14, fontFamily: 'Montserrat' },
  inlineInput: { fontSize: 14, fontFamily: 'Montserrat', textAlign: 'right', flex: 1 },
  divider: { height: 0.5, marginLeft: 0 },
  userChip: { alignItems: 'center', gap: 4, padding: 8, borderRadius: 10, borderWidth: 1, minWidth: 60 },
  userChipName: { fontSize: 11, fontWeight: '600', fontFamily: 'Montserrat' },
  userChipAfd: { fontSize: 9, fontFamily: 'Montserrat' },
  autoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 4 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  emptyCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5 },
  toggle: { width: 42, height: 26, borderRadius: 13, position: 'relative' },
  thumb: { position: 'absolute', top: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  footerNote: { fontSize: 12, fontFamily: 'Montserrat', marginHorizontal: 20, marginTop: 6 },
  deleteRow: { marginHorizontal: 14, marginTop: 18, borderRadius: 12, borderWidth: 0.5, paddingVertical: 14, alignItems: 'center' },
  deleteTxt: { fontSize: 15, fontFamily: 'Montserrat', color: '#E24B4A', fontWeight: '500' },
  searchCard: { marginHorizontal: 14, borderRadius: 12, borderWidth: 0.5, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

function leegForm(userId: number, date: string): ShiftForm {
  return { userId, date, start: '08:00', end: '16:00', toeslagen: [], gewerkt: false, notities: '' };
}

export default function PlanningScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const p = getPalette(isDark);
  const surface       = p.surface;
  const pageBg        = p.bg;
  const textPrimary   = p.text;
  const textSecondary = p.textSecondary;
  const border        = p.border;
  const tint          = p.accent;
  const inputBg       = p.surfaceAlt;

  const { user, token } = useAuth();
  const magBeheren = getRolNiveau(user?.rol ?? '') !== 'medewerker';

  const today = useMemo(() => new Date(), []);
  const [medewerkers, setMedewerkers]     = useState<User[]>([]);
  const [shifts, setShifts]               = useState<Shift[]>([]);
  const [goedgekeurdVerlof, setGoedgekeurdVerlof] = useState<ApiGoedgekeurdVerlof[]>([]);
  const [laden, setLaden]                 = useState(true);
  const [fout, setFout]                   = useState<string | null>(null);
  const [weekStart, setWeekStart]         = useState<Date>(() => getWeekStart(today));
  const [selectedDate, setSelectedDate]   = useState<string>(() => fmt(today));
  const [activeTab, setActiveTab]         = useState<TabKey>('dag');
  const [sheetOpen, setSheetOpen]         = useState(false);
  const [sheetMode, setSheetMode]         = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId]         = useState<number | null>(null);
  const [form, setForm]                   = useState<ShiftForm>(() => leegForm(0, fmt(today)));
  const [opslaanBezig, setOpslaanBezig]   = useState(false);
  const [activeAfdeling, setActiveAfdeling] = useState<Afdeling | null>(null);
  const heeftGeladenRef = useRef(false);

  const userById = useCallback(
    (id: number): User => medewerkers.find((u) => u.id === id) ?? {
      id: 0, firstname: 'Onbekend', lastname: '', initials: '?', color: textSecondary, colorBg: inputBg, afdeling: AFDELINGEN[0],
    },
    [medewerkers, textSecondary, inputBg]
  );

  // ── Medewerkers laden ────────────────────────────────────────────────────────
  const laadMedewerkers = useCallback(async () => {
    if (!token) return;
    setMedewerkers((await getRoosterMedewerkers(token)).map(naarUser));
  }, [token]);

  // ── Shifts + goedgekeurd verlof laden voor een venster rond de huidige week ──
  const laadShifts = useCallback(async () => {
    if (!token) return;
    const van = fmt(addDays(weekStart, -7));
    const tot = fmt(addDays(weekStart, 27));
    setShifts((await getShifts(token, van, tot)).map(naarShift));
  }, [token, weekStart]);

  const laadVerlof = useCallback(async () => {
    if (!token) return;
    const van = fmt(addDays(weekStart, -7));
    const tot = fmt(addDays(weekStart, 27));
    setGoedgekeurdVerlof(await getGoedgekeurdVerlof(token, van, tot));
  }, [token, weekStart]);

  // Wacht tot het token beschikbaar is (die komt async binnen, bv. na een
  // biometrische ontgrendeling) — pas dan de eerste keer laden, anders blijft
  // dit scherm voorgoed leeg omdat een leeg-deps effect de verouderde,
  // token-loze versie van de laadfuncties zou vasthouden.
  useEffect(() => {
    if (!token || heeftGeladenRef.current) return;
    heeftGeladenRef.current = true;
    (async () => {
      setLaden(true);
      try {
        await Promise.all([laadMedewerkers(), laadShifts(), laadVerlof()]);
        setFout(null);
      } catch (e) {
        setFout(e instanceof Error ? e.message : 'Dienstrooster laden is mislukt.');
      } finally {
        setLaden(false);
      }
    })();
  }, [token, laadMedewerkers, laadShifts, laadVerlof]);

  useEffect(() => {
    if (!heeftGeladenRef.current) return;
    (async () => {
      try {
        await Promise.all([laadShifts(), laadVerlof()]);
        setFout(null);
      } catch (e) {
        setFout(e instanceof Error ? e.message : 'Dienstrooster laden is mislukt.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const weekLabel = useMemo(() => {
    const o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${weekDays[0].toLocaleDateString('nl-NL', o)} – ${weekDays[6].toLocaleDateString('nl-NL', o)}`;
  }, [weekDays]);

  const selectedDateObj = useMemo(() => new Date(selectedDate + 'T12:00:00'), [selectedDate]);
  const selectedDateLabel = useMemo(() =>
    selectedDateObj.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }),
    [selectedDateObj]);

  const shiftsForDate = useCallback(
    (date: string) => shifts.filter((s) => s.date === date).sort((a, b) => a.start.localeCompare(b.start)),
    [shifts],
  );
  const shiftsForWeek = useMemo(
    () => shifts.filter((s) => weekDays.some((d) => fmt(d) === s.date)),
    [shifts, weekDays],
  );
  const summaryShifts = activeTab === 'dag' ? shiftsForDate(selectedDate) : shiftsForWeek;

  // ── Goedgekeurd verlof — blokkeert inplannen op die dag ──────────────────────
  const verlofOp = useCallback((userId: number, date: string): ApiGoedgekeurdVerlof | null => {
    const dagStart = `${date} 00:00:00`;
    const dagEind = `${date} 23:59:59`;
    return goedgekeurdVerlof.find((v) => v.accountId === userId && v.van <= dagEind && v.tot >= dagStart) ?? null;
  }, [goedgekeurdVerlof]);

  // ── Navigation ──────────────────────────────────────────────────────────────

  const goNextDay = useCallback(() => {
    const next = fmt(addDays(new Date(selectedDate + 'T12:00:00'), 1));
    setSelectedDate(next);
    const nextDate = new Date(next + 'T12:00:00');
    if (!weekDays.some((d) => fmt(d) === next)) {
      setWeekStart(getWeekStart(nextDate));
    }
  }, [selectedDate, weekDays]);

  const goPrevDay = useCallback(() => {
    const prev = fmt(addDays(new Date(selectedDate + 'T12:00:00'), -1));
    setSelectedDate(prev);
    const prevDate = new Date(prev + 'T12:00:00');
    if (!weekDays.some((d) => fmt(d) === prev)) {
      setWeekStart(getWeekStart(prevDate));
    }
  }, [selectedDate, weekDays]);

  const goNextWeek = useCallback(() => setWeekStart((w) => addDays(w, 7)), []);
  const goPrevWeek = useCallback(() => setWeekStart((w) => addDays(w, -7)), []);

  // Swipe for dag-view (swipe by day)
  const dagSwipe = useSwipeNav(goNextDay, goPrevDay);
  // Swipe for week-view and medewerker-view (swipe by week)
  const weekSwipe = useSwipeNav(goNextWeek, goPrevWeek);

  // ── Sheet helpers ───────────────────────────────────────────────────────────

  const openAdd = (prefillUserId?: number, prefillDate?: string) => {
    if (!magBeheren) return;
    if (medewerkers.length === 0) {
      Alert.alert('Geen medewerkers', 'Er zijn nog geen medewerkers geladen om in te plannen. Probeer het zo opnieuw.');
      return;
    }
    const date = prefillDate ?? selectedDate;
    if (prefillUserId !== undefined) {
      const verlof = verlofOp(prefillUserId, date);
      if (verlof) {
        Alert.alert('Medewerker op verlof', `${userById(prefillUserId).firstname} heeft goedgekeurd verlof (${verlof.typeLabel}) op deze dag.`);
        return;
      }
    }
    setForm({ ...leegForm(prefillUserId ?? medewerkers[0].id, date), gewerkt: isPast(date, '23:59') });
    setSheetMode('add'); setEditingId(null); setSheetOpen(true);
  };

  const openEdit = (shift: Shift) => {
    if (!magBeheren) return;
    setForm({ userId: shift.userId, date: shift.date, start: shift.start, end: shift.end, toeslagen: [...shift.toeslagen], gewerkt: shift.gewerkt ?? false, notities: shift.notities });
    setSheetMode('edit'); setEditingId(shift.id); setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!token) return;
    if (!form.date || !form.start || !form.end) {
      Alert.alert('Onvolledig', 'Vul datum, begintijd en eindtijd in.'); return;
    }
    const verlof = verlofOp(form.userId, form.date);
    if (verlof) {
      Alert.alert('Medewerker op verlof', `${userById(form.userId).firstname} heeft goedgekeurd verlof (${verlof.typeLabel}) op deze dag.`);
      return;
    }
    const afdeling = userById(form.userId).afdeling;
    setOpslaanBezig(true);
    try {
      if (sheetMode === 'add') {
        await createShift(token, {
          accountId: form.userId,
          afdeling,
          datum: form.date,
          start: form.start,
          eind: form.end,
          toeslagen: form.toeslagen as ShiftToeslag[],
          notities: form.notities || undefined,
        });
        setSelectedDate(form.date);
      } else if (editingId !== null) {
        await updateShift(token, {
          id: editingId,
          datum: form.date,
          start: form.start,
          eind: form.end,
          toeslagen: form.toeslagen as ShiftToeslag[],
          notities: form.notities || null,
          gewerkt: form.gewerkt,
        });
      }
      hapticSuccess();
      setSheetOpen(false);
      await laadShifts();
    } catch (e) {
      Alert.alert('Opslaan mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
    } finally {
      setOpslaanBezig(false);
    }
  };

  const handleDelete = (id: number) => {
    if (!magBeheren) return;
    Alert.alert('Shift verwijderen', 'Weet je zeker dat je deze shift wilt verwijderen?', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen', style: 'destructive', onPress: async () => {
          if (!token) return;
          hapticMedium();
          try {
            await deleteShift(token, id);
            await laadShifts();
          } catch (e) {
            Alert.alert('Verwijderen mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
          }
        },
      },
    ]);
  };

  const handleToggleGewerkt = async (id: number) => {
    if (!token || !magBeheren) return;
    const huidig = shifts.find((s) => s.id === id);
    if (!huidig) return;
    const volgende = !huidig.gewerkt;
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, gewerkt: volgende } : s)));
    try {
      await updateShift(token, { id, gewerkt: volgende });
    } catch (e) {
      setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, gewerkt: !volgende } : s)));
      Alert.alert('Mislukt', e instanceof Error ? e.message : 'Bijwerken is mislukt.');
    }
  };

  // ── Memoised header title ───────────────────────────────────────────────────

  const headerTitle = useMemo(() => {
    if (activeTab === 'dag') return selectedDateLabel;
    return `Week ${weekLabel}`;
  }, [activeTab, selectedDateLabel, weekLabel]);

  // ── Tab renders ─────────────────────────────────────────────────────────────

  const renderDagView = () => {
    const dayShifts = shiftsForDate(selectedDate);
    const usersToShow = activeAfdeling ? medewerkers.filter((u) => u.afdeling === activeAfdeling) : medewerkers;
    return (
      <Animated.View style={{ transform: [{ translateX: dagSwipe.translateX }] }} {...dagSwipe.panResponder.panHandlers}>
        {/* Afdeling filter — alleen zinvol voor wie meerdere afdelingen kan
            zien (filiaalmanager); wie geen planning maakt ziet sowieso alleen
            de eigen afdeling (server-side gescoped, zie roster.php/shifts/list.php). */}
        {magBeheren && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 5, paddingVertical: 2 }}>
            <TouchableOpacity
              style={[fStyles.pill, { backgroundColor: activeAfdeling === null ? tint : surface, borderColor: activeAfdeling === null ? tint : border }]}
              onPress={() => { hapticLight(); setActiveAfdeling(null); }}
            >
              <Text style={[fStyles.txt, { color: activeAfdeling === null ? '#fff' : textSecondary }]}>Alle</Text>
            </TouchableOpacity>
            {AFDELINGEN.map((afd) => {
              const c = AFDELING_COLORS[afd]; const on = activeAfdeling === afd;
              return (
                <TouchableOpacity key={afd} style={[fStyles.pill, { backgroundColor: on ? c.bg : surface, borderColor: on ? c.border : border }]}
                  onPress={() => { hapticLight(); setActiveAfdeling(on ? null : afd); }}>
                  <Text style={[fStyles.txt, { color: on ? c.text : textSecondary }]}>{afd}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {AFDELINGEN.filter((afd) => !activeAfdeling || afd === activeAfdeling).map((afd) => {
          const afdUsers = usersToShow.filter((u) => u.afdeling === afd);
          if (afdUsers.length === 0) return null;
          return (
            <View key={afd}>
              <AfdelingHeader afdeling={afd} />
              {afdUsers.map((u) => {
                const shift = dayShifts.find((s) => s.userId === u.id) ?? null;
                const verlof = verlofOp(u.id, selectedDate);
                return (
                  <EmployeeRow
                    key={u.id} user={u} shift={shift} verlofLabel={verlof?.typeLabel ?? null}
                    surface={surface} border={border} textPrimary={textPrimary} textSecondary={textSecondary} tint={tint}
                    readOnly={!magBeheren}
                    onPress={() => shift && openEdit(shift)}
                    onAdd={() => openAdd(u.id)}
                    onLongPress={() => shift && showShiftActions(shift, u.firstname, () => openEdit(shift), () => handleDelete(shift.id), () => handleToggleGewerkt(shift.id))}
                  />
                );
              })}
            </View>
          );
        })}

        {/* Swipe hint */}
        <View style={hintStyles.wrap}>
          <Text style={[hintStyles.txt, { color: textSecondary }]}>← veeg voor andere dag →</Text>
        </View>
      </Animated.View>
    );
  };

  const renderWeekView = () => (
    <Animated.View style={{ transform: [{ translateX: weekSwipe.translateX }] }} {...weekSwipe.panResponder.panHandlers}>
      {weekDays.map((d) => {
        const ds = fmt(d);
        const ss = shiftsForDate(ds);
        const isFeest = FEESTDAGEN.has(ds);
        return (
          <View key={ds}>
            <View style={wStyles.dayHdrRow}>
              <TouchableOpacity onPress={() => { hapticLight(); setSelectedDate(ds); setActiveTab('dag'); }}>
                <Text style={[wStyles.dayHdr, { color: textSecondary }]}>
                  {d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' })}
                </Text>
              </TouchableOpacity>
              {isFeest && <View style={wStyles.feestTag}><Text style={wStyles.feestTxt}>🎉 Feestdag</Text></View>}
            </View>
            {ss.length === 0
              ? <Text style={[wStyles.none, { color: textSecondary }]}>Geen shifts</Text>
              : ss.map((s) => {
                const u = userById(s.userId);
                const hours = calcHours(s.start, s.end);
                const allT = [...new Set([...s.toeslagen, ...computeAutoToeslagen(s.date, s.start, s.end)])];
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[wiStyles.row, { backgroundColor: surface, borderColor: border }]}
                    onPress={() => openEdit(s)}
                    onLongPress={() => showShiftActions(s, u.firstname, () => openEdit(s), () => handleDelete(s.id), () => handleToggleGewerkt(s.id))}
                    delayLongPress={350}
                  >
                    <Avatar user={u} size={30} />
                    <View style={wiStyles.info}>
                      <Text style={[wiStyles.name, { color: textPrimary }]}>{u.firstname.split(' ')[0]}</Text>
                      <AfdelingBadge afdeling={u.afdeling} />
                    </View>
                    <TimelineBar shift={s} userColor={u.color} userColorBg={u.colorBg} isPastShift={isPast(s.date, s.end)} />
                    <View style={wiStyles.right}>
                      <Text style={[wiStyles.hrs, { color: textSecondary }]}>{hours.toFixed(1)}u</Text>
                      <View style={wiStyles.dots}>{allT.slice(0, 3).map((t) => <View key={t} style={[wiStyles.dot, { backgroundColor: TOESLAG_COLORS[t].border }]} />)}</View>
                    </View>
                  </TouchableOpacity>
                );
              })
            }
          </View>
        );
      })}
      <View style={hintStyles.wrap}>
        <Text style={[hintStyles.txt, { color: textSecondary }]}>← veeg voor andere week →</Text>
      </View>
    </Animated.View>
  );

  const renderMedewerkerView = () => (
    <Animated.View style={{ transform: [{ translateX: weekSwipe.translateX }] }} {...weekSwipe.panResponder.panHandlers}>
      {AFDELINGEN.map((afd) => {
        const afdUsers = medewerkers.filter((u) => u.afdeling === afd);
        return (
          <View key={afd}>
            <AfdelingHeader afdeling={afd} />
            {afdUsers.map((u) => {
              const us = shiftsForWeek.filter((s) => s.userId === u.id).sort((a, b) => a.date.localeCompare(b.date));
              const totalH = us.reduce((a, s) => a + calcHours(s.start, s.end), 0);
              return (
                <View key={u.id} style={[mvStyles.card, { backgroundColor: surface, borderColor: border }]}>
                  <View style={mvStyles.top}>
                    <Avatar user={u} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={[mvStyles.name, { color: textPrimary }]}>{u.firstname}</Text>
                      <Text style={[mvStyles.meta, { color: textSecondary }]}>{us.length} shifts · {totalH.toFixed(1)}u deze week</Text>
                    </View>
                    {magBeheren && (
                      <TouchableOpacity style={[mvStyles.addBtn, { borderColor: border }]} onPress={() => openAdd(u.id)}>
                        <Text style={{ color: tint, fontSize: 18, lineHeight: 20 }}>+</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {weekDays.map((d) => {
                    const ds = fmt(d);
                    const shift = us.find((s) => s.date === ds);
                    const past = shift ? isPast(shift.date, shift.end) : false;
                    const autoT = shift ? computeAutoToeslagen(shift.date, shift.start, shift.end) : [];
                    const verlof = !shift ? verlofOp(u.id, ds) : null;
                    return (
                      <TouchableOpacity
                        key={ds}
                        style={[mvStyles.dayRow, { borderTopColor: border }, !!verlof && { opacity: 0.55 }]}
                        onPress={() => shift ? openEdit(shift) : openAdd(u.id, ds)}
                        onLongPress={() => shift && showShiftActions(shift, u.firstname, () => openEdit(shift), () => handleDelete(shift.id), () => handleToggleGewerkt(shift.id))}
                        delayLongPress={350}
                        disabled={!shift && !magBeheren}
                      >
                        <Text style={[mvStyles.dayLbl, { color: textSecondary }]}>
                          {d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric' })}
                        </Text>
                        <View style={mvStyles.tlWrap}>
                          <TimelineBar shift={shift ?? null} userColor={u.color} userColorBg={u.colorBg} isPastShift={past} />
                        </View>
                        <Text style={[mvStyles.hrsLbl, { color: shift ? textPrimary : textSecondary }]} numberOfLines={1}>
                          {shift ? `${calcHours(shift.start, shift.end).toFixed(1)}u` : verlof ? '🌴' : '—'}
                        </Text>
                        {autoT.length > 0 && (
                          <View style={mvStyles.dotRow}>{autoT.slice(0, 2).map((t) => <View key={t} style={[mvStyles.tDot, { backgroundColor: TOESLAG_COLORS[t].border }]} />)}</View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </View>
        );
      })}
      <View style={hintStyles.wrap}>
        <Text style={[hintStyles.txt, { color: textSecondary }]}>← veeg voor andere week →</Text>
      </View>
    </Animated.View>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <ThemedView style={[styles.container, { backgroundColor: pageBg }]}>
      <ScreenHeader title="Planning" />

      {/* Periode-navigatie */}
      <View style={[styles.periodeNav, { backgroundColor: pageBg }]}>
        <TouchableOpacity
          style={[styles.navBtn, { borderColor: border, backgroundColor: surface }]}
          onPress={() => { hapticLight(); if (activeTab === 'dag') goPrevDay(); else goPrevWeek(); }}
        >
          <Text style={{ color: textPrimary, fontSize: 15 }}>‹</Text>
        </TouchableOpacity>

        {/* Tappable title — tap to jump to today */}
        <TouchableOpacity
          style={styles.titleWrap}
          onPress={() => {
            hapticLight();
            const t = fmt(new Date());
            setSelectedDate(t);
            setWeekStart(getWeekStart(new Date()));
            setActiveTab('dag');
          }}
        >
          <ThemedText style={styles.headerTitle} numberOfLines={1}>{headerTitle}</ThemedText>
          {isToday(selectedDate) && activeTab === 'dag' && (
            <View style={[styles.todayDot, { backgroundColor: tint }]} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navBtn, { borderColor: border, backgroundColor: surface }]}
          onPress={() => { hapticLight(); if (activeTab === 'dag') goNextDay(); else goNextWeek(); }}
        >
          <Text style={{ color: textPrimary, fontSize: 15 }}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day strip */}
      <View style={{ marginBottom: 10 }}>
        <DayStrip
          weekStart={weekStart}
          selectedDate={selectedDate}
          shifts={shifts}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          tint={tint}
          border={border}
          surface={surface}
          onSelect={(d) => { setSelectedDate(d); if (activeTab !== 'dag') setActiveTab('dag'); }}
        />
      </View>

      {/* iOS Segmented Control */}
      <SegmentedControl
        tabs={[{ key: 'dag', label: 'Dag' }, { key: 'week', label: 'Week' }, { key: 'medewerker', label: 'Medewerker' }]}
        active={activeTab}
        surface={surface}
        border={border}
        tint={tint}
        textSecondary={textSecondary}
        onChange={setActiveTab}
      />

      {/* Summary */}
      <SummaryStrip
        shifts={summaryShifts}
        date={activeTab === 'dag' ? selectedDate : undefined}
        surface={surface}
        border={border}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
      />

      {/* Content */}
      {laden ? (
        <View style={styles.laadWrap}>
          <ActivityIndicator color={tint} />
        </View>
      ) : fout ? (
        <View style={styles.laadWrap}>
          <Text style={[styles.foutTekst, { color: p.danger }]}>{fout}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { backgroundColor: pageBg }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
        >
          {activeTab === 'dag' && renderDagView()}
          {activeTab === 'week' && renderWeekView()}
          {activeTab === 'medewerker' && renderMedewerkerView()}
        </ScrollView>
      )}

      {/* FAB — add shift */}
      {magBeheren && (
        <TouchableOpacity
          style={[fabStyles.fab, { backgroundColor: tint }]}
          onPress={() => { hapticMedium(); openAdd(); }}
          accessibilityLabel="Shift toevoegen"
        >
          <Text style={fabStyles.icon}>+</Text>
        </TouchableOpacity>
      )}

      <ShiftFormSheet
        visible={sheetOpen} mode={sheetMode} form={form} users={medewerkers}
        surface={surface} border={border} textPrimary={textPrimary} textSecondary={textSecondary}
        tint={tint} inputBg={inputBg} opslaanBezig={opslaanBezig}
        onClose={() => setSheetOpen(false)} onSave={handleSave}
        onDelete={() => { setSheetOpen(false); if (editingId !== null) handleDelete(editingId); }}
        onChangeForm={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
      />
    </ThemedView>
  );
}

// ─── Remaining styles ─────────────────────────────────────────────────────────

const fStyles = StyleSheet.create({
  pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 0.5 },
  txt: { fontSize: 12, fontWeight: '500', fontFamily: 'Montserrat' },
});

const wStyles = StyleSheet.create({
  dayHdrRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 6 },
  dayHdr: { fontSize: 11, fontWeight: '600', fontFamily: 'Montserrat', textTransform: 'capitalize', letterSpacing: 0.4 },
  feestTag: { backgroundColor: '#F0FBF0', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  feestTxt: { fontSize: 10, color: '#1A5C1A', fontWeight: '500', fontFamily: 'Montserrat' },
  none: { fontSize: 11, fontFamily: 'Montserrat', fontStyle: 'italic', marginBottom: 8, opacity: 0.45 },
});

const wiStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 0.5, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 5 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 5, width: 90 },
  name: { fontSize: 11, fontWeight: '500', fontFamily: 'Montserrat' },
  right: { alignItems: 'flex-end', gap: 3, minWidth: 30 },
  hrs: { fontSize: 10, fontFamily: 'Montserrat' },
  dots: { flexDirection: 'row', gap: 2 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});

const mvStyles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 0.5, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6, marginBottom: 8, ...(Shadow.card as object) },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  name: { fontSize: 13, fontWeight: '600', fontFamily: 'Montserrat' },
  meta: { fontSize: 11, fontFamily: 'Montserrat', marginTop: 1 },
  addBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: 0.5 },
  dayLbl: { fontSize: 10, fontFamily: 'Montserrat', width: 46 },
  tlWrap: { flex: 1 },
  hrsLbl: { fontSize: 10, fontFamily: 'Montserrat', fontWeight: '500', width: 28, textAlign: 'right' },
  dotRow: { flexDirection: 'row', gap: 2, width: 14 },
  tDot: { width: 5, height: 5, borderRadius: 2.5 },
});

const fabStyles = StyleSheet.create({
  fab: {
    position: 'absolute', right: 20, bottom: 32,
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#534AB7', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  icon: { color: '#fff', fontSize: 28, lineHeight: 30, fontWeight: '300' },
});

const hintStyles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 16 },
  txt: { fontSize: 11, fontFamily: 'Montserrat', opacity: 0.5 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  periodeNav: { height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  headerTitle: { fontSize: 14, fontWeight: '600', letterSpacing: 0.1, fontFamily: 'Montserrat' },
  todayDot: { width: 6, height: 6, borderRadius: 3, marginTop: 1 },
  navBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 14, paddingBottom: 100, gap: 0 },
  laadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  foutTekst: { fontSize: 13, fontFamily: 'Montserrat', textAlign: 'center', paddingHorizontal: 24 },
});

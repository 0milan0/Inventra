import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, getPalette, Radius, Shadow, Spacing } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { getDepartementInfo } from '@/data/store-map';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  addTaakChecklistItem,
  addTaakReactie,
  ApiTaakDetail,
  deleteTask,
  getTask,
  Prioriteit,
  removeTaakChecklistItem,
  TaakActiviteitType,
  TaakStatus,
  toggleTaakChecklistItem,
  updateTask,
} from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const F = FontFamily;

const statusLabel: Record<TaakStatus, string> = {
  Todo: 'Open',
  active: 'In uitvoering',
  finish: 'Afgerond',
};

const statusProgress: Record<TaakStatus, number> = {
  Todo: 0.15,
  active: 0.55,
  finish: 1,
};

const statusOrder: TaakStatus[] = ['Todo', 'active', 'finish'];

const priorityLabel: Record<Prioriteit, string> = {
  hoog: 'Hoog',
  midden: 'Midden',
  laag: 'Laag',
};

const activiteitLabel: Record<TaakActiviteitType, string> = {
  created: 'Taak aangemaakt',
  status_changed: 'Status gewijzigd',
  assigned: 'Taak toegewezen',
  comment: 'Reactie geplaatst',
};

function formatTijd(iso: string) {
  return new Date(iso.replace(' ', 'T')).toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function formatDatum(iso: string) {
  const datum = new Date(iso);
  const datumStr = datum.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  const heeftTijd = datum.getHours() !== 0 || datum.getMinutes() !== 0;
  if (!heeftTijd) return datumStr;
  const tijdStr = datum.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  return `${datumStr}, ${tijdStr}`;
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const taskId = Number(id);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const p = getPalette(isDark);

  const priorityColor: Record<Prioriteit, string> = {
    hoog: p.danger,
    midden: p.warning,
    laag: p.success,
  };

  const [task, setTask] = useState<ApiTaakDetail | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  const [newCheckItem, setNewCheckItem] = useState('');
  const [checklistBezig, setChecklistBezig] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [notitieBezig, setNotitieBezig] = useState(false);
  const [activeReplyId, setActiveReplyId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');

  const [bewerkenOpen, setBewerkenOpen] = useState(false);
  const [bewerkTitel, setBewerkTitel] = useState('');
  const [bewerkBeschrijving, setBewerkBeschrijving] = useState('');
  const [opslaanBezig, setOpslaanBezig] = useState(false);
  const [verwijderenBezig, setVerwijderenBezig] = useState(false);

  const laadTaak = useCallback(async () => {
    if (!token || !Number.isFinite(taskId)) return;
    setFout(null);
    try {
      setTask(await getTask(token, taskId));
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Taak laden is mislukt.');
    }
  }, [token, taskId]);

  useEffect(() => {
    (async () => {
      setLaden(true);
      await laadTaak();
      setLaden(false);
    })();
  }, [laadTaak]);

  const progress = useMemo(() => statusProgress[task?.status ?? 'Todo'], [task?.status]);

  async function wijzigStatus(nieuweStatus: TaakStatus) {
    if (!token || !task) return;
    try {
      await updateTask(token, { taskId: task.id, status: nieuweStatus });
      await laadTaak();
    } catch (e) {
      Alert.alert('Opslaan mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
    }
  }

  async function addChecklistItem() {
    if (!token || !task) return;
    const trimmed = newCheckItem.trim();
    if (!trimmed) return;
    setChecklistBezig(true);
    try {
      await addTaakChecklistItem(token, task.id, trimmed);
      setNewCheckItem('');
      await laadTaak();
    } catch (e) {
      Alert.alert('Toevoegen mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
    } finally {
      setChecklistBezig(false);
    }
  }

  async function toggleChecklistItem(itemId: number) {
    if (!token || !task) return;
    try {
      await toggleTaakChecklistItem(token, task.id, itemId);
      await laadTaak();
    } catch (e) {
      Alert.alert('Bijwerken mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
    }
  }

  async function removeChecklistItem(itemId: number) {
    if (!token || !task) return;
    try {
      await removeTaakChecklistItem(token, task.id, itemId);
      await laadTaak();
    } catch (e) {
      Alert.alert('Verwijderen mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
    }
  }

  async function addNote() {
    if (!token || !task) return;
    const trimmed = newNote.trim();
    if (!trimmed) return;
    setNotitieBezig(true);
    try {
      await addTaakReactie(token, task.id, trimmed);
      setNewNote('');
      await laadTaak();
    } catch (e) {
      Alert.alert('Plaatsen mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
    } finally {
      setNotitieBezig(false);
    }
  }

  function toggleReplyComposer(noteId: number) {
    setActiveReplyId((prev) => (prev === noteId ? null : noteId));
    setReplyText('');
  }

  async function addReply(noteId: number) {
    if (!token || !task) return;
    const trimmed = replyText.trim();
    if (!trimmed) return;
    setNotitieBezig(true);
    try {
      await addTaakReactie(token, task.id, trimmed, noteId);
      setReplyText('');
      setActiveReplyId(null);
      await laadTaak();
    } catch (e) {
      Alert.alert('Plaatsen mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
    } finally {
      setNotitieBezig(false);
    }
  }

  function startBewerken() {
    if (!task) return;
    setBewerkTitel(task.titel);
    setBewerkBeschrijving(task.beschrijving ?? '');
    setBewerkenOpen(true);
  }

  async function opslaanBewerking() {
    if (!token || !task) return;
    if (!bewerkTitel.trim()) {
      Alert.alert('Titel ontbreekt', 'Vul een titel in.');
      return;
    }
    setOpslaanBezig(true);
    try {
      await updateTask(token, { taskId: task.id, titel: bewerkTitel.trim(), beschrijving: bewerkBeschrijving.trim() });
      setBewerkenOpen(false);
      await laadTaak();
    } catch (e) {
      Alert.alert('Opslaan mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
    } finally {
      setOpslaanBezig(false);
    }
  }

  function confirmDelete() {
    if (!task) return;
    Alert.alert(
      'Taak verwijderen',
      'Weet je zeker dat je deze taak wilt verwijderen? Dit kan niet ongedaan worden gemaakt.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Verwijderen',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            setVerwijderenBezig(true);
            try {
              await deleteTask(token, task.id);
              router.back();
            } catch (e) {
              Alert.alert('Verwijderen mislukt', e instanceof Error ? e.message : 'Er ging iets mis.');
              setVerwijderenBezig(false);
            }
          },
        },
      ]
    );
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

  if (fout || !task) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
        <SafeAreaView style={styles.center}>
          <Ionicons name="alert-circle-outline" size={70} color={p.textMuted} />
          <ThemedText style={styles.notFoundTitle}>{fout ?? 'Taak niet gevonden'}</ThemedText>
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

  const category = getDepartementInfo(task.afdeling);
  const toegewezenNamen = [
    ...(task.toegewezenAan ? [task.toegewezenAan.naam] : []),
    ...task.extraToegewezenen.map((t) => t.naam),
  ];
  const toegewezenLabel = toegewezenNamen.length > 0 ? toegewezenNamen.join(', ') : undefined;
  const topNotities = task.reacties.filter((r) => r.parentId === null);
  const replyVan = (noteId: number) => task.reacties.filter((r) => r.parentId === noteId);

  return (
    <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* HEADER */}
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[styles.header, { borderBottomColor: p.border }]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.iconBtn, { backgroundColor: p.surface, borderColor: p.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={p.text} />
          </TouchableOpacity>

          <ThemedText style={styles.headerTitle} numberOfLines={1}>Taak</ThemedText>
        </Animated.View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 + insets.bottom }}
        >
          {/* HERO */}
          <Animated.View entering={FadeInDown.delay(100)} style={styles.heroSection}>
            <View style={[styles.chip, styles.heroChip, { backgroundColor: category.tekst + '1f' }]}>
              <Text style={[styles.chipText, { color: category.tekst }]}>{category.label}</Text>
            </View>

            {bewerkenOpen ? (
              <>
                <TextInput
                  value={bewerkTitel}
                  onChangeText={setBewerkTitel}
                  style={[styles.editTitelInput, { color: p.text, borderColor: p.border }]}
                  placeholder="Titel"
                  placeholderTextColor={p.textMuted}
                />
                <TextInput
                  value={bewerkBeschrijving}
                  onChangeText={setBewerkBeschrijving}
                  style={[styles.editBeschrijvingInput, { color: p.text, borderColor: p.border }]}
                  placeholder="Beschrijving"
                  placeholderTextColor={p.textMuted}
                  multiline
                />
                <View style={styles.editActieRow}>
                  <TouchableOpacity
                    onPress={() => setBewerkenOpen(false)}
                    style={[styles.editCancelBtn, { borderColor: p.border }]}
                    disabled={opslaanBezig}
                  >
                    <Text style={[styles.editCancelTxt, { color: p.textSecondary }]}>Annuleren</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={opslaanBewerking}
                    style={[styles.editSaveBtn, { backgroundColor: p.accent, opacity: opslaanBezig ? 0.7 : 1 }]}
                    disabled={opslaanBezig}
                  >
                    {opslaanBezig ? <ActivityIndicator size="small" color="#fff" /> : (
                      <Text style={styles.editSaveTxt}>Opslaan</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.heroTitle, { color: p.text }]}>{task.titel}</Text>
                {!!task.beschrijving && (
                  <Text style={[styles.heroDescription, { color: p.textSecondary }]}>
                    {task.beschrijving}
                  </Text>
                )}
              </>
            )}

            <View style={styles.chipRow}>
              {task.prioriteit && (
                <View style={[styles.chip, { backgroundColor: priorityColor[task.prioriteit] + '1f' }]}>
                  <Ionicons name="flag" size={11} color={priorityColor[task.prioriteit]} />
                  <Text style={[styles.chipText, { color: priorityColor[task.prioriteit], marginLeft: Spacing.xs }]}>
                    {priorityLabel[task.prioriteit]}
                  </Text>
                </View>
              )}

              <View style={[styles.chip, { backgroundColor: p.accentSoft }]}>
                <Text style={[styles.chipText, { color: p.accent }]}>{statusLabel[task.status]}</Text>
              </View>
            </View>

            <View style={styles.progressWrap}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, { color: p.textMuted }]}>Voortgang</Text>
                <Text style={[styles.progressLabel, { color: p.textMuted }]}>{Math.round(progress * 100)}%</Text>
              </View>

              <View style={[styles.progressBackground, { backgroundColor: p.divider }]}>
                <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: p.accent }]} />
              </View>
            </View>
          </Animated.View>

          {/* STATUS SELECTOR */}
          <Animated.View entering={FadeInDown.delay(150)} style={styles.sectionWrap}>
            <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Status</Text>

            <View style={styles.statusRow}>
              {statusOrder.map((s) => {
                const active = task.status === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => task.magBewerken && wijzigStatus(s)}
                    disabled={!task.magBewerken}
                    style={[
                      styles.statusItem,
                      {
                        borderColor: active ? p.accent : p.border,
                        backgroundColor: active ? p.accentSoft : p.surface,
                        opacity: task.magBewerken ? 1 : 0.5,
                      },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: active ? p.accent : p.text }]}>
                      {statusLabel[s]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {!task.magBewerken && (
              <Text style={[styles.permissionHint, { color: p.textMuted }]}>
                Alleen toegewezen medewerkers, de afdeling of een manager kunnen de status wijzigen.
              </Text>
            )}
          </Animated.View>

          {/* DETAILS */}
          {(task.startTime || task.deadline || toegewezenLabel || task.product) && (
            <Animated.View entering={FadeInDown.delay(200)} style={styles.sectionWrap}>
              <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Details</Text>

              <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                {task.startTime && (
                  <InfoRow
                    icon="play-outline"
                    label="Starttijd"
                    value={formatDatum(task.startTime)}
                    last={!task.deadline && !toegewezenLabel && !task.product}
                    p={p}
                  />
                )}
                {task.deadline && (
                  <InfoRow
                    icon="calendar-outline"
                    label="Deadline"
                    value={formatDatum(task.deadline)}
                    last={!toegewezenLabel && !task.product}
                    p={p}
                  />
                )}
                {toegewezenLabel && (
                  <InfoRow
                    icon="person-outline"
                    label="Toegewezen aan"
                    value={toegewezenLabel}
                    last={!task.product}
                    p={p}
                  />
                )}
                {task.product && (
                  <InfoRow icon="barcode-outline" label="Product" value={`${task.product.naam} · ${task.product.barcode}`} last p={p} />
                )}
              </View>
            </Animated.View>
          )}

          {/* CHECKLIST */}
          <Animated.View entering={FadeInDown.delay(250)} style={styles.sectionWrap}>
            <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Checklist</Text>

            <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
              {task.checklist.length === 0 && (
                <Text style={[styles.emptyHint, { color: p.textMuted }]}>Nog geen checklist-items.</Text>
              )}

              {task.checklist.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.checkItem,
                    index !== task.checklist.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.divider },
                  ]}
                >
                  <Pressable
                    onPress={() => task.magBewerken && toggleChecklistItem(item.id)}
                    disabled={!task.magBewerken}
                    style={styles.checkItemMain}
                  >
                    <Ionicons
                      name={item.gedaan ? 'checkbox' : 'square-outline'}
                      size={19}
                      color={item.gedaan ? p.success : p.textSecondary}
                    />
                    <Text
                      style={[
                        styles.checkText,
                        {
                          color: p.text,
                          textDecorationLine: item.gedaan ? 'line-through' : 'none',
                          opacity: item.gedaan ? 0.5 : 1,
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>

                  {task.magBewerken && (
                    <TouchableOpacity onPress={() => removeChecklistItem(item.id)} hitSlop={8}>
                      <Ionicons name="close" size={17} color={p.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {task.magBewerken && (
                <View
                  style={[
                    styles.addRow,
                    task.checklist.length > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.divider },
                  ]}
                >
                  <TextInput
                    value={newCheckItem}
                    onChangeText={setNewCheckItem}
                    placeholder="Nieuw item toevoegen..."
                    placeholderTextColor={p.textMuted}
                    style={[styles.addInput, { color: p.text }]}
                    returnKeyType="done"
                    onSubmitEditing={addChecklistItem}
                    editable={!checklistBezig}
                  />
                  <TouchableOpacity
                    onPress={addChecklistItem}
                    disabled={!newCheckItem.trim() || checklistBezig}
                    style={[styles.addIconBtn, { backgroundColor: p.accentSoft, opacity: newCheckItem.trim() ? 1 : 0.5 }]}
                  >
                    {checklistBezig ? <ActivityIndicator size="small" color={p.accent} /> : (
                      <Ionicons name="add" size={18} color={p.accent} />
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {!task.magBewerken && (
              <Text style={[styles.permissionHint, { color: p.textMuted }]}>
                Alleen toegewezen medewerkers, de afdeling of een manager kunnen de checklist bijwerken.
              </Text>
            )}
          </Animated.View>

          {/* OPMERKINGEN */}
          <Animated.View entering={FadeInDown.delay(300)} style={styles.sectionWrap}>
            <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Opmerkingen</Text>

            <View style={[styles.card, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
              {topNotities.length === 0 && (
                <Text style={[styles.emptyHint, { color: p.textMuted }]}>Nog geen opmerkingen.</Text>
              )}

              {topNotities.map((note, index) => {
                const replies = replyVan(note.id);
                return (
                  <View
                    key={note.id}
                    style={[
                      styles.noteItem,
                      index !== topNotities.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.divider },
                    ]}
                  >
                    <View style={styles.noteHeader}>
                      <Avatar naam={note.auteurNaam} foto={note.auteurFoto} size={26} p={p} />
                      <Text style={[styles.noteAuthor, { color: p.text, flex: 1 }]}>{note.auteurNaam}</Text>
                      <Text style={[styles.noteTime, { color: p.textMuted }]}>{formatTijd(note.tijd)}</Text>
                    </View>
                    <Text style={[styles.noteText, { color: p.textSecondary }]}>{note.tekst}</Text>

                    {replies.length > 0 && (
                      <View style={[styles.replyList, { borderLeftColor: p.divider }]}>
                        {replies.map((reactie) => (
                          <View key={reactie.id} style={styles.replyItem}>
                            <View style={styles.noteHeader}>
                              <Avatar naam={reactie.auteurNaam} foto={reactie.auteurFoto} size={20} p={p} />
                              <Text style={[styles.replyAuthor, { color: p.text, flex: 1 }]}>{reactie.auteurNaam}</Text>
                              <Text style={[styles.noteTime, { color: p.textMuted }]}>{formatTijd(reactie.tijd)}</Text>
                            </View>
                            <Text style={[styles.replyText, { color: p.textSecondary }]}>{reactie.tekst}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <Pressable onPress={() => toggleReplyComposer(note.id)} hitSlop={6}>
                      <Text style={[styles.replyToggle, { color: p.accent }]}>
                        {activeReplyId === note.id ? 'Annuleren' : 'Reageren'}
                      </Text>
                    </Pressable>

                    {activeReplyId === note.id && (
                      <View style={styles.replyComposerRow}>
                        <TextInput
                          value={replyText}
                          onChangeText={setReplyText}
                          placeholder="Schrijf een reactie..."
                          placeholderTextColor={p.textMuted}
                          style={[styles.replyInput, { color: p.text }]}
                          multiline
                          autoFocus
                          editable={!notitieBezig}
                        />
                        <TouchableOpacity
                          onPress={() => addReply(note.id)}
                          disabled={!replyText.trim() || notitieBezig}
                          style={[styles.replyIconBtn, { backgroundColor: p.accentSoft, opacity: replyText.trim() ? 1 : 0.5 }]}
                        >
                          <Ionicons name="send" size={13} color={p.accent} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}

              <View
                style={[
                  styles.addRow,
                  topNotities.length > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.divider },
                ]}
              >
                <TextInput
                  value={newNote}
                  onChangeText={setNewNote}
                  placeholder="Opmerking toevoegen..."
                  placeholderTextColor={p.textMuted}
                  style={[styles.addInput, { color: p.text }]}
                  multiline
                  returnKeyType="default"
                  editable={!notitieBezig}
                />
                <TouchableOpacity
                  onPress={addNote}
                  disabled={!newNote.trim() || notitieBezig}
                  style={[styles.addIconBtn, { backgroundColor: p.accentSoft, opacity: newNote.trim() ? 1 : 0.5 }]}
                >
                  {notitieBezig ? <ActivityIndicator size="small" color={p.accent} /> : (
                    <Ionicons name="send" size={15} color={p.accent} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* ACTIVITEIT */}
          <Animated.View entering={FadeInDown.delay(350)} style={styles.sectionWrap}>
            <Text style={[styles.sectionLabel, { color: p.textMuted }]}>Activiteit</Text>

            <View style={[styles.card, Shadow.card, styles.timeline, { backgroundColor: p.surface, borderColor: p.border }]}>
              {task.activiteit.map((item, index) => (
                <View key={item.id} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, { backgroundColor: p.accent }]} />
                    {index !== task.activiteit.length - 1 && <View style={[styles.timelineLine, { backgroundColor: p.border }]} />}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.timelineTitle, { color: p.text }]}>
                      {item.type === 'status_changed' && item.detail
                        ? `Status gewijzigd naar ${statusLabel[item.detail as TaakStatus] ?? item.detail}`
                        : activiteitLabel[item.type]}
                      {' · '}{item.accountNaam}
                    </Text>
                    <Text style={[styles.timelineTime, { color: p.textMuted }]}>{formatTijd(item.tijd)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        </ScrollView>

        {/* BOTTOM ACTION BAR */}
        <View
          style={[
            styles.bottomBar,
            { backgroundColor: p.bg, borderTopColor: p.border, paddingBottom: insets.bottom + Spacing.md },
          ]}
        >
          {task.magVerwijderen && (
            <TouchableOpacity
              onPress={confirmDelete}
              disabled={verwijderenBezig}
              style={[styles.iconOnlyButton, { borderColor: p.dangerSoft, backgroundColor: p.dangerSoft }]}
            >
              {verwijderenBezig ? <ActivityIndicator size="small" color={p.danger} /> : (
                <Ionicons name="trash-outline" size={18} color={p.danger} />
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            disabled={!task.magBewerken || bewerkenOpen}
            onPress={startBewerken}
            style={[styles.secondaryButton, { borderColor: p.border, opacity: task.magBewerken && !bewerkenOpen ? 1 : 0.4 }]}
          >
            <Ionicons name="create-outline" size={17} color={p.text} />
            <Text style={[styles.secondaryButtonText, { color: p.text }]}>Bewerken</Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={!task.magBewerken || task.status === 'finish'}
            onPress={() => wijzigStatus('finish')}
            style={[styles.primaryBottomButton, { backgroundColor: p.accent, opacity: task.magBewerken && task.status !== 'finish' ? 1 : 0.4 }]}
          >
            <Ionicons name="checkmark" size={17} color="#fff" />
            <Text style={styles.primaryBottomButtonText}>Voltooien</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function Avatar({
  naam,
  foto,
  size,
  p,
}: {
  naam: string;
  foto: string | null;
  size: number;
  p: ReturnType<typeof getPalette>;
}) {
  const initialen = naam
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((deel) => deel[0])
    .join('')
    .toUpperCase();

  if (foto) {
    return <Image source={{ uri: foto }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: p.accentSoft },
      ]}
    >
      <Text style={[styles.avatarInitialen, { color: p.accent, fontSize: size * 0.4 }]}>{initialen}</Text>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last,
  p,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  last?: boolean;
  p: ReturnType<typeof getPalette>;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.divider },
      ]}
    >
      <View style={[styles.infoIconWrap, { backgroundColor: p.surfaceAlt }]}>
        <Ionicons name={icon} size={15} color={p.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: p.textMuted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: p.text }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, gap: Spacing.md },

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

  heroSection: { marginBottom: Spacing.xl },
  heroChip: { alignSelf: 'flex-start', marginBottom: Spacing.sm },
  heroTitle: { fontSize: 18, fontWeight: '700', lineHeight: 24, fontFamily: F },
  heroDescription: { marginTop: Spacing.xs, fontSize: 13, lineHeight: 18, fontFamily: F },

  editTitelInput: { fontSize: 18, fontWeight: '700', lineHeight: 24, fontFamily: F, borderBottomWidth: 1, paddingVertical: 4 },
  editBeschrijvingInput: { marginTop: Spacing.sm, fontSize: 13, lineHeight: 18, fontFamily: F, borderWidth: 0.5, borderRadius: Radius.sm, padding: Spacing.sm, minHeight: 60, textAlignVertical: 'top' },
  editActieRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  editCancelBtn: { flex: 1, borderWidth: 0.5, borderRadius: Radius.sm, paddingVertical: 9, alignItems: 'center' },
  editCancelTxt: { fontSize: 12.5, fontWeight: '600', fontFamily: F },
  editSaveBtn: { flex: 1, borderRadius: Radius.sm, paddingVertical: 9, alignItems: 'center' },
  editSaveTxt: { color: '#fff', fontSize: 12.5, fontWeight: '600', fontFamily: F },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.pill, paddingHorizontal: 11, paddingVertical: 6 },
  chipText: { fontSize: 11.5, fontWeight: '700', fontFamily: F },

  progressWrap: { marginTop: Spacing.lg },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  progressLabel: { fontSize: 11, fontWeight: '600', fontFamily: F },
  progressBackground: { height: 4, borderRadius: Radius.pill, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: Radius.pill },

  sectionWrap: { marginBottom: Spacing.xl },
  sectionLabel: {
    fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: Spacing.sm, paddingHorizontal: 2, fontFamily: F,
  },
  permissionHint: { fontSize: 11.5, fontStyle: 'italic', marginTop: Spacing.sm, paddingHorizontal: 2, fontFamily: F },

  card: { borderRadius: Radius.lg, borderWidth: 0.5, overflow: 'hidden' },

  statusRow: { flexDirection: 'row', gap: Spacing.sm },
  statusItem: { flex: 1, paddingVertical: Spacing.md - 1, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center' },
  statusText: { fontWeight: '600', fontSize: 12.5, fontFamily: F },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  infoIconWrap: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: F },
  infoValue: { fontSize: 14, fontWeight: '600', marginTop: 1, fontFamily: F },

  checkItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  checkItemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  checkText: { flex: 1, fontSize: 13.5, fontFamily: F },

  noteItem: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitialen: { fontWeight: '700', fontFamily: F },
  noteAuthor: { fontWeight: '600', fontSize: 12.5, fontFamily: F },
  noteTime: { fontSize: 10.5, fontFamily: F },
  noteText: { marginTop: 3, fontSize: 13, lineHeight: 18, fontFamily: F },

  replyToggle: { marginTop: Spacing.xs + 2, fontSize: 11.5, fontWeight: '600', fontFamily: F },

  replyList: { marginTop: Spacing.sm, marginLeft: Spacing.xs, paddingLeft: Spacing.md, borderLeftWidth: 2, gap: Spacing.sm },
  replyItem: {},
  replyAuthor: { fontWeight: '600', fontSize: 11.5, fontFamily: F },
  replyText: { marginTop: 2, fontSize: 12, lineHeight: 16, fontFamily: F },

  replyComposerRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xs,
    marginTop: Spacing.sm, marginLeft: Spacing.md,
  },
  replyInput: { flex: 1, fontSize: 12.5, fontFamily: F, paddingVertical: 2, maxHeight: 70 },
  replyIconBtn: { width: 26, height: 26, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },

  emptyHint: { fontSize: 12.5, fontStyle: 'italic', padding: Spacing.md, fontFamily: F },

  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  addInput: { flex: 1, fontSize: 13.5, fontFamily: F, paddingVertical: Spacing.xs, maxHeight: 90 },
  addIconBtn: { width: 30, height: 30, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },

  timeline: { padding: Spacing.md },
  timelineItem: { flexDirection: 'row', paddingVertical: Spacing.sm },
  timelineLeft: { alignItems: 'center', marginRight: Spacing.md, width: 10 },
  timelineDot: { width: 8, height: 8, borderRadius: 4 },
  timelineLine: { flex: 1, width: 1, marginTop: 4, minHeight: 20 },
  timelineTitle: { fontWeight: '600', fontSize: 13, fontFamily: F },
  timelineTime: { marginTop: 2, fontSize: 11, fontFamily: F },

  bottomBar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    gap: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  iconOnlyButton: {
    width: 48, height: 48, borderRadius: Radius.md, borderWidth: 0.5,
    alignItems: 'center', justifyContent: 'center',
  },

  secondaryButton: {
    flex: 1,
    borderWidth: 1, borderRadius: Radius.md, height: 48,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.xs + 2,
  },
  secondaryButtonText: { fontWeight: '600', fontSize: 13.5, fontFamily: F },

  primaryBottomButton: {
    flex: 1, height: 48, borderRadius: Radius.md,
    justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: Spacing.xs + 2,
  },
  primaryBottomButtonText: { color: '#fff', fontWeight: '600', fontSize: 13.5, fontFamily: F },

  primaryButton: { borderRadius: Radius.md, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 13.5, fontFamily: F },

  notFoundTitle: { fontWeight: '600', fontSize: 16 },
});

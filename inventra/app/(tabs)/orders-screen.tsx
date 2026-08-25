import { ScreenHeader } from '@/components/screen-header';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, getPalette, Radius, Shadow, Spacing } from '@/constants/design-tokens';
import {
  ALL_ORDERS,
  getOrderStats,
  STATUS_FILTERS,
  statusTag,
  type Order,
  type OrderStatus,
} from '@/data/order-data';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const F = FontFamily;
type Palette = ReturnType<typeof getPalette>;

const FILTER_LABEL: Record<OrderStatus, string> = {
  geplaatst: 'Geplaatst',
  bevestigd: 'Bevestigd',
  onderweg: 'Onderweg',
  geleverd: 'Geleverd',
  verlopen: 'Verlopen',
};

const euro = (n: number) =>
  n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

// ─── Sectiekop ────────────────────────────────────────────────────────────────

function SectionHeader({ titel, meta, p, kleur }: { titel: string; meta: string; p: Palette; kleur?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: kleur ?? p.text }]}>{titel}</Text>
      <Text style={[styles.sectionMeta, { color: p.textMuted }]}>{meta}</Text>
    </View>
  );
}

// ─── Order card ───────────────────────────────────────────────────────────────

function OrderCard({ order, onPress, p }: { order: Order; onPress: () => void; p: Palette }) {
  const tag = statusTag(order.status, p);
  const accentRand = order.status === 'verlopen' ? p.danger : order.accent;

  return (
    <TouchableOpacity
      style={[
        styles.orderCard,
        Shadow.card,
        { backgroundColor: p.surface, borderColor: p.border, borderLeftColor: accentRand },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.orderTop}>
          <View style={[styles.orderIcon, { backgroundColor: order.iconBg }]}>
            <Text style={styles.orderIconEmoji}>{order.icon}</Text>
          </View>
          <View style={styles.orderInfo}>
            <Text style={[styles.orderSupplier, { color: p.text }]} numberOfLines={1}>
              {order.supplier}
            </Text>
            <Text style={[styles.orderSubtitle, { color: p.textSecondary }]} numberOfLines={1}>
              {order.subtitle}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: tag.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: tag.dot }]} />
            <Text style={[styles.statusPillText, { color: tag.text }]}>{tag.label}</Text>
          </View>
        </View>

        <View style={[styles.orderDivider, { backgroundColor: p.divider }]} />

        <View style={styles.orderBottom}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.orderMeta, { color: p.textMuted }]}>
              {order.orderNumber} · {order.date}
            </Text>
            {order.status !== 'geleverd' && order.status !== 'verlopen' && (
              <View style={styles.progressRow}>
                <View style={[styles.progressTrack, { backgroundColor: p.divider }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${order.progress}%` as `${number}%`, backgroundColor: order.accent },
                    ]}
                  />
                </View>
                <Text style={[styles.progressLabel, { color: p.textMuted }]}>{order.progress}%</Text>
              </View>
            )}
          </View>
          <Text style={[styles.orderAmount, { color: p.text }]}>{order.amount}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={p.textMuted} style={{ marginLeft: Spacing.sm }} />
    </TouchableOpacity>
  );
}

// ─── Lege staat ───────────────────────────────────────────────────────────────

function EmptyState({ p }: { p: Palette }) {
  return (
    <View style={[styles.emptyCard, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Ionicons name="file-tray-outline" size={26} color={p.textMuted} />
      <Text style={[styles.emptyTitle, { color: p.text }]}>Geen bestellingen gevonden</Text>
      <Text style={[styles.emptyBody, { color: p.textSecondary }]}>Probeer een andere zoekterm of filter.</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OrdersScreen() {
  const [zoek, setZoek] = useState('');
  const [filter, setFilter] = useState<'alle' | OrderStatus>('alle');
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const p = getPalette(isDark);

  const stats = useMemo(() => getOrderStats(ALL_ORDERS), []);

  const filterChips = useMemo(
    () => [
      { key: 'alle' as const, label: 'Alle', count: ALL_ORDERS.length },
      ...STATUS_FILTERS.map((s) => ({
        key: s,
        label: FILTER_LABEL[s],
        count: ALL_ORDERS.filter((o) => o.status === s).length,
      })),
    ],
    []
  );

  const gefilterd = useMemo(() => {
    const term = zoek.trim().toLowerCase();
    return ALL_ORDERS.filter((o) => {
      if (filter !== 'alle' && o.status !== filter) return false;
      if (
        term &&
        !o.supplier.toLowerCase().includes(term) &&
        !o.orderNumber.toLowerCase().includes(term)
      ) return false;
      return true;
    });
  }, [zoek, filter]);

  const toontGroepen = filter === 'alle' && zoek.trim() === '';
  const verlopen = gefilterd.filter((o) => o.status === 'verlopen');
  const openstaand = gefilterd.filter((o) => o.status !== 'geleverd' && o.status !== 'verlopen');
  const geleverd = gefilterd.filter((o) => o.status === 'geleverd');

  // Bestellingen komen nog uit statische mock-data (ALL_ORDERS) — er is dus
  // nog geen echte serverdata om te verversen. Korte cosmetische vertraging
  // i.p.v. een netwerkcall die kan blijven hangen (en de spinner open houdt).
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const openDetail = (order: Order) => {
    router.push({ pathname: '/modal-order-detail' as any, params: { orderId: order.id } });
  };

  const openNewOrder = () => {
    router.push('/modal-new-order' as any);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Bestellingen" />

        <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.textMuted} />}
      >
        {/* Statistiekenstrip */}
        <View style={[styles.statStrip, Shadow.card, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: p.text }]}>{stats.openstaandAantal}</Text>
            <Text style={[styles.statLabel, { color: p.textMuted }]}>Openstaand</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: p.divider }]} />
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: p.text }]}>{euro(stats.openstaandWaarde)}</Text>
            <Text style={[styles.statLabel, { color: p.textMuted }]}>Openstaande waarde</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: p.divider }]} />
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: stats.verlopenAantal > 0 ? p.danger : p.text }]}>
              {stats.verlopenAantal}
            </Text>
            <Text style={[styles.statLabel, { color: p.textMuted }]}>Verlopen</Text>
          </View>
        </View>

        {/* Alert */}
        {stats.verlopenAantal > 0 && (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setFilter('verlopen')}
            style={[styles.alert, { backgroundColor: p.dangerSoft, borderColor: p.danger + '33' }]}
          >
            <Ionicons name="alert-circle" size={16} color={p.danger} />
            <View style={styles.alertBody}>
              <Text style={[styles.alertTitel, { color: p.danger }]}>
                {stats.verlopenAantal} {stats.verlopenAantal === 1 ? 'bestelling' : 'bestellingen'} verlopen
              </Text>
              <Text style={[styles.alertSub, { color: p.danger }]}>Tik om te bekijken</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={p.danger} />
          </TouchableOpacity>
        )}

        {/* Zoeken */}
        <View style={[styles.searchBar, { backgroundColor: p.surface, borderColor: p.border }]}>
          <Ionicons name="search-outline" size={16} color={p.textMuted} />
          <TextInput
            value={zoek}
            onChangeText={setZoek}
            placeholder="Zoek op leverancier of bestelnummer…"
            placeholderTextColor={p.textMuted}
            style={[styles.searchInput, { color: p.text }]}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {zoek.length > 0 && (
            <TouchableOpacity onPress={() => setZoek('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={p.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filterchips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filterChips.map((chip) => {
            const active = filter === chip.key;
            return (
              <TouchableOpacity
                key={chip.key}
                onPress={() => setFilter(chip.key)}
                style={[
                  styles.filterChip,
                  { borderColor: active ? p.accent : p.border, backgroundColor: active ? p.accentSoft : p.surface },
                ]}
              >
                <Text style={[styles.filterChipText, { color: active ? p.accent : p.textSecondary }]}>
                  {chip.label}
                </Text>
                <View style={[styles.filterChipCount, { backgroundColor: active ? p.accent : p.divider }]}>
                  <Text style={[styles.filterChipCountText, { color: active ? '#fff' : p.textSecondary }]}>
                    {chip.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Lijst */}
        {toontGroepen ? (
          <>
            {verlopen.length > 0 && (
              <>
                <SectionHeader titel="Verlopen" meta={`${verlopen.length}`} p={p} kleur={p.danger} />
                {verlopen.map((order) => (
                  <OrderCard key={order.id} order={order} p={p} onPress={() => openDetail(order)} />
                ))}
              </>
            )}

            <SectionHeader titel="Openstaand" meta={`${openstaand.length} bestellingen`} p={p} />
            {openstaand.length === 0 ? (
              <EmptyState p={p} />
            ) : (
              openstaand.map((order) => (
                <OrderCard key={order.id} order={order} p={p} onPress={() => openDetail(order)} />
              ))
            )}

            <SectionHeader titel="Geleverd" meta="Afgelopen periode" p={p} />
            {geleverd.length === 0 ? (
              <EmptyState p={p} />
            ) : (
              geleverd.map((order) => (
                <OrderCard key={order.id} order={order} p={p} onPress={() => openDetail(order)} />
              ))
            )}
          </>
        ) : (
          <>
            <SectionHeader
              titel={filter === 'alle' ? 'Resultaten' : FILTER_LABEL[filter]}
              meta={`${gefilterd.length} bestelling${gefilterd.length !== 1 ? 'en' : ''}`}
              p={p}
            />
            {gefilterd.length === 0 ? (
              <EmptyState p={p} />
            ) : (
              gefilterd.map((order) => (
                <OrderCard key={order.id} order={order} p={p} onPress={() => openDetail(order)} />
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.bottomBar, { backgroundColor: p.bg, borderTopColor: p.border, paddingBottom: insets.bottom + Spacing.md }]}>
        <TouchableOpacity style={[styles.newOrderBtn, { backgroundColor: p.accent }]} onPress={openNewOrder} activeOpacity={0.85}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.newOrderBtnText}>Nieuwe bestelling</Text>
        </TouchableOpacity>
      </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  content: { padding: Spacing.lg, paddingBottom: 110, gap: Spacing.md },

  statStrip: {
    flexDirection: 'row', borderRadius: Radius.lg, borderWidth: 0.5,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 3, paddingHorizontal: 4 },
  statValue: { fontSize: 15.5, fontWeight: '700', fontFamily: F },
  statLabel: { fontSize: 10.5, fontFamily: F, textAlign: 'center' },
  statDivider: { width: StyleSheet.hairlineWidth, marginVertical: 2 },

  alert: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md,
  },
  alertBody: { flex: 1 },
  alertTitel: { fontSize: 13, fontWeight: '700', fontFamily: F },
  alertSub: { fontSize: 11.5, fontFamily: F, marginTop: 1 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 0.5,
    paddingHorizontal: Spacing.md, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 13.5, fontFamily: F, padding: 0 },

  filterRow: { gap: Spacing.sm, paddingRight: Spacing.md },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2,
    borderRadius: Radius.pill, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  filterChipText: { fontSize: 12.5, fontWeight: '600', fontFamily: F },
  filterChipCount: { borderRadius: Radius.pill, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterChipCountText: { fontSize: 10.5, fontWeight: '700', fontFamily: F },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xs },
  sectionTitle: { fontSize: 14, fontWeight: '700', fontFamily: F },
  sectionMeta: { fontSize: 12, fontFamily: F },

  orderCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.lg, borderWidth: 0.5, borderLeftWidth: 3,
    padding: Spacing.md,
  },
  orderTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  orderIcon: { width: 40, height: 40, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  orderIconEmoji: { fontSize: 18 },
  orderInfo: { flex: 1, gap: 1 },
  orderSupplier: { fontSize: 14.5, fontWeight: '600', fontFamily: F },
  orderSubtitle: { fontSize: 11.5, fontFamily: F },

  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusPillText: { fontSize: 10.5, fontWeight: '700', fontFamily: F },

  orderDivider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.sm },

  orderBottom: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  orderMeta: { fontSize: 11, fontFamily: F },
  orderAmount: { fontSize: 14, fontWeight: '700', fontFamily: F },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 5 },
  progressTrack: { flex: 1, maxWidth: 90, height: 4, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  progressLabel: { fontSize: 10, fontFamily: F },

  emptyCard: { borderRadius: Radius.lg, borderWidth: 0.5, padding: Spacing.xxl, alignItems: 'center', gap: Spacing.xs },
  emptyTitle: { fontSize: 14, fontWeight: '600', fontFamily: F },
  emptyBody: { fontSize: 12.5, fontFamily: F, textAlign: 'center' },

  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  newOrderBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs + 2,
    borderRadius: Radius.md, height: 48,
  },
  newOrderBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', fontFamily: F },
});

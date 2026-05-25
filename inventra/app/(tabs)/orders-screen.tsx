import { DrawerMenu } from '@/components/drawer-menu';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ALL_ORDERS, type Order } from '@/data/order-data';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Order Row ────────────────────────────────────────────────────────────────

function OrderRow({
  order,
  onPress,
  textPrimary,
  textSecondary,
  surface,
  border,
  trackBg,
}: {
  order: Order;
  onPress: () => void;
  textPrimary: string;
  textSecondary: string;
  surface: string;
  border: string;
  trackBg: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.orderRow, { backgroundColor: surface, borderColor: border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.orderIcon, { backgroundColor: order.iconBg }]}>
        <Text style={styles.orderIconEmoji}>{order.icon}</Text>
      </View>
      <View style={styles.orderText}>
        <Text style={[styles.orderLabel, { color: textPrimary }]}>{order.supplier}</Text>
        <Text style={[styles.orderSub, { color: textSecondary }]}>{order.subtitle}</Text>
      </View>
      <View style={styles.orderRight}>
        <Text style={[styles.orderAmount, { color: order.accent }]}>{order.amount}</Text>
        <View style={[styles.progressTrack, { backgroundColor: trackBg }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${order.progress}%` as `${number}%`, backgroundColor: order.accent },
            ]}
          />
        </View>
      </View>
      <Text style={[styles.chevron, { color: '#ccc' }]}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OrdersScreen() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const surface       = isDark ? '#2c2c2e' : '#ffffff';
  const pageBg        = isDark ? '#1c1c1e' : '#f2f2f7';
  const textPrimary   = isDark ? '#ffffff' : '#1a1a1a';
  const textSecondary = isDark ? '#aaaaaa' : '#666666';
  const border        = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const trackBg       = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const rowProps = { textPrimary, textSecondary, surface, border, trackBg };

  const pending   = ALL_ORDERS.filter((o) => o.status !== 'geleverd');
  const delivered = ALL_ORDERS.filter((o) => o.status === 'geleverd');

  // Use the existing /modal route with a query param to distinguish which modal to show.
  // Expo Router resolves `modal` from app/modal.tsx — extend that file to accept `type` param,
  // OR add dedicated screens to your Stack in _layout.tsx (see README below).
  const openDetail = (order: Order) => {
    router.push({
      pathname: '/modal-order-detail' as any,
      params: { orderId: order.id },
    });
  };

  const openNewOrder = () => {
    router.push('/modal-new-order' as any);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: pageBg }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: pageBg }}>
        <View style={[styles.header, { backgroundColor: pageBg }]}>
          <TouchableOpacity
            onPress={() => setDrawerOpen(true)}
            style={styles.hamburgerBtn}
            accessibilityLabel="Open menu"
          >
            <View style={[styles.bar, { backgroundColor: textPrimary }]} />
            <View style={[styles.bar, { backgroundColor: textPrimary }]} />
            <View style={[styles.bar, { backgroundColor: textPrimary, width: 12 }]} />
          </TouchableOpacity>

          <ThemedText style={styles.headerTitle}>Bestellingen</ThemedText>

          <View style={[styles.avatar, { backgroundColor: '#EEEDFE' }]}>
            <Text style={[styles.avatarText, { color: '#534AB7' }]}>JD</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={[styles.content, { backgroundColor: pageBg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Pending */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>Openstaand</Text>
          <Text style={[styles.sectionMeta, { color: textSecondary }]}>
            {pending.length} bestellingen
          </Text>
        </View>
        {pending.map((order) => (
          <OrderRow key={order.id} order={order} onPress={() => openDetail(order)} {...rowProps} />
        ))}

        {/* Delivered */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>Geleverd</Text>
          <Text style={[styles.sectionMeta, { color: textSecondary }]}>Afgelopen 7 dagen</Text>
        </View>
        {delivered.map((order) => (
          <OrderRow key={order.id} order={order} onPress={() => openDetail(order)} {...rowProps} />
        ))}

        {/* New order CTA */}
        <TouchableOpacity
          style={[styles.newOrderBtn, { backgroundColor: '#534AB7' }]}
          onPress={openNewOrder}
        >
          <Text style={styles.newOrderBtnText}>+ Nieuwe bestelling</Text>
        </TouchableOpacity>
      </ScrollView>

      <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  hamburgerBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'flex-start', gap: 5 },
  bar: { height: 2, borderRadius: 2, width: 18 },
  headerTitle: { fontSize: 16, fontWeight: '600', letterSpacing: 0.2, fontFamily: 'Montserrat' },
  avatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 12, fontWeight: '700', fontFamily: 'Montserrat' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 14, fontWeight: '700', fontFamily: 'Montserrat' },
  sectionMeta: { fontSize: 12, fontFamily: 'Montserrat' },
  orderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 0.5, padding: 16,
  },
  orderIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  orderIconEmoji: { fontSize: 20 },
  orderText: { flex: 1, gap: 2 },
  orderLabel: { fontSize: 15, fontWeight: '600', fontFamily: 'Montserrat' },
  orderSub: { fontSize: 12, fontFamily: 'Montserrat' },
  orderRight: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  orderAmount: { fontSize: 13, fontWeight: '600', fontFamily: 'Montserrat' },
  progressTrack: { height: 4, width: 48, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  chevron: { fontSize: 22, flexShrink: 0, marginLeft: -6 },
  newOrderBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  newOrderBtnText: { color: '#fff', fontSize: 13, fontWeight: '600', fontFamily: 'Montserrat' },
});
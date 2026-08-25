import { ThemedView } from '@/components/themed-view';
import { getPalette } from '@/constants/design-tokens';
import { ALL_ORDERS, statusTag, type Order, type OrderProduct } from '@/data/order-data';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Link, useLocalSearchParams } from 'expo-router';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ModalOrderDetail() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const order: Order | undefined = ALL_ORDERS.find((o: Order) => o.id === orderId);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const p = getPalette(isDark);

  const surface       = p.surface;
  const pageBg        = p.bg;
  const textPrimary   = p.text;
  const textSecondary = p.textSecondary;
  const border        = p.border;

  if (!order) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: pageBg }]}>
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: textSecondary }]}>Bestelling niet gevonden</Text>
          <Link href="/orders-screen" dismissTo>
            <Text style={styles.backLink}>Terug</Text>
          </Link>
        </View>
      </ThemedView>
    );
  }

  const tag = statusTag(order.status, p);

  return (
    <ThemedView style={[styles.container, { backgroundColor: pageBg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: pageBg, borderBottomColor: border }]}>
        <Link href="/orders-screen" dismissTo style={styles.closeBtn}>
          <View style={[styles.closeBtnInner, { backgroundColor: isDark ? p.surface : p.accentSoft }]}>
            <Text style={styles.closeBtnText}>✕</Text>
          </View>
        </Link>
        <Text style={[styles.headerTitle, { color: textPrimary }]} numberOfLines={1}>
          {order.supplier}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { backgroundColor: pageBg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Order header card */}
        <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
          <View style={styles.detailHeader}>
            <View style={[styles.detailIcon, { backgroundColor: order.iconBg }]}>
              <Text style={{ fontSize: 24 }}>{order.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.detailTitle, { color: textPrimary }]}>{order.supplier}</Text>
              <Text style={[styles.detailSub, { color: textSecondary }]}>
                Bestelling {order.orderNumber} · {order.date}
              </Text>
            </View>
            <View style={[styles.tag, { backgroundColor: tag.bg }]}>
              <View style={[styles.tagDot, { backgroundColor: tag.dot }]} />
              <Text style={[styles.tagText, { color: tag.text }]}>{tag.label}</Text>
            </View>
          </View>
        </View>

        {/* Products */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>Producten</Text>
          <Text style={[styles.sectionMeta, { color: textSecondary }]}>
            {order.products.length} artikelen
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: surface, borderColor: border, gap: 0 }]}>
          {order.products.map((p: OrderProduct, i: number) => (
            <View
              key={i}
              style={[
                styles.productRow,
                {
                  borderBottomColor: border,
                  borderBottomWidth: i < order.products.length - 1 ? 0.5 : 0,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.productName, { color: textPrimary }]}>{p.name}</Text>
                <Text style={[styles.productMeta, { color: textSecondary }]}>{p.qty}</Text>
              </View>
              <Text style={[styles.productPrice, { color: textPrimary }]}>{p.price}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: textPrimary }]}>Totaal</Text>
            <Text style={[styles.totalValue, { color: order.accent }]}>{order.total}</Text>
          </View>
        </View>

        {/* Action card – expired */}
        {order.status === 'verlopen' && (
          <View style={[styles.card, { backgroundColor: surface, borderColor: '#E24B4A33' }]}>
            <View style={[styles.tag, { backgroundColor: '#FCEBEB' }]}>
              <View style={[styles.tagDot, { backgroundColor: '#E24B4A' }]} />
              <Text style={[styles.tagText, { color: '#A32D2D' }]}>Actie vereist</Text>
            </View>
            <Text style={[styles.cardTitle, { color: textPrimary }]}>Bestelling verlopen</Text>
            <Text style={[styles.cardBody, { color: textSecondary }]}>
              Neem contact op met de leverancier of annuleer de bestelling.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <TouchableOpacity style={[styles.btnSolid, { backgroundColor: '#534AB7' }]}>
                <Text style={styles.btnSolidText}>Opnieuw bestellen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnOutline, { borderColor: '#E24B4A' }]}>
                <Text style={[styles.btnOutlineText, { color: '#E24B4A' }]}>Annuleren</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Action card – delivered */}
        {order.status === 'geleverd' && (
          <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
            <View style={[styles.tag, { backgroundColor: p.successSoft }]}>
              <View style={[styles.tagDot, { backgroundColor: '#1D9E75' }]} />
              <Text style={[styles.tagText, { color: p.success }]}>Geleverd</Text>
            </View>
            <Text style={[styles.cardTitle, { color: textPrimary }]}>Ontvangst bevestigen</Text>
            <Text style={[styles.cardBody, { color: textSecondary }]}>
              Klopt alles? Bevestig de ontvangst om de voorraad bij te werken.
            </Text>
            <TouchableOpacity style={[styles.btnSolid, { backgroundColor: '#1D9E75' }]}>
              <Text style={styles.btnSolidText}>Ontvangst bevestigen</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  backBtn: { minWidth: 60, justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '600', fontFamily: 'Montserrat', color: '#534AB7' },
  backLink: { fontSize: 14, color: '#534AB7', fontFamily: 'Montserrat' },
  closeBtn: { minWidth: 60, justifyContent: 'center', alignItems: 'flex-end' },
  closeBtnText: { fontSize: 18, fontWeight: '700', fontFamily: 'Montserrat', color: '#534AB7' },
  closeBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 16, fontWeight: '600', fontFamily: 'Montserrat',
    flex: 1, textAlign: 'center',
  },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 14, fontWeight: '700', fontFamily: 'Montserrat' },
  sectionMeta: { fontSize: 12, fontFamily: 'Montserrat' },
  card: { borderRadius: 16, borderWidth: 0.5, padding: 16, gap: 6 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  detailTitle: { fontSize: 17, fontWeight: '700', fontFamily: 'Montserrat' },
  detailSub: { fontSize: 12, fontFamily: 'Montserrat' },
  tag: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    gap: 6, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 2,
  },
  tagDot: { width: 6, height: 6, borderRadius: 3 },
  tagText: { fontSize: 12, fontWeight: '600', fontFamily: 'Montserrat' },
  productRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 8,
  },
  productName: { fontSize: 14, fontWeight: '500', fontFamily: 'Montserrat' },
  productMeta: { fontSize: 12, fontFamily: 'Montserrat', marginTop: 1 },
  productPrice: { fontSize: 14, fontWeight: '600', fontFamily: 'Montserrat' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingTop: 8,
  },
  totalLabel: { fontSize: 14, fontWeight: '700', fontFamily: 'Montserrat' },
  totalValue: { fontSize: 18, fontWeight: '700', fontFamily: 'Montserrat' },
  cardTitle: { fontSize: 15, fontWeight: '600', fontFamily: 'Montserrat' },
  cardBody: { fontSize: 13, lineHeight: 20, fontFamily: 'Montserrat' },
  btnSolid: {
    alignSelf: 'flex-start', borderRadius: 9,
    paddingVertical: 8, paddingHorizontal: 16, marginTop: 4,
  },
  btnSolidText: { color: '#fff', fontSize: 13, fontWeight: '600', fontFamily: 'Montserrat' },
  btnOutline: {
    alignSelf: 'flex-start', borderRadius: 9, borderWidth: 1.5,
    paddingVertical: 7, paddingHorizontal: 14, marginTop: 4,
  },
  btnOutlineText: { fontSize: 13, fontWeight: '600', fontFamily: 'Montserrat' },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 14, fontFamily: 'Montserrat' },
});
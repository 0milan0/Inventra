import { ThemedView } from '@/components/themed-view';
import { clearSelectedContact, getSelectedContact } from '@/data/contact-selection';
import { CONTACTS, type Contact } from '@/data/contacts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

type Params = {
  items?: string; // JSON stringified quantities
  totalItems?: string;
  totalPrice?: string;
};

export default function ModalOrderContact() {
  const params = useLocalSearchParams<Params>();

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const surface = isDark ? '#2c2c2e' : '#ffffff';
  const pageBg = isDark ? '#1c1c1e' : '#f2f2f7';
  const textPrimary = isDark ? '#ffffff' : '#1a1a1a';
  const textSecondary = isDark ? '#aaaaaa' : '#666666';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [deliveryDate, setDeliveryDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<Array<{ name: string; qty: number; price: number }>>([]);
  const [totalItemsFromParams, setTotalItemsFromParams] = useState<number | null>(null);
  const [totalPriceFromParams, setTotalPriceFromParams] = useState<number | null>(null);

  useEffect(() => {
    // Parse items and totals passed from previous modal
    const raw = (params.items as string) || '';
    if (raw) {
      let parsed: any = [];
      try {
        parsed = JSON.parse(decodeURIComponent(raw));
      } catch (e) {
        try {
          parsed = JSON.parse(raw);
        } catch (e2) {
          parsed = [];
        }
      }
      setItems(Array.isArray(parsed) ? parsed : []);
    }

    if (params.totalItems) setTotalItemsFromParams(Number(params.totalItems));
    if (params.totalPrice) setTotalPriceFromParams(Number(params.totalPrice));
    // Check if contact was selected from contact-list
    const sel = getSelectedContact();
    if (sel) {
      setName(sel.name);
      setPhone(sel.phone);
      setEmail(sel.email ?? '');
      clearSelectedContact();
    }
  }, []);

  const selectContact = (c: Contact) => {
    setSelectedId(c.id);
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email ?? '');
  };

  const valid = name.trim().length > 0 && phone.trim().length > 0;

  const handleSubmit = () => {
    if (!valid) return;
    // TODO: persist order with contact data
    router.back();
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: pageBg }]}>
      <View style={[styles.header, { backgroundColor: pageBg, borderBottomColor: border }]}>
        <Link href="/orders-screen" dismissTo style={styles.closeBtn}>
          <View style={[styles.closeBtnInner, { backgroundColor: isDark ? '#2c2c2e' : '#EEEDFE' }]}>
            <Text style={styles.closeBtnText}>✕</Text>
          </View>
        </Link>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Contactgegevens</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
          <Text style={[styles.label, { color: textSecondary }]}>Naam (verplicht)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              value={name}
              onChangeText={setName}
              style={[styles.input, { color: textPrimary, borderColor: border, flex: 1 }]}
              placeholder="Naam"
              placeholderTextColor={textSecondary}
            />
          </View>

          <Text style={[styles.label, { color: textSecondary }]}>Telefoon (verplicht)</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            style={[styles.input, { color: textPrimary, borderColor: border }]}
            placeholder="+31 6 ..."
            placeholderTextColor={textSecondary}
            keyboardType="phone-pad"
          />

          <Text style={[styles.label, { color: textSecondary }]}>Email (optioneel)</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={[styles.input, { color: textPrimary, borderColor: border }]}
            placeholder="email@example.com"
            placeholderTextColor={textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={[styles.label, { color: textSecondary }]}>Gewenste leverdatum (optioneel)</Text>
          {Platform.OS === 'ios' ? (
            <>
              <TouchableOpacity
                style={[
  styles.input,
  {
    borderColor: border,
    justifyContent: 'center',
    paddingVertical: 10,
  },
]}
                onPress={() => setShowDatePicker(!showDatePicker)}
              >
                <Text style={{ color: deliveryDate ? textPrimary : textSecondary }}>
                  {deliveryDate ? deliveryDate.toLocaleDateString('nl-NL') : 'Selecteer datum'}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <View style={[styles.datePickerContainer, { backgroundColor: surface }]}>
                  <DateTimePicker
                    value={deliveryDate || new Date()}
                    mode="date"
                    display="spinner"
                    locale="nl-NL"
                    onChange={(event, selectedDate) => {
                        if (selectedDate) {
                        setDeliveryDate(selectedDate);
                        }
                    }}
                    />
                  <TouchableOpacity
                    style={styles.datePickerDone}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.datePickerDoneText}>Klaar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <TouchableOpacity
              style={[
  styles.input,
  {
    borderColor: border,
    justifyContent: 'center',
    paddingVertical: 10,
  },
]}
              onPress={async () => {
                try {
                  const { action, year, month, day } = await require('react-native').DatePickerAndroid.open({
                    date: deliveryDate || new Date(),
                  });
                  if (action !== require('react-native').DatePickerAndroid.dismissedAction) {
                    setDeliveryDate(new Date(year, month, day));
                  }
                } catch (e) {
                  // fallback if DatePickerAndroid not available
                }
              }}
            >
              <Text style={{ color: deliveryDate ? textPrimary : textSecondary }}>
                {deliveryDate ? deliveryDate.toLocaleDateString('nl-NL') : 'Selecteer datum'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>Bestelling</Text>
          <View style={[styles.card, { backgroundColor: surface, borderColor: border, marginTop: 8 }]}>
            <Text style={{ color: textPrimary, fontWeight: '700' }}>
              {totalItemsFromParams ?? items.reduce((s, it) => s + it.qty, 0)} artikelen · €{(totalPriceFromParams ?? items.reduce((s, it) => s + it.price * it.qty, 0)).toFixed(2)}
            </Text>
            {items.map((it, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ color: textPrimary }}>{it.name} × {it.qty}</Text>
                <Text style={{ color: textPrimary }}>€{(it.price * it.qty).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: textPrimary }]}>Selecteer contact</Text>
        <View style={{ gap: 8 }}>
          {CONTACTS.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.contactRow,
                { backgroundColor: selectedId === c.id ? '#EEEDFE' : surface, borderColor: border },
              ]}
              onPress={() => selectContact(c)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.contactName, { color: textPrimary }]}>{c.name}</Text>
                <Text style={[styles.contactMeta, { color: textSecondary }]}>{c.company ?? ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.contactPhone, { color: textPrimary }]}>{c.phone}</Text>
                <Text style={[styles.contactEmail, { color: textSecondary }]}>{c.email}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.placeBtn, { backgroundColor: valid ? '#534AB7' : '#aaa' }]}
          disabled={!valid}
          onPress={handleSubmit}
        >
          <Text style={styles.placeBtnText}>Plaats bestelling</Text>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 0.5 },
  closeBtn: { minWidth: 60, justifyContent: 'center' },
  closeBtnInner: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 18, fontWeight: '700', fontFamily: 'Montserrat', color: '#534AB7' },
  headerTitle: { fontSize: 16, fontWeight: '600', fontFamily: 'Montserrat', flex: 1, textAlign: 'center' },
  card: { borderRadius: 12, borderWidth: 0.5, padding: 12, gap: 8 },
  label: { fontSize: 12, fontFamily: 'Montserrat' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontFamily: 'Montserrat' },
  searchBtn: { minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  searchBtnInner: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  searchBtnText: { fontSize: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', fontFamily: 'Montserrat' },
  contactRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderRadius: 10, padding: 12 },
  contactName: { fontSize: 15, fontWeight: '600', fontFamily: 'Montserrat' },
  contactMeta: { fontSize: 12, fontFamily: 'Montserrat' },
  contactPhone: { fontSize: 13, fontWeight: '600', fontFamily: 'Montserrat' },
  contactEmail: { fontSize: 12, fontFamily: 'Montserrat' },
  placeBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  placeBtnText: { color: '#fff', fontSize: 13, fontWeight: '600', fontFamily: 'Montserrat' },
  datePickerContainer: { borderRadius: 12, borderWidth: 0.5, marginTop: 8, overflow: 'hidden' },
  datePickerDone: { paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.1)' },
  datePickerDoneText: { fontSize: 14, fontWeight: '600', fontFamily: 'Montserrat', color: '#534AB7' },
});

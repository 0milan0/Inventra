import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Product, ProductMeta, ProductStatus, getProductByBarcode, updateProduct } from '@/data/products';

const statusOptions: ProductStatus[] = ['ok', 'warning', 'expired'];
const packageTypeOptions: ProductMeta['packageType'][] = ['doos', 'fles', 'blik', 'zak', 'tray'];
const unitOptions: ProductMeta['unit'][] = ['st', 'g', 'kg', 'ml', 'l'];
const storageOptions: ProductMeta['storage'][] = ['ambient', 'koel', 'vries'];
const priorityOptions: ProductMeta['priority'][] = ['laag', 'normaal', 'hoog'];
const tagOptions = ['basis', 'vers', 'promo', 'koeling', 'impuls', 'biologisch', 'seizoensgebonden', 'actie'];

const defaultMeta: ProductMeta = {
  supplier: '',
  brand: '',
  sku: '',
  aisle: '',
  shelf: '',
  batch: '',
  packageType: 'doos',
  unit: 'st',
  storage: 'ambient',
  priority: 'normaal',
  reorderPoint: 0,
  maxStock: 0,
  weight: 0,
  volume: 0,
  restockDate: '',
  notes: '',
  featured: false,
  organic: false,
  chilled: false,
  tags: [],
};

const normalizeMeta = (meta?: Partial<ProductMeta>): ProductMeta => ({
  ...defaultMeta,
  ...meta,
  tags: meta?.tags ? [...meta.tags] : [],
});

const normalizeProduct = (product: Product): Product => ({
  ...product,
  meta: normalizeMeta(product.meta),
});

const formatDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const parseDate = (value?: string) => {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

export default function ProductDetailScreen() {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const barcodeValue = Array.isArray(barcode) ? barcode[0] : barcode;

  const product = barcodeValue ? getProductByBarcode(barcodeValue) : undefined;
  const normalizedProduct = useMemo(() => (product ? normalizeProduct(product) : null), [product?.barcode]);
  const originalProduct = useRef<Product | null>(normalizedProduct);
  const [draftProduct, setDraftProduct] = useState<Product | null>(normalizedProduct);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const meta = normalizeMeta(draftProduct?.meta);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Product',
      headerRight: () => (
        <TouchableOpacity
          onPress={hasChanges ? handleSave : () => setEditingField(null)}
          disabled={!hasChanges && !editingField}
          style={styles.headerIconBtn}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons
            name={hasChanges ? 'content-save-outline' : 'close'}
            size={22}
            color={hasChanges ? colors.tint : colors.textSecondary}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, hasChanges, editingField, colors.tint, colors.border, colors.textSecondary]);

  useEffect(() => {
    setDraftProduct(normalizedProduct);
    originalProduct.current = normalizedProduct;
    setEditingField(null);
    setSaveMessage('');
    setHasChanges(false);
  }, [normalizedProduct]);

  useEffect(() => {
    if (!saveMessage) return;
    const timer = setTimeout(() => setSaveMessage(''), 1800);
    return () => clearTimeout(timer);
  }, [saveMessage]);

  const statusColor = (status: ProductStatus) => {
    if (status === 'ok') return '#22c55e';
    if (status === 'warning') return '#f59e0b';
    return '#ef4444';
  };

  const statusLabel = (status: ProductStatus) => {
    if (status === 'ok') return 'OK';
    if (status === 'warning') return 'Bijna verlopen';
    return 'Verlopen';
  };

  const updateField = <K extends keyof Product>(key: K, value: Product[K]) => {
    if (!draftProduct) return;
    const updated = { ...draftProduct, [key]: value };
    setDraftProduct(updated);
    setHasChanges(JSON.stringify(updated) !== JSON.stringify(originalProduct.current));
  };

  const updateMetaField = <K extends keyof ProductMeta>(key: K, value: ProductMeta[K]) => {
    if (!draftProduct) return;
    const updated = {
      ...draftProduct,
      meta: {
        ...normalizeMeta(draftProduct.meta),
        [key]: value,
      },
    };
    setDraftProduct(updated);
    setHasChanges(JSON.stringify(updated) !== JSON.stringify(originalProduct.current));
  };

  const handleSave = () => {
    if (!draftProduct) return;
    updateProduct(draftProduct);
    originalProduct.current = draftProduct;
    setEditingField(null);
    setHasChanges(false);
    setSaveMessage('Opgeslagen');
  };

  const renderField = (label: string, fieldKey: keyof Product, value: string | number) => (
    <TouchableOpacity
      onPress={() => setEditingField(fieldKey)}
      style={[styles.fieldCard, { backgroundColor: colors.card, borderColor: editingField === fieldKey ? colors.tint : colors.border }]}
      activeOpacity={0.7}
    >
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      {editingField === fieldKey ? (
        <TextInput
          autoFocus
          value={String(value)}
          onChangeText={(text) => {
            const numericText = text.replace(/[^0-9]/g, '');
            updateField(fieldKey, fieldKey === 'stock' ? (Number(numericText) || 0) : text);
          }}
          onBlur={() => setEditingField(null)}
          keyboardType={fieldKey === 'stock' ? 'number-pad' : 'default'}
          inputMode={fieldKey === 'stock' ? 'numeric' : 'text'}
          maxLength={fieldKey === 'stock' ? 6 : undefined}
          style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.tint}
        />
      ) : (
        <ThemedText style={[styles.fieldValue, { color: colors.text }]}>{value}</ThemedText>
      )}
    </TouchableOpacity>
  );

  const renderDateField = (
    label = 'Vervaldatum',
    fieldId = 'tht',
    value = draftProduct?.tht ?? '',
    onChange = (nextValue: string) => updateField('tht', nextValue),
  ) => (
    <TouchableOpacity
      onPress={() => setEditingField(fieldId)}
      style={[styles.fieldCard, { backgroundColor: colors.card, borderColor: editingField === fieldId ? colors.tint : colors.border }]}
      activeOpacity={0.7}
    >
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      {editingField === fieldId ? (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={parseDate(value)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
            onChange={(_, selectedDate) => {
              if (!selectedDate) return;
              onChange(`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`);
            }}
            style={styles.datePicker}
          />
          <TouchableOpacity onPress={() => setEditingField(null)} activeOpacity={0.7} style={styles.doneBtn}>
            <Text style={[styles.doneBtnText, { color: colors.tint }]}>Gereed</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ThemedText style={[styles.fieldValue, { color: colors.text }]}>{value ? formatDate(parseDate(value)) : 'Niet ingesteld'}</ThemedText>
      )}
    </TouchableOpacity>
  );

  const renderMetaTextField = (
    label: string,
    fieldId: string,
    value: string | number,
    onChange: (value: string) => void,
    options?: { halfWidth?: boolean; numeric?: boolean; multiline?: boolean; placeholder?: string },
  ) => (
    <TouchableOpacity
      onPress={() => setEditingField(fieldId)}
      style={[
        styles.fieldCard,
        options?.halfWidth && styles.fieldHalf,
        { backgroundColor: colors.card, borderColor: editingField === fieldId ? colors.tint : colors.border },
      ]}
      activeOpacity={0.7}
    >
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      {editingField === fieldId ? (
        <TextInput
          autoFocus
          multiline={options?.multiline}
          numberOfLines={options?.multiline ? 4 : 1}
          value={String(value)}
          onChangeText={(text) => {
            if (options?.numeric) {
              onChange(text.replace(/[^0-9]/g, ''));
              return;
            }
            onChange(text);
          }}
          onBlur={() => setEditingField(null)}
          keyboardType={options?.numeric ? 'number-pad' : 'default'}
          inputMode={options?.numeric ? 'numeric' : 'text'}
          maxLength={options?.numeric ? 6 : undefined}
          placeholder={options?.placeholder}
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.tint}
          style={[
            styles.fieldInput,
            options?.multiline && styles.fieldInputMultiline,
            { color: colors.text, backgroundColor: colors.background, borderColor: colors.border },
          ]}
        />
      ) : (
        <ThemedText style={[styles.fieldValue, { color: colors.text }]}>{String(value).trim() || 'Leeg'}</ThemedText>
      )}
    </TouchableOpacity>
  );

  const renderMetaChoiceField = <T extends string>({
    label,
    value,
    options,
    onChange,
  }: {
    label: string;
    value: T;
    options: readonly T[];
    onChange: (value: T) => void;
  }) => (
    <View style={[styles.fieldCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <TouchableOpacity
              key={option}
              onPress={() => onChange(option)}
              style={[
                styles.choicePill,
                {
                  backgroundColor: selected ? colors.tint : colors.background,
                  borderColor: selected ? colors.tint : colors.border,
                },
              ]}
              activeOpacity={0.8}
            >
              <Text style={[styles.choicePillText, { color: selected ? '#fff' : colors.text }]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderSwitchField = (label: string, description: string, value: boolean, onChange: (value: boolean) => void) => (
    <View style={[styles.switchCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.switchTextWrap}>
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.tint }}
        thumbColor="#fff"
      />
    </View>
  );

  const toggleTag = (tag: string) => {
    const nextTags = meta.tags.includes(tag) ? meta.tags.filter((value) => value !== tag) : [...meta.tags, tag];
    updateMetaField('tags', nextTags);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!draftProduct ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ThemedText style={[styles.title, { color: colors.text, marginBottom: 8 }]}>Product niet gevonden</ThemedText>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Barcode: {barcode}</Text>
          </View>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ThemedText style={[styles.title, { color: colors.text }]}>{draftProduct.name}</ThemedText>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{draftProduct.category}</Text>
              <View style={styles.metaRow}>
                <Text style={[styles.barcode, { color: colors.textSecondary }]}>Barcode {draftProduct.barcode}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(draftProduct.status) }]}>
                  <Text style={[styles.statusText, { color: '#fff' }]}>{statusLabel(draftProduct.status)}</Text>
                </View>
              </View>
              {saveMessage ? <Text style={[styles.savedText, { color: colors.tint }]}>{saveMessage}</Text> : null}
            </View>

            <View style={styles.stackSection}>
              <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Gegevens</ThemedText>
              {renderField('Productnaam', 'name', draftProduct.name)}
              {renderField('Categorie', 'category', draftProduct.category)}
              {renderDateField()}
              {renderField('Voorraad', 'stock', draftProduct.stock)}
              {renderField('Locatie', 'location', draftProduct.location)}

              <TouchableOpacity
                onPress={() => setEditingField(editingField === 'status' ? null : 'status')}
                style={[styles.fieldCard, { backgroundColor: colors.card, borderColor: editingField === 'status' ? colors.tint : colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Status</Text>
                {editingField === 'status' ? (
                  <View style={styles.statusGrid}>
                    {statusOptions.map((status) => (
                      <TouchableOpacity
                        key={status}
                        onPress={() => {
                          updateField('status', status);
                          setEditingField(null);
                        }}
                        style={[
                          styles.statusOption,
                          {
                            backgroundColor: draftProduct.status === status ? statusColor(status) : colors.background,
                            borderColor: draftProduct.status === status ? statusColor(status) : colors.border,
                          },
                        ]}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.statusOptionText, { color: draftProduct.status === status ? '#fff' : colors.text }]}>
                          {statusLabel(status)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.fieldValue, { color: colors.text }]}>{statusLabel(draftProduct.status)}</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.stackSection}>
              <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Meta velden</ThemedText>
              <View style={styles.metaGrid}>
                {renderMetaTextField('Leverancier', 'meta.supplier', meta.supplier, (value) => updateMetaField('supplier', value), { halfWidth: true, placeholder: 'Leverancier' })}
                {renderMetaTextField('Merk', 'meta.brand', meta.brand, (value) => updateMetaField('brand', value), { halfWidth: true, placeholder: 'Merk' })}
                {renderMetaTextField('SKU', 'meta.sku', meta.sku, (value) => updateMetaField('sku', value), { halfWidth: true, placeholder: 'SKU' })}
                {renderMetaTextField('Batch', 'meta.batch', meta.batch, (value) => updateMetaField('batch', value), { halfWidth: true, placeholder: 'Batch' })}
                {renderMetaTextField('Gang', 'meta.aisle', meta.aisle, (value) => updateMetaField('aisle', value), { halfWidth: true, placeholder: 'A' })}
                {renderMetaTextField('Schap', 'meta.shelf', meta.shelf, (value) => updateMetaField('shelf', value), { halfWidth: true, placeholder: '1' })}
                {renderMetaTextField('Herbestelpunt', 'meta.reorderPoint', meta.reorderPoint, (value) => updateMetaField('reorderPoint', Number(value) || 0), { halfWidth: true, numeric: true, placeholder: '0' })}
                {renderMetaTextField('Max voorraad', 'meta.maxStock', meta.maxStock, (value) => updateMetaField('maxStock', Number(value) || 0), { halfWidth: true, numeric: true, placeholder: '0' })}
                {renderMetaTextField('Gewicht', 'meta.weight', meta.weight, (value) => updateMetaField('weight', Number(value) || 0), { halfWidth: true, numeric: true, placeholder: '0' })}
                {renderMetaTextField('Volume', 'meta.volume', meta.volume, (value) => updateMetaField('volume', Number(value) || 0), { halfWidth: true, numeric: true, placeholder: '0' })}
              </View>

              {renderDateField('Nieuwe leverdatum', 'meta.restockDate', meta.restockDate, (value) => updateMetaField('restockDate', value))}

              {renderMetaChoiceField({
                label: 'Verpakking',
                value: meta.packageType,
                options: packageTypeOptions,
                onChange: (value) => updateMetaField('packageType', value),
              })}
              {renderMetaChoiceField({
                label: 'Eenheid',
                value: meta.unit,
                options: unitOptions,
                onChange: (value) => updateMetaField('unit', value),
              })}
              {renderMetaChoiceField({
                label: 'Opslag',
                value: meta.storage,
                options: storageOptions,
                onChange: (value) => updateMetaField('storage', value),
              })}
              {renderMetaChoiceField({
                label: 'Prioriteit',
                value: meta.priority,
                options: priorityOptions,
                onChange: (value) => updateMetaField('priority', value),
              })}

              {renderSwitchField('Featured', 'Wordt uitgelicht in de lijst', meta.featured, (value) => updateMetaField('featured', value))}
              {renderSwitchField('Biologisch', 'Biologisch product', meta.organic, (value) => updateMetaField('organic', value))}
              {renderSwitchField('Gekoeld', 'Koeling vereist', meta.chilled, (value) => updateMetaField('chilled', value))}

              <View style={[styles.fieldCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tags</Text>
                <View style={styles.tagRow}>
                  {tagOptions.map((tag) => {
                    const selected = meta.tags.includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => toggleTag(tag)}
                        style={[
                          styles.tagChip,
                          {
                            backgroundColor: selected ? colors.tint : colors.background,
                            borderColor: selected ? colors.tint : colors.border,
                          },
                        ]}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.tagChipText, { color: selected ? '#fff' : colors.text }]}>{tag}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={[styles.fieldCard, styles.notesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Opmerkingen</Text>
                <TextInput
                  multiline
                  value={meta.notes}
                  onChangeText={(value) => updateMetaField('notes', value)}
                  placeholder="Extra notities, bijzonderheden, afspraken..."
                  placeholderTextColor={colors.textSecondary}
                  selectionColor={colors.tint}
                  style={[styles.notesInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                />
              </View>
            </View>
          </>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 52, padding: 8 },
  backText: { fontSize: 14, fontWeight: '500' },
  headerTitle: { fontSize: 17, fontWeight: '500' },
  saveBtn: {
    minWidth: 70,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 13, fontWeight: '600' },
  headerIconBtn: {
    padding: 6,
    backgroundColor: 'transparent',
  },
  headerSaveBtn: {
    minWidth: 64,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSaveText: { fontSize: 12, fontWeight: '600' },
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  title: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  subtitle: { fontSize: 13, marginTop: 3, fontWeight: '400' },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 10,
  },
  barcode: { fontSize: 12, fontWeight: '500', opacity: 0.7, flex: 1 },
  savedText: { marginTop: 8, fontSize: 12, fontWeight: '600' },
  stackSection: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '500', marginBottom: 2 },
  fieldCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  fieldHalf: {
    width: '48%',
  },
  fieldLabel: { fontSize: 11, marginBottom: 6, fontWeight: '600', opacity: 0.7 },
  fieldValue: { fontSize: 15, fontWeight: '500', lineHeight: 21 },
  fieldInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    fontWeight: '500',
  },
  fieldInputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  pickerWrap: {
    gap: 10,
  },
  datePicker: {
    alignSelf: 'stretch',
  },
  doneBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  doneBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusOption: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: 84,
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  choicePill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  choicePillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  switchCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  switchTextWrap: {
    flex: 1,
    gap: 2,
  },
  switchDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  notesCard: {
    gap: 8,
  },
  notesInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 104,
    textAlignVertical: 'top',
  },
});

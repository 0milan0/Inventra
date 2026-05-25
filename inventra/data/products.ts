export type ProductStatus = 'ok' | 'warning' | 'expired';

export type ProductMeta = {
  supplier: string;
  brand: string;
  sku: string;
  aisle: string;
  shelf: string;
  batch: string;
  packageType: 'doos' | 'fles' | 'blik' | 'zak' | 'tray';
  unit: 'st' | 'g' | 'kg' | 'ml' | 'l';
  storage: 'ambient' | 'koel' | 'vries';
  priority: 'laag' | 'normaal' | 'hoog';
  reorderPoint: number;
  maxStock: number;
  weight: number;
  volume: number;
  restockDate: string;
  notes: string;
  featured: boolean;
  organic: boolean;
  chilled: boolean;
  tags: string[];
};

export type Product = {
  barcode: string;
  articleNumber?: string;
  name: string;
  category: string;
  tht: string;
  stock: number;
  location: string;
  status: ProductStatus;
  price?: number;
  meta?: ProductMeta;
};

export const products: Record<string, Product> = {
  '8710447252543': {
    barcode: '8710447252543',
    articleNumber: '100001',
    name: 'Halfvolle melk 1L',
    category: 'Zuivel',
    tht: '2025-04-10',
    stock: 24,
    location: 'Schap A3',
    status: 'ok',
    price: 0.99,
    meta: {
      supplier: 'FrieslandCampina',
      brand: 'Campina',
      sku: 'MELK-1L-HV',
      aisle: 'A',
      shelf: '3',
      batch: 'B2404',
      packageType: 'fles',
      unit: 'l',
      storage: 'koel',
      priority: 'normaal',
      reorderPoint: 8,
      maxStock: 48,
      weight: 1,
      volume: 1,
      restockDate: '2025-04-08',
      notes: 'Standaard schapvoorraad.',
      featured: true,
      organic: false,
      chilled: true,
      tags: ['zuivel', 'basis', 'vers'],
    },
  },
  '8720326038779': {
    barcode: '8720326038779',
    articleNumber: '100006',
    name: 'Ice Tea Green',
    category: 'Dranken',
    tht: '2026-05-17',
    stock: 14,
    location: 'Schap D4',
    status: 'ok',
    price: 0.79,
    meta: {
      supplier: 'Picnic',
      brand: 'Ice Tea',
      sku: 'DRK-ITE-330',
      aisle: 'D',
      shelf: '4',
      batch: 'I2405',
      packageType: 'blik',
      unit: 'ml',
      storage: 'ambient',
      priority: 'normaal',
      reorderPoint: 10,
      maxStock: 32,
      weight: 0.33,
      volume: 0.33,
      restockDate: '2025-05-10',
      notes: 'Promo-artikel, zichtbaar fronten.',
      featured: true,
      organic: false,
      chilled: false,
      tags: ['drank', 'promo'],
    },
  },
  '8720181590832': {
    barcode: '8720181590832',
    articleNumber: '100002',
    name: 'Sunset Fresh Deodorant',
    category: 'Verzorging',
    tht: 'n.v.t.',
    stock: 31,
    location: 'Schap C1',
    status: 'ok',
    price: 4.99,
    meta: {
      supplier: 'Unilever',
      brand: 'AXE',
      sku: 'DEO-SF-100',
      aisle: 'C',
      shelf: '1',
      batch: 'B2404',
      packageType: 'fles',
      unit: 'l',
      storage: 'ambient',
      priority: 'normaal',
      reorderPoint: 8,
      maxStock: 48,
      weight: 1,
      volume: 1,
      restockDate: '2025-04-08',
      notes: 'Standaard schapvoorraad.',
      featured: true,
      organic: false,
      chilled: false,
      tags: ['verzorging', 'deodorant', 'promo'],
    },
  },
  '5000159484695': {
    barcode: '5000159484695',
    articleNumber: '100003',
    name: 'Verse sinaasappelsap 1L',
    category: 'Dranken',
    tht: '2025-04-06',
    stock: 8,
    location: 'Koeling B1',
    status: 'warning',
    price: 2.49,
    meta: {
      supplier: 'Coca-Cola Europacific',
      brand: 'Tropicana',
      sku: 'SAP-ORANJE-1L',
      aisle: 'B',
      shelf: '1',
      batch: 'J2403',
      packageType: 'fles',
      unit: 'l',
      storage: 'koel',
      priority: 'hoog',
      reorderPoint: 12,
      maxStock: 36,
      weight: 1,
      volume: 1,
      restockDate: '2025-04-05',
      notes: 'Snel roteren, eerste in / eerste uit.',
      featured: false,
      organic: false,
      chilled: true,
      tags: ['drank', 'sap', 'vers'],
    },
  },
  '8718309001154': {
    barcode: '8718309001154',
    articleNumber: '100004',
    name: 'Griekse yoghurt 500g',
    category: 'Zuivel',
    tht: '2025-03-28',
    stock: 3,
    location: 'Koeling B2',
    status: 'expired',
    price: 1.99,
    meta: {
      supplier: 'Danone',
      brand: 'Oikos',
      sku: 'YOG-500',
      aisle: 'B',
      shelf: '2',
      batch: 'Y2402',
      packageType: 'tray',
      unit: 'g',
      storage: 'koel',
      priority: 'hoog',
      reorderPoint: 6,
      maxStock: 24,
      weight: 0.5,
      volume: 0.5,
      restockDate: '2025-03-26',
      notes: 'Controleer derving en marge.',
      featured: false,
      organic: false,
      chilled: true,
      tags: ['zuivel', 'koeling'],
    },
  },
  '8721398338422': {
    barcode: '8721398338422',
    articleNumber: '100005',
    name: 'Stelz Schrobbeler',
    category: 'Dranken',
    tht: '2026-05-17',
    stock: 14,
    location: 'Schap D4',
    status: 'ok',
    price: 0.79,
    meta: {
      supplier: 'Stelz',
      brand: 'Schrobbeler',
      sku: 'DRK-STZ-330',
      aisle: 'D',
      shelf: '4',
      batch: 'S2405',
      packageType: 'blik',
      unit: 'ml',
      storage: 'ambient',
      priority: 'normaal',
      reorderPoint: 10,
      maxStock: 32,
      weight: 0.33,
      volume: 0.33,
      restockDate: '2025-05-10',
      notes: 'Promo-artikel, zichtbaar fronten.',
      featured: true,
      organic: false,
      chilled: false,
      tags: ['drank', 'promo'],
    },
  },
  '20998271': {
    barcode: '20998271',
    articleNumber: '100006',
    name: 'Big Hit',
    category: 'Chocolade',
    tht: '2026-05-17',
    stock: 14,
    location: 'Schap D4',
    status: 'ok',
    price: 1.29,
    meta: {
      supplier: 'Nestlé',
      brand: 'Big Hit',
      sku: 'CHOC-BH-01',
      aisle: 'D',
      shelf: '4',
      batch: 'C2405',
      packageType: 'zak',
      unit: 'g',
      storage: 'ambient',
      priority: 'laag',
      reorderPoint: 8,
      maxStock: 40,
      weight: 0.15,
      volume: 0.15,
      restockDate: '2025-05-10',
      notes: 'Kassa artikel, vooraan plaatsen.',
      featured: false,
      organic: false,
      chilled: false,
      tags: ['snoep', 'impuls'],
    },
  },
  '4066447600179': {
    barcode: '4066447600179',
    articleNumber: '100007',
    name: 'Balea Man Deo',
    category: 'Verzorging',
    tht: '2026-12-31',
    stock: 21,
    location: 'Schap C2',
    status: 'ok',
    price: 3.49,
    meta: {
      supplier: 'Balea',
      brand: 'Balea Men',
      sku: 'CARE-DEO-200',
      aisle: 'C',
      shelf: '2',
      batch: 'D2612',
      packageType: 'fles',
      unit: 'ml',
      storage: 'ambient',
      priority: 'normaal',
      reorderPoint: 12,
      maxStock: 30,
      weight: 0.2,
      volume: 0.2,
      restockDate: '2026-12-20',
      notes: 'Personal care, keep upright.',
      featured: false,
      organic: false,
      chilled: false,
      tags: ['verzorging', 'deodorant'],
    },
  },
  
};

export const recentScans: Product[] = [
  products['8710447252543'],
  products['5000159484695'],
  products['8718309001154'],
];

export function getProductByBarcode(barcode: string) {
  return products[barcode];
}

export function updateProduct(product: Product) {
  products[product.barcode] = product;
}

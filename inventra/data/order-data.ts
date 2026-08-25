// data/order-data.ts

import type { getPalette } from '@/constants/design-tokens';

export type OrderStatus =
  | 'geplaatst'
  | 'bevestigd'
  | 'onderweg'
  | 'geleverd'
  | 'verlopen';

export interface OrderProduct {
  name: string;
  qty: string;
  price: string;
}

export interface Order {
  id: string;
  orderNumber: string;

  supplier: string;
  subtitle: string;
  date: string;

  amount: string;
  total: string;

  progress: number;
  status: OrderStatus;

  icon: string;
  iconBg: string;
  accent: string;

  products: OrderProduct[];
}

export const ALL_ORDERS: Order[] = [
  {
    id: 'SUP-1001',
    orderNumber: 'BM-2026-001',

    supplier: 'Sligro',
    subtitle: 'Verse producten & zuivel',
    date: '5 mei 2026',

    amount: '€482,30',
    total: '€482,30',

    progress: 75,
    status: 'onderweg',

    icon: '🛒',
    iconBg: '#EEF2FF',
    accent: '#534AB7',

    products: [
      {
        name: 'Halfvolle melk',
        qty: '24 pakken',
        price: '€38,40',
      },
      {
        name: 'Jonge kaas',
        qty: '12 stuks',
        price: '€54,00',
      },
      {
        name: 'Volkoren brood',
        qty: '30 broden',
        price: '€72,00',
      },
      {
        name: 'Eieren M',
        qty: '20 dozen',
        price: '€96,00',
      },
    ],
  },

  {
    id: 'SUP-1002',
    orderNumber: 'BM-2026-002',

    supplier: 'HANOS',
    subtitle: 'Frisdrank & snacks',
    date: '4 mei 2026',

    amount: '€319,90',
    total: '€319,90',

    progress: 100,
    status: 'geleverd',

    icon: '🥤',
    iconBg: '#EAF8F1',
    accent: '#18A957',

    products: [
      {
        name: 'Cola blikjes',
        qty: '10 trays',
        price: '€89,90',
      },
      {
        name: 'Chips naturel',
        qty: '24 zakken',
        price: '€52,00',
      },
      {
        name: 'Sinaasappelsap',
        qty: '18 flessen',
        price: '€41,00',
      },
      {
        name: 'Water 1.5L',
        qty: '12 pakken',
        price: '€33,00',
      },
    ],
  },

  {
    id: 'SUP-1003',
    orderNumber: 'BM-2026-003',

    supplier: 'Makro',
    subtitle: 'Groente & fruit',
    date: '3 mei 2026',

    amount: '€274,50',
    total: '€274,50',

    progress: 40,
    status: 'bevestigd',

    icon: '🍎',
    iconBg: '#FFF4E8',
    accent: '#F59E0B',

    products: [
      {
        name: 'Bananen',
        qty: '15 dozen',
        price: '€67,50',
      },
      {
        name: 'Tomaten',
        qty: '20 kg',
        price: '€48,00',
      },
      {
        name: 'Komkommers',
        qty: '40 stuks',
        price: '€32,00',
      },
      {
        name: 'Appels',
        qty: '12 kg',
        price: '€55,00',
      },
    ],
  },

  {
    id: 'SUP-1004',
    orderNumber: 'BM-2026-004',

    supplier: 'Bidfood',
    subtitle: 'Diepvriesproducten',
    date: '1 mei 2026',

    amount: '€612,80',
    total: '€612,80',

    progress: 100,
    status: 'geleverd',

    icon: '🧊',
    iconBg: '#E0F2FE',
    accent: '#0284C7',

    products: [
      {
        name: 'Friet diepvries',
        qty: '25 zakken',
        price: '€120,00',
      },
      {
        name: 'Pizza margarita',
        qty: '18 dozen',
        price: '€144,00',
      },
      {
        name: 'Vanille ijs',
        qty: '10 bakken',
        price: '€78,00',
      },
      {
        name: 'Kroketten',
        qty: '15 dozen',
        price: '€95,00',
      },
    ],
  },

  {
    id: 'SUP-1005',
    orderNumber: 'BM-2026-005',

    supplier: 'VHC Jongens',
    subtitle: 'Bakkerijproducten',
    date: '29 april 2026',

    amount: '€184,20',
    total: '€184,20',

    progress: 100,
    status: 'verlopen',

    icon: '🥖',
    iconBg: '#FEF3C7',
    accent: '#D97706',

    products: [
      {
        name: 'Croissants',
        qty: '40 stuks',
        price: '€36,00',
      },
      {
        name: 'Witte bollen',
        qty: '60 stuks',
        price: '€42,00',
      },
      {
        name: 'Appelflappen',
        qty: '24 stuks',
        price: '€28,80',
      },
      {
        name: 'Donuts mix',
        qty: '30 stuks',
        price: '€31,40',
      },
    ],
  },
];

// ─── Status- & statistiekhelpers ─────────────────────────────────────────────
// Gedeeld tussen orders-screen.tsx en modal-order-detail.tsx zodat de
// status-chip er overal exact hetzelfde uitziet.

type Palette = ReturnType<typeof getPalette>;

export const STATUS_FILTERS: OrderStatus[] = ['geplaatst', 'bevestigd', 'onderweg', 'geleverd', 'verlopen'];

export function statusTag(status: OrderStatus, p: Palette): {
  bg: string;
  dot: string;
  text: string;
  label: string;
} {
  switch (status) {
    case 'verlopen':  return { bg: p.dangerSoft, dot: p.danger, text: p.danger, label: 'Verlopen' };
    case 'geleverd':  return { bg: p.successSoft, dot: p.success, text: p.success, label: 'Geleverd' };
    case 'bevestigd': return { bg: p.accentSoft, dot: p.accent, text: p.accent, label: 'Bevestigd' };
    case 'onderweg':  return { bg: p.warningSoft, dot: p.warning, text: p.warning, label: 'Onderweg' };
    default:          return { bg: p.accentSoft, dot: p.accent, text: p.accent, label: 'Geplaatst' };
  }
}

/** "€482,30" → 482.30 */
export function parseBedrag(bedrag: string): number {
  const schoon = bedrag.replace(/[^\d,.-]/g, '').replace(',', '.');
  return parseFloat(schoon) || 0;
}

export interface OrderStats {
  openstaandAantal: number;
  openstaandWaarde: number;
  onderwegAantal: number;
  verlopenAantal: number;
}

export function getOrderStats(orders: Order[]): OrderStats {
  const openstaand = orders.filter((o) => o.status !== 'geleverd');
  return {
    openstaandAantal: openstaand.length,
    openstaandWaarde: openstaand.reduce((s, o) => s + parseBedrag(o.total), 0),
    onderwegAantal: orders.filter((o) => o.status === 'onderweg').length,
    verlopenAantal: orders.filter((o) => o.status === 'verlopen').length,
  };
}
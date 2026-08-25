// ─── Types ───────────────────────────────────────────────────────────────────
// Filialen (Branches) komen niet meer uit statische data — die worden live
// opgehaald via getBranches() in lib/api.ts en zijn beschikbaar via
// useAuth().branches (zie contexts/auth-context.tsx).

export type Department = 'AGF' | 'Kassa & Boetiek' | 'KW' | 'Vers' | 'Brood';
export type ShelfType = 'shelf' | 'equipment';

export interface Shelf {
  id: number;
  branchId: number;
  name: string;
  shortLabel: string;
  department: Department;
  x: number; // middelpunt van het schap-blok, schaal 0–50
  y: number; // middelpunt van het schap-blok, schaal 0–30
  width: number; // breedte van het schap-blok, zelfde schaal als x
  height: number; // diepte van het schap-blok, zelfde schaal als y
  // 'equipment' = apparatuur (koeling, kassa, e.d.) i.p.v. een gewoon schap.
  // Bepaalt of "Bekijk metadata" beschikbaar is in het long-press-menu.
  // Standaard 'shelf' als het veld ontbreekt.
  type?: ShelfType;
}

export interface DepartmentInfo {
  id: Department;
  label: string;
  icon: string;
  bg: string;
  tekst: string;
}

export interface ShelfStockItem {
  productName: string;
  unitType: string;
  shelfStock: number;
  minimumStock: number;
  shortestTht: string; // ISO datum
  // TODO: koppel aan de echte productfoto-bron (bv. AFAS media-bijlage of een
  // CDN-URL) zodra die beschikbaar is. Ontbreekt 'ie, dan toont de app een
  // fallback-icoon i.p.v. een gebroken plaatje.
  photoUrl?: string;
  // Welke plank binnen het schap dit product ligt. Ontbreekt 'ie, dan wordt
  // alles als "Plank 1" getoond.
  plankNummer?: number;
}

// Metadata voor schappen met type: 'equipment' (koelingen, kassa's, e.d.).
// `temperatuur` is alleen relevant voor koeling/vries-apparatuur.
export interface EquipmentMetadata {
  serienummer?: string;
  laatsteOnderhoud?: string; // ISO datum
  temperatuur?: string;
  opmerking?: string;
}

// ─── Afdelingen ───────────────────────────────────────────────────────────────

export const departementen: DepartmentInfo[] = [
  { id: 'AGF', label: 'AGF', icon: '🥦', bg: '#EAF3DE', tekst: '#3B6D11' },
  { id: 'Vers', label: 'Vers', icon: '🥩', bg: '#FCEBEB', tekst: '#A32D2D' },
  { id: 'Brood', label: 'Brood', icon: '🍞', bg: '#FAEEDA', tekst: '#854F0B' },
  { id: 'KW', label: 'Kruidenierswaren', icon: '🛒', bg: '#EEEDFE', tekst: '#534AB7' },
  { id: 'Kassa & Boetiek', label: 'Kassa & Boetiek', icon: '🧾', bg: '#E3F2FD', tekst: '#1565C0' },
];

export function getDepartementInfo(dept: Department): DepartmentInfo {
  return departementen.find((d) => d.id === dept) ?? departementen[0];
}

// ─── Schappen ─────────────────────────────────────────────────────────────────
// Elk filiaal heeft dezelfde 8 schaptypes plus 2 stuks apparatuur (diepvries-
// unit en kassa), maar in een eigen rij-indeling met looppaden ertussen —
// gebaseerd op branches[].storeType (M = 3 rijen, L = rijen + eiland, S =
// compacter). `x`/`y` zijn het middelpunt van het blok, `width`/`height` de
// afmeting — het "pad" is simpelweg de lege ruimte tussen de blokken. De
// ingang (zie de hardcoded entree-pill in plattegrond.tsx, onderkant-midden
// rond x≈25, y≈29) blijft in elke indeling vrij.

export const shelves: Shelf[] = [
  // Filiaal 1 — Nijverdal Centrum (M): 3 gelijke rijen, kassa bij de ingang.
  { id: 1, branchId: 1, name: 'Zuivelschap A1', shortLabel: 'Zuivel', department: 'KW', x: 9, y: 5, width: 16, height: 6 },
  { id: 2, branchId: 1, name: 'Groente & Fruit B1', shortLabel: 'AGF', department: 'AGF', x: 9, y: 16, width: 14, height: 6 },
  { id: 3, branchId: 1, name: 'Broodschap C1', shortLabel: 'Brood', department: 'Brood', x: 28, y: 5, width: 14, height: 6 },
  { id: 4, branchId: 1, name: 'Vleeswaren D1', shortLabel: 'Vlees', department: 'Vers', x: 44, y: 5, width: 10, height: 6 },
  { id: 5, branchId: 1, name: 'Frisdrank E1', shortLabel: 'Drank', department: 'Kassa & Boetiek', x: 27, y: 16, width: 16, height: 6 },
  { id: 6, branchId: 1, name: 'Snoep F1', shortLabel: 'Snoep', department: 'KW', x: 43, y: 16, width: 12, height: 6 },
  { id: 7, branchId: 1, name: 'Diepvries G1', shortLabel: 'Vries', department: 'Vers', x: 41, y: 25, width: 14, height: 6, type: 'equipment' },
  { id: 8, branchId: 1, name: 'Non-food H1', shortLabel: 'Non-food', department: 'Kassa & Boetiek', x: 9, y: 25, width: 14, height: 6 },

  // Filiaal 2 — Hellendoorn (S): 2 diepe rijen + smalle rij vooraan, compacter.
  { id: 9, branchId: 2, name: 'Zuivelschap A1', shortLabel: 'Zuivel', department: 'KW', x: 9, y: 6, width: 14, height: 7 },
  { id: 10, branchId: 2, name: 'Groente & Fruit B1', shortLabel: 'AGF', department: 'AGF', x: 9, y: 17, width: 14, height: 7 },
  { id: 11, branchId: 2, name: 'Broodschap C1', shortLabel: 'Brood', department: 'Brood', x: 26, y: 6, width: 14, height: 7 },
  { id: 12, branchId: 2, name: 'Vleeswaren D1', shortLabel: 'Vlees', department: 'Vers', x: 42, y: 6, width: 12, height: 7 },
  { id: 13, branchId: 2, name: 'Frisdrank E1', shortLabel: 'Drank', department: 'Kassa & Boetiek', x: 27, y: 17, width: 16, height: 7 },
  { id: 14, branchId: 2, name: 'Snoep F1', shortLabel: 'Snoep', department: 'KW', x: 44, y: 17, width: 10, height: 7 },
  { id: 15, branchId: 2, name: 'Diepvries G1', shortLabel: 'Vries', department: 'Vers', x: 40, y: 25, width: 16, height: 5, type: 'equipment' },
  { id: 16, branchId: 2, name: 'Non-food H1', shortLabel: 'Non-food', department: 'Kassa & Boetiek', x: 10, y: 25, width: 16, height: 5 },

  // Filiaal 3 — Almelo XL (L, in verbouwing): rij achter, twee eilanden in het
  // midden, rij vooraan, plus een smalle diepvries-unit tegen de rechterwand.
  { id: 17, branchId: 3, name: 'Zuivelschap A1', shortLabel: 'Zuivel', department: 'KW', x: 9, y: 4, width: 16, height: 6 },
  { id: 18, branchId: 3, name: 'Groente & Fruit B1', shortLabel: 'AGF', department: 'AGF', x: 14, y: 15, width: 16, height: 6 },
  { id: 19, branchId: 3, name: 'Broodschap C1', shortLabel: 'Brood', department: 'Brood', x: 28, y: 4, width: 14, height: 6 },
  { id: 20, branchId: 3, name: 'Vleeswaren D1', shortLabel: 'Vlees', department: 'Vers', x: 9, y: 25, width: 16, height: 6 },
  { id: 21, branchId: 3, name: 'Frisdrank E1', shortLabel: 'Drank', department: 'Kassa & Boetiek', x: 36, y: 15, width: 16, height: 6 },
  { id: 22, branchId: 3, name: 'Snoep F1', shortLabel: 'Snoep', department: 'KW', x: 44, y: 4, width: 10, height: 6 },
  { id: 23, branchId: 3, name: 'Diepvries G1', shortLabel: 'Vries', department: 'Vers', x: 47.5, y: 15, width: 3, height: 10, type: 'equipment' },
  { id: 24, branchId: 3, name: 'Non-food H1', shortLabel: 'Non-food', department: 'Kassa & Boetiek', x: 41, y: 25, width: 16, height: 6 },

  // Filiaal 4 — Rotterdam Centrum (L): zelfde opzet als een grote stad-winkel,
  // andere afdelingsindeling dan filiaal 3.
  { id: 25, branchId: 4, name: 'Zuivelschap A1', shortLabel: 'Zuivel', department: 'KW', x: 14, y: 15, width: 16, height: 6 },
  { id: 26, branchId: 4, name: 'Groente & Fruit B1', shortLabel: 'AGF', department: 'AGF', x: 9, y: 4, width: 16, height: 6 },
  { id: 27, branchId: 4, name: 'Broodschap C1', shortLabel: 'Brood', department: 'Brood', x: 9, y: 25, width: 16, height: 6 },
  { id: 28, branchId: 4, name: 'Vleeswaren D1', shortLabel: 'Vlees', department: 'Vers', x: 28, y: 4, width: 14, height: 6 },
  { id: 29, branchId: 4, name: 'Frisdrank E1', shortLabel: 'Drank', department: 'Kassa & Boetiek', x: 36, y: 15, width: 16, height: 6 },
  { id: 30, branchId: 4, name: 'Snoep F1', shortLabel: 'Snoep', department: 'KW', x: 41, y: 25, width: 16, height: 6 },
  { id: 31, branchId: 4, name: 'Diepvries G1', shortLabel: 'Vries', department: 'Vers', x: 47.5, y: 15, width: 3, height: 10, type: 'equipment' },
  { id: 32, branchId: 4, name: 'Non-food H1', shortLabel: 'Non-food', department: 'Kassa & Boetiek', x: 44, y: 4, width: 10, height: 6 },

  // Filiaal 5 — Schiedam (S, gesloten): compacte indeling zoals filiaal 2,
  // andere afdelingsindeling.
  { id: 33, branchId: 5, name: 'Zuivelschap A1', shortLabel: 'Zuivel', department: 'KW', x: 9, y: 17, width: 14, height: 7 },
  { id: 34, branchId: 5, name: 'Groente & Fruit B1', shortLabel: 'AGF', department: 'AGF', x: 10, y: 25, width: 16, height: 5 },
  { id: 35, branchId: 5, name: 'Broodschap C1', shortLabel: 'Brood', department: 'Brood', x: 9, y: 6, width: 14, height: 7 },
  { id: 36, branchId: 5, name: 'Vleeswaren D1', shortLabel: 'Vlees', department: 'Vers', x: 27, y: 17, width: 16, height: 7 },
  { id: 37, branchId: 5, name: 'Frisdrank E1', shortLabel: 'Drank', department: 'Kassa & Boetiek', x: 26, y: 6, width: 14, height: 7 },
  { id: 38, branchId: 5, name: 'Snoep F1', shortLabel: 'Snoep', department: 'KW', x: 44, y: 17, width: 10, height: 7 },
  { id: 39, branchId: 5, name: 'Diepvries G1', shortLabel: 'Vries', department: 'Vers', x: 42, y: 6, width: 12, height: 7, type: 'equipment' },
  { id: 40, branchId: 5, name: 'Non-food H1', shortLabel: 'Non-food', department: 'Kassa & Boetiek', x: 40, y: 25, width: 16, height: 5 },

  // Kassa's — één per filiaal, vlak bij de ingang (onderkant-midden).
  { id: 41, branchId: 1, name: 'Kassa 1', shortLabel: 'Kassa', department: 'Kassa & Boetiek', x: 25, y: 21, width: 8, height: 4, type: 'equipment' },
  { id: 42, branchId: 2, name: 'Kassa 1', shortLabel: 'Kassa', department: 'Kassa & Boetiek', x: 25, y: 25, width: 8, height: 4, type: 'equipment' },
  { id: 43, branchId: 3, name: 'Kassa 1', shortLabel: 'Kassa', department: 'Kassa & Boetiek', x: 25, y: 21, width: 8, height: 4, type: 'equipment' },
  { id: 44, branchId: 4, name: 'Kassa 1', shortLabel: 'Kassa', department: 'Kassa & Boetiek', x: 25, y: 21, width: 8, height: 4, type: 'equipment' },
  { id: 45, branchId: 5, name: 'Kassa 1', shortLabel: 'Kassa', department: 'Kassa & Boetiek', x: 25, y: 25, width: 8, height: 4, type: 'equipment' },
];

export function getShelvesByBranch(branchId: number): Shelf[] {
  return shelves.filter((s) => s.branchId === branchId);
}

export function getShelfById(id: number): Shelf | undefined {
  return shelves.find((s) => s.id === id);
}

// ─── Voorraad per schap ─────────────────────────────────────────────────────
// Gebaseerd op de product_branch-koppelingen; niet elk schap heeft producten.
// Apparatuur (Vries, Kassa) heeft bewust geen voorraadregels — die tonen in de
// app alleen de metadata-tab, geen planken.

export const stockByShelf: Record<number, ShelfStockItem[]> = {
  1: [
    { productName: 'Conference Peren 1kg', unitType: 'zak', shelfStock: 52, minimumStock: 17, shortestTht: '2026-07-29', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Kipfilet 400g', unitType: 'pak', shelfStock: 55, minimumStock: 16, shortestTht: '2026-08-23', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Sinaasappelsap 1L', unitType: 'fles', shelfStock: 26, minimumStock: 11, shortestTht: '2026-08-13', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Pilsener 6-pack', unitType: '6-pack', shelfStock: 2, minimumStock: 20, shortestTht: '2026-09-02', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  3: [
    { productName: 'Aardappelen Kruimig 2.5kg', unitType: 'zak', shelfStock: 52, minimumStock: 12, shortestTht: '2026-07-28', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Pure Chocolade Reep', unitType: 'stuk', shelfStock: 20, minimumStock: 17, shortestTht: '2026-09-22', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  4: [
    { productName: 'IJsbergsla', unitType: 'stuk', shelfStock: 35, minimumStock: 5, shortestTht: '2026-08-30', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Melkchocolade Reep', unitType: 'stuk', shelfStock: 44, minimumStock: 8, shortestTht: '2026-08-15', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  5: [
    { productName: 'Griekse Yoghurt 500g', unitType: 'pot', shelfStock: 28, minimumStock: 10, shortestTht: '2026-08-18', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Rundvlees Braadstuk', unitType: 'stuk', shelfStock: 30, minimumStock: 19, shortestTht: '2026-08-19', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  6: [
    { productName: 'Karnemelk 1L', unitType: 'stuk', shelfStock: 29, minimumStock: 13, shortestTht: '2026-09-12', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  8: [
    { productName: 'Jong Belegen Kaas 400g', unitType: 'stuk', shelfStock: 46, minimumStock: 11, shortestTht: '2026-08-26', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Appelsap 1L', unitType: 'fles', shelfStock: 27, minimumStock: 17, shortestTht: '2026-09-21', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  9: [
    { productName: 'Diepvries Spinazie 450g', unitType: 'zak', shelfStock: 15, minimumStock: 6, shortestTht: '2026-08-31', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  10: [
    { productName: 'Diepvries Doperwten 1kg', unitType: 'zak', shelfStock: 23, minimumStock: 11, shortestTht: '2026-09-16', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Pizza Salami', unitType: 'stuk', shelfStock: 3, minimumStock: 10, shortestTht: '2026-08-24', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Yoghurt Drink 1L', unitType: 'stuk', shelfStock: 20, minimumStock: 19, shortestTht: '2026-09-15', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  11: [
    { productName: 'Roomboter 250g', unitType: 'pak', shelfStock: 12, minimumStock: 9, shortestTht: '2026-08-18', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  12: [
    { productName: 'Douchegel 250ml', unitType: 'fles', shelfStock: 12, minimumStock: 20, shortestTht: '2026-09-05', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Oude Kaas 300g', unitType: 'stuk', shelfStock: 10, minimumStock: 7, shortestTht: '2026-09-04', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  13: [
    { productName: 'Griekse Yoghurt 500g', unitType: 'pot', shelfStock: 12, minimumStock: 14, shortestTht: '2026-09-13', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'IJsbergsla', unitType: 'stuk', shelfStock: 42, minimumStock: 20, shortestTht: '2026-09-16', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Sinaasappelsap 1L', unitType: 'fles', shelfStock: 5, minimumStock: 7, shortestTht: '2026-08-11', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Gemengde Noten 300g', unitType: 'zak', shelfStock: 30, minimumStock: 12, shortestTht: '2026-08-22', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Kipdrumsticks 600g', unitType: 'pak', shelfStock: 13, minimumStock: 15, shortestTht: '2026-07-29', plankNummer: 3, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  14: [
    { productName: 'Elstar Appels 1kg', unitType: 'zak', shelfStock: 28, minimumStock: 16, shortestTht: '2026-08-17', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Wit Casino Brood', unitType: 'stuk', shelfStock: 4, minimumStock: 9, shortestTht: '2026-08-29', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Verse Zalmfilet 250g', unitType: 'stuk', shelfStock: 31, minimumStock: 9, shortestTht: '2026-08-26', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Cassis Fris 1.5L', unitType: 'fles', shelfStock: 18, minimumStock: 18, shortestTht: '2026-07-30', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  16: [
    { productName: 'Volle Melk 1L', unitType: 'stuk', shelfStock: 48, minimumStock: 13, shortestTht: '2026-08-05', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Sinaasappels Net 2kg', unitType: 'net', shelfStock: 47, minimumStock: 20, shortestTht: '2026-08-20', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Volkoren Brood', unitType: 'stuk', shelfStock: 30, minimumStock: 13, shortestTht: '2026-08-02', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Jonagold Appels 1.5kg', unitType: 'zak', shelfStock: 15, minimumStock: 12, shortestTht: '2026-09-16', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  18: [
    { productName: 'Halfvolle Melk 1L', unitType: 'stuk', shelfStock: 40, minimumStock: 7, shortestTht: '2026-09-19', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Allesreiniger 1L', unitType: 'fles', shelfStock: 53, minimumStock: 19, shortestTht: '2026-08-02', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  19: [
    { productName: 'Conference Peren 1kg', unitType: 'zak', shelfStock: 19, minimumStock: 12, shortestTht: '2026-09-02', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  20: [
    { productName: 'Wit Casino Brood', unitType: 'stuk', shelfStock: 18, minimumStock: 19, shortestTht: '2026-08-20', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Gemengde Noten 300g', unitType: 'zak', shelfStock: 0, minimumStock: 14, shortestTht: '2026-08-13', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  21: [
    { productName: 'Croissants 4-pack', unitType: '4-pack', shelfStock: 1, minimumStock: 20, shortestTht: '2026-08-24', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Rundergehakt 500g', unitType: 'pak', shelfStock: 7, minimumStock: 5, shortestTht: '2026-09-12', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Jonagold Appels 1.5kg', unitType: 'zak', shelfStock: 15, minimumStock: 11, shortestTht: '2026-07-31', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Naturel Chips 200g', unitType: 'zak', shelfStock: 59, minimumStock: 17, shortestTht: '2026-09-13', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  22: [
    { productName: 'Kipdrumsticks 600g', unitType: 'pak', shelfStock: 28, minimumStock: 5, shortestTht: '2026-09-05', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  24: [
    { productName: 'Cola Fles 1.5L', unitType: 'fles', shelfStock: 47, minimumStock: 17, shortestTht: '2026-08-11', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Douchegel 250ml', unitType: 'fles', shelfStock: 5, minimumStock: 20, shortestTht: '2026-08-19', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  25: [
    { productName: 'Roomboter 250g', unitType: 'pak', shelfStock: 42, minimumStock: 14, shortestTht: '2026-08-11', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Aardappelen Kruimig 2.5kg', unitType: 'zak', shelfStock: 46, minimumStock: 9, shortestTht: '2026-08-29', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Yoghurt Drink 1L', unitType: 'stuk', shelfStock: 58, minimumStock: 9, shortestTht: '2026-08-27', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  26: [
    { productName: 'IJsbergsla', unitType: 'stuk', shelfStock: 31, minimumStock: 19, shortestTht: '2026-07-31', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Chips Paprika 200g', unitType: 'zak', shelfStock: 28, minimumStock: 12, shortestTht: '2026-08-05', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  27: [
    { productName: 'Appelsap 1L', unitType: 'fles', shelfStock: 41, minimumStock: 17, shortestTht: '2026-07-27', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  28: [
    { productName: 'Elstar Appels 1kg', unitType: 'zak', shelfStock: 24, minimumStock: 13, shortestTht: '2026-09-06', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Kipfilet 400g', unitType: 'pak', shelfStock: 17, minimumStock: 14, shortestTht: '2026-09-24', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Margarine 500g', unitType: 'pak', shelfStock: 45, minimumStock: 12, shortestTht: '2026-08-22', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  29: [
    { productName: 'Verse Zalmfilet 250g', unitType: 'stuk', shelfStock: 46, minimumStock: 18, shortestTht: '2026-09-04', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Karnemelk 1L', unitType: 'stuk', shelfStock: 23, minimumStock: 6, shortestTht: '2026-09-12', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  30: [
    { productName: 'Oude Kaas 300g', unitType: 'stuk', shelfStock: 15, minimumStock: 6, shortestTht: '2026-08-31', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  32: [
    { productName: 'Cola Fles 1.5L', unitType: 'fles', shelfStock: 13, minimumStock: 12, shortestTht: '2026-09-23', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Pure Chocolade Reep', unitType: 'stuk', shelfStock: 40, minimumStock: 17, shortestTht: '2026-09-19', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  33: [
    { productName: 'Volkoren Brood', unitType: 'stuk', shelfStock: 21, minimumStock: 14, shortestTht: '2026-09-01', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Wit Casino Brood', unitType: 'stuk', shelfStock: 29, minimumStock: 11, shortestTht: '2026-08-01', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Chips Paprika 200g', unitType: 'zak', shelfStock: 60, minimumStock: 19, shortestTht: '2026-08-31', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  36: [
    { productName: 'Sinaasappels Net 2kg', unitType: 'net', shelfStock: 58, minimumStock: 6, shortestTht: '2026-09-05', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Yoghurt Drink 1L', unitType: 'stuk', shelfStock: 51, minimumStock: 14, shortestTht: '2026-09-09', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Jonagold Appels 1.5kg', unitType: 'zak', shelfStock: 16, minimumStock: 11, shortestTht: '2026-08-11', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Rundvlees Braadstuk', unitType: 'stuk', shelfStock: 14, minimumStock: 11, shortestTht: '2026-09-17', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  37: [
    { productName: 'Margarine 500g', unitType: 'pak', shelfStock: 47, minimumStock: 8, shortestTht: '2026-09-18', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
    { productName: 'Haringfilet 200g', unitType: 'pot', shelfStock: 52, minimumStock: 18, shortestTht: '2026-08-19', plankNummer: 2, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  38: [
    { productName: 'Elstar Appels 1kg', unitType: 'zak', shelfStock: 15, minimumStock: 11, shortestTht: '2026-08-07', plankNummer: 1, photoUrl: 'https://placeholder.milancarati.com/inventra/products/images/AH_CP_01.jpg' },
  ],
  40: [],
};

export function getStockForShelf(shelfId: number): ShelfStockItem[] {
  return stockByShelf[shelfId] ?? [];
}

// ─── Apparatuur-metadata ────────────────────────────────────────────────────
// Alleen ingevuld voor schappen met `type: 'equipment'` (de Vries- en
// Kassa-eenheden hierboven). Placeholder-waarden — koppel aan de echte bron
// (bv. een AFAS-asset, onderhoudslogboek of los beheersysteem) zodra die er is.

export const equipmentMetadata: Record<number, EquipmentMetadata> = {
  // Diepvries-units
  23: { serienummer: 'DV-NIJ-001', laatsteOnderhoud: '2026-05-14', temperatuur: '-18°C', opmerking: 'Laatste storing: geen bekend.' },
  15: { serienummer: 'DV-HLD-001', laatsteOnderhoud: '2026-04-02', temperatuur: '-19°C' },
  7: { serienummer: 'DV-ALM-001', laatsteOnderhoud: '2026-06-20', temperatuur: '-18°C', opmerking: 'Filiaal in verbouwing — check bereikbaarheid.' },
  31: { serienummer: 'DV-RTD-001', laatsteOnderhoud: '2026-03-11', temperatuur: '-17°C' },
  39: { serienummer: 'DV-SDM-001', laatsteOnderhoud: '2026-02-27', temperatuur: '-18°C', opmerking: 'Filiaal gesloten — alleen onderhoudstoegang.' },

  // Kassa's
  41: { serienummer: 'KS-NIJ-001', laatsteOnderhoud: '2026-06-01', opmerking: 'Laatste kassa-update: 2026-06-01.' },
  42: { serienummer: 'KS-HLD-001', laatsteOnderhoud: '2026-05-18' },
  43: { serienummer: 'KS-ALM-001', laatsteOnderhoud: '2026-06-20', opmerking: 'Filiaal in verbouwing — check bereikbaarheid.' },
  44: { serienummer: 'KS-RTD-001', laatsteOnderhoud: '2026-04-30' },
  45: { serienummer: 'KS-SDM-001', laatsteOnderhoud: '2026-01-15', opmerking: 'Filiaal gesloten — alleen onderhoudstoegang.' },
};

export function getEquipmentMetadata(shelfId: number): EquipmentMetadata | undefined {
  return equipmentMetadata[shelfId];
}
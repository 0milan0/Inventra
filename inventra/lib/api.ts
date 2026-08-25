const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export class ApiError extends Error {}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError('Kan geen verbinding maken met de server.');
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(body?.error ?? 'Er ging iets mis.');
  }

  return body as T;
}

export interface ApiUser {
  id: number;
  naam: string;
  initialen: string;
  voornaam: string | null;
  tussenvoegsel: string | null;
  achternaam: string | null;
  email: string;
  telefoonnummer: string | null;
  geboortedatum: string | null;
  profielfoto: string | null;
  rol: string;
  afdeling: string;
  status: AccountStatus | null;
  badges: string | null;
  company: number | null;
  branchId: number | null;
  /** Namen uit `permissions.name` die momenteel effectief zijn (rang, afdeling, of losse override). */
  permissies: string[];
}

export interface LoginResponse {
  token: string;
  user: ApiUser;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/api/auth/login.php', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function activateAccount(
  email: string,
  code: string,
  password: string,
): Promise<LoginResponse> {
  return request<LoginResponse>('/api/auth/activate.php', {
    method: 'POST',
    body: JSON.stringify({ email, code, password }),
  });
}

export function getMe(token: string): Promise<{ user: ApiUser }> {
  return request('/api/auth/me.php', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function registerDevice(
  token: string,
  deviceName: string,
  pushToken: string,
): Promise<{ isNewDevice: boolean }> {
  return request('/api/devices/register.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ deviceName, pushToken }),
  });
}

export interface ApiBranch {
  id: number;
  naam: string;
  email: string | null;
  telefoonnummer: string | null;
  straat: string | null;
  huisnummer: string | null;
  postcode: string | null;
  stad: string;
  provincie: string | null;
  land: string | null;
  latitude: string | null;
  longitude: string | null;
  storeType: 'XS' | 'S' | 'M' | 'L';
  status: 'actief' | 'verbouwing' | 'gesloten';
  bakkerij: boolean;
  slagerij: boolean;
  selfscan: boolean;
  bloemen: boolean;
}

export function getBranches(token: string): Promise<ApiBranch[]> {
  return request('/api/branches/list.php', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface ApiUurVerkoop {
  uur: number;
  transacties: number;
  omzet: number;
}

export function getVerkoopPerUur(token: string): Promise<ApiUurVerkoop[]> {
  return request('/api/sales/today.php', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type Betaalmethode = 'pin' | 'contant' | 'creditcard' | 'ideal' | 'klarna';
export type VerkoopbonStatus = 'voltooid' | 'geannuleerd' | 'geretourneerd';

export interface ApiVerkoopbon {
  id: number;
  totaal: number;
  betaalmethode: Betaalmethode;
  status: VerkoopbonStatus;
  datum: string;
  kassamedewerker: string;
  klantId: number | null;
  klantNaam: string | null;
  loyaltyKaart: string | null;
  aantalArtikelen: number;
}

export function getVerkoopbonnen(token: string): Promise<ApiVerkoopbon[]> {
  return request('/api/sales/list.php', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface ApiVerkoopbonArtikel {
  id: number;
  productId: number;
  naam: string;
  sku: string;
  barcode: string;
  eenheid: string;
  aantal: number;
  stukprijs: number;
  btwPercentage: number;
  korting: number;
  subtotaal: number;
}

export interface ApiVerkoopbonDetail extends ApiVerkoopbon {
  klantEmail: string | null;
  klantTelefoon: string | null;
}

export function getVerkoopbonDetail(
  token: string,
  id: number,
): Promise<{ bon: ApiVerkoopbonDetail; artikelen: ApiVerkoopbonArtikel[] }> {
  return request(`/api/sales/get.php?id=${id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Statistieken ───────────────────────────────────────────────────────────

export type StatsMetric = 'verkoop' | 'derving';
export type StatsGroepering = 'afdeling' | 'categorie' | 'product' | 'reden';

export interface ApiStatsPeriode {
  aantal: number;
  bedrag: number;
}

export interface ApiStatsTrendPunt {
  label: string;
  aantal: number;
  bedrag: number;
}

export interface ApiStatsBreakdownItem {
  id: string;
  naam: string;
  aantal: number;
  bedrag: number;
  percentage: number;
  /** Alleen aanwezig bij groepering "product" — voor doorklikken naar het product. */
  barcode?: string;
}

export interface ApiStatsOverview {
  metric: StatsMetric;
  groepering: StatsGroepering;
  periode: { van: string; tot: string };
  totaal: ApiStatsPeriode;
  vorige: ApiStatsPeriode;
  trend: ApiStatsTrendPunt[];
  breakdown: ApiStatsBreakdownItem[];
  topProducten: ApiStatsBreakdownItem[];
  /** Alleen aanwezig bij metric "derving". */
  dervingPercentageVanOmzet?: number | null;
}

export interface StatsOverviewParams {
  metric: StatsMetric;
  groepering: StatsGroepering;
  van: string;
  tot: string;
  afdeling?: string;
  categorieId?: number;
}

export function getStatsOverview(token: string, params: StatsOverviewParams): Promise<ApiStatsOverview> {
  const q = new URLSearchParams({
    metric: params.metric,
    groepering: params.groepering,
    van: params.van,
    tot: params.tot,
  });
  if (params.afdeling) q.set('afdeling', params.afdeling);
  if (params.categorieId) q.set('categorieId', String(params.categorieId));
  return request(`/api/stats/overview.php?${q.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface ApiSchapVullingCategorie {
  categorie: string;
  totaal: number;
  opSchap: number;
  percentage: number;
}

export interface ApiSchapVulling {
  perCategorie: ApiSchapVullingCategorie[];
  totaal: { totaal: number; opSchap: number; percentage: number };
}

/** Percentage volle schappen, per productcategorie — alleen van de eigen afdeling van de gebruiker. */
export function getSchapVulling(token: string): Promise<ApiSchapVulling> {
  return request('/api/stock/schapvulling.php', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface ApiProfile extends ApiUser {
  emergencyTelefoon?: string | null;
  emergencyEmail?: string | null;
}

export function getAccount(
  token: string,
  id?: number,
): Promise<{ user: ApiProfile; isEigen: boolean }> {
  const query = id !== undefined ? `?id=${id}` : '';
  return request(`/api/accounts/get.php${query}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type AccountStatus = 'uitgenodigd' | 'actief' | 'inactief' | 'geblokkeerd';

export interface ApiStaffMember {
  id: number;
  naam: string;
  initialen: string;
  email: string;
  telefoonnummer: string | null;
  profielfoto: string | null;
  rol: string;
  afdeling: string;
  status: AccountStatus;
}

/** Personeelslijst — teamleider: eigen afdeling, (assistent-)filiaalmanager: heel filiaal. */
export function getStaff(token: string): Promise<ApiStaffMember[]> {
  return request('/api/accounts/staff-list.php', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type Rank =
  | 'Vakkenvuller' | 'Kassamedewerker' | 'Medewerker' | 'Medewerker AGF' | 'Medewerker Vers'
  | 'Medewerker Brood' | 'Medewerker KW' | 'Medewerker Bakkerij' | 'Medewerker Slagerij'
  | 'Nachtploeg Medewerker' | 'Senior Medewerker' | 'Teamleider' | 'Teamleider AGF'
  | 'Teamleider Vers' | 'Teamleider Brood' | 'Teamleider KW' | 'Teamleider Kassa & Boetiek'
  | 'Assistent Filiaalmanager' | 'Filiaalmanager' | 'Regiomanager' | 'Inkoper'
  | 'Logistiek Coördinator' | 'HR Medewerker' | 'ICT Beheerder' | 'Financieel Medewerker'
  | 'Directielid' | 'Beheerder';

export const ALLE_RANGEN: Rank[] = [
  'Vakkenvuller', 'Kassamedewerker', 'Medewerker', 'Medewerker AGF', 'Medewerker Vers',
  'Medewerker Brood', 'Medewerker KW', 'Medewerker Bakkerij', 'Medewerker Slagerij',
  'Nachtploeg Medewerker', 'Senior Medewerker', 'Teamleider', 'Teamleider AGF',
  'Teamleider Vers', 'Teamleider Brood', 'Teamleider KW', 'Teamleider Kassa & Boetiek',
  'Assistent Filiaalmanager', 'Filiaalmanager', 'Regiomanager', 'Inkoper',
  'Logistiek Coördinator', 'HR Medewerker', 'ICT Beheerder', 'Financieel Medewerker',
  'Directielid', 'Beheerder',
];

export type Afdeling = 'AGF' | 'Kassa & Boetiek' | 'KW' | 'Vers' | 'Brood';

export const ALLE_AFDELINGEN: Afdeling[] = ['AGF', 'Kassa & Boetiek', 'KW', 'Vers', 'Brood'];

/** Genereert een nieuwe 6-cijferige kassacode voor een medewerker. */
export function generateRegisterCode(token: string, accountId: number): Promise<{ code: string }> {
  return request('/api/accounts/generate-register-code.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ accountId }),
  });
}

export interface NieuwPersoneelslid {
  voornaam: string;
  tussenvoegsel?: string;
  achternaam: string;
  email: string;
  telefoonnummer: string;
  geboortedatum?: string;
  rank: Rank;
  department: Afdeling;
}

/** Nodigt een nieuwe medewerker uit (status 'invited') — vereist de permissie "personeel_aanmaken". */
export function createStaffAccount(
  token: string,
  data: NieuwPersoneelslid,
): Promise<{ id: number; activatieCode: string }> {
  return request('/api/accounts/create.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export interface UpdateStaffInput {
  rank?: Rank;
  department?: Afdeling;
  status?: 'actief' | 'inactief' | 'geblokkeerd';
}

/** Rang/afdeling/status van een medewerker wijzigen (personeelsbeheer). */
export function updateStaffMember(
  token: string,
  accountId: number,
  data: UpdateStaffInput,
): Promise<{ ok: true }> {
  return request('/api/accounts/manage.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ accountId, ...data }),
  });
}

export interface ApiPermissie {
  id: number;
  naam: string;
  label: string;
  omschrijving: string | null;
  effectief: boolean;
  bron: 'rank' | 'department' | 'account' | null;
  override: 'grant' | 'revoke' | null;
}

export interface ApiPermissieCategorie {
  categorie: string;
  permissies: ApiPermissie[];
}

/** Volledige permissie-catalogus voor één medewerker, per categorie. */
export function getStaffPermissions(token: string, accountId: number): Promise<ApiPermissieCategorie[]> {
  return request(`/api/accounts/permissions.php?accountId=${accountId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function updateStaffPermission(
  token: string,
  accountId: number,
  permissionId: number,
  action: 'grant' | 'revoke' | 'reset',
): Promise<{ ok: true }> {
  return request('/api/accounts/permissions-update.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ accountId, permissionId, action }),
  });
}

export type RepeatInterval = 'Yearly' | 'quarterly' | 'monthly' | 'weekly' | 'daily' | 'specific_day';
export type RepeatDay = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export type Prioriteit = 'hoog' | 'midden' | 'laag';

export interface NieuweTaak {
  title: string;
  description?: string;
  department: Afdeling;
  assignedToId?: number;
  /** Extra toegewezenen naast assignedToId. */
  assigneeIds?: number[];
  deadline?: string;
  repeatInterval?: RepeatInterval;
  repeatDay?: RepeatDay;
  priority?: Prioriteit;
  /** Koppelt de taak aan een product (via barcode, server zoekt het product_id op). */
  barcode?: string;
}

/** Nieuwe taak aanmaken/toewijzen (personeelsbeheer + het algemene "Nieuwe taak"-scherm). */
export function createTask(token: string, data: NieuweTaak): Promise<{ id: number }> {
  return request('/api/tasks/create.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

// ─── Taken (overzicht, detail, checklist, reacties) ────────────────────────

export type TaakStatus = 'Todo' | 'active' | 'finish';

export interface ApiTaakToegewezene {
  id: number;
  naam: string;
}

export interface ApiTaakSamenvatting {
  id: number;
  titel: string;
  beschrijving: string;
  afdeling: Afdeling;
  status: TaakStatus;
  prioriteit: Prioriteit | null;
  deadline: string | null;
  toegewezenAan: ApiTaakToegewezene | null;
  extraToegewezenen: ApiTaakToegewezene[];
  aangemaaktDoorId: number;
  aangemaaktOp: string;
  checklistTotaal: number;
  checklistAfgerond: number;
  magBewerken: boolean;
}

export function getTasks(token: string): Promise<ApiTaakSamenvatting[]> {
  return request('/api/tasks/list.php', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface ApiTaakChecklistItem {
  id: number;
  label: string;
  gedaan: boolean;
}

export interface ApiTaakReactie {
  id: number;
  parentId: number | null;
  tekst: string;
  auteurId: number;
  auteurNaam: string;
  auteurFoto: string | null;
  tijd: string;
}

export type TaakActiviteitType = 'created' | 'status_changed' | 'assigned' | 'comment';

export interface ApiTaakActiviteit {
  id: number;
  type: TaakActiviteitType;
  detail: string | null;
  accountNaam: string;
  tijd: string;
}

export interface ApiTaakDetail {
  id: number;
  titel: string;
  beschrijving: string;
  afdeling: Afdeling;
  status: TaakStatus;
  prioriteit: Prioriteit | null;
  startTime: string | null;
  deadline: string | null;
  herhaalInterval: RepeatInterval | null;
  herhaalDag: RepeatDay | null;
  toegewezenAan: ApiTaakToegewezene | null;
  extraToegewezenen: ApiTaakToegewezene[];
  product: { id: number; naam: string; barcode: string } | null;
  aangemaaktDoor: ApiTaakToegewezene;
  aangemaaktOp: string;
  bijgewerktOp: string;
  magBewerken: boolean;
  magVerwijderen: boolean;
  checklist: ApiTaakChecklistItem[];
  reacties: ApiTaakReactie[];
  activiteit: ApiTaakActiviteit[];
}

export function getTask(token: string, id: number): Promise<ApiTaakDetail> {
  return request(`/api/tasks/get.php?id=${id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface UpdateTaakInput {
  taskId: number;
  titel?: string;
  beschrijving?: string;
  deadline?: string | null;
  prioriteit?: Prioriteit | null;
  status?: TaakStatus;
}

export function updateTask(token: string, data: UpdateTaakInput): Promise<{ success: true }> {
  return request('/api/tasks/update.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export function deleteTask(token: string, taskId: number): Promise<{ success: true }> {
  return request('/api/tasks/delete.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ taskId }),
  });
}

export function addTaakChecklistItem(token: string, taskId: number, label: string): Promise<{ id: number }> {
  return request('/api/tasks/checklist-item.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ taskId, action: 'add', label }),
  });
}

export function toggleTaakChecklistItem(token: string, taskId: number, itemId: number): Promise<{ success: true }> {
  return request('/api/tasks/checklist-item.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ taskId, action: 'toggle', itemId }),
  });
}

export function removeTaakChecklistItem(token: string, taskId: number, itemId: number): Promise<{ success: true }> {
  return request('/api/tasks/checklist-item.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ taskId, action: 'remove', itemId }),
  });
}

export function addTaakReactie(
  token: string,
  taskId: number,
  tekst: string,
  parentCommentId?: number,
): Promise<{ id: number }> {
  return request('/api/tasks/comment.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ taskId, tekst, parentCommentId: parentCommentId ?? null }),
  });
}

export interface UpdateProfileInput {
  voornaam: string;
  tussenvoegsel?: string | null;
  achternaam: string;
  telefoonnummer?: string | null;
  geboortedatum?: string | null;
  emergencyTelefoon?: string | null;
  emergencyEmail?: string | null;
}

export function updateProfile(
  token: string,
  data: UpdateProfileInput,
): Promise<{ user: ApiProfile }> {
  return request('/api/accounts/update.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export interface UpdateStaffProfileInput {
  accountId: number;
  voornaam: string;
  tussenvoegsel?: string | null;
  achternaam: string;
  telefoonnummer?: string | null;
  geboortedatum?: string | null;
}

/** Basisgegevens van een collega bijwerken — alleen toegestaan voor wie `mag_beheren` is over dat account. */
export function updateStaffProfile(
  token: string,
  data: UpdateStaffProfileInput,
): Promise<{ user: ApiProfile }> {
  return request('/api/accounts/manage-profile.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

/** Multipart-upload — mag niet via request() lopen, dat forceert application/json. */
export async function uploadProfilePhoto(
  token: string,
  localUri: string,
): Promise<{ profielfoto: string }> {
  const filename = localUri.split('/').pop() ?? 'foto.jpg';
  const ext = /\.(\w+)$/.exec(filename)?.[1]?.toLowerCase() ?? 'jpg';
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const form = new FormData();
  form.append('photo', { uri: localUri, name: filename, type: mime } as unknown as Blob);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/accounts/upload-photo.php`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    throw new ApiError('Kan geen verbinding maken met de server.');
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(body?.error ?? 'Uploaden is mislukt.');
  }

  return body;
}

export type VerlofType = 'vakantie' | 'ziekte' | 'verlof' | 'onbetaald_verlof' | 'bijzonder_verlof';

export interface ApiVerlofaanvraag {
  id: number;
  medewerkerId: number;
  medewerkerNaam: string;
  afdelingId: string;
  type: VerlofType;
  typeLabel: string;
  /** Datum + tijd, bv. '2026-07-10 09:00:00'. */
  van: string;
  /** Datum + tijd, bv. '2026-07-14 17:00:00'. */
  tot: string;
  reden: string | null;
  status: 'open' | 'goedgekeurd' | 'afgewezen' | 'geannuleerd';
  /** Notitie van de manager bij het goed-/afkeuren (null zolang nog niet beslist). */
  notitie: string | null;
  aangevraagdOp: string;
}

/** Openstaande verlofaanvragen — rolgebonden gescoped door de server (zie php-api/leave-requests/list.php). */
export function getVerlofaanvragen(token: string): Promise<ApiVerlofaanvraag[]> {
  return request('/api/leave-requests/list.php', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface ApiVerlofaanvraagDetail extends ApiVerlofaanvraag {
  beslistDoorNaam: string | null;
  magBeslissen: boolean;
  isEigen: boolean;
}

export function getVerlofaanvraag(token: string, id: number): Promise<ApiVerlofaanvraagDetail> {
  return request(`/api/leave-requests/get.php?id=${id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Eigen verlofaanvragen, alle statussen (niet alleen openstaand). */
export function getMijnVerlofaanvragen(token: string): Promise<ApiVerlofaanvraag[]> {
  return request('/api/leave-requests/mine.php', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function beslisVerlofaanvraag(
  token: string,
  id: number,
  status: 'goedgekeurd' | 'afgewezen',
  notitie?: string,
): Promise<{ ok: true }> {
  return request('/api/leave-requests/decide.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id, status, notitie }),
  });
}

export interface NieuweVerlofaanvraag {
  type: VerlofType;
  /** Datum + tijd, bv. '2026-07-10 09:00:00'. */
  startDate: string;
  /** Datum + tijd, bv. '2026-07-14 17:00:00'. */
  endDate: string;
  reason?: string;
}

export function maakVerlofaanvraag(
  token: string,
  data: NieuweVerlofaanvraag,
): Promise<{ id: number }> {
  return request('/api/leave-requests/create.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export interface ApiGoedgekeurdVerlof {
  id: number;
  accountId: number;
  type: VerlofType;
  typeLabel: string;
  van: string;
  tot: string;
}

/** Goedgekeurd verlof in een periode — gebruikt om inplannen te blokkeren op verlofdagen. */
export function getGoedgekeurdVerlof(token: string, van: string, tot: string): Promise<ApiGoedgekeurdVerlof[]> {
  return request(`/api/leave-requests/goedgekeurd.php?van=${van}&tot=${tot}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Producten ──────────────────────────────────────────────────────────────

export type Opslagwijze = 'ambient' | 'koel' | 'vries';

export interface ApiProductFiliaal {
  opSchap: number;
  magazijn: number;
  gereserveerd: number;
  minimum: number;
  schapGrootte: number;
  /** null = nog geen THT ingesteld (bv. niet-bederfelijk artikel, of net aangemaakt/geactiveerd). */
  kortsteTht: string | null;
  laatsteLevering: string;
  opslag: Opslagwijze | null;
  biologisch: boolean;
  uitgelicht: boolean;
  notities: string | null;
  /** null = filiaal heeft nog geen schap gekozen (net centraal aangemaakt product). */
  schapId: number | null;
  schapNaam: string | null;
}

export interface ApiProduct {
  id: number;
  barcode: string;
  sku: string;
  pluCode: string;
  naam: string;
  categorie: string;
  subcategorie: string;
  merk: string;
  leverancier: string;
  eenheidType: string;
  eenheidGrootte: number;
  colloGrootte: number;
  verkoopprijs: number;
  afbeelding: string | null;
  filiaal: ApiProductFiliaal;
}

export function getProduct(token: string, barcode: string): Promise<ApiProduct> {
  return request(`/api/products/get.php?barcode=${encodeURIComponent(barcode)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getProductByPlu(token: string, pluCode: string): Promise<ApiProduct> {
  return request(`/api/products/get.php?plu=${encodeURIComponent(pluCode)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface ApiProductVerkoopPeriode {
  aantal: number;
  omzet: number;
}

export interface ApiProductVerkoopStats {
  /** Deze week tot en met vandaag. */
  huidigeWeek: ApiProductVerkoopPeriode;
  /** Vorige volledige week (maandag t/m zondag). */
  vorigeWeek: ApiProductVerkoopPeriode;
  /** Gemiddelde van de laatste 4 volledige weken. */
  prognose: ApiProductVerkoopPeriode;
}

export function getProductVerkoopStats(token: string, productId: number): Promise<ApiProductVerkoopStats> {
  return request(`/api/products/sales-stats.php?id=${productId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface ApiGerelateerdProduct {
  id: number;
  naam: string;
  barcode: string;
  afbeelding: string | null;
  verkoopprijs: number;
  aantalSamen: number;
  /** % van de bonnen mét dit product waar het gerelateerde product ook op stond. */
  percentage: number;
}

/** Producten die vaak op dezelfde kassabon staan als dit product (market-basket, eigen filiaal). */
export function getGerelateerdeProducten(token: string, productId: number): Promise<ApiGerelateerdProduct[]> {
  return request(`/api/products/related.php?id=${productId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface ApiExpiringProduct {
  barcode: string;
  naam: string;
  sku: string;
  pluCode: string;
  kortsteTht: string;
}

export function getExpiringProducts(token: string, dagen = 5): Promise<ApiExpiringProduct[]> {
  return request(`/api/products/expiring.php?dagen=${dagen}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface UpdateProductBranchInput {
  barcode: string;
  opSchap: number;
  magazijn: number;
  kortsteTht?: string | null;
  opslag?: Opslagwijze | null;
  biologisch?: boolean;
  uitgelicht?: boolean;
  notities?: string | null;
}

export function updateProductBranch(
  token: string,
  data: UpdateProductBranchInput,
): Promise<{ success: true }> {
  return request('/api/products/update-branch.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export interface ApiProductDashboardStats {
  totaal: number;
  verlopen: number;
  bijnaVerlopen: number;
  lageVoorraad: number;
}

export function getProductDashboardStats(token: string): Promise<ApiProductDashboardStats> {
  return request('/api/products/dashboard-stats.php', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface ApiAandachtsartikel {
  barcode: string;
  naam: string;
  categorie: string;
  locatie: string;
  voorraadWinkel: number;
  dagen: number;
}

export function getAandachtsartikelen(
  token: string,
  minDagen = 30,
  limiet = 5,
): Promise<ApiAandachtsartikel[]> {
  return request(`/api/products/aandachtsartikelen.php?minDagen=${minDagen}&limiet=${limiet}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface ApiSubcategorie {
  id: number;
  naam: string;
}

export interface ApiCategorie {
  id: number;
  naam: string;
  subcategorieen: ApiSubcategorie[];
}

export interface ApiMerk {
  id: number;
  naam: string;
}

export interface ApiLeverancier {
  id: number;
  naam: string;
}

export interface ApiSchap {
  id: number;
  naam: string;
  afdeling: string;
}

export interface ApiProductLookups {
  categorieen: ApiCategorie[];
  merken: ApiMerk[];
  leveranciers: ApiLeverancier[];
  schappen: ApiSchap[];
}

export function getProductLookups(token: string): Promise<ApiProductLookups> {
  return request('/api/products/lookups.php', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface NieuwProduct {
  barcode: string;
  sku: string;
  pluCode: string;
  naam: string;
  shortName: string;
  description: string;
  subcategorieId: number;
  merkId: number;
  leverancierId: number;
  eenheidType: string;
  eenheidGrootte: number;
  colloGrootte: number;
  verkoopprijs: number;
  /** Geldt voor alle filialen tegelijk — wordt bij aanmaken op elke product_branch-rij gezet. */
  opslag?: Opslagwijze | null;
  biologisch?: boolean;
  uitgelicht?: boolean;
}

export function createProduct(
  token: string,
  data: NieuwProduct,
): Promise<{ id: number; barcode: string; filialen: number }> {
  return request('/api/products/create.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export interface ApiProductZoekresultaat {
  id: number;
  barcode: string;
  naam: string;
  shortName: string;
  merk: string;
}

/** Catalogus-brede zoekopdracht (niet gebonden aan één filiaal) — voor het kiezen van een product bij een recall. */
export function searchProducts(token: string, q: string): Promise<ApiProductZoekresultaat[]> {
  return request(`/api/products/search.php?q=${encodeURIComponent(q)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Eén productfoto uploaden — meerdere keren aanroepen voor meerdere foto's. */
export async function uploadProductImage(
  token: string,
  productId: number,
  localUri: string,
): Promise<{ id: number; url: string }> {
  const filename = localUri.split('/').pop() ?? 'foto.jpg';
  const ext = /\.(\w+)$/.exec(filename)?.[1]?.toLowerCase() ?? 'jpg';
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const form = new FormData();
  form.append('productId', String(productId));
  form.append('photo', { uri: localUri, name: filename, type: mime } as unknown as Blob);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/products/upload-image.php`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    throw new ApiError('Kan geen verbinding maken met de server.');
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(body?.error ?? 'Uploaden is mislukt.');
  }

  return body;
}

export interface ApiNieuweProductVoorFiliaal {
  barcode: string;
  sku: string;
  pluCode: string;
  naam: string;
  shortName: string;
  merk: string;
  categorie: string;
  afbeelding: string | null;
}

/** Centraal aangemaakte producten die nog geen filiaalgegevens (schap/voorraad/THT) hebben voor dit filiaal. */
export function getNieuweProductenVoorFiliaal(token: string): Promise<ApiNieuweProductVoorFiliaal[]> {
  return request('/api/products/needs-branch-info.php', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface ActiveerProductInput {
  barcode: string;
  schapId: number;
  opSchap: number;
  magazijn: number;
  kortsteTht?: string | null;
  minimum?: number;
  schapGrootte?: number;
}

/** Maakt de eerste product_branch-rij aan voor dit filiaal (tegenhanger van updateProductBranch, dat een bestaande rij verwacht). */
export function activeerProductBranch(
  token: string,
  data: ActiveerProductInput,
): Promise<{ success: true }> {
  return request('/api/products/activate-branch.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

// ─── Recalls ────────────────────────────────────────────────────────────────

export interface NieuweRecall {
  productId: number;
  titel: string;
  criteriaNotitie?: string;
  thtVan?: string;
  thtTot?: string;
  startTime?: string;
  deadline?: string;
  alleFilialen: boolean;
  branchIds?: number[];
}

export function createRecall(
  token: string,
  data: NieuweRecall,
): Promise<{ id: number; aangemaakt: number; overgeslagen: number }> {
  return request('/api/recalls/create.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export interface ApiRecallSamenvatting {
  id: number;
  titel: string;
  productNaam: string;
  productBarcode: string;
  alleFilialen: boolean;
  aangemaaktDoor: string;
  aangemaaktOp: string;
  totaalFilialen: number;
  aangemaaktFilialen: number;
}

export function getRecalls(token: string): Promise<ApiRecallSamenvatting[]> {
  return request('/api/recalls/list.php', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type RecallFiliaalStatus = 'aangemaakt' | 'overgeslagen';

export interface ApiRecallFiliaal {
  branchId: number;
  naam: string;
  stad: string;
  afdeling: string | null;
  status: RecallFiliaalStatus;
  taakId: number | null;
  taakStatus: string | null;
}

export interface ApiRecallDetail {
  id: number;
  titel: string;
  criteriaNotitie: string | null;
  thtVan: string | null;
  thtTot: string | null;
  alleFilialen: boolean;
  productId: number;
  productNaam: string;
  productBarcode: string;
  aangemaaktDoor: string;
  aangemaaktOp: string;
  filialen: ApiRecallFiliaal[];
}

export function getRecall(token: string, id: number): Promise<ApiRecallDetail> {
  return request(`/api/recalls/get.php?id=${id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface ApiRoosterMedewerker {
  id: number;
  voornaam: string | null;
  achternaam: string | null;
  naam: string;
  initialen: string;
  profielfoto: string | null;
  afdeling: Afdeling;
}

/** Lichte personeelslijst voor het dienstrooster — toegankelijk voor iedereen (i.t.t. getStaff, dat rang-gated is). */
export function getRoosterMedewerkers(token: string): Promise<ApiRoosterMedewerker[]> {
  return request('/api/accounts/roster.php', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Dienstrooster (shifts) ─────────────────────────────────────────────────

export type ShiftToeslag = 'Overuren' | 'Weekend' | 'Nacht' | 'Ziekte';

export interface ApiShift {
  id: number;
  accountId: number;
  medewerkerNaam: string;
  afdeling: Afdeling;
  datum: string;
  start: string;
  eind: string;
  toeslagen: ShiftToeslag[];
  gewerkt: boolean;
  notities: string | null;
  aangemaaktDoorId: number;
}

/** Dienstrooster tussen twee data (inclusief) — filiaalbreed voor filiaalmanager, anders eigen afdeling. */
export function getShifts(token: string, van: string, tot: string): Promise<ApiShift[]> {
  return request(`/api/shifts/list.php?van=${van}&tot=${tot}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface NieuweShift {
  accountId: number;
  afdeling: Afdeling;
  datum: string;
  start: string;
  eind: string;
  toeslagen?: ShiftToeslag[];
  notities?: string | null;
}

export function createShift(token: string, data: NieuweShift): Promise<{ id: number }> {
  return request('/api/shifts/create.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export interface UpdateShiftInput {
  id: number;
  datum?: string;
  start?: string;
  eind?: string;
  toeslagen?: ShiftToeslag[];
  notities?: string | null;
  gewerkt?: boolean;
}

export function updateShift(token: string, data: UpdateShiftInput): Promise<{ ok: true }> {
  return request('/api/shifts/update.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export function deleteShift(token: string, id: number): Promise<{ ok: true }> {
  return request('/api/shifts/delete.php', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id }),
  });
}

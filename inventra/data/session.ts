// ─── Ingelogde gebruiker & filiaal ────────────────────────────────────────────
// Gebruiker komt nu uit een echte login (zie contexts/auth-context.tsx).

import type { ApiBranch, ApiUser } from '@/lib/api';

export interface Afdeling {
  /** Komt overeen met Taak.categorie in data/tasks.ts */
  id: string;
  label: string;
}

export interface Filiaal {
  code: string;
  naam: string;
  plaats: string;
}

export interface Gebruiker {
  id: string;
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
  badges: string | null;
  /** Afdeling-id — gekoppeld aan Taak.categorie */
  afdelingId: string;
  /** Filiaal-id uit data/store-map.ts (Accounts.branch_id) — null als nog niet ingesteld. */
  branchId: number | null;
  filiaal: Filiaal;
  /** Namen uit `permissions.name` die momenteel effectief zijn (rang, afdeling, of losse override). */
  permissies: string[];
}

export const afdelingen: Afdeling[] = [
  { id: 'voorraad', label: 'Voorraad' },
  { id: 'tht',      label: 'THT' },
  { id: 'planning', label: 'Planning' },
  { id: 'retour',   label: 'Retouren' },
  { id: 'orders',   label: 'Orders' },
];

// Account heeft geen (geldig) branch_id? Dan een eerlijke "niet ingesteld"-
// placeholder tonen — geen verzonnen filiaalnaam die op echte data lijkt.
const onbekendFiliaal: Filiaal = {
  code: '—',
  naam: 'Geen filiaal ingesteld',
  plaats: '—',
};

export function filiaalVoorBranch(branchId: number | null, branches: ApiBranch[]): Filiaal {
  const branch = branchId !== null ? branches.find(b => b.id === branchId) : undefined;
  if (!branch) return onbekendFiliaal;
  return {
    code: `FIL-${String(branch.id).padStart(3, '0')}`,
    naam: branch.naam,
    plaats: branch.stad,
  };
}

export function mapAccountToGebruiker(account: ApiUser, branches: ApiBranch[]): Gebruiker {
  return {
    id: String(account.id),
    naam: account.naam,
    initialen: account.initialen,
    voornaam: account.voornaam,
    tussenvoegsel: account.tussenvoegsel,
    achternaam: account.achternaam,
    email: account.email,
    telefoonnummer: account.telefoonnummer,
    geboortedatum: account.geboortedatum,
    profielfoto: account.profielfoto,
    rol: account.rol,
    badges: account.badges,
    afdelingId: account.afdeling,
    branchId: account.branchId,
    filiaal: filiaalVoorBranch(account.branchId, branches),
    // Defensief: een sessie die vóór dit veld is gecachet (SecureStore) mist
    // het totdat auth-context.refresh() opnieuw ophaalt.
    permissies: account.permissies ?? [],
  };
}

export function getAfdelingLabel(id: string): string {
  return afdelingen.find(a => a.id === id)?.label ?? id;
}

// ─── Rolniveau (dashboard-weergave) ────────────────────────────────────────────
// Gebaseerd op Accounts.rank (via `rol`) — pas de matchwoorden hieronder aan
// zodra de echte rank-waarden in de database vastliggen. Onbekende/nieuwe
// rollen vallen bewust terug op 'medewerker' (minste rechten/weergave).

export type RolNiveau = 'medewerker' | 'teamleider' | 'filiaalmanager';

export function getRolNiveau(rol: string): RolNiveau {
  const r = rol.toLowerCase();
  if (r.includes('filiaalmanager')) return 'filiaalmanager';
  if (r.includes('teamleider')) return 'teamleider';
  return 'medewerker';
}

// Spiegelt php-api/rank_helper.php::mag_beheren() — alleen voor UI-gating
// (bv. de bewerk-knop tonen/verbergen). De server controleert dit sowieso
// opnieuw bij het opslaan, dus hier hoeft geen foutmelding uit te komen.
export function magPersoneelBeheren(
  gebruiker: Gebruiker | null,
  doelwit: { branchId: number | null; afdelingId: string },
): boolean {
  if (!gebruiker || gebruiker.branchId === null || doelwit.branchId === null) return false;
  if (gebruiker.branchId !== doelwit.branchId) return false;

  const niveau = getRolNiveau(gebruiker.rol);
  if (niveau === 'filiaalmanager') return true;
  if (niveau === 'teamleider') return gebruiker.afdelingId === doelwit.afdelingId;
  return false;
}

/** Mag deze gebruiker nieuwe producten aan de centrale catalogus toevoegen? */
export function magProductenAanmaken(gebruiker: Gebruiker | null): boolean {
  return !!gebruiker?.permissies.includes('producten_aanmaken');
}

/** Mag deze gebruiker nieuwe medewerkers uitnodigen (nieuw account aanmaken)? */
export function magPersoneelAanmaken(gebruiker: Gebruiker | null): boolean {
  return !!gebruiker?.permissies.includes('personeel_aanmaken');
}

/** Mag deze gebruiker productrecalls aanmaken? */
export function magRecallsAanmaken(gebruiker: Gebruiker | null): boolean {
  return !!gebruiker?.permissies.includes('recalls_aanmaken');
}

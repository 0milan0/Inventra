// ─── Verkoopcijfers ───────────────────────────────────────────────────────────
// "Verkoop per uur vandaag" komt uit een echte API (zie lib/api.ts →
// getVerkoopPerUur, gebaseerd op de `sales`-tabel) — getVerkoopVandaag()
// verwacht die opgehaalde lijst als argument in plaats van vaste seed-data.
//
// "Aandachtsartikelen" (lang niet verkocht) en de voorraad-dashboardcijfers
// komen inmiddels ook uit een echte API — zie lib/api.ts (getAandachtsartikelen,
// getProductDashboardStats, backend in php-api/products/). Schapvulling komt
// uit getSchapVulling (backend in php-api/stock/schapvulling.php).

export interface UurVerkoop {
  /** Uur van de dag, 24-uurs */
  uur: number;
  transacties: number;
  omzet: number;
}

export interface VerkoopTotaal {
  transacties: number;
  omzet: number;
  besteUur: UurVerkoop | null;
  huidigUur: UurVerkoop | null;
  piek: number;
}

export function getVerkoopVandaag(verkoopPerUur: UurVerkoop[]): VerkoopTotaal {
  const transacties = verkoopPerUur.reduce((s, u) => s + u.transacties, 0);
  const omzet = verkoopPerUur.reduce((s, u) => s + u.omzet, 0);
  const besteUur = verkoopPerUur.length === 0
    ? null
    : verkoopPerUur.reduce((a, b) => (b.omzet > a.omzet ? b : a));
  const nu = new Date().getHours();
  return {
    transacties,
    omzet,
    besteUur,
    huidigUur: verkoopPerUur.find(u => u.uur === nu) ?? null,
    piek: verkoopPerUur.length === 0 ? 0 : Math.max(...verkoopPerUur.map(u => u.transacties)),
  };
}

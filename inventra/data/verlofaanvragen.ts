// ─── Verlofaanvragen: weergave-helpers ─────────────────────────────────────────
// De data zelf komt nu via de API (zie lib/api.ts — getVerlofaanvragen /
// beslisVerlofaanvraag / maakVerlofaanvraag, backend in php-api/leave-requests/).
// Dit bestand bevat alleen de pure Dutch-weergave-formattering, generiek over
// elke vorm die minstens deze velden heeft.

import { getAfdelingLabel } from './session';

interface VerlofPeriode {
  afdelingId: string;
  typeLabel: string;
  van: string; // datum + tijd, bv. '2026-07-10 09:00:00'
  tot: string; // datum + tijd
}

/** "JJJJ-MM-DD UU:MM(:SS)" of "JJJJ-MM-DD" -> Date, zonder tijdzone-gedoe. */
function parseVerlofDatum(waarde: string): Date {
  const [datumDeel, tijdDeel] = waarde.split(' ');
  const [y, m, d] = (datumDeel ?? '').split('-').map(Number);
  if (!y || !m || !d) return new Date(waarde);
  const [hh, mm] = (tijdDeel ?? '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0);
}

const isMiddernacht = (d: Date) => d.getHours() === 0 && d.getMinutes() === 0;

/** bv. "10 – 14 jul" of "5 jul" als het hele dagen zijn, met tijd erbij als het dat niet is. */
export function formatPeriode(van: string, tot: string): string {
  const vanDate = parseVerlofDatum(van);
  const totDate = parseVerlofDatum(tot);
  const maand = totDate.toLocaleDateString('nl-NL', { month: 'short' });
  const heleDagen = isMiddernacht(vanDate) && isMiddernacht(totDate);
  const tijd = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const zelfdeDag = vanDate.toDateString() === totDate.toDateString();
  if (zelfdeDag) {
    return heleDagen ? `${vanDate.getDate()} ${maand}` : `${vanDate.getDate()} ${maand}, ${tijd(vanDate)} – ${tijd(totDate)}`;
  }

  const zelfdeMaand = vanDate.getMonth() === totDate.getMonth();
  const basis = zelfdeMaand
    ? `${vanDate.getDate()} – ${totDate.getDate()} ${maand}`
    : `${vanDate.getDate()} ${vanDate.toLocaleDateString('nl-NL', { month: 'short' })} – ${totDate.getDate()} ${maand}`;
  return heleDagen ? basis : `${basis} (${tijd(vanDate)} – ${tijd(totDate)})`;
}

export function verlofSamenvatting(v: VerlofPeriode): string {
  return `${v.typeLabel} · ${getAfdelingLabel(afdeling.afdelingId)} · ${formatPeriode(v.van, v.tot)}`;
}

// Eén bron voor alle kleuren die de plattegrond en schap-detailpagina delen.
// De basis komt uit de globale app-theme, zodat deze pagina aansluit op de
// rest van de app in light en dark mode.

import { Colors } from '@/constants/theme';

export const dark = {
  pageBg: Colors.dark.background,
  card: Colors.dark.card,
  surface: Colors.dark.card,
  surfaceRaised: '#20242A',
  text: Colors.dark.text,
  textSecondary: Colors.dark.textSecondary,
  textMuted: Colors.dark.tabIconDefault,
  border: Colors.dark.border,
  borderStrong: 'rgba(255,255,255,0.14)',
  accent: '#4C9EFF',
  danger: '#EF4444',
  warning: '#F2B84B',
  good: '#3FBE6B',
  equipment: '#A277FF',
  rackFill: 'rgba(255,255,255,0.07)',
  rackBorder: 'rgba(255,255,255,0.1)',
  rackDepthFill: 'rgba(0,0,0,0.32)',
  overlayScrim: 'rgba(0,0,0,0.55)',
  imgFallback: '#262A31',
  shadow: '#000000',
  // Vloer: licht-naar-donker verloop (linksboven -> rechtsonder) geeft de
  // platte kaart een gevoel van diepte/belichting zonder 'm echt te kantelen.
  floorFrom: '#22262E',
  floorTo: '#15171B',
  floorGridLine: 'rgba(255,255,255,0.045)',
};

export const light = {
  pageBg: Colors.light.background,
  card: Colors.light.card,
  surface: '#E9EDF3',
  surfaceRaised: Colors.light.background,
  text: Colors.light.text,
  textSecondary: Colors.light.textSecondary,
  textMuted: '#8A93A0',
  border: Colors.light.border,
  borderStrong: 'rgba(17,24,28,0.18)',
  accent: '#2F7BE0',
  danger: '#E23F3F',
  warning: '#C98A1F',
  good: '#2FA35B',
  equipment: '#7C5CFF',
  rackFill: 'rgba(17,24,28,0.045)',
  rackBorder: 'rgba(17,24,28,0.09)',
  rackDepthFill: 'rgba(17,24,28,0.22)',
  overlayScrim: 'rgba(0,0,0,0.4)',
  imgFallback: '#E2E6EC',
  shadow: '#11181C',
  floorFrom: '#F4F6F9',
  floorTo: '#DFE4EB',
  floorGridLine: 'rgba(17,24,28,0.06)',
};

export type Theme = typeof dark;

export function pickTheme(isDark: boolean): Theme {
  return isDark ? dark : light;
}

// Eigen accentkleur per schaptype — blijft bewust gelijk in beide thema's,
// dit zijn merk/categorie-kleuren, geen UI-kleuren.
export const SCHAP_ACCENTS: Record<string, string> = {
  Zuivel: '#4C9EFF',
  AGF: '#3FBE6B',
  Brood: '#F2B84B',
  Vlees: '#F2664B',
  Drank: '#37C6B0',
  Snoep: '#A277FF',
  Vries: '#37B6E0',
  Kassa: '#E0619E',
  'Non-food': '#E0619E',
};

// Zachte kaartschaduw, iets nadrukkelijker dan platte borders — geeft
// kaarten/sheets meer diepte zonder een aparte library nodig te hebben.
export function cardShadow(theme: Theme) {
  return {
    shadowColor: theme.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  } as const;
}

// Kortere, meer gerichte schaduw voor de schap-blokken op de kaart — alsof
// licht recht van boven komt, zodat ze op de vloer lijken te "staan" i.p.v.
// er los boven te zweven zoals een ambient card-shadow zou geven.
export function groundedShadow(theme: Theme) {
  return {
    shadowColor: theme.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  } as const;
}

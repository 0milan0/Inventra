/**
 * Shared design tokens: semantic colors, spacing, radius and shadows.
 * Screens should pull from here instead of hardcoding hex values,
 * so the whole app stays visually consistent and themeable in one place.
 */

import { Platform } from 'react-native';

export const Palette = {
  light: {
    bg: '#F4F5F7',
    surface: '#FFFFFF',
    surfaceAlt: '#F8F8FB',
    text: '#151519',
    textSecondary: '#6B6F76',
    textMuted: '#9AA0A8',
    border: 'rgba(20,20,25,0.08)',
    divider: 'rgba(20,20,25,0.06)',
    accent: '#5B54E8',
    accentSoft: '#EEEDFE',
    success: '#1D9E75',
    successSoft: '#E6F5EE',
    warning: '#B9790E',
    warningSoft: '#FCF0DA',
    danger: '#D6403F',
    dangerSoft: '#FCEBEB',
  },
  dark: {
    bg: '#111114',
    surface: '#1C1C21',
    surfaceAlt: '#232329',
    text: '#F2F2F5',
    textSecondary: '#A6A8B0',
    textMuted: '#7A7C84',
    border: 'rgba(255,255,255,0.09)',
    divider: 'rgba(255,255,255,0.07)',
    accent: '#8A82FF',
    accentSoft: '#26234A',
    success: '#3FCB96',
    successSoft: '#173229',
    warning: '#E3A93E',
    warningSoft: '#3A2C10',
    danger: '#F0625F',
    dangerSoft: '#3A1B1B',
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const FontFamily = 'Montserrat';

export const Shadow = Platform.select({
  ios: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
    },
    raised: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
    },
  },
  default: {
    card: { elevation: 2 },
    raised: { elevation: 6 },
  },
})!;

export function getPalette(isDark: boolean) {
  return isDark ? Palette.dark : Palette.light;
}

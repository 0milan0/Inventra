import { useSettings } from '@/contexts/settings-context';

/**
 * Geeft het actieve thema terug ('light' | 'dark'), rekening houdend met de
 * gekozen instelling (Systeem/Licht/Donker) in plaats van altijd blind het
 * systeemthema te volgen. Zelfde functienaam/signatuur als voorheen (toen dit
 * simpelweg React Native's eigen hook doorgaf) zodat alle bestaande
 * `useColorScheme() === 'dark'`-call sites ongewijzigd blijven werken.
 */
export function useColorScheme(): 'light' | 'dark' {
  return useSettings().colorScheme;
}

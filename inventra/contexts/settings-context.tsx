import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const THEME_KEY = 'settings_theme';
const HAPTICS_KEY = 'settings_haptics';
const AUTOLOCK_KEY = 'settings_autolock';
const START_SCREEN_KEY = 'settings_start_screen';

export type ThemePreference = 'system' | 'light' | 'dark';
export type AutoLockDelay = 'direct' | '1min' | '5min';
export type StartScreen = 'index' | 'products' | 'taken';

/** In milliseconden hoelang de app op de achtergrond mag zijn voordat we 'm vergrendelen. */
export const AUTOLOCK_DELAY_MS: Record<AutoLockDelay, number> = {
  direct: 0,
  '1min': 60_000,
  '5min': 5 * 60_000,
};

interface SettingsContextValue {
  isLoading: boolean;

  themePreference: ThemePreference;
  /** Het daadwerkelijk te gebruiken thema — 'system' al opgelost naar licht/donker. */
  colorScheme: 'light' | 'dark';
  setThemePreference: (value: ThemePreference) => void;

  hapticsEnabled: boolean;
  setHapticsEnabled: (value: boolean) => void;

  autoLockDelay: AutoLockDelay;
  setAutoLockDelay: (value: AutoLockDelay) => void;

  startScreen: StartScreen;
  setStartScreen: (value: StartScreen) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const systemScheme = useRNColorScheme();

  const [isLoading, setIsLoading] = useState(true);
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);
  const [autoLockDelay, setAutoLockDelayState] = useState<AutoLockDelay>('direct');
  const [startScreen, setStartScreenState] = useState<StartScreen>('index');

  useEffect(() => {
    (async () => {
      const [theme, haptics, autolock, start] = await Promise.all([
        SecureStore.getItemAsync(THEME_KEY),
        SecureStore.getItemAsync(HAPTICS_KEY),
        SecureStore.getItemAsync(AUTOLOCK_KEY),
        SecureStore.getItemAsync(START_SCREEN_KEY),
      ]);

      if (theme === 'light' || theme === 'dark' || theme === 'system') setThemePreferenceState(theme);
      if (haptics !== null) setHapticsEnabledState(haptics === '1');
      if (autolock === '1min' || autolock === '5min' || autolock === 'direct') setAutoLockDelayState(autolock);
      if (start === 'index' || start === 'products' || start === 'taken') setStartScreenState(start);

      setIsLoading(false);
    })();
  }, []);

  function setThemePreference(value: ThemePreference) {
    setThemePreferenceState(value);
    SecureStore.setItemAsync(THEME_KEY, value).catch(() => {});
  }

  function setHapticsEnabled(value: boolean) {
    setHapticsEnabledState(value);
    SecureStore.setItemAsync(HAPTICS_KEY, value ? '1' : '0').catch(() => {});
  }

  function setAutoLockDelay(value: AutoLockDelay) {
    setAutoLockDelayState(value);
    SecureStore.setItemAsync(AUTOLOCK_KEY, value).catch(() => {});
  }

  function setStartScreen(value: StartScreen) {
    setStartScreenState(value);
    SecureStore.setItemAsync(START_SCREEN_KEY, value).catch(() => {});
  }

  const colorScheme: 'light' | 'dark' = useMemo(() => {
    if (themePreference === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
    return themePreference;
  }, [themePreference, systemScheme]);

  const value: SettingsContextValue = {
    isLoading,
    themePreference,
    colorScheme,
    setThemePreference,
    hapticsEnabled,
    setHapticsEnabled,
    autoLockDelay,
    setAutoLockDelay,
    startScreen,
    setStartScreen,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings moet binnen een SettingsProvider gebruikt worden.');
  }
  return context;
}

import { AUTOLOCK_DELAY_MS, useSettings } from '@/contexts/settings-context';
import { mapAccountToGebruiker, type Gebruiker } from '@/data/session';
import {
    activateAccount as apiActivateAccount,
    getBranches,
    getMe,
    login as apiLogin,
    type ApiBranch,
    type ApiUser,
} from '@/lib/api';
import { registerDeviceForPush } from '@/lib/push-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const BIOMETRIC_KEY = 'biometric_enabled';

interface AuthContextValue {
  user: Gebruiker | null;
  token: string | null;
  /** Filialen van het eigen bedrijf, live uit de database (Branches-tabel). */
  branches: ApiBranch[];
  isLoading: boolean;
  isLocked: boolean;
  login: (email: string, password: string) => Promise<void>;
  activate: (email: string, code: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  unlockWithBiometrics: () => Promise<boolean>;
  /** Haalt profiel + filialen opnieuw op met het bestaande token, zonder opnieuw in te loggen. */
  refresh: () => Promise<void>;
  /** Face ID/vingerafdruk-vergrendeling aan- of uitzetten vanuit Instellingen. */
  biometricEnabled: boolean;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function vraagBiometrieAan(): Promise<boolean> {
  const alBeslist = await SecureStore.getItemAsync(BIOMETRIC_KEY);
  if (alBeslist !== null) {
    return alBeslist === '1';
  }

  const [heeftHardware, heeftEnrollment] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  if (!heeftHardware || !heeftEnrollment) {
    await SecureStore.setItemAsync(BIOMETRIC_KEY, '0');
    return false;
  }

  const akkoord = await new Promise<boolean>(resolve => {
    Alert.alert(
      'Snel inloggen',
      'Wil je de app voortaan ontgrendelen met Face ID / vingerafdruk in plaats van steeds opnieuw in te loggen?',
      [
        { text: 'Nee', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Ja', onPress: () => resolve(true) },
      ],
    );
  });

  await SecureStore.setItemAsync(BIOMETRIC_KEY, akkoord ? '1' : '0');
  return akkoord;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiUser, setApiUser] = useState<ApiUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<ApiBranch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const { autoLockDelay } = useSettings();

  async function laadFilialen(authToken: string) {
    try {
      setBranches(await getBranches(authToken));
    } catch {
      // Geen internet/server bereikbaar — filialen blijven leeg, schermen
      // vallen terug op een "niet ingesteld"-weergave i.p.v. te crashen.
    }
  }

  async function refresh() {
    if (!token) return;
    try {
      const [{ user: verseUser }, verseBranches] = await Promise.all([
        getMe(token),
        getBranches(token),
      ]);
      setApiUser(verseUser);
      setBranches(verseBranches);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(verseUser));
    } catch {
      // Verversen mag stil falen — de app blijft gewoon met de laatst bekende
      // gegevens werken (bv. geen internet op dat moment).
    }
  }

  // 'inactive' is op iOS ook de tussenstatus voor systeem-UI zoals de eigen
  // Face ID-prompt, control center of een inkomend gesprek — de app is dan
  // niet echt verlaten. Alleen 'background' betekent dat je 'm echt hebt
  // weggenavigeerd; dat tijdstip zetten we hier bij en checken/wissen we
  // zodra de app weer 'active' wordt (voor de "automatisch vergrendelen
  // na..."-instelling — bij 'direct' gedraagt dit zich als voorheen).
  const naarAchtergrondOp = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const [storedToken, storedUser, storedBiometric] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
        SecureStore.getItemAsync(BIOMETRIC_KEY),
      ]);

      const biometricAan = storedBiometric === '1';
      setBiometricEnabledState(biometricAan);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setApiUser(JSON.parse(storedUser));
        if (biometricAan) {
          setIsLocked(true);
        }
        laadFilialen(storedToken);
      }
      setIsLoading(false);
    })();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background') {
        naarAchtergrondOp.current = Date.now();
        return;
      }

      if (nextState === 'active') {
        if (naarAchtergrondOp.current !== null) {
          const weggeweest = Date.now() - naarAchtergrondOp.current;
          if (biometricEnabled && apiUser && weggeweest >= AUTOLOCK_DELAY_MS[autoLockDelay]) {
            setIsLocked(true);
          }
          if (apiUser) {
            refresh();
          }
        }
        naarAchtergrondOp.current = null;
      }
      // 'inactive' negeren we bewust: dat is ook de tussenstatus voor de
      // eigen Face ID-prompt, control center, een inkomend gesprek, etc.
    });
    return () => subscription.remove();
  }, [biometricEnabled, apiUser, token, autoLockDelay]);

  async function startSession(newToken: string, newUser: ApiUser) {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, newToken),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(newUser)),
    ]);

    setToken(newToken);
    setApiUser(newUser);
    await laadFilialen(newToken);

    registerDeviceForPush(newUser.id, newToken).catch(() => {
      // Push-registratie mag de login niet blokkeren.
    });

    vraagBiometrieAan()
      .then(setBiometricEnabledState)
      .catch(() => {
        // Geen biometrie beschikbaar of geweigerd — geen probleem, gewoon los blijven inloggen.
      });
  }

  /** Vanuit Instellingen: direct aan/uit, zonder de eenmalige opt-in-Alert. */
  async function setBiometricEnabled(enabled: boolean) {
    await SecureStore.setItemAsync(BIOMETRIC_KEY, enabled ? '1' : '0');
    setBiometricEnabledState(enabled);
  }

  async function login(email: string, password: string) {
    const { token: newToken, user: newUser } = await apiLogin(email, password);
    await startSession(newToken, newUser);
  }

  async function activate(email: string, code: string, password: string) {
    const { token: newToken, user: newUser } = await apiActivateAccount(email, code, password);
    await startSession(newToken, newUser);
  }

  async function logout() {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
    setToken(null);
    setApiUser(null);
    setBranches([]);
    setIsLocked(false);
  }

  async function unlockWithBiometrics(): Promise<boolean> {
    const resultaat = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Ontgrendel Inventra',
      cancelLabel: 'Annuleren',
    });
    if (resultaat.success) {
      setIsLocked(false);
    }
    return resultaat.success;
  }

  // Herberekent zodra branches binnenkomt (na login al gezet, maar ook
  // opnieuw als de filialen-fetch later dan de user-data binnenkomt).
  const user = useMemo(
    () => (apiUser ? mapAccountToGebruiker(apiUser, branches) : null),
    [apiUser, branches]
  );

  const value: AuthContextValue = {
    user,
    token,
    branches,
    isLoading,
    isLocked,
    login,
    activate,
    logout,
    unlockWithBiometrics,
    refresh,
    biometricEnabled,
    setBiometricEnabled,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth moet binnen een AuthProvider gebruikt worden.');
  }
  return context;
}

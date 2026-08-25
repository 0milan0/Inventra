import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View } from 'react-native';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';

import { BiometricUnlockScreen } from '@/components/biometric-unlock-screen';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { SettingsProvider, useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

// Zonder deze handler laat expo-notifications een binnenkomende melding
// stilletjes door zodra de app open/actief staat — Expo bevestigt dan wel
// aflevering, maar er verschijnt niets op het scherm.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function RootLayoutNav() {
  const { user, isLoading, isLocked } = useAuth();
  const { isLoading: settingsLoading, startScreen } = useSettings();
  const segments = useSegments();
  const router = useRouter();

  const gereed = !isLoading && !settingsLoading;

  // Los van de redirect-effect hieronder: mag maar één keer per app-start
  // gebeuren. Stond 'ie in hetzelfde effect als de redirect (die ook op
  // `segments` reageert), dan werd hideAsync() bij élke navigatie opnieuw
  // aangeroepen — en gaf iOS daarna "No native splash screen registered".
  useEffect(() => {
    if (gereed) {
      SplashScreen.hideAsync();
    }
  }, [gereed]);

  useEffect(() => {
    if (!gereed) return;

    const publiekSchermActief = segments[0] === 'login' || segments[0] === 'activeren';
    if (!user && !publiekSchermActief) {
      router.replace('/login');
    } else if (user && publiekSchermActief) {
      const doel = startScreen === 'index' ? '/(tabs)' : `/(tabs)/${startScreen}`;
      router.replace(doel as never);
    }
  }, [user, gereed, segments, router, startScreen]);

  if (!gereed) {
    return null;
  }

  return (
    <>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="activeren" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen
          name="modal-order-detail"
          options={{
            presentation: 'modal',
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="modal-new-order"
          options={{
            presentation: 'modal',
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="modal-order-contact"
          options={{
            presentation: 'modal',
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="modal-contact-list"
          options={{
            presentation: 'modal',
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen name="product/[barcode]" options={{ title: 'Product detail' }} />
        <Stack.Screen name="product/activeren/[barcode]" options={{ headerShown: false }} />
        <Stack.Screen name="schap/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="tasks/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="statistieken" options={{ headerShown: false }} />
        <Stack.Screen name="bonnen/pakbonnen" options={{ headerShown: false }} />
        <Stack.Screen name="bonnen/verkoopbonnen" options={{ headerShown: false }} />
        <Stack.Screen name="bonnen/verkoopbonnen/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="profile/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="producten-toevoegen" options={{ headerShown: false }} />
        <Stack.Screen name="recalls" options={{ headerShown: false }} />
        <Stack.Screen name="recalls/nieuw" options={{ headerShown: false }} />
        <Stack.Screen name="recalls/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="verlof/mijn" options={{ headerShown: false }} />
        <Stack.Screen name="verlof/nieuw" options={{ headerShown: false }} />
        <Stack.Screen name="verlof/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="personeel" options={{ headerShown: false }} />
        <Stack.Screen name="personeel/nieuw" options={{ headerShown: false }} />
        <Stack.Screen name="personeel/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="personeel/[id]/permissies" options={{ headerShown: false }} />
        <Stack.Screen name="order/new" options={{ presentation: 'modal', title: 'Nieuwe bestelling' }} />
        <Stack.Screen name="order/[id]" options={{ presentation: 'modal', title: 'Order detail' }} />
      </Stack>
      {isLocked && (
        <View style={StyleSheet.absoluteFill}>
          <BiometricUnlockScreen />
        </View>
      )}
    </>
  );
}

function RootLayoutThemed() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <RootLayoutNav />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsProvider>
        <AuthProvider>
          <RootLayoutThemed />
        </AuthProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}

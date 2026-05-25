import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
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
        <Stack.Screen name="order/new" options={{ presentation: 'modal', title: 'Nieuwe bestelling' }} />
        <Stack.Screen name="order/[id]" options={{ presentation: 'modal', title: 'Order detail' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

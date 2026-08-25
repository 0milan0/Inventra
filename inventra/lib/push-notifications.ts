import { registerDevice } from '@/lib/api';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

function deviceMarkerKey(userId: number) {
  return `push_device_token_${userId}`;
}

/**
 * Vraagt (indien nodig) een Expo push-token op voor dit device en stuurt 'm
 * alleen naar de server als dit device nog niet met dit token geregistreerd
 * stond voor deze gebruiker.
 */
export async function registerDeviceForPush(userId: number, authToken: string): Promise<void> {
  if (!Device.isDevice) {
    return; // Simulators/emulators/web hebben geen echt Expo push-token.
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: bestaandeStatus } = await Notifications.getPermissionsAsync();
  let status = bestaandeStatus;
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') {
    return; // Gebruiker weigert notificaties — login mag hierdoor niet mislukken.
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });

  const markerKey = deviceMarkerKey(userId);
  const geregistreerdToken = await SecureStore.getItemAsync(markerKey);
  if (geregistreerdToken === pushToken) {
    return; // Dit device staat al met dit token geregistreerd voor deze gebruiker.
  }

  const deviceName = Device.deviceName ?? Device.modelName ?? 'Onbekend apparaat';
  await registerDevice(authToken, deviceName, pushToken);
  await SecureStore.setItemAsync(markerKey, pushToken);
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Stuurt rechtstreeks een pushbericht via de publieke Expo push-API naar een
 * specifiek Expo push-token. Handig voor een handmatige testknop; voor echte
 * meldingen (bv. bij een db-event) hoort dit normaal server-side te gebeuren.
 *
 * Geeft het "ticket" van Expo terug — dat zegt alleen dat het verzoek is
 * geaccepteerd, nog niet of het bericht ook echt is afgeleverd. Gebruik
 * `checkExpoPushReceipt` een paar seconden later voor de echte status.
 */
export async function sendExpoPushNotification(
  pushToken: string,
  title: string,
  body: string,
): Promise<ExpoPushTicket> {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    // `to` als array sturen: Expo geeft de `data` in het antwoord dan altijd
    // als array terug (1 ticket erin). Stuur je een los token-string mee,
    // dan is `data` juist een los object i.p.v. een array — dat brak hier de
    // hieronder aangenomen `data[0]`-vorm en liet elke geslaagde send als
    // "mislukt" ogen.
    body: JSON.stringify({ to: [pushToken], sound: 'default', title, body }),
  });

  const json = await response.json().catch(() => null);
  const ticket: ExpoPushTicket | undefined = json?.data?.[0];

  if (!response.ok || !ticket) {
    throw new Error(json?.errors?.[0]?.message ?? 'Versturen van de notificatie is mislukt.');
  }
  if (ticket.status === 'error') {
    throw new Error(ticket.details?.error ? `${ticket.details.error}: ${ticket.message}` : ticket.message);
  }
  return ticket;
}

/**
 * Vraagt bij Expo de daadwerkelijke afleverstatus van een eerder verstuurd
 * ticket op (bv. 'DeviceNotRegistered' als het token niet meer geldig is).
 * Onmiddellijk na het versturen is deze meestal nog niet beschikbaar — roep
 * dit een paar seconden later aan.
 */
export async function checkExpoPushReceipt(ticketId: string): Promise<ExpoPushTicket | null> {
  const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids: [ticketId] }),
  });

  const json = await response.json().catch(() => null);
  return json?.data?.[ticketId] ?? null;
}

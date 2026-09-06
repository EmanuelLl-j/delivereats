import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; role: string; firstName: string };
};

const key = 'delivereats.client.session';

export async function getSession(): Promise<Session | null> {
  const value =
    Platform.OS === 'web'
      ? globalThis.localStorage?.getItem(key)
      : await SecureStore.getItemAsync(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as Session;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  const value = JSON.stringify(session);
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
  else
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
}

export async function clearSession(): Promise<void> {
  if (Platform.OS === 'web') globalThis.localStorage?.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type Session = { accessToken: string; refreshToken: string; user: { id: string; role: string; firstName: string; lastName?: string; emailVerifiedAt?: string | null } };
const key = 'delivereats.client.session';
let webSession: Session | null = null;
const listeners = new Set<(session: Session | null) => void>();
export function onSessionChanged(listener: (session: Session | null) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
// Browser exports are previews: tokens live in memory only. Native installs use the device keychain.
export async function getSession(): Promise<Session | null> {
  if (Platform.OS === 'web') {
    try { globalThis.localStorage?.removeItem(key); } catch { /* Legacy token cleanup is best effort. */ }
    return webSession;
  }
  const value = await SecureStore.getItemAsync(key);
  if (!value) return null;
  try { return JSON.parse(value) as Session; } catch { await SecureStore.deleteItemAsync(key); return null; }
}
export async function saveSession(session: Session) {
  const previous = await getSession();
  if (Platform.OS === 'web') webSession = session;
  else await SecureStore.setItemAsync(key, JSON.stringify(session), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  if (previous?.user.id !== session.user.id) listeners.forEach(listener => listener(session));
}
export async function clearSession() {
  webSession = null;
  if (Platform.OS === 'web') { try { globalThis.localStorage?.removeItem(key); } catch { /* No persistent credentials are used. */ } }
  else await SecureStore.deleteItemAsync(key);
  listeners.forEach(listener => listener(null));
}

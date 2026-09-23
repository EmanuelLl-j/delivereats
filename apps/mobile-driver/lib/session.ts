import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { isSession, parseSession, type Session } from './session-contract';
export type { Session } from './session-contract';
const key = 'delivereats.driver.session';
let webSession: Session | null = null;
const listeners = new Set<(session: Session | null) => void>();
export function onSessionChanged(listener: (session: Session | null) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
// Browser exports are previews: tokens live in memory only. Native installs use the device keychain.
export async function getSession(): Promise<Session | null> {
  if (Platform.OS === 'web') {
    try { globalThis.localStorage?.removeItem(key); } catch { /* Legacy token cleanup is best effort. */ }
    return webSession;
  }
  let value: string | null;
  try { value = await SecureStore.getItemAsync(key); } catch { return null; }
  const session = parseSession(value);
  if (value && !session) { try { await SecureStore.deleteItemAsync(key); } catch { /* Corrupt storage cleanup is best effort. */ } }
  return session;
}
export async function saveSession(session: Session) {
  if (!isSession(session)) throw new Error('La sesión recibida no cumple el contrato DRIVER.');
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

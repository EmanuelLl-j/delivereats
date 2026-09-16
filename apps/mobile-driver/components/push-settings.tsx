import { useEffect, useState } from 'react';
import { AppState, Platform, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { api } from '../lib/api';
import { getSession, onSessionChanged } from '../lib/session';
import { Button, colors } from './ui';

const configured = Platform.OS === 'android' && Constants.expoConfig?.extra?.pushConfigured === true;
async function register(ask: boolean) {
  if (!configured) throw new Error('Push Android pendiente de configurar Firebase y generar una compilación nativa. Las notificaciones internas siguen disponibles.');
  if (!await getSession()) return;
  await Notifications.setNotificationChannelAsync('deliveries', { name: 'Entregas y pedidos', importance: Notifications.AndroidImportance.HIGH, lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE });
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted || !ask ? existing : await Notifications.requestPermissionsAsync();
  if (!permission.granted) { if (ask) throw new Error('Permiso no concedido. Puedes cambiarlo en Ajustes del dispositivo.'); return; }
  const device = await Notifications.getDevicePushTokenAsync();
  if (device.type !== 'android' || typeof device.data !== 'string') throw new Error('No se recibió un token FCM Android válido');
  await api('/notifications/notifications/devices', { method: 'POST', body: JSON.stringify({ platform: 'android', token: device.data }) });
}
export function PushLifecycle() {
  useEffect(() => {
    if (!configured) return;
    const sync = () => { void register(false).catch(() => undefined); };
    sync();
    const session = onSessionChanged(value => { if (value) sync(); });
    const state = AppState.addEventListener('change', value => { if (value === 'active') sync(); });
    const token = Notifications.addPushTokenListener(() => sync());
    const response = Notifications.addNotificationResponseReceivedListener(event => {
      const orderId = event.notification.request.content.data?.orderId;
      // Only known app routes, never URLs supplied by a notification payload.
      // Delivery screens take assignment IDs, not order IDs. Home reloads the
      // authenticated driver's current offers and assignments before navigation.
      if (typeof orderId === 'string' && /^[a-f0-9-]{36}$/i.test(orderId)) router.push('/(tabs)/home');
    });
    return () => { session(); state.remove(); token.remove(); response.remove(); };
  }, []);
  return null;
}
export function PushSettings() {
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function enable() {
    setBusy(true); setMessage('');
    try { await register(true); setMessage('Dispositivo registrado. La recepción remota requiere Firebase operativo; registrar no prueba la entrega.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo registrar el dispositivo'); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 10 }}><Button label="Activar notificaciones de entregas" loading={busy} onPress={enable} /><Text style={{ color: colors.muted }}>{message || (configured ? 'Solicitaremos permiso solo si eliges activarlas. La sesión cerrada deja de recibir nuevas notificaciones.' : 'Push pendiente de credenciales externas. Puedes consultar las notificaciones dentro de la app.')}</Text></View>;
}

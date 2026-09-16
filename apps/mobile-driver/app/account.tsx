import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Share, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Field, colors } from '../components/ui';
import { LegalAcceptance } from '../components/legal-acceptance';
import { api, logout } from '../lib/api';
import { PushSettings } from '../components/push-settings';
type Profile = { firstName: string; lastName: string; phone: string | null; email: string; emailVerifiedAt: string | null };
type Ticket = { id: string; subject: string; description: string; status: string; response: string | null };
export default function AccountScreen() {
  const { mode = 'profile', orderId } = useLocalSearchParams<{ mode?: string; orderId?: string }>();
  const cache = useQueryClient();
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/users/auth/profile') });
  const consent = useQuery({ queryKey: ['privacy-consent'], queryFn: () => api<{ marketing: boolean }>('/users/privacy/consent'), enabled: mode === 'privacy' });
  const tickets = useQuery({ queryKey: ['support-tickets'], queryFn: () => api<Ticket[]>('/users/support/tickets'), enabled: mode === 'support' });
  const requests = useQuery({ queryKey: ['privacy-requests'], queryFn: () => api<Array<{ id: string; type: string; status: string; resolution?: string }>>('/users/privacy/requests'), enabled: mode === 'privacy' });
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [currentPassword, setCurrentPassword] = useState(''); const [newPassword, setNewPassword] = useState('');
  const [token, setToken] = useState(''); const [subject, setSubject] = useState(''); const [description, setDescription] = useState(''); const [type, setType] = useState('ACCESS');
  const [incident, setIncident] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => { if (profile.data) setForm({ firstName: profile.data.firstName, lastName: profile.data.lastName, phone: profile.data.phone ?? '' }); }, [profile.data]);
  async function run(operation: () => Promise<unknown>, success = 'Cambios guardados') {
    setBusy(true); setMessage('');
    try { await operation(); setMessage(success); await cache.invalidateQueries(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo completar la operación'); }
    finally { setBusy(false); }
  }
  const labels: Record<string, string> = { profile: 'Mi cuenta', security: 'Seguridad', privacy: 'Privacidad', support: 'Ayuda y soporte', legal: 'Términos del servicio' };
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22, gap: 17 }}>
    <Text style={{ fontSize: 28, fontWeight: '900', color: colors.navy }}>{labels[mode] ?? 'Mi cuenta'}</Text>
    {profile.isError && <Text accessibilityRole="alert" style={{ color: colors.red }}>{profile.error.message}</Text>}
    {mode === 'profile' && <>
      <PushSettings />
      <Text style={{ color: colors.muted }}>{profile.data?.email}</Text>
      <Field label="Nombres" value={form.firstName} onChangeText={value => setForm(current => ({ ...current, firstName: value }))} />
      <Field label="Apellidos" value={form.lastName} onChangeText={value => setForm(current => ({ ...current, lastName: value }))} />
      <Field label="Celular (opcional)" value={form.phone} onChangeText={value => setForm(current => ({ ...current, phone: value }))} keyboardType="phone-pad" />
      <Button label="Guardar perfil" loading={busy} onPress={() => run(() => api('/users/auth/profile', { method: 'PATCH', body: JSON.stringify({ ...form, phone: form.phone || undefined }) }))} />
      {!profile.data?.emailVerifiedAt && <>
        <Text style={{ color: '#92400e' }}>Verifica tu correo para continuar con las operaciones.</Text>
        <Field label="Código recibido por correo" value={token} onChangeText={setToken} autoCapitalize="none" />
        <Button label="Verificar correo" loading={busy} onPress={() => run(() => api('/users/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }), 'Correo verificado')} />
        <Button label="Reenviar código" loading={busy} onPress={() => run(() => api('/users/auth/resend-verification', { method: 'POST' }), 'Revisa tu correo; el código vence en 30 minutos')} />
      </>}
    </>}
    {mode === 'security' && <>
      <Field label="Contraseña actual" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
      <Field label="Nueva contraseña" value={newPassword} onChangeText={setNewPassword} secureTextEntry maxLength={72} />
      <Text style={{ color: colors.muted }}>Mínimo 12 caracteres, mayúscula, minúscula, número y símbolo. Las sesiones abiertas se revocarán.</Text>
      <Button label="Cambiar contraseña" loading={busy} onPress={() => run(async () => { await api('/users/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }); await logout().catch(() => undefined); cache.clear(); router.replace('/login'); }, 'Contraseña actualizada')} />
    </>}
    {mode === 'legal' && <LegalAcceptance />}
    {mode === 'privacy' && <>
      <View style={{ padding: 16, backgroundColor: 'white', borderRadius: 16, flexDirection: 'row', gap: 15, alignItems: 'center' }}><Text style={{ flex: 1, color: colors.navy }}>Quiero recibir comunicaciones promocionales (opcional)</Text><Switch accessibilityLabel="Consentimiento de marketing" disabled={busy || consent.isLoading} value={consent.data?.marketing ?? false} onValueChange={marketing => run(() => api('/users/privacy/consent', { method: 'PATCH', body: JSON.stringify({ marketing }) }))} /></View>
      <Button label="Exportar mis datos" loading={busy} onPress={() => run(async () => { const data = await api('/users/privacy/export'); await Share.share({ message: JSON.stringify(data, null, 2), title: 'Mis datos en DeliverEats' }); }, 'Exportación preparada')} />
      <Text style={{ color: colors.navy, fontWeight: '800' }}>Solicitud de privacidad</Text>
      <View style={{ gap: 8 }}>{[['ACCESS', 'Acceso a mis datos'], ['CORRECTION', 'Rectificación'], ['DELETION', 'Eliminación de cuenta'], ['OBJECTION', 'Oposición al tratamiento']].map(([value, label]) => <Button key={value} label={(type === value ? '✓ ' : '') + label} onPress={() => setType(value!)} />)}</View>
      <Field label="Describe tu solicitud" value={description} onChangeText={setDescription} multiline />
      <Button label="Enviar solicitud de privacidad" loading={busy} onPress={() => run(() => api('/users/privacy/requests', { method: 'POST', body: JSON.stringify({ type, description }) }), 'Solicitud registrada. Podrás revisar su estado aquí.')} />
      {requests.data?.map(row => <View key={row.id} style={{ borderRadius: 14, padding: 14, backgroundColor: 'white', gap: 6 }}><Text style={{ fontWeight: '800', color: colors.navy }}>{row.type} · {row.status}</Text>{row.resolution && <Text>{row.resolution}</Text>}</View>)}
    </>}
    {mode === 'support' && <>
      <Field label="Asunto" value={subject} onChangeText={setSubject} />
      <Field label="Cuéntanos qué ocurrió" value={description} onChangeText={setDescription} multiline />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text>Es una incidencia de entrega</Text><Switch value={incident} onValueChange={setIncident} accessibilityLabel="Es una incidencia" /></View>
      <Button label="Enviar consulta" loading={busy} onPress={() => run(async () => { await api('/users/support/tickets', { method: 'POST', body: JSON.stringify({ type: incident ? 'INCIDENT' : 'SUPPORT', subject, description, orderId }) }); setSubject(''); setDescription(''); }, 'Consulta registrada')} />
      {tickets.data?.map(ticket => <View key={ticket.id} style={{ backgroundColor: 'white', borderRadius: 15, padding: 15, gap: 8 }}><Text style={{ fontWeight: '800', color: colors.navy }}>{ticket.subject} · {ticket.status}</Text><Text>{ticket.description}</Text>{ticket.response && <Text style={{ color: colors.green }}>{ticket.response}</Text>}</View>)}
    </>}
    {!!message && <Text accessibilityRole="alert" style={{ borderRadius: 12, padding: 14, backgroundColor: '#e8edf7', color: colors.navy }}>{message}</Text>}
    <Button label="Volver" onPress={() => router.back()} />
  </ScrollView></SafeAreaView>;
}

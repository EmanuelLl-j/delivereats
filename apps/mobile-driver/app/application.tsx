import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, Field, Header } from '@/components/ui';
import { LegalAcceptance } from '@/components/legal-acceptance';
import { api, ApiError } from '@/lib/api';
import { uploadAsset } from '@/lib/upload';
type Profile = { applicationStatus: string; reviewReason?: string; documentNumber: string; vehicleType: string };
const vehicles = [{ id: 'BICYCLE', label: 'Bicicleta' }, { id: 'MOTORCYCLE', label: 'Moto' }, { id: 'CAR', label: 'Auto' }];
export default function Application() {
  const cache = useQueryClient();
  const [form, setForm] = useState({ documentNumber: '', vehicleType: 'BICYCLE', vehiclePlate: '', licenseNumber: '' });
  const [documents, setDocuments] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const profile = useQuery({ queryKey: ['driver-profile'], queryFn: async () => { try { return await api<Profile>('/drivers/drivers/me'); } catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; } } });
  const application = useMutation({ mutationFn: () => api('/drivers/drivers/me/application', { method: 'POST', body: JSON.stringify({ ...form, vehiclePlate: form.vehiclePlate || undefined, licenseNumber: form.licenseNumber || undefined, documentIds: documents }) }), onSuccess: async () => { await cache.invalidateQueries({ queryKey: ['driver-profile'] }); setMessage('Solicitud enviada. No podrás recibir entregas hasta su aprobación.'); }, onError: error => setMessage(error.message) });
  async function attach() { setUploading(true); try { const file = await uploadAsset('DRIVER_DOCUMENT'); if (file) setDocuments(current => [...current, file.id]); } catch (error) { setMessage(error instanceof Error ? error.message : 'Error al adjuntar'); } finally { setUploading(false); } }
  const canApply = !profile.data || profile.data.applicationStatus === 'REJECTED';
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}><ScrollView contentContainerStyle={{ padding: 22, gap: 14 }}>
    <Button label="Volver" tone="ghost" onPress={() => router.back()} />
    <Header eyebrow="DeliverEats Repartidor" title="Tu solicitud" subtitle="Documentación privada, revisión administrativa y vehículo validado antes de operar." />
    {profile.isError && <Text style={{ color: colors.red }}>{profile.error.message}</Text>}
    {profile.data && <View style={{ padding: 18, borderRadius: 18, backgroundColor: 'white', gap: 8 }}><Text style={{ fontWeight: '800', color: colors.navy }}>Estado: {profile.data.applicationStatus}</Text><Text>{profile.data.reviewReason ?? 'La revisión de tu documentación aparecerá aquí.'}</Text></View>}
    <LegalAcceptance types={['GENERAL_TERMS', 'PRIVACY_POLICY', 'DRIVER_TERMS']} />
    {canApply && !profile.isLoading && <>
      <Field label="DNI / documento" value={form.documentNumber} keyboardType="number-pad" onChangeText={documentNumber => setForm({ ...form, documentNumber })} />
      <Text style={{ color: colors.navy, fontWeight: '800' }}>Vehículo</Text>
      {vehicles.map(vehicle => <Button key={vehicle.id} label={(form.vehicleType === vehicle.id ? '✓ ' : '') + vehicle.label} tone={form.vehicleType === vehicle.id ? 'navy' : 'ghost'} onPress={() => setForm({ ...form, vehicleType: vehicle.id })} />)}
      {form.vehicleType !== 'BICYCLE' && <><Field label="Placa" autoCapitalize="characters" value={form.vehiclePlate} onChangeText={vehiclePlate => setForm({ ...form, vehiclePlate })} /><Field label="Licencia de conducir" value={form.licenseNumber} onChangeText={licenseNumber => setForm({ ...form, licenseNumber })} /></>}
      <Text style={{ color: colors.muted }}>Adjunta documento de identidad y, para vehículos motorizados, licencia, tarjeta de propiedad y seguro vigente. Hasta 6 archivos privados, máximo 8 MB por archivo.</Text>
      <Button label={'Adjuntar documento (' + documents.length + '/6)'} disabled={documents.length >= 6} loading={uploading} tone="ghost" onPress={attach} />
      {documents.map((id, index) => <Button key={id} label={'Quitar documento ' + (index + 1)} tone="ghost" onPress={() => setDocuments(current => current.filter(value => value !== id))} />)}
      <Button label="Enviar a revisión" disabled={!documents.length || profile.isError} loading={application.isPending} onPress={() => application.mutate()} />
    </>}
    {!!message && <Text accessibilityRole="alert" style={{ color: colors.navy }}>{message}</Text>}
  </ScrollView></SafeAreaView>;
}


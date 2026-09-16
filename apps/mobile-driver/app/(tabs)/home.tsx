import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, Header } from '@/components/ui';
import { AvailabilityMap } from '@/components/availability-map';
import type { GpsState } from '@/components/driver-tracking';
import { api, ApiError } from '@/lib/api';
type Assignment = { id: string; orderId: string; estimatedEarnings: string; pickupCount: number; destination?: string; expiresAt: string; status: string };
type Profile = { status: string; applicationStatus: string; reviewReason?: string; assignments: Assignment[] };
export default function DriverHome() {
  const cache = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState('');
  const profile = useQuery({ queryKey: ['driver-profile'], queryFn: async () => { try { return await api<Profile>('/drivers/drivers/me'); } catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; } }, refetchInterval: 5000, retry: false });
  const person = useQuery({ queryKey: ['profile'], queryFn: () => api<{ firstName: string }>('/users/auth/profile') });
  const approved = profile.data?.applicationStatus === 'APPROVED';
  const offer = useQuery({ queryKey: ['active-offer'], queryFn: () => api<Assignment | null>('/drivers/drivers/me/offers/active'), refetchInterval: 3000, enabled: approved, retry: false });
  const earnings = useQuery({ queryKey: ['driver-earnings', 'day'], queryFn: () => api<{ amount: number; completed: number }>('/drivers/drivers/me/earnings?period=day'), enabled: approved, refetchInterval: 15000 });
  const gps = useQuery<GpsState>({ queryKey: ['driver-gps'], enabled: false });
  const availability = useMutation({ mutationFn: async (status: string) => {
    if (status === 'AVAILABLE') {
      if (!(await Location.requestForegroundPermissionsAsync()).granted) throw new Error('Necesitas activar el permiso de ubicación para recibir ofertas.');
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await api('/drivers/drivers/me/location', { method: 'POST', body: JSON.stringify({ latitude: current.coords.latitude, longitude: current.coords.longitude, timestamp: new Date(current.timestamp).toISOString() }) });
    }
    return api('/drivers/drivers/me/availability', { method: 'PATCH', body: JSON.stringify({ status }) });
  }, onSuccess: () => cache.invalidateQueries({ queryKey: ['driver-profile'] }), onError: error => setMessage(error.message) });
  const respond = useMutation({ mutationFn: ({ id, action }: { id: string; action: string }) => api<Assignment>('/drivers/drivers/me/offers/' + id + '/' + action, { method: 'POST', body: '{}' }), onSuccess: async (assignment, variables) => { await cache.invalidateQueries({ queryKey: ['active-offer'] }); await cache.invalidateQueries({ queryKey: ['driver-profile'] }); if (variables.action === 'accept') router.push({ pathname: '/delivery/[id]', params: { id: assignment.id } }); }, onError: error => setMessage(error.message) });
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(timer); }, []);
  const active = profile.data?.assignments.find(value => value.status === 'ACCEPTED');
  const online = profile.data?.status === 'AVAILABLE';
  const seconds = offer.data ? Math.max(0, Math.ceil((new Date(offer.data.expiresAt).getTime() - now) / 1000)) : 0;
  const point = gps.data?.point && now - new Date(gps.data.point.timestamp).getTime() < 30000 ? gps.data.point : undefined;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}><ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} refreshControl={<RefreshControl refreshing={profile.isFetching} onRefresh={() => { void profile.refetch(); void offer.refetch(); }} />}>
    <Header eyebrow="Tu jornada" title={person.data ? 'Hola, ' + person.data.firstName : 'DeliverEats Repartidor'} subtitle="Conéctate cuando estés listo para recibir entregas." />
    {!approved && <View style={{ padding: 18, borderRadius: 18, backgroundColor: '#fffbeb', gap: 12 }}><Text style={{ color: '#92400e' }}>{profile.data ? 'Tu solicitud está en estado: ' + profile.data.applicationStatus : 'Completa tu solicitud para comenzar.'}</Text>{profile.data?.reviewReason && <Text>{profile.data.reviewReason}</Text>}<Button label="Ver solicitud y documentos" tone="amber" onPress={() => router.push('/application')} /></View>}
    {profile.isError && <Text style={{ color: colors.red }}>{profile.error.message}</Text>}
    <AvailabilityMap point={point} />
    <View style={{ padding: 18, borderRadius: 18, backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ flex: 1 }}><Text style={{ fontSize: 18, fontWeight: '800', color: colors.navy }}>{online ? 'Disponible' : active ? 'Entrega en curso' : profile.data?.status === 'RESERVED' ? 'Oferta pendiente' : 'Desconectado'}</Text><Text style={{ color: colors.muted, marginTop: 5 }}>{online ? 'Recibirás ofertas según tu ubicación y vehículo.' : 'No recibirás nuevas ofertas.'}</Text></View><Switch accessibilityLabel="Disponibilidad para recibir pedidos" value={online} disabled={!approved || availability.isPending || !!active || profile.data?.status === 'RESERVED'} onValueChange={enabled => availability.mutate(enabled ? 'AVAILABLE' : 'OFFLINE')} /></View>
    {gps.data?.error && <Text accessibilityRole="alert" style={{ color: '#92400e' }}>{gps.data.error} · {gps.data.pending} punto(s) pendientes.</Text>}
    {(online || active) && <Text style={{ color: colors.muted, fontSize: 12 }}>Mantén la app visible para compartir GPS cada 5 segundos. Los puntos sin conexión se conservan temporalmente en memoria, hasta 120 muestras.</Text>}
    {active && <Button label="Continuar entrega activa" tone="amber" onPress={() => router.push({ pathname: '/delivery/[id]', params: { id: active.id } })} />}
    {offer.data && <View style={{ padding: 22, borderRadius: 22, backgroundColor: colors.navy, gap: 15 }}>
      <Text style={{ color: colors.amber, fontWeight: '800' }}>NUEVA SOLICITUD · {seconds}s</Text><Text style={{ color: 'white', fontSize: 24, fontWeight: '800' }}>S/ {Number(offer.data.estimatedEarnings).toFixed(2)}</Text><Text style={{ color: '#cbd5e1' }}>{offer.data.pickupCount} recogida(s) · {offer.data.destination ?? 'Consulta el destino al aceptar'}</Text>
      <Button label="Aceptar entrega" tone="amber" disabled={seconds === 0} loading={respond.isPending} onPress={() => respond.mutate({ id: offer.data!.id, action: 'accept' })} />
      <Button label="Rechazar oferta" tone="red" disabled={seconds === 0} loading={respond.isPending} onPress={() => respond.mutate({ id: offer.data!.id, action: 'reject' })} />
    </View>}
    {offer.isError && approved && <Text style={{ color: colors.red }}>{offer.error.message}</Text>}
    <View style={{ padding: 20, borderRadius: 20, backgroundColor: 'white', gap: 10 }}><Text style={{ fontWeight: '800', color: colors.navy }}>Tu actividad de hoy</Text><Text style={{ fontSize: 27, fontWeight: '800', color: colors.navy }}>{earnings.data ? 'S/ ' + earnings.data.amount.toFixed(2) : '—'}</Text><Text>{earnings.data ? earnings.data.completed + ' entregas completadas' : 'Sin información disponible'}</Text><Button label="Ver ganancias" tone="ghost" onPress={() => router.push('/(tabs)/earnings')} /></View>
    {!!message && <Text accessibilityRole="alert" style={{ color: colors.red }}>{message}</Text>}
  </ScrollView></SafeAreaView>;
}

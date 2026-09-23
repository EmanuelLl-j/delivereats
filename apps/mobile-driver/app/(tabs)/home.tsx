import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AvailabilityMap } from '@/components/availability-map';
import { Button, colors, Header } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { deriveDriverHomeState, finiteMoney, type Assignment, type DriverProfile } from '@/lib/driver-home-state';
import { getSession } from '@/lib/session';

function Card({ title, text, action }: { title: string; text: string; action?: boolean }) {
  return <View style={{ padding: 22, borderRadius: 20, backgroundColor: 'white', gap: 10 }}><Text style={{ fontSize: 21, fontWeight: '900', color: colors.navy }}>{title}</Text><Text style={{ color: colors.muted }}>{text}</Text>{action && <Button label="Ver solicitud y documentos" tone="amber" onPress={() => router.push('/application')} />}</View>;
}

export default function DriverHome() {
  const session = useQuery({ queryKey: ['driver-session'], queryFn: getSession, staleTime: Infinity });
  const profile = useQuery({ queryKey: ['driver-profile'], queryFn: async () => { try { return await api<DriverProfile>('/drivers/drivers/me'); } catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; } }, enabled: !!session.data, refetchInterval: 5000, retry: false });
  const person = useQuery({ queryKey: ['profile'], queryFn: () => api<{ firstName?: string; displayName?: string }>('/users/auth/profile'), enabled: !!session.data });
  const approved = profile.data?.applicationStatus === 'APPROVED';
  const offer = useQuery({ queryKey: ['active-offer'], queryFn: () => api<Assignment | null>('/drivers/drivers/me/offers/active'), enabled: approved, refetchInterval: 3000, retry: false });
  const earnings = useQuery({ queryKey: ['driver-earnings', 'day'], queryFn: () => api<{ amount?: number | string; completed?: number }>('/drivers/drivers/me/earnings?period=day'), enabled: approved });
  const state = deriveDriverHomeState({ authenticated: !!session.data, loading: session.isLoading || (!!session.data && profile.isLoading), error: session.isError || profile.isError, profile: profile.data, mapsConfigured: Boolean(Constants.expoConfig?.extra?.mapsConfigured) });
  const firstName = person.data?.displayName?.trim() || person.data?.firstName?.trim() || session.data?.user.firstName?.trim();
  const offerMoney = finiteMoney(offer.data?.estimatedEarnings);
  const todayMoney = finiteMoney(earnings.data?.amount);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}><ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} refreshControl={<RefreshControl refreshing={profile.isFetching} onRefresh={() => void profile.refetch()} />}>
    <Header eyebrow="Tu jornada" title={firstName ? 'Hola, ' + firstName : 'DeliverEats Repartidor'} subtitle="Conéctate cuando estés listo para recibir entregas." />
    {state.screen === 'LOADING' && <ActivityIndicator color={colors.amber} />}
    {state.screen === 'UNAUTHENTICATED' && <Card title="Sesión no disponible" text="Inicia sesión nuevamente para continuar." />}
    {state.screen === 'NO_APPLICATION' && <Card title="Completa tu solicitud" text="Tu cuenta DRIVER ya está creada. Registra tus documentos y vehículo para iniciar la revisión." action />}
    {state.screen === 'PENDING_REVIEW' && <Card title="Tu solicitud está siendo revisada" text="Validaremos tus documentos y te avisaremos cuando puedas comenzar a recibir entregas." action />}
    {state.screen === 'REJECTED' && <Card title="Tu solicitud necesita correcciones" text={state.profile.reviewReason || 'Revisa tus documentos y vuelve a enviar la solicitud.'} action />}
    {state.screen === 'SUSPENDED' && <Card title="Cuenta suspendida" text={state.profile.reviewReason || 'Comunícate con soporte para revisar tu cuenta.'} />}
    {state.screen === 'ERROR' && <Card title="No pudimos cargar tu perfil" text="Intenta actualizar. Si el problema continúa, comunícate con soporte." />}
    {state.screen === 'APPROVED' && <>
      <AvailabilityMap />
      <Card title={state.status === 'AVAILABLE' ? 'Disponible' : state.active ? 'Entrega en curso' : state.status === 'RESERVED' ? 'Oferta pendiente' : state.status === 'BUSY' ? 'Ocupado' : 'Desconectado'} text={state.status === 'AVAILABLE' ? 'Recibirás ofertas según tu ubicación y vehículo.' : 'No recibirás nuevas ofertas.'} />
      {state.active?.id && <Button label="Continuar entrega activa" tone="amber" onPress={() => router.push({ pathname: '/delivery/[id]', params: { id: state.active!.id! } })} />}
      {offer.data?.id && <View style={{ padding: 22, borderRadius: 22, backgroundColor: colors.navy, gap: 12 }}><Text style={{ color: colors.amber, fontWeight: '800' }}>NUEVA SOLICITUD</Text><Text style={{ color: 'white', fontSize: 24, fontWeight: '800' }}>{offerMoney ? 'S/ ' + offerMoney : 'Importe por confirmar'}</Text><Text style={{ color: '#cbd5e1' }}>{typeof offer.data.pickupCount === 'number' ? offer.data.pickupCount + ' recogida(s)' : 'Recogidas por confirmar'} · {offer.data.destination || 'Destino por confirmar'}</Text></View>}
      {!offer.data && !state.active && !offer.isLoading && <Card title="No hay pedidos disponibles" text="Mantente disponible. Te mostraremos aquí una oferta cuando haya una entrega cercana." />}
      <View style={{ padding: 20, borderRadius: 20, backgroundColor: 'white', gap: 10 }}><Text style={{ fontWeight: '800', color: colors.navy }}>Tu actividad de hoy</Text><Text style={{ fontSize: 27, fontWeight: '800', color: colors.navy }}>{todayMoney ? 'S/ ' + todayMoney : '—'}</Text><Text>{typeof earnings.data?.completed === 'number' ? earnings.data.completed + ' entregas completadas' : 'Sin entregas completadas'}</Text><Button label="Ver ganancias" tone="ghost" onPress={() => router.push('/(tabs)/earnings')} /></View>
    </>}
  </ScrollView></SafeAreaView>;
}

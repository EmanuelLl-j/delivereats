import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Bike, Clock3, MapPin, Navigation, Power, Route } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, Header } from '@/components/ui';
import { api } from '@/lib/api';

type Assignment = {
  id: string;
  orderId: string;
  estimatedEarnings: string;
  pickupCount: number;
  destination?: string;
  expiresAt: string;
  status: string;
};
type Profile = {
  id: string;
  status: string;
  rating: string;
  completedOrders: number;
  vehicleType: string;
  assignments: Assignment[];
};

export default function DriverHome() {
  const client = useQueryClient();
  const [seconds, setSeconds] = useState(15);
  const profile = useQuery({
    queryKey: ['driver-profile'],
    queryFn: () => api<Profile>('/drivers/drivers/me'),
    refetchInterval: 8_000,
  });
  const offer = useQuery({
    queryKey: ['active-offer'],
    queryFn: () => api<Assignment | null>('/drivers/drivers/me/offers/active'),
    refetchInterval: 3_000,
  });
  const availability = useMutation({
    mutationFn: async (status: string) => {
      const updated = await api<Profile>('/drivers/drivers/me/availability', {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (status === 'AVAILABLE') {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted') {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          await api('/drivers/drivers/me/location', {
            method: 'POST',
            body: JSON.stringify({
              latitude: current.coords.latitude,
              longitude: current.coords.longitude,
              speed: current.coords.speed ?? 0,
            }),
          });
        }
      }
      return updated;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['driver-profile'] }),
    onError: (error) => Alert.alert('No se pudo cambiar', error.message),
  });
  const respond = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'accept' | 'reject' }) =>
      api<Assignment>(`/drivers/drivers/me/offers/${id}/${action}`, { method: 'POST', body: '{}' }),
    onSuccess: (assignment, variables) => {
      client.invalidateQueries({ queryKey: ['active-offer'] });
      client.invalidateQueries({ queryKey: ['driver-profile'] });
      if (variables.action === 'accept')
        router.push({ pathname: '/delivery/[id]', params: { id: assignment.id } });
    },
    onError: (error) => Alert.alert('Oferta no disponible', error.message),
  });
  useEffect(() => {
    if (!offer.data) return;
    const update = () =>
      setSeconds(
        Math.max(0, Math.ceil((new Date(offer.data!.expiresAt).getTime() - Date.now()) / 1000)),
      );
    update();
    const timer = setInterval(update, 500);
    return () => clearInterval(timer);
  }, [offer.data]);
  const online = profile.data?.status === 'AVAILABLE';
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={profile.isFetching}
            onRefresh={() => {
              void profile.refetch();
              void offer.refetch();
            }}
            tintColor={colors.amber}
          />
        }
      >
        <Header
          eyebrow="OPERACIÓN DEL REPARTIDOR"
          title="Hola, Luis"
          subtitle="Conéctate cuando estés listo para recibir pedidos cercanos."
        />
        <View style={[styles.availability, online && styles.available]}>
          <View style={[styles.power, online && { backgroundColor: colors.green }]}>
            <Power size={26} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.availabilityTitle}>
              {online
                ? 'Estás disponible'
                : profile.data?.status === 'BUSY'
                  ? 'Entrega en curso'
                  : 'Estás desconectado'}
            </Text>
            <Text style={styles.availabilityText}>
              {online
                ? 'Buscando pedidos cerca de tu ubicación'
                : 'No recibirás nuevas solicitudes'}
            </Text>
          </View>
          <Pressable
            disabled={profile.data?.status === 'BUSY' || profile.data?.status === 'RESERVED'}
            onPress={() => availability.mutate(online ? 'OFFLINE' : 'AVAILABLE')}
            style={[styles.switch, online && styles.switchOn]}
          >
            <View style={[styles.knob, online && { marginLeft: 23 }]} />
          </Pressable>
        </View>
        {offer.data ? (
          <View style={styles.offer}>
            <View style={styles.offerTop}>
              <View>
                <Text style={styles.offerKicker}>NUEVA SOLICITUD</Text>
                <Text style={styles.offerOrder}>Pedido {offer.data.orderId.slice(0, 8)}</Text>
              </View>
              <View style={[styles.timer, seconds <= 5 && { backgroundColor: '#FEE2E2' }]}>
                <Clock3 size={15} color={seconds <= 5 ? colors.red : '#C87800'} />
                <Text style={[styles.timerText, seconds <= 5 && { color: colors.red }]}>
                  {seconds}s
                </Text>
              </View>
            </View>
            <View style={styles.offerStats}>
              <View style={styles.stat}>
                <Route size={19} color={colors.navy2} />
                <Text style={styles.statValue}>{offer.data.pickupCount}</Text>
                <Text style={styles.statLabel}>recojos</Text>
              </View>
              <View style={styles.stat}>
                <MapPin size={19} color={colors.navy2} />
                <Text style={styles.statValue}>~3.2 km</Text>
                <Text style={styles.statLabel}>distancia</Text>
              </View>
              <View style={styles.stat}>
                <Navigation size={19} color={colors.navy2} />
                <Text style={styles.statValue}>18 min</Text>
                <Text style={styles.statLabel}>ETA</Text>
              </View>
            </View>
            <View style={styles.destination}>
              <MapPin size={17} color={colors.amber} />
              <Text style={styles.destinationText}>
                {offer.data.destination ?? 'Destino en Ayacucho'}
              </Text>
            </View>
            <Text style={styles.earning}>
              Ganancia estimada{' '}
              <Text style={styles.earningValue}>
                S/ {Number(offer.data.estimatedEarnings).toFixed(2)}
              </Text>
            </Text>
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Rechazar"
                  onPress={() => respond.mutate({ id: offer.data!.id, action: 'reject' })}
                  tone="red"
                  loading={respond.isPending}
                />
              </View>
              <View style={{ flex: 1.4 }}>
                <Button
                  label="Aceptar pedido"
                  onPress={() => respond.mutate({ id: offer.data!.id, action: 'accept' })}
                  tone="amber"
                  loading={respond.isPending}
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.waiting}>
            <View style={styles.waitingIcon}>
              <Bike size={34} color={colors.amber} />
            </View>
            <Text style={styles.waitingTitle}>
              {online ? 'Buscando una buena ruta…' : 'Conéctate para empezar'}
            </Text>
            <Text style={styles.waitingText}>
              Las ofertas se ordenan por distancia y cada repartidor se reserva de forma atómica.
            </Text>
          </View>
        )}
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{profile.data?.completedOrders ?? 0}</Text>
            <Text style={styles.metricLabel}>Entregas</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>★ {Number(profile.data?.rating ?? 5).toFixed(1)}</Text>
            <Text style={styles.metricLabel}>Calificación</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{profile.data?.vehicleType ?? 'MOTO'}</Text>
            <Text style={styles.metricLabel}>Vehículo</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20, paddingBottom: 36 },
  availability: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 15,
  },
  available: { borderColor: '#A7F3D0', backgroundColor: '#F0FDF7' },
  power: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  availabilityTitle: { color: colors.navy, fontSize: 14, fontWeight: '900' },
  availabilityText: { color: colors.muted, fontSize: 9, marginTop: 4 },
  switch: { width: 50, height: 29, borderRadius: 15, backgroundColor: '#CBD5E1', padding: 3 },
  switchOn: { backgroundColor: '#86E0B9' },
  knob: { width: 23, height: 23, borderRadius: 12, backgroundColor: colors.white },
  offer: { marginTop: 22, borderRadius: 24, backgroundColor: colors.navy, padding: 20 },
  offerTop: { flexDirection: 'row', justifyContent: 'space-between' },
  offerKicker: { color: colors.amber, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  offerOrder: { color: colors.white, fontSize: 18, fontWeight: '900', marginTop: 5 },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF7E6',
    borderRadius: 11,
    paddingHorizontal: 10,
    height: 35,
  },
  timerText: { color: '#C87800', fontSize: 12, fontWeight: '900' },
  offerStats: { flexDirection: 'row', gap: 8, marginTop: 18 },
  stat: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 11,
    alignItems: 'center',
  },
  statValue: { color: colors.navy, fontSize: 11, fontWeight: '900', marginTop: 5 },
  statLabel: { color: colors.muted, fontSize: 8, marginTop: 2 },
  destination: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 15,
    padding: 12,
    borderRadius: 13,
    backgroundColor: '#163759',
  },
  destinationText: { color: '#CBD5E1', fontSize: 10, flex: 1 },
  earning: { color: '#94A3B8', fontSize: 10, marginTop: 15 },
  earningValue: { color: colors.amber, fontSize: 18, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 17 },
  waiting: {
    alignItems: 'center',
    marginTop: 22,
    padding: 30,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    backgroundColor: colors.white,
  },
  waitingIcon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: '#FFF7E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingTitle: { color: colors.navy, fontSize: 16, fontWeight: '900', marginTop: 15 },
  waitingText: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 7,
    maxWidth: 260,
  },
  metrics: {
    flexDirection: 'row',
    marginTop: 20,
    borderRadius: 19,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  metricValue: { color: colors.navy, fontSize: 13, fontWeight: '900' },
  metricLabel: { color: '#94A3B8', fontSize: 8, marginTop: 4 },
});

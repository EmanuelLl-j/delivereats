import { useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Bike, Clock3 } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { colors } from '@/components/ui';
import { TrackingMap } from '@/components/tracking-map';
import { api } from '@/lib/api';
import { getSession } from '@/lib/session';

type Location = {
  driverId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  timestamp: string;
};
type Order = {
  id: string;
  status: string;
  deliveryAddress: string;
  deliveryLatitude: string;
  deliveryLongitude: string;
  subOrders: Array<{ id: string; merchant: { name: string; latitude: string; longitude: string } }>;
};

export default function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useQueryClient();
  const order = useQuery({
    queryKey: ['order-tracking', id],
    queryFn: () => api<Order>(`/orders/orders/${id}`),
    refetchInterval: 8_000,
  });
  const location = useQuery({
    queryKey: ['driver-location', id],
    queryFn: () => api<Location | null>(`/drivers/tracking/orders/${id}/location`),
    refetchInterval: 5_000,
  });
  useEffect(() => {
    let socket: ReturnType<typeof io> | undefined;
    void getSession().then((session) => {
      if (!session) return;
      const socketUrl =
        (Constants.expoConfig?.extra?.socketUrl as string | undefined) ?? 'http://localhost';
      socket = io(`${socketUrl}/tracking`, {
        path: '/socket.io/tracking',
        auth: { token: session.accessToken },
        transports: ['websocket', 'polling'],
      });
      socket.emit('tracking.subscribe', id);
      socket.on('driver.location.updated', (value: Location) =>
        client.setQueryData(['driver-location', id], value),
      );
    });
    return () => {
      socket?.disconnect();
    };
  }, [client, id]);
  const data = order.data;
  const driver = location.data;
  const destination = {
    latitude: Number(data?.deliveryLatitude ?? -13.1603),
    longitude: Number(data?.deliveryLongitude ?? -74.2257),
  };
  const driverPoint = driver
    ? { latitude: driver.latitude, longitude: driver.longitude }
    : { latitude: -13.1588, longitude: -74.2236 };
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <ArrowLeft size={20} color={colors.navy} />
        </Pressable>
        <View>
          <Text style={styles.kicker}>TRACKING EN VIVO</Text>
          <Text style={styles.title}>{data?.status.replaceAll('_', ' ') ?? 'LOCALIZANDO'}</Text>
        </View>
      </View>
      <TrackingMap
        pickups={(data?.subOrders ?? []).map((point) => ({
          id: point.id,
          name: point.merchant.name,
          latitude: Number(point.merchant.latitude),
          longitude: Number(point.merchant.longitude),
        }))}
        driver={driverPoint}
        destination={destination}
        destinationLabel={data?.deliveryAddress}
      />
      <View style={styles.panel}>
        <View style={styles.handle} />
        <View style={styles.driverRow}>
          <View style={styles.avatar}>
            <Bike size={22} color={colors.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.driverName}>Luis · Repartidor verificado</Text>
            <Text style={styles.driverMeta}>
              {driver
                ? `Última ubicación ${new Date(driver.timestamp).toLocaleTimeString('es-PE')}`
                : 'Esperando señal GPS…'}
            </Text>
          </View>
          <View style={styles.eta}>
            <Clock3 size={13} color="#C87800" />
            <Text style={styles.etaText}>12 min</Text>
          </View>
        </View>
        <View style={styles.progress}>
          <View
            style={[styles.progressFill, { width: data?.status === 'ON_THE_WAY' ? '78%' : '45%' }]}
          />
        </View>
        <Text style={styles.hint}>
          Si la conexión en vivo falla, actualizamos la posición cada 5 segundos por REST.
        </Text>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  top: {
    height: 78,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: { color: '#C87800', fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: colors.navy, fontSize: 15, fontWeight: '900', marginTop: 3 },
  panel: {
    backgroundColor: colors.white,
    padding: 19,
    paddingBottom: 26,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    marginTop: -24,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 17,
  },
  driverRow: { flexDirection: 'row', gap: 11, alignItems: 'center' },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#FFF7E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverName: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  driverMeta: { color: colors.muted, fontSize: 9, marginTop: 4 },
  eta: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    backgroundColor: '#FFF7E6',
    borderRadius: 9,
    padding: 7,
  },
  etaText: { color: '#C87800', fontSize: 10, fontWeight: '900' },
  progress: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    marginTop: 18,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.amber },
  hint: { color: '#94A3B8', fontSize: 9, lineHeight: 14, marginTop: 10 },
});

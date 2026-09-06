import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CheckCircle2, Navigation, PackageCheck } from 'lucide-react-native';
import { useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, Header } from '@/components/ui';
import { RouteMap } from '@/components/route-map';
import { api } from '@/lib/api';

type SubOrder = {
  id: string;
  status: string;
  pickedUpAt?: string;
  pickupSequence: number;
  merchant: { name: string; address: string; latitude: string; longitude: string };
  items: Array<{ id: string; productName: string; quantity: number }>;
};
type Order = {
  id: string;
  orderNumber: string;
  status: string;
  deliveryAddress: string;
  deliveryLatitude: string;
  deliveryLongitude: string;
  subOrders: SubOrder[];
};

export default function DeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useQueryClient();
  const order = useQuery({
    queryKey: ['assigned-order', id],
    queryFn: () => api<Order>(`/drivers/drivers/me/assignments/${id}/order`),
    refetchInterval: 5_000,
  });
  const pickup = useMutation({
    mutationFn: (subOrderId: string) =>
      api(`/drivers/drivers/me/assignments/${id}/pickups/${subOrderId}`, {
        method: 'POST',
        body: '{}',
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['assigned-order', id] }),
    onError: (error) => Alert.alert('No se pudo confirmar', error.message),
  });
  const status = useMutation({
    mutationFn: (value: string) =>
      api(`/drivers/drivers/me/assignments/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: value }),
      }),
    onSuccess: (_, value) => {
      client.invalidateQueries({ queryKey: ['assigned-order', id] });
      if (value === 'DELIVERED') {
        Alert.alert('Entrega completada', 'Volviste a estar disponible.');
        router.replace('/(tabs)/home');
      }
    },
    onError: (error) => Alert.alert('No se pudo avanzar', error.message),
  });
  useEffect(() => {
    let subscription: Location.LocationSubscription | undefined;
    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('GPS requerido', 'Activa la ubicación para continuar con la entrega.');
        return;
      }
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5_000, distanceInterval: 5 },
        (position) => {
          if (!order.data?.id) return;
          void api('/drivers/drivers/me/location', {
            method: 'POST',
            body: JSON.stringify({
              orderId: order.data.id,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              speed: position.coords.speed ?? 0,
              timestamp: new Date(position.timestamp).toISOString(),
            }),
          }).catch(() => undefined);
        },
      );
    })();
    return () => subscription?.remove();
  }, [order.data?.id]);
  const data = order.data;
  const pickups = data?.subOrders ?? [];
  const allPicked = pickups.length > 0 && pickups.every((item) => item.pickedUpAt);
  const destination = {
    latitude: Number(data?.deliveryLatitude ?? -13.1603),
    longitude: Number(data?.deliveryLongitude ?? -74.2257),
  };
  const points = pickups.map((item) => ({
    id: item.id,
    name: item.merchant.name,
    latitude: Number(item.merchant.latitude),
    longitude: Number(item.merchant.longitude),
    pickedUp: Boolean(item.pickedUpAt),
  }));
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <ArrowLeft size={20} color={colors.navy} />
        </Pressable>
        <View>
          <Text style={styles.kicker}>ENTREGA ACTIVA</Text>
          <Text style={styles.topTitle}>{data?.orderNumber ?? 'Cargando pedido'}</Text>
        </View>
      </View>
      <RouteMap points={points} destination={destination} />
      <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent}>
        <View style={styles.handle} />
        <Header
          eyebrow="RUTA COORDINADA"
          title={data?.status.replaceAll('_', ' ') ?? 'Preparando ruta'}
          subtitle={`${pickups.length} punto(s) de recojo antes de llegar al cliente.`}
        />
        {pickups.map((item, index) => (
          <View key={item.id} style={styles.stop}>
            <View style={[styles.sequence, item.pickedUpAt && { backgroundColor: colors.green }]}>
              {item.pickedUpAt ? (
                <CheckCircle2 size={17} color={colors.white} />
              ) : (
                <Text style={styles.sequenceText}>{index + 1}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stopName}>{item.merchant.name}</Text>
              <Text style={styles.stopAddress}>{item.merchant.address}</Text>
              {item.items.map((product) => (
                <Text key={product.id} style={styles.item}>
                  {product.quantity}× {product.productName}
                </Text>
              ))}
            </View>
            {!item.pickedUpAt && (
              <Pressable
                disabled={
                  !['READY_FOR_PICKUP', 'PICKING_UP'].includes(data?.status ?? '') ||
                  pickup.isPending
                }
                onPress={() => pickup.mutate(item.id)}
                style={styles.confirm}
              >
                <PackageCheck size={17} color={colors.navy} />
              </Pressable>
            )}
          </View>
        ))}
        <View style={styles.destination}>
          <Navigation size={20} color={colors.amber} />
          <View style={{ flex: 1 }}>
            <Text style={styles.stopName}>Destino del cliente</Text>
            <Text style={styles.stopAddress}>{data?.deliveryAddress}</Text>
          </View>
        </View>
        {allPicked && data?.status === 'PICKING_UP' && (
          <Button
            label="Iniciar ruta al cliente"
            onPress={() => status.mutate('ON_THE_WAY')}
            loading={status.isPending}
            tone="amber"
          />
        )}
        {data?.status === 'ON_THE_WAY' && (
          <Button
            label="Confirmar entrega y cobro"
            onPress={() => status.mutate('DELIVERED')}
            loading={status.isPending}
            tone="amber"
          />
        )}{' '}
        {!['READY_FOR_PICKUP', 'PICKING_UP', 'ON_THE_WAY'].includes(data?.status ?? '') && (
          <Text style={styles.wait}>
            Espera a que los comercios marquen el pedido como listo. Esta pantalla se actualiza
            automáticamente.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  top: {
    height: 75,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 17,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  back: {
    width: 41,
    height: 41,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: { color: '#C87800', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  topTitle: { color: colors.navy, fontSize: 14, fontWeight: '900', marginTop: 3 },
  sheet: {
    flex: 1,
    marginTop: -20,
    backgroundColor: colors.canvas,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  sheetContent: { padding: 19, paddingBottom: 34, gap: 11 },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 7,
  },
  stop: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'flex-start',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 14,
  },
  sequence: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sequenceText: { color: colors.navy, fontSize: 11, fontWeight: '900' },
  stopName: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  stopAddress: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 4 },
  item: { color: '#475569', fontSize: 9, fontWeight: '700', marginTop: 4 },
  confirm: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destination: {
    flexDirection: 'row',
    gap: 11,
    borderRadius: 17,
    backgroundColor: colors.navy,
    padding: 15,
  },
  wait: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    borderRadius: 13,
    backgroundColor: '#EAF0F6',
    padding: 13,
  },
});

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { Button, colors } from '@/components/ui';
import { TrackingMap } from '@/components/tracking-map';
import { api, socketUrl } from '@/lib/api';
import { getSession } from '@/lib/session';
type Location = { latitude: number; longitude: number; timestamp: string };
type Order = { id: string; status: string; deliveryAddress: string; deliveryLatitude: string; deliveryLongitude: string; shipment?: { pickupAddress: string; pickupLatitude: string; pickupLongitude: string; pickedUpAt?: string }; subOrders: Array<{ id: string; pickedUpAt?: string; merchant: { name: string; latitude: string; longitude: string } }> };
export default function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cache = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const order = useQuery({ queryKey: ['order-tracking', id], queryFn: () => api<Order>('/orders/orders/' + id), refetchInterval: 5000 });
  const location = useQuery({ queryKey: ['driver-location', id], queryFn: () => api<Location | null>('/drivers/tracking/orders/' + id + '/location'), refetchInterval: 5000, retry: false });
  const conversation = useQuery({ queryKey: ['tracking-participant', id], queryFn: () => api<{ counterpart: { displayName: string; vehicleType: string; vehiclePlate?: string }; call?: { status: string } }>('/drivers/communications/orders/' + id), refetchInterval: 5000, retry: false });
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(interval); }, []);
  useEffect(() => {
    let alive = true, socket: ReturnType<typeof io> | undefined;
    void getSession().then(session => {
      if (!alive || !session) return;
      socket = io(socketUrl + '/tracking', { path: '/socket.io/tracking', auth: { token: session.accessToken }, transports: ['websocket', 'polling'] });
      socket.on('connect', () => socket?.emit('tracking.subscribe', id));
      socket.on('driver.location.updated', (value: Location) => cache.setQueryData(['driver-location', id], value));
    });
    return () => { alive = false; socket?.disconnect(); };
  }, [cache, id]);
  const data = order.data;
  const driver = !location.isError && location.data && now - new Date(location.data.timestamp).getTime() <= 30000 ? location.data : undefined;
  const points = data?.shipment ? data.shipment.pickedUpAt ? [] : [{ id: data.id, name: 'Recogida del paquete', latitude: Number(data.shipment.pickupLatitude), longitude: Number(data.shipment.pickupLongitude) }] : (data?.subOrders ?? []).filter(item => !item.pickedUpAt).map(item => ({ id: item.id, name: item.merchant.name, latitude: Number(item.merchant.latitude), longitude: Number(item.merchant.longitude) }));
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
    <View style={{ padding: 18, gap: 10, backgroundColor: 'white' }}><Button label="Volver al pedido" variant="ghost" onPress={() => router.back()} /><Text style={{ color: colors.navy, fontSize: 21, fontWeight: '800' }}>{data?.status.replaceAll('_', ' ') ?? 'Cargando seguimiento…'}</Text></View>
    {data && <TrackingMap pickups={points} driver={driver} destination={{ latitude: Number(data.deliveryLatitude), longitude: Number(data.deliveryLongitude) }} destinationLabel={data.deliveryAddress} />}
    <ScrollView style={{ flexGrow: 0, maxHeight: 270, backgroundColor: 'white' }} contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ color: colors.navy, fontSize: 19, fontWeight: '800' }}>{conversation.data?.counterpart.displayName ?? 'Repartidor asignado'}</Text>
      {conversation.data?.counterpart.vehicleType && <Text>{conversation.data.counterpart.vehicleType} {conversation.data.counterpart.vehiclePlate ?? ''}</Text>}
      <Text style={{ color: driver ? colors.green : colors.muted }}>{driver ? 'Última señal: ' + new Date(driver.timestamp).toLocaleTimeString('es-PE') : 'Sin señal GPS reciente. No mostramos una posición estimada.'}</Text>
      {(order.isError || location.isError) && <Text style={{ color: colors.red }}>{order.error?.message ?? location.error?.message}</Text>}
      <Text style={{ color: colors.muted, fontSize: 12 }}>La posición se consulta cada 5 segundos. Las líneas unen los puntos de entrega; no son una ruta de navegación ni una estimación de llegada.</Text>
      <Button label={conversation.data?.call?.status === 'RINGING' ? 'Llamada pendiente · abrir chat' : 'Chat y llamada con el repartidor'} onPress={() => router.push({ pathname: '/chat/[id]', params: { id } })} />
    </ScrollView>
  </SafeAreaView>;
}

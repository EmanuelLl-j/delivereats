import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, Field, Header } from '@/components/ui';
import { RouteMap } from '@/components/route-map';
import { api } from '@/lib/api';
import { uploadAsset } from '@/lib/upload';
type SubOrder = { id: string; status: string; pickedUpAt?: string; merchant: { name: string; address: string; latitude: string; longitude: string }; items: Array<{ id: string; productName: string; quantity: number }> };
type Shipment = { pickupAddress: string; pickupReference?: string; pickupLatitude: string; pickupLongitude: string; dropoffReference?: string; contentDescription: string; recipientName: string; weightKg: string; fragile: boolean; pickedUpAt?: string };
type Order = { id: string; type: string; orderNumber: string; status: string; paymentMethod: string; total: string; deliveryAddress: string; deliveryLatitude: string; deliveryLongitude: string; shipment?: Shipment; subOrders: SubOrder[] };
export default function DeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cache = useQueryClient();
  const [code, setCode] = useState('');
  const [evidence, setEvidence] = useState('');
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const order = useQuery({ queryKey: ['assigned-order', id], queryFn: () => api<Order>('/drivers/drivers/me/assignments/' + id + '/order'), refetchInterval: 5000 });
  const data = order.data;
  const phase = data?.status === 'ON_THE_WAY' ? 'DELIVERY' : 'PICKUP';
  const conversation = useQuery({ queryKey: ['delivery-participant', data?.id], queryFn: () => api<{ counterpart: { displayName: string }; call?: { status: string } }>('/drivers/communications/orders/' + data!.id), enabled: !!data?.id && !['CANCELLED', 'DELIVERED'].includes(data.status), refetchInterval: 5000, retry: false });
  async function reload() { await cache.invalidateQueries({ queryKey: ['assigned-order', id] }); await cache.invalidateQueries({ queryKey: ['driver-profile'] }); await cache.invalidateQueries({ queryKey: ['driver-earnings'] }); }
  const pickup = useMutation({ mutationFn: (subId: string) => api('/drivers/drivers/me/assignments/' + id + '/pickups/' + subId, { method: 'POST', body: '{}' }), onSuccess: reload, onError: error => setMessage(error.message) });
  const complete = useMutation({ mutationFn: () => data?.shipment ? api('/drivers/drivers/me/assignments/' + id + '/verify', { method: 'POST', body: JSON.stringify({ phase, code, evidenceFileId: evidence || undefined }) }) : api('/drivers/drivers/me/assignments/' + id + '/status', { method: 'POST', body: JSON.stringify({ status: 'DELIVERED' }) }), onSuccess: async () => { setCode(''); setEvidence(''); setMessage('Etapa confirmada.'); await reload(); if (phase === 'DELIVERY') router.replace('/(tabs)/home'); }, onError: error => setMessage(error.message) });
  async function photo(camera: boolean) { setUploading(true); try { const result = await uploadAsset(phase === 'PICKUP' ? 'PICKUP_EVIDENCE' : 'DELIVERY_EVIDENCE', camera); if (result) setEvidence(result.id); } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo adjuntar'); } finally { setUploading(false); } }
  const points = data?.shipment ? [{ id: data.id, name: 'Recogida del paquete', latitude: Number(data.shipment.pickupLatitude), longitude: Number(data.shipment.pickupLongitude), pickedUp: !!data.shipment.pickedUpAt }] : (data?.subOrders ?? []).map(item => ({ id: item.id, name: item.merchant.name, latitude: Number(item.merchant.latitude), longitude: Number(item.merchant.longitude), pickedUp: !!item.pickedUpAt }));
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}><ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
    <Button label="Volver a mi jornada" tone="ghost" onPress={() => router.replace('/(tabs)/home')} />
    <Header eyebrow="Entrega asignada" title={data?.orderNumber ?? 'Cargando…'} subtitle={data?.status.replaceAll('_', ' ') ?? 'Consultando el pedido'} />
    {order.isError && <Text accessibilityRole="alert" style={{ color: colors.red }}>{order.error.message}</Text>}
    {data && <RouteMap points={points} destination={{ latitude: Number(data.deliveryLatitude), longitude: Number(data.deliveryLongitude) }} />}
    <Text style={{ color: colors.muted, fontSize: 12 }}>Las líneas conectan puntos de entrega, no representan indicaciones viales.</Text>
    {data && !['CANCELLED', 'DELIVERED'].includes(data.status) && <Button label={conversation.data?.call?.status === 'RINGING' ? 'Llamada pendiente · abrir chat' : 'Chat y llamada con ' + (conversation.data?.counterpart.displayName ?? 'el cliente')} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: data.id } })} />}
    {data?.shipment && <View style={{ padding: 20, backgroundColor: 'white', borderRadius: 20, gap: 10 }}><Text style={{ fontWeight: '800', fontSize: 18 }}>Recogida del paquete</Text><Text>{data.shipment.pickupAddress}</Text><Text>{data.shipment.pickupReference}</Text><Text>{data.shipment.contentDescription} · {data.shipment.weightKg} kg{data.shipment.fragile ? ' · FRÁGIL' : ''}</Text><Text>Recibe: {data.shipment.recipientName}</Text></View>}
    {data?.subOrders.map((item, index) => <View key={item.id} style={{ padding: 20, backgroundColor: 'white', borderRadius: 20, gap: 10 }}><Text style={{ fontWeight: '800', fontSize: 18 }}>{index + 1}. {item.merchant.name}</Text><Text>{item.merchant.address}</Text>{item.items.map(product => <Text key={product.id}>{product.quantity} × {product.productName}</Text>)}<Text>{item.pickedUpAt ? 'Recogido' : item.status.replaceAll('_', ' ')}</Text>{!item.pickedUpAt && <Button label="Confirmar recogida" tone="amber" disabled={!['ASSIGNED', 'PICKING_UP'].includes(data.status) || item.status !== 'READY_FOR_PICKUP'} loading={pickup.isPending} onPress={() => pickup.mutate(item.id)} />}</View>)}
    {data && <View style={{ padding: 20, backgroundColor: colors.navy, borderRadius: 20, gap: 8 }}><Text style={{ fontWeight: '800', color: 'white', fontSize: 18 }}>Destino</Text><Text style={{ color: '#cbd5e1' }}>{data.deliveryAddress}</Text>{data.shipment?.dropoffReference && <Text style={{ color: '#cbd5e1' }}>{data.shipment.dropoffReference}</Text>}<Text style={{ color: colors.amber, fontWeight: '800' }}>{data.paymentMethod === 'CASH' ? 'Cobrar al entregar: S/ ' + Number(data.total).toFixed(2) : 'Pago electrónico: no cobrar nuevamente'}</Text></View>}
    {data?.shipment && ['ASSIGNED', 'ON_THE_WAY'].includes(data.status) && <>
      <Text style={{ fontWeight: '800', fontSize: 18 }}>Verificar {phase === 'PICKUP' ? 'recogida' : 'entrega'}</Text><Text style={{ color: colors.muted }}>Solicita el código de 6 dígitos cuando hayas verificado físicamente el paquete. El servidor valida la fase y limita los intentos.</Text>
      <Field label="Código de verificación" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} secureTextEntry />
      <Button label={evidence ? 'Evidencia adjunta · tomar otra' : 'Tomar foto de evidencia'} tone="ghost" loading={uploading} onPress={() => photo(true)} />
      <Button label="Adjuntar foto desde archivos" tone="ghost" loading={uploading} onPress={() => photo(false)} />
      <Button label={'Confirmar ' + (phase === 'PICKUP' ? 'recogida' : 'entrega y cobro, si corresponde')} tone="amber" disabled={!/^\d{6}$/.test(code)} loading={complete.isPending} onPress={() => complete.mutate()} />
    </>}
    {!data?.shipment && data?.status === 'ON_THE_WAY' && <Button label={data.paymentMethod === 'CASH' ? 'Confirmar entrega y efectivo recibido' : 'Confirmar entrega al cliente'} tone="amber" loading={complete.isPending} onPress={() => complete.mutate()} />}
    {data && <Button label="Reportar incidencia" tone="ghost" onPress={() => router.push({ pathname: '/account', params: { mode: 'support', orderId: data.id } })} />}
    {!!message && <Text accessibilityRole="alert" style={{ color: colors.navy }}>{message}</Text>}
  </ScrollView></SafeAreaView>;
}

import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Bike, CheckCircle2, Circle, MapPinned } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, ScreenHeader } from '@/components/ui';
import { api } from '@/lib/api';

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  subtotal: string;
  deliveryFee: string;
  serviceFee: string;
  discount: string;
  paymentMethod: string;
  paymentStatus: string;
  deliveryAddress: string;
  assignedDriverId?: string;
  subOrders: Array<{
    id: string;
    status: string;
    merchant: { name: string };
    items: Array<{ id: string; productName: string; quantity: number }>;
  }>;
  statusHistory: Array<{ id: string; toStatus: string; createdAt: string }>;
};

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useQuery({
    queryKey: ['order', id],
    queryFn: () => api<Order>(`/orders/orders/${id}`),
    refetchInterval: 5_000,
  });
  const data = order.data;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.replace('/(tabs)/orders')} style={styles.back}>
          <ArrowLeft size={20} color={colors.navy} />
        </Pressable>
        <ScreenHeader
          eyebrow="Estado del pedido"
          title={data?.orderNumber ?? 'Cargando…'}
          subtitle={data ? `Entrega en ${data.deliveryAddress}` : 'Consultando la operación'}
        />
        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            {data?.status === 'DELIVERED' ? (
              <CheckCircle2 size={31} color={colors.green} />
            ) : (
              <Bike size={31} color={colors.amber} />
            )}
          </View>
          <Text style={styles.statusTitle}>
            {data?.status.replaceAll('_', ' ') ?? 'PROCESANDO'}
          </Text>
          <Text style={styles.statusText}>
            {data?.status === 'PENDING'
              ? 'Esperando verificación del pago'
              : data?.status === 'SEARCHING_DRIVER'
                ? 'Buscando al repartidor más cercano'
                : data?.status === 'ON_THE_WAY'
                  ? 'Tu pedido está en camino'
                  : data?.status === 'DELIVERED'
                    ? 'Pedido entregado correctamente'
                    : 'La operación se actualiza automáticamente'}
          </Text>
        </View>
        {data?.assignedDriverId && !['DELIVERED', 'CANCELLED'].includes(data.status) ? (
          <Button
            label="Ver tracking GPS"
            onPress={() => router.push({ pathname: '/tracking/[id]', params: { id: data.id } })}
            variant="amber"
          />
        ) : null}
        <Text style={styles.section}>RECOJOS</Text>
        {data?.subOrders.map((subOrder, index) => (
          <View key={subOrder.id} style={styles.pickup}>
            <View style={styles.sequence}>
              <Text style={styles.sequenceText}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.merchant}>{subOrder.merchant.name}</Text>
              {subOrder.items.map((item) => (
                <Text key={item.id} style={styles.item}>
                  {item.quantity}× {item.productName}
                </Text>
              ))}
            </View>
            <Text style={styles.subStatus}>{subOrder.status.replaceAll('_', ' ')}</Text>
          </View>
        ))}
        <Text style={styles.section}>RESUMEN</Text>
        {data && (
          <View style={styles.summary}>
            {[
              ['Subtotal', data.subtotal],
              ['Delivery', data.deliveryFee],
              ['Servicio', data.serviceFee],
              ['Descuento', `-${data.discount}`],
            ].map(([label, value]) => (
              <View key={label} style={styles.row}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.value}>S/ {Number(value).toFixed(2)}</Text>
              </View>
            ))}
            <View style={[styles.row, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.total}>S/ {Number(data.total).toFixed(2)}</Text>
            </View>
            <Text style={styles.payment}>
              {data.paymentMethod} · {data.paymentStatus}
            </Text>
          </View>
        )}
        <Text style={styles.section}>TRAZABILIDAD</Text>
        <View style={styles.timeline}>
          {data?.statusHistory.map((event, index) => (
            <View key={event.id} style={styles.event}>
              {index === data.statusHistory.length - 1 ? (
                <CheckCircle2 size={18} color={colors.green} />
              ) : (
                <Circle size={18} color="#CBD5E1" />
              )}
              <View>
                <Text style={styles.eventTitle}>{event.toStatus.replaceAll('_', ' ')}</Text>
                <Text style={styles.eventDate}>
                  {new Date(event.createdAt).toLocaleString('es-PE')}
                </Text>
              </View>
            </View>
          ))}
        </View>
        {data?.status === 'DELIVERED' && (
          <Button
            label="Calificar entrega"
            onPress={() => router.push({ pathname: '/rating/[id]', params: { id: data.id } })}
            variant="amber"
          />
        )}
        <View style={styles.mapHint}>
          <MapPinned size={17} color={colors.navy2} />
          <Text style={styles.mapHintText}>
            El tracking cambia a polling REST si el WebSocket no está disponible.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  back: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statusCard: { alignItems: 'center', borderRadius: 22, backgroundColor: colors.navy, padding: 24 },
  statusIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#163759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: { color: colors.white, fontSize: 19, fontWeight: '900', marginTop: 13 },
  statusText: { color: '#94A3B8', fontSize: 11, marginTop: 5 },
  section: { color: '#94A3B8', fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginTop: 18 },
  pickup: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'flex-start',
    borderRadius: 17,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  sequence: {
    width: 29,
    height: 29,
    borderRadius: 10,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sequenceText: { color: colors.navy, fontSize: 11, fontWeight: '900' },
  merchant: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  item: { color: colors.muted, fontSize: 10, marginTop: 4 },
  subStatus: { color: '#C87800', fontSize: 8, fontWeight: '900', maxWidth: 75, textAlign: 'right' },
  summary: {
    borderRadius: 17,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: colors.muted, fontSize: 11 },
  value: { color: colors.navy, fontSize: 11, fontWeight: '800' },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, marginTop: 2 },
  totalLabel: { color: colors.navy, fontSize: 14, fontWeight: '900' },
  total: { color: colors.navy, fontSize: 17, fontWeight: '900' },
  payment: { color: '#C87800', fontSize: 9, fontWeight: '900', textAlign: 'right' },
  timeline: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 16,
    gap: 15,
  },
  event: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  eventTitle: { color: colors.navy, fontSize: 11, fontWeight: '900' },
  eventDate: { color: '#94A3B8', fontSize: 9, marginTop: 3 },
  mapHint: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 12,
    borderRadius: 13,
    backgroundColor: '#EAF0F6',
  },
  mapHintText: { flex: 1, color: colors.muted, fontSize: 9, lineHeight: 14 },
});

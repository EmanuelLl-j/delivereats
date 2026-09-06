import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, EmptyState, ScreenHeader } from '@/components/ui';
import { api } from '@/lib/api';

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  createdAt: string;
  subOrders: Array<{ merchant: { name: string } }>;
};

export default function OrdersScreen() {
  const orders = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api<Order[]>('/orders/orders'),
    refetchInterval: 10_000,
  });
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={orders.isFetching}
            onRefresh={() => void orders.refetch()}
            tintColor={colors.amber}
          />
        }
      >
        <ScreenHeader
          eyebrow="Tu actividad"
          title="Pedidos"
          subtitle="Historial y seguimiento de tus compras."
        />
        {!orders.data?.length && !orders.isLoading ? (
          <EmptyState
            icon="🧾"
            title="Todavía no tienes pedidos"
            message="Combina productos de varios comercios en un solo carrito."
          />
        ) : (
          <View style={{ gap: 12 }}>
            {orders.data?.map((order) => (
              <Link
                key={order.id}
                href={{ pathname: '/order/[id]', params: { id: order.id } }}
                asChild
              >
                <Pressable style={styles.card}>
                  <View style={styles.row}>
                    <View>
                      <Text style={styles.number}>{order.orderNumber}</Text>
                      <Text style={styles.merchants} numberOfLines={1}>
                        {order.subOrders.map((item) => item.merchant.name).join(' + ')}
                      </Text>
                    </View>
                    <Text style={styles.total}>S/ {Number(order.total).toFixed(2)}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.date}>
                      {new Date(order.createdAt).toLocaleDateString('es-PE')}
                    </Text>
                    <Text
                      style={[
                        styles.status,
                        order.status === 'DELIVERED' && {
                          color: colors.green,
                          backgroundColor: '#ECFDF5',
                        },
                      ]}
                    >
                      {order.status.replaceAll('_', ' ')}
                    </Text>
                  </View>
                </Pressable>
              </Link>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20, paddingBottom: 32 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 16,
    gap: 15,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  number: { color: colors.navy, fontSize: 15, fontWeight: '900' },
  merchants: { color: colors.muted, fontSize: 11, marginTop: 5, maxWidth: 230 },
  total: { color: colors.navy, fontSize: 16, fontWeight: '900' },
  date: { color: '#94A3B8', fontSize: 10, fontWeight: '700' },
  status: {
    color: '#C87800',
    backgroundColor: '#FFF7E6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 9,
    fontWeight: '900',
  },
});

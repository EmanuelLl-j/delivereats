import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeft, Minus, Plus, Trash2 } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, EmptyState, ScreenHeader } from '@/components/ui';
import { api } from '@/lib/api';

type CartItem = {
  id: string;
  quantity: number;
  product: { name: string; price: string };
  merchant: { id: string; name: string };
};
type Cart = { id: string; items: CartItem[] };

export default function CartScreen() {
  const client = useQueryClient();
  const cart = useQuery({ queryKey: ['cart'], queryFn: () => api<Cart>('/orders/cart') });
  const change = useMutation({
    mutationFn: ({ item, quantity }: { item: CartItem; quantity: number }) =>
      quantity <= 0
        ? api(`/orders/cart/items/${item.id}`, { method: 'DELETE' })
        : api(`/orders/cart/items/${item.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ quantity }),
          }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['cart'] }),
  });
  const groups = new Map<string, CartItem[]>();
  for (const item of cart.data?.items ?? [])
    groups.set(item.merchant.id, [...(groups.get(item.merchant.id) ?? []), item]);
  const subtotal = (cart.data?.items ?? []).reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0,
  );
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <ArrowLeft size={20} color={colors.navy} />
        </Pressable>
        <ScreenHeader
          eyebrow="Multi-negocio"
          title="Tu carrito"
          subtitle={`${groups.size} establecimiento(s) en una sola entrega coordinada.`}
        />
        {!cart.data?.items.length && !cart.isLoading ? (
          <EmptyState
            icon="🛒"
            title="Tu carrito está vacío"
            message="Añade productos desde uno o varios comercios."
          />
        ) : (
          <View style={{ gap: 15 }}>
            {Array.from(groups.values()).map((items) => (
              <View key={items[0]!.merchant.id} style={styles.group}>
                <View style={styles.groupHead}>
                  <Text style={styles.store}>{items[0]!.merchant.name}</Text>
                  <Text style={styles.pickup}>PUNTO DE RECOJO</Text>
                </View>
                {items.map((item) => (
                  <View key={item.id} style={styles.item}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.product.name}</Text>
                      <Text style={styles.price}>S/ {Number(item.product.price).toFixed(2)}</Text>
                    </View>
                    <View style={styles.quantity}>
                      <Pressable
                        onPress={() => change.mutate({ item, quantity: item.quantity - 1 })}
                      >
                        {item.quantity === 1 ? (
                          <Trash2 size={15} color={colors.red} />
                        ) : (
                          <Minus size={15} color={colors.navy} />
                        )}
                      </Pressable>
                      <Text style={styles.qty}>{item.quantity}</Text>
                      <Pressable
                        onPress={() => change.mutate({ item, quantity: item.quantity + 1 })}
                      >
                        <Plus size={15} color={colors.navy} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ))}
            <View style={styles.summary}>
              <View style={styles.row}>
                <Text style={styles.summaryLabel}>Subtotal estimado</Text>
                <Text style={styles.summaryValue}>S/ {subtotal.toFixed(2)}</Text>
              </View>
              <Text style={styles.note}>
                Delivery, servicio y descuento se calculan de forma segura en el checkout.
              </Text>
            </View>
            <Button
              label="Continuar al checkout"
              onPress={() => router.push('/checkout')}
              variant="amber"
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20, paddingBottom: 36 },
  back: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  group: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  groupHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#F8FAFC',
  },
  store: { color: colors.navy, fontSize: 13, fontWeight: '900' },
  pickup: { color: '#C87800', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  itemName: { color: colors.navy, fontSize: 13, fontWeight: '800' },
  price: { color: '#C87800', fontSize: 11, fontWeight: '900', marginTop: 5 },
  quantity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 38,
  },
  qty: { color: colors.navy, fontSize: 13, fontWeight: '900' },
  summary: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 17,
    borderWidth: 1,
    borderColor: colors.line,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  summaryValue: { color: colors.navy, fontSize: 17, fontWeight: '900' },
  note: { color: '#94A3B8', fontSize: 10, lineHeight: 15, marginTop: 10 },
});

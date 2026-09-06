import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ShoppingCart, Star } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/components/ui';
import { api } from '@/lib/api';

type Product = {
  id: string;
  name: string;
  description: string;
  price: string;
  isAvailable: boolean;
};
type Merchant = {
  id: string;
  name: string;
  description: string;
  rating: string;
  category: string;
  deliveryEstimateMin: number;
  deliveryEstimateMax: number;
  categories: Array<{ id: string; name: string; products: Product[] }>;
};

export default function MerchantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useQueryClient();
  const merchant = useQuery({
    queryKey: ['merchant', id],
    queryFn: () => api<Merchant>(`/orders/merchants/${id}`),
  });
  const add = useMutation({
    mutationFn: (productId: string) =>
      api('/orders/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity: 1 }),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['cart'] });
      Alert.alert('Añadido', 'El producto está en tu carrito multi-negocio.');
    },
    onError: (error) => Alert.alert('No se pudo añadir', error.message),
  });
  const data = merchant.data;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Pressable onPress={() => router.back()} style={styles.round}>
            <ArrowLeft size={20} color={colors.white} />
          </Pressable>
          <Pressable onPress={() => router.push('/cart')} style={styles.round}>
            <ShoppingCart size={20} color={colors.white} />
          </Pressable>
          <Text style={styles.heroIcon}>
            {data?.category === 'PHARMACY'
              ? '💊'
              : data?.category === 'SUPERMARKET'
                ? '🛒'
                : data?.category === 'RESTAURANT'
                  ? '🍲'
                  : '⚡'}
          </Text>
        </View>
        {data && (
          <View style={styles.info}>
            <Text style={styles.name}>{data.name}</Text>
            <View style={styles.meta}>
              <Star size={13} fill={colors.amber} color={colors.amber} />
              <Text style={styles.metaText}>
                {Number(data.rating).toFixed(1)} · {data.deliveryEstimateMin}-
                {data.deliveryEstimateMax} min
              </Text>
            </View>
            <Text style={styles.description}>{data.description}</Text>
          </View>
        )}
        {data?.categories.map((category) => (
          <View key={category.id}>
            <Text style={styles.category}>{category.name}</Text>
            <View style={{ gap: 11 }}>
              {category.products.map((product) => (
                <View key={product.id} style={styles.product}>
                  <View style={styles.productImage}>
                    <Text style={{ fontSize: 27 }}>✦</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text numberOfLines={2} style={styles.productDescription}>
                      {product.description}
                    </Text>
                    <Text style={styles.price}>S/ {Number(product.price).toFixed(2)}</Text>
                  </View>
                  <Pressable
                    disabled={add.isPending}
                    onPress={() => add.mutate(product.id)}
                    style={styles.add}
                  >
                    <Text style={styles.addText}>+</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: 36 },
  hero: {
    height: 220,
    backgroundColor: colors.navy,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  round: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  heroIcon: { position: 'absolute', fontSize: 104, right: 26, bottom: -12, opacity: 0.76 },
  info: {
    marginHorizontal: 20,
    marginTop: -38,
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.line,
  },
  name: { color: colors.navy, fontSize: 25, fontWeight: '900', letterSpacing: -0.8 },
  meta: { flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 8 },
  metaText: { color: '#C87800', fontSize: 11, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 11 },
  category: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '900',
    marginHorizontal: 20,
    marginTop: 27,
    marginBottom: 12,
  },
  product: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  productImage: {
    width: 61,
    height: 61,
    borderRadius: 14,
    backgroundColor: '#FFF7E6',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.amber,
  },
  productName: { color: colors.navy, fontSize: 13, fontWeight: '900' },
  productDescription: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 4 },
  price: { color: '#C87800', fontSize: 13, fontWeight: '900', marginTop: 6 },
  add: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { color: colors.navy, fontSize: 22, lineHeight: 24, fontWeight: '900' },
});

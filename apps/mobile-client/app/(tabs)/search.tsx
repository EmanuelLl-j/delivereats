import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, EmptyState, ScreenHeader } from '@/components/ui';
import { api } from '@/lib/api';

type Merchant = {
  id: string;
  name: string;
  description: string;
  category: string;
  rating: string;
  deliveryEstimateMin: number;
};

export default function SearchScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const [search, setSearch] = useState('');
  const merchants = useQuery({
    queryKey: ['merchant-search', search, params.category],
    queryFn: () =>
      api<Merchant[]>(
        `/orders/merchants?${new URLSearchParams({ ...(search ? { search } : {}), ...(params.category ? { category: params.category } : {}) }).toString()}`,
      ),
  });
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          eyebrow="Descubre"
          title="Buscar"
          subtitle="Restaurantes, supermercados, farmacias y entregas express."
        />
        <View style={styles.search}>
          <Search size={18} color="#94A3B8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="¿Qué estás buscando?"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            autoFocus={false}
          />
        </View>
        {merchants.isLoading ? (
          <ActivityIndicator color={colors.amber} style={{ margin: 50 }} />
        ) : !merchants.data?.length ? (
          <EmptyState icon="🔎" title="Sin resultados" message="Prueba otro nombre o categoría." />
        ) : (
          <View style={styles.results}>
            {merchants.data.map((merchant) => (
              <Link
                key={merchant.id}
                href={{ pathname: '/merchant/[id]', params: { id: merchant.id } }}
                asChild
              >
                <Pressable style={styles.card}>
                  <View style={styles.icon}>
                    <Text style={{ fontSize: 30 }}>
                      {merchant.category === 'PHARMACY'
                        ? '💊'
                        : merchant.category === 'SUPERMARKET'
                          ? '🛒'
                          : merchant.category === 'RESTAURANT'
                            ? '🍲'
                            : '⚡'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{merchant.name}</Text>
                    <Text style={styles.meta}>
                      ★ {Number(merchant.rating).toFixed(1)} · desde {merchant.deliveryEstimateMin}{' '}
                      min
                    </Text>
                    <Text numberOfLines={2} style={styles.description}>
                      {merchant.description}
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
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  input: { flex: 1, color: colors.navy, fontSize: 14 },
  results: { gap: 12 },
  card: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 13,
  },
  icon: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: '#EFF4F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: colors.navy, fontSize: 15, fontWeight: '900' },
  meta: { color: '#C87800', fontSize: 10, fontWeight: '800', marginTop: 5 },
  description: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
});

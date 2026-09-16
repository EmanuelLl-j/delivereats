import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Bell, MapPin, Search, ShoppingCart } from 'lucide-react-native';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/components/ui';
import { api, assetUrl } from '@/lib/api';

type Merchant = {
  id: string;
  name: string;
  description: string;
  category: string;
  rating: string;
  logoUrl?: string; coverUrl?: string;
  deliveryEstimateMin: number;
  deliveryEstimateMax: number;
  isOpen: boolean;
};
const categories = [
  { key: 'RESTAURANT', label: 'Restaurantes', icon: '🍲' },
  { key: 'SUPERMARKET', label: 'Mercados', icon: '🛒' },
  { key: 'PHARMACY', label: 'Farmacias', icon: '💊' },
  { key: 'SHIPMENT', label: 'Envíos', icon: '📦' },
];

export default function HomeScreen() {
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api<{ firstName: string }>('/users/auth/profile') });
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: () => api<Array<{ label: string; address: string; isDefault: boolean }>>('/users/users/me/addresses') });
  const unread = useQuery({ queryKey: ['notification-unread'], queryFn: () => api<{ count: number }>('/notifications/notifications/unread-count'), refetchInterval: 15000 });
  const locationLabel = (addresses.data?.find(item => item.isDefault) ?? addresses.data?.[0])?.address ?? 'Elige tu dirección de entrega';
  const merchants = useQuery({
    queryKey: ['merchants'],
    queryFn: () => api<Merchant[]>('/orders/merchants'),
  });
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={merchants.isFetching}
            onRefresh={() => void merchants.refetch()}
            tintColor={colors.amber}
          />
        }
        contentContainerStyle={styles.content}
      >
        <View style={styles.top}>
          <View>
            <Text style={styles.greeting}>HOLA{profile.data?.firstName ? ', ' + profile.data.firstName.toLocaleUpperCase('es-PE') : ''}</Text>
            <Link href="/addresses" asChild><Pressable style={styles.location}>
              <MapPin size={15} color={colors.amber} />
              <Text style={styles.locationText} numberOfLines={1}>
                {locationLabel}
              </Text>
            </Pressable></Link>
          </View>
          <Link href="/(tabs)/notifications" asChild><Pressable accessibilityLabel="Notificaciones" style={styles.cart}><Bell size={20} color={colors.navy} />{!!unread.data?.count && <Text style={{ color: colors.red, fontSize: 10 }}>{unread.data.count}</Text>}</Pressable></Link>
          <Link href="/cart" asChild>
            <Pressable style={styles.cart}>
              <ShoppingCart size={20} color={colors.navy} />
            </Pressable>
          </Link>
        </View>
        <Text style={styles.hero}>¿Qué necesitas{`\n`}hoy?</Text>
        <Link href="/(tabs)/search" asChild>
          <Pressable style={styles.search}>
            <Search size={18} color="#94A3B8" />
            <Text style={styles.searchText}>Busca comida, farmacia o envíos</Text>
          </Pressable>
        </Link>
        <Text style={styles.sectionTitle}>Explora categorías</Text>
        <FlatList
          data={categories}
          horizontal
          scrollEnabled={false}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.categories}
          renderItem={({ item }) => (
            <Link href={item.key === 'SHIPMENT' ? '/shipment' : { pathname: '/(tabs)/search', params: { category: item.key } }} asChild>
              <Pressable style={styles.category}>
                <Text style={styles.categoryIcon}>{item.icon}</Text>
                <Text style={styles.categoryLabel}>{item.label}</Text>
              </Pressable>
            </Link>
          )}
        />
        <Link href="/shipment" asChild><Pressable style={styles.promo}>
          <View style={{ flex: 1 }}>
            <Text style={styles.promoKicker}>ENVÍOS PERSONALES</Text>
            <Text style={styles.promoTitle}>¿Un paquete por enviar? Cotiza según su tamaño y destino.</Text>
            <Text style={styles.promoCode}>Cotizar envío →</Text>
          </View>
          <Text style={styles.promoIcon}>↗</Text>
        </Pressable></Link>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Comercios en Ayacucho</Text>
          <Link href="/(tabs)/search"><Text style={styles.seeAll}>Ver todos</Text></Link>
        </View>
        {merchants.isLoading ? (
          <ActivityIndicator color={colors.amber} style={{ margin: 40 }} />
        ) : merchants.isError ? (
          <Text style={styles.error}>
            No pudimos cargar los comercios. Desliza para reintentar.
          </Text>
        ) : (
          <View style={{ gap: 13 }}>
            {!merchants.data?.length && <Text style={{ padding: 24, color: colors.muted }}>Aún no hay comercios aprobados disponibles. Puedes consultar de nuevo más tarde.</Text>}
            {merchants.data?.map((merchant) => (
              <Link
                key={merchant.id}
                href={{ pathname: '/merchant/[id]', params: { id: merchant.id } }}
                asChild
              >
                <Pressable style={styles.merchant}>
                  <View style={styles.merchantImage}>
                    {merchant.logoUrl ? <Image source={{ uri: assetUrl(merchant.logoUrl) }} style={{ width: 66, height: 66, borderRadius: 15 }} /> : <>
                    <Text style={{ fontSize: 31 }}>
                      {merchant.category === 'PHARMACY'
                        ? '💊'
                        : merchant.category === 'SUPERMARKET'
                          ? '🛒'
                          : merchant.category === 'RESTAURANT'
                            ? '🍲'
                            : '⚡'}
                    </Text></>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.merchantName}>{merchant.name}</Text>
                    <Text style={styles.merchantMeta}>
                      ★ {Number(merchant.rating).toFixed(1)} · {merchant.deliveryEstimateMin}-
                      {merchant.deliveryEstimateMax} min
                    </Text>
                    <Text style={styles.merchantDescription} numberOfLines={1}>
                      {merchant.description}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.openDot,
                      { backgroundColor: merchant.isOpen ? colors.green : colors.red },
                    ]}
                  />
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
  content: { padding: 20, paddingBottom: 36 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { color: '#C87800', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, maxWidth: 260 },
  locationText: { color: colors.navy, fontSize: 13, fontWeight: '800' },
  cart: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  hero: {
    color: colors.navy,
    fontSize: 37,
    lineHeight: 42,
    fontWeight: '900',
    letterSpacing: -1.5,
    marginTop: 27,
  },
  search: {
    height: 54,
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  searchText: { color: '#94A3B8', fontSize: 13 },
  sectionTitle: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 27,
    marginBottom: 14,
  },
  categories: { justifyContent: 'space-between', width: '100%' },
  category: { width: 78, alignItems: 'center', gap: 8 },
  categoryIcon: {
    width: 58,
    height: 58,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 25,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    paddingTop: 12,
  },
  categoryLabel: { color: '#475569', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  promo: {
    marginTop: 28,
    borderRadius: 22,
    backgroundColor: colors.navy,
    padding: 20,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  promoKicker: { color: colors.amber, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  promoTitle: {
    color: colors.white,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
    marginTop: 7,
    maxWidth: 250,
  },
  promoCode: {
    color: colors.navy,
    backgroundColor: colors.amber,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 12,
  },
  promoIcon: { color: colors.amber, fontSize: 68, opacity: 0.2 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seeAll: { color: '#C87800', fontSize: 11, fontWeight: '800', marginTop: 16 },
  merchant: {
    flexDirection: 'row',
    gap: 13,
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  merchantImage: {
    width: 66,
    height: 66,
    borderRadius: 15,
    backgroundColor: '#F0F4F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantName: { color: colors.navy, fontSize: 15, fontWeight: '900' },
  merchantMeta: { color: '#C87800', fontSize: 10, fontWeight: '800', marginTop: 4 },
  merchantDescription: { color: colors.muted, fontSize: 10, marginTop: 5 },
  openDot: { width: 8, height: 8, borderRadius: 4, alignSelf: 'flex-start', marginTop: 5 },
  error: { color: colors.red, textAlign: 'center', padding: 30, fontSize: 12 },
});

import { useInfiniteQuery } from '@tanstack/react-query';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, Header } from '@/components/ui';
import { api } from '@/lib/api';
type Assignment = { id: string; orderId: string; status: string; estimatedEarnings: string; assignedAt: string; destination: string | null };
type Page = { items: Assignment[]; nextCursor: string | null };
const labels: Record<string, string> = { OFFERED: 'Oferta recibida', ACCEPTED: 'En curso', REJECTED: 'Rechazada', EXPIRED: 'Vencida', COMPLETED: 'Completada' };
export default function HistoryScreen() {
  const query = useInfiniteQuery({ queryKey: ['driver-history'], initialPageParam: '', queryFn: ({ pageParam }) => api<Page>('/drivers/drivers/me/history' + (pageParam ? '?cursor=' + pageParam : '')), getNextPageParam: page => page.nextCursor ?? undefined });
  const rows = query.data?.pages.flatMap(page => page.items) ?? [];
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}><ScrollView contentContainerStyle={{ padding: 22, gap: 16 }}>
    <Header eyebrow="ACTIVIDAD" title="Historial" subtitle="Tus ofertas y entregas, de la más reciente a la más antigua." />
    {query.isLoading && <Text>Cargando historial…</Text>}
    {query.isError && <Text accessibilityRole="alert" style={{ color: colors.red }}>{query.error.message}</Text>}
    {!query.isLoading && !query.isError && !rows.length && <Text style={{ color: colors.muted }}>Aún no has recibido ofertas de entrega.</Text>}
    {rows.map(row => <View key={row.id} style={{ padding: 20, borderRadius: 18, backgroundColor: 'white', gap: 8 }}>
      <Text style={{ fontWeight: '800', color: colors.navy }}>Pedido {row.orderId.slice(0,8)}</Text><Text style={{ color: colors.muted }}>{new Date(row.assignedAt).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</Text>
      <Text style={{ color: row.status === 'COMPLETED' ? colors.green : colors.navy }}>{labels[row.status] ?? row.status}</Text>
      <Text>{row.status === 'COMPLETED' ? 'Ganancia' : 'Ganancia ofrecida'}: S/ {Number(row.estimatedEarnings).toFixed(2)}</Text>
    </View>)}
    {query.hasNextPage && <Button label="Cargar anteriores" loading={query.isFetchingNextPage} onPress={() => query.fetchNextPage()} />}
  </ScrollView></SafeAreaView>;
}

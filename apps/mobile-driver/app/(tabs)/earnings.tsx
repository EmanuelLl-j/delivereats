import { useQuery } from '@tanstack/react-query';
import { CircleDollarSign, TrendingUp } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, Header } from '@/components/ui';
import { api } from '@/lib/api';
type Assignment = { status: string; estimatedEarnings: string; completedAt?: string };
type Profile = { assignments: Assignment[] };
export default function EarningsScreen() {
  const profile = useQuery({
    queryKey: ['driver-profile'],
    queryFn: () => api<Profile>('/drivers/drivers/me'),
  });
  const completed = profile.data?.assignments.filter((item) => item.status === 'COMPLETED') ?? [];
  const total = completed.reduce((sum, item) => sum + Number(item.estimatedEarnings), 0);
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Header
          eyebrow="RENDIMIENTO"
          title="Ganancias"
          subtitle="Resumen transparente de tus entregas completadas."
        />
        <View style={styles.hero}>
          <CircleDollarSign size={29} color={colors.amber} />
          <Text style={styles.heroLabel}>GANANCIA ACUMULADA</Text>
          <Text style={styles.total}>S/ {total.toFixed(2)}</Text>
          <View style={styles.trend}>
            <TrendingUp size={14} color={colors.green} />
            <Text style={styles.trendText}>{completed.length} entregas completadas</Text>
          </View>
        </View>
        <View style={styles.grid}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              S/ {completed.length ? (total / completed.length).toFixed(2) : '0.00'}
            </Text>
            <Text style={styles.metricLabel}>Promedio por entrega</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{completed.length}</Text>
            <Text style={styles.metricLabel}>Pedidos pagados</Text>
          </View>
        </View>
        <Text style={styles.note}>
          Las cifras son demostrativas y se calculan sobre DriverAssignment. No constituyen una
          liquidación bancaria.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20 },
  hero: { borderRadius: 23, backgroundColor: colors.navy, alignItems: 'center', padding: 27 },
  heroLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginTop: 12,
  },
  total: { color: colors.white, fontSize: 37, fontWeight: '900', letterSpacing: -1, marginTop: 7 },
  trend: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    backgroundColor: '#163759',
    borderRadius: 9,
    padding: 8,
    marginTop: 13,
  },
  trendText: { color: '#A7F3D0', fontSize: 9, fontWeight: '800' },
  grid: { flexDirection: 'row', gap: 11, marginTop: 14 },
  metric: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 18,
  },
  metricValue: { color: colors.navy, fontSize: 16, fontWeight: '900' },
  metricLabel: { color: colors.muted, fontSize: 9, marginTop: 6, textAlign: 'center' },
  note: { color: '#94A3B8', fontSize: 9, lineHeight: 14, marginTop: 16, textAlign: 'center' },
});

import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, Header } from '@/components/ui';
import { api } from '@/lib/api';
type Assignment = {
  id: string;
  orderId: string;
  status: string;
  estimatedEarnings: string;
  assignedAt: string;
};
type Profile = { assignments: Assignment[] };
export default function HistoryScreen() {
  const profile = useQuery({
    queryKey: ['driver-profile'],
    queryFn: () => api<Profile>('/drivers/drivers/me'),
  });
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Header eyebrow="ACTIVIDAD" title="Historial" subtitle="Ofertas y entregas recientes." />
        <View style={{ gap: 11 }}>
          {profile.data?.assignments.map((item) => (
            <View key={item.id} style={styles.card}>
              <View>
                <Text style={styles.order}>Pedido {item.orderId.slice(0, 8)}</Text>
                <Text style={styles.date}>{new Date(item.assignedAt).toLocaleString('es-PE')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.money}>S/ {Number(item.estimatedEarnings).toFixed(2)}</Text>
                <Text
                  style={[
                    styles.status,
                    item.status === 'COMPLETED' && {
                      color: colors.green,
                      backgroundColor: '#ECFDF5',
                    },
                  ]}
                >
                  {item.status}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20 },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 15,
  },
  order: { color: colors.navy, fontSize: 13, fontWeight: '900' },
  date: { color: '#94A3B8', fontSize: 9, marginTop: 5 },
  money: { color: colors.navy, fontSize: 13, fontWeight: '900' },
  status: {
    color: '#C87800',
    fontSize: 8,
    fontWeight: '900',
    backgroundColor: '#FFF7E6',
    padding: 4,
    borderRadius: 6,
    marginTop: 5,
  },
});

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, EmptyState, ScreenHeader } from '@/components/ui';
import { api } from '@/lib/api';

type Notification = {
  id: string;
  title: string;
  message: string;
  readAt?: string;
  createdAt: string;
  type: string;
};

export default function NotificationsScreen() {
  const client = useQueryClient();
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<Notification[]>('/notifications/notifications'),
  });
  const markAll = useMutation({
    mutationFn: () => api('/notifications/notifications/read-all', { method: 'PATCH', body: '{}' }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const mark = useMutation({
    mutationFn: (id: string) =>
      api(`/notifications/notifications/${id}/read`, { method: 'PATCH', body: '{}' }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['notifications'] }),
  });
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={notifications.isFetching}
            onRefresh={() => void notifications.refetch()}
            tintColor={colors.amber}
          />
        }
      >
        <ScreenHeader
          eyebrow="En tiempo real"
          title="Notificaciones"
          subtitle="Pagos, preparación, reparto y promociones."
          action={
            <Pressable onPress={() => markAll.mutate()}>
              <Text style={styles.markAll}>Leer todas</Text>
            </Pressable>
          }
        />
        {!notifications.data?.length && !notifications.isLoading ? (
          <EmptyState
            icon="🔔"
            title="Todo al día"
            message="Aquí verás cada novedad de tus pedidos."
          />
        ) : (
          <View style={{ gap: 10 }}>
            {notifications.data?.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => !item.readAt && mark.mutate(item.id)}
                style={[styles.card, !item.readAt && styles.unread]}
              >
                <View style={styles.icon}>
                  <Text>
                    {item.type === 'PAYMENT' ? '💳' : item.type === 'PROMOTION' ? '🎁' : '🛵'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.message}>{item.message}</Text>
                  <Text style={styles.time}>
                    {new Date(item.createdAt).toLocaleString('es-PE')}
                  </Text>
                </View>
                {!item.readAt && <View style={styles.dot} />}
              </Pressable>
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
  markAll: { color: '#C87800', fontSize: 11, fontWeight: '900' },
  card: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 14,
  },
  unread: { borderColor: '#F4C365', backgroundColor: '#FFFBF1' },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#EFF4F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.navy, fontSize: 13, fontWeight: '900' },
  message: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  time: { color: '#94A3B8', fontSize: 9, marginTop: 7 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.amber, marginTop: 5 },
});

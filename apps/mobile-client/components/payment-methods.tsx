import { useQuery } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { colors } from './ui';
export type PaymentMethod = { method: string; accountLabel?: string; instructions?: string; qrImageUrl?: string };
export const paymentLabels: Record<string, string> = { CASH: 'Efectivo al entregar', MERCADO_PAGO: 'Mercado Pago', YAPE_MANUAL: 'Yape · verificación manual', PLIN_MANUAL: 'Plin · verificación manual' };
export function PaymentMethods({ value, onChange, cashAllowed = true }: { value: string; onChange: (value: string) => void; cashAllowed?: boolean }) {
  const methods = useQuery({ queryKey: ['payment-methods'], queryFn: () => api<PaymentMethod[]>('/orders/payments/methods') });
  const rows = methods.data?.filter(item => cashAllowed || item.method !== 'CASH') ?? [];
  return <View style={{ gap: 10 }}>
    <Text style={{ color: colors.navy, fontWeight: '800', fontSize: 16 }}>Medio de pago</Text>
    {methods.isError && <Text style={{ color: colors.red }}>{methods.error.message}</Text>}
    {!methods.isLoading && !rows.length && <Text style={{ color: colors.muted }}>No hay medios de pago disponibles. Inténtalo más tarde.</Text>}
    {rows.map(item => <Pressable accessibilityRole="radio" accessibilityState={{ checked: value === item.method }} key={item.method} onPress={() => onChange(item.method)} style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: value === item.method ? colors.amber : colors.line, backgroundColor: value === item.method ? '#fffbeb' : 'white' }}><Text style={{ fontWeight: '700', color: colors.navy }}>{value === item.method ? '● ' : '○ '}{paymentLabels[item.method] ?? item.method}</Text></Pressable>)}
  </View>;
}


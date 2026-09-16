import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, Header } from '@/components/ui';
import { api } from '@/lib/api';
type Earnings = { amount: number; average: number; completed: number; from: string };
export default function EarningsScreen() {
  const [period, setPeriod] = useState('day');
  const query = useQuery({ queryKey: ['driver-earnings', period], queryFn: () => api<Earnings>('/drivers/drivers/me/earnings?period=' + period), refetchInterval: 30_000 });
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}><ScrollView contentContainerStyle={{ padding: 22, gap: 18 }}>
    <Header eyebrow="RENDIMIENTO" title="Mis ganancias" subtitle="Entregas efectivamente completadas, según la fecha de cierre." />
    <View style={{ gap: 8 }}>{[['day','Hoy'],['week','Últimos 7 días'],['month','Últimos 30 días'],['year','Últimos 365 días']].map(([value,label]) => <Button key={value} label={(period === value ? '✓ ' : '') + label} onPress={() => setPeriod(value!)} />)}</View>
    {query.isLoading ? <Text>Cargando ganancias…</Text> : query.isError ? <Text accessibilityRole="alert" style={{ color: colors.red }}>{query.error.message}</Text> : query.data && <>
      <View style={{ padding: 28, borderRadius: 22, backgroundColor: colors.navy, gap: 10 }}><Text style={{ color: '#cbd5e1' }}>GANANCIA DEL PERIODO</Text><Text style={{ color: 'white', fontSize: 38, fontWeight: '900' }}>S/ {query.data.amount.toFixed(2)}</Text><Text style={{ color: '#a7f3d0' }}>{query.data.completed} entregas completadas</Text></View>
      <View style={{ padding: 20, backgroundColor: 'white', borderRadius: 18 }}><Text style={{ color: colors.muted }}>Promedio por entrega</Text><Text style={{ color: colors.navy, fontSize: 24, fontWeight: '800' }}>S/ {query.data.average.toFixed(2)}</Text></View>
      <Text style={{ color: colors.muted }}>Desde {new Date(query.data.from).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}. Son ganancias devengadas; no acreditan una liquidación ni transferencia bancaria.</Text>
    </>}
  </ScrollView></SafeAreaView>;
}

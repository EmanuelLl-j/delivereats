import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, Field, ScreenHeader } from '@/components/ui';
import { PaymentMethods } from '@/components/payment-methods';
import { LegalAcceptance } from '@/components/legal-acceptance';
import { api } from '@/lib/api';
type Address = { id: string; label: string; address: string; latitude: string; longitude: string; isDefault: boolean };
type Totals = { subtotal: number; deliveryFee: number; serviceFee: number; discount: number; total: number };
export default function CheckoutScreen() {
  const cache = useQueryClient();
  const [method, setMethod] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [addressId, setAddressId] = useState('');
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: () => api<Address[]>('/users/users/me/addresses') });
  const selected = addresses.data?.find(item => item.id === addressId) ?? addresses.data?.find(item => item.isDefault) ?? addresses.data?.[0];
  const payload = selected ? { deliveryAddressId: selected.id, deliveryAddress: selected.address, deliveryLatitude: Number(selected.latitude), deliveryLongitude: Number(selected.longitude), paymentMethod: method, promoCode: promoCode.trim() || undefined } : null;
  const quote = useQuery({ queryKey: ['checkout-quote', payload], queryFn: () => api<Totals>('/orders/cart/quote', { method: 'POST', body: JSON.stringify(payload) }), enabled: !!payload && !!method, retry: false });
  const checkout = useMutation({ mutationFn: () => {
    if (!payload || !quote.data) throw new Error('Selecciona dirección y medio de pago y revisa el total.');
    return api<{ order: { id: string } }>('/orders/cart/checkout', { method: 'POST', body: JSON.stringify({ ...payload, expectedTotal: quote.data.total }) });
  }, onSuccess: async result => { await cache.invalidateQueries({ queryKey: ['cart'] }); await cache.invalidateQueries({ queryKey: ['orders'] }); router.replace({ pathname: '/order/[id]', params: { id: result.order.id } }); } });
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}><ScrollView contentContainerStyle={{ padding: 22, gap: 16 }}>
    <Button label="Volver al carrito" variant="ghost" onPress={() => router.back()} />
    <ScreenHeader eyebrow="Último paso" title="Confirmar pedido" subtitle="Revisa la dirección, el importe y las condiciones antes de confirmar." />
    <Text style={{ color: colors.navy, fontWeight: '800', fontSize: 18 }}>Dónde entregamos</Text>
    {addresses.data?.map(item => <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected?.id === item.id }} key={item.id} onPress={() => setAddressId(item.id)} style={{ padding: 16, backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: selected?.id === item.id ? colors.amber : colors.line }}><Text style={{ fontWeight: '800' }}>{item.label}</Text><Text>{item.address}</Text></Pressable>)}
    {addresses.isError && <Text style={{ color: colors.red }}>{addresses.error.message}</Text>}
    <Button label="Gestionar direcciones" variant="ghost" onPress={() => router.push('/addresses')} />
    <PaymentMethods value={method} onChange={setMethod} />
    <Field label="Cupón (opcional)" value={promoCode} onChangeText={setPromoCode} autoCapitalize="characters" />
    <LegalAcceptance types={['GENERAL_TERMS', 'PRIVACY_POLICY']} />
    {quote.data && <View style={{ padding: 20, backgroundColor: 'white', borderRadius: 18, gap: 12 }}>{([['Subtotal', 'subtotal'], ['Entrega', 'deliveryFee'], ['Servicio', 'serviceFee'], ['Descuento', 'discount'], ['Total a pagar', 'total']] as const).map(([label, key]) => <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontWeight: key === 'total' ? '800' : '400' }}>{label}</Text><Text style={{ fontWeight: '800' }}>S/ {quote.data[key].toFixed(2)}</Text></View>)}</View>}
    {(quote.isError || checkout.isError) && <Text accessibilityRole="alert" style={{ color: colors.red }}>{checkout.error?.message ?? quote.error?.message}</Text>}
    <Button label={quote.data ? 'Confirmar · S/ ' + quote.data.total.toFixed(2) : 'Confirmar pedido'} variant="amber" disabled={!quote.data || quote.isFetching || !method || !selected} loading={checkout.isPending} onPress={() => checkout.mutate()} />
  </ScrollView></SafeAreaView>;
}

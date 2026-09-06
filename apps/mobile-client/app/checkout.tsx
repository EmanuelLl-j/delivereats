import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeft, Banknote, CreditCard, MapPin, Smartphone } from 'lucide-react-native';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, ScreenHeader } from '@/components/ui';
import { api } from '@/lib/api';

type Address = {
  id: string;
  label: string;
  address: string;
  reference?: string;
  latitude: string;
  longitude: string;
  isDefault: boolean;
};
type CheckoutResult = {
  order: { id: string; orderNumber: string; total: string };
  payment?: { client?: { sandbox: boolean; sandboxCode?: string } };
};
const methods = [
  { value: 'YAPE', label: 'Yape sandbox', icon: Smartphone },
  { value: 'MERCADO_PAGO', label: 'Mercado Pago', icon: CreditCard },
  { value: 'CASH', label: 'Efectivo', icon: Banknote },
];

export default function CheckoutScreen() {
  const [method, setMethod] = React.useState('YAPE');
  const [promoCode, setPromoCode] = React.useState('PDGP10');
  const addresses = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api<Address[]>('/users/users/me/addresses'),
  });
  const selected = addresses.data?.find((item) => item.isDefault) ?? addresses.data?.[0];
  const checkout = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Agrega una dirección antes de continuar');
      return api<CheckoutResult>('/orders/cart/checkout', {
        method: 'POST',
        body: JSON.stringify({
          deliveryAddressId: selected.id,
          deliveryAddress: selected.address,
          deliveryLatitude: Number(selected.latitude),
          deliveryLongitude: Number(selected.longitude),
          paymentMethod: method,
          promoCode: promoCode || undefined,
        }),
      });
    },
    onSuccess: (result) => {
      const code =
        result.payment && 'client' in result.payment
          ? result.payment.client?.sandboxCode
          : undefined;
      Alert.alert(
        'Pedido confirmado',
        `${result.order.orderNumber}${code ? `\n\nCódigo sandbox: ${code}` : ''}`,
      );
      router.replace({ pathname: '/order/[id]', params: { id: result.order.id } });
    },
    onError: (error) => Alert.alert('No se pudo confirmar', error.message),
  });
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <ArrowLeft size={20} color={colors.navy} />
        </Pressable>
        <ScreenHeader
          eyebrow="Confirmación segura"
          title="Checkout"
          subtitle="El servidor recalcula productos, promociones y tarifas."
        />
        <Text style={styles.section}>ENTREGA</Text>
        <View style={styles.address}>
          <MapPin size={20} color={colors.amber} />
          <View style={{ flex: 1 }}>
            <Text style={styles.addressLabel}>{selected?.label ?? 'Cargando dirección…'}</Text>
            <Text style={styles.addressText}>
              {selected?.address ?? 'Necesitas una dirección guardada'}
            </Text>
          </View>
        </View>
        <Text style={styles.section}>MÉTODO DE PAGO</Text>
        <View style={{ gap: 10 }}>
          {methods.map(({ value, label, icon: Icon }) => (
            <Pressable
              key={value}
              onPress={() => setMethod(value)}
              style={[styles.method, method === value && styles.selected]}
            >
              <View style={styles.methodIcon}>
                <Icon size={19} color={method === value ? colors.navy : colors.muted} />
              </View>
              <Text style={styles.methodLabel}>{label}</Text>
              <View style={[styles.radio, method === value && styles.radioSelected]}>
                {method === value && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          ))}
        </View>
        <Text style={styles.sandbox}>
          Yape y Plin usan un PaymentIntent simulado claramente identificado. Mercado Pago usa
          sandbox o mock según las variables del backend.
        </Text>
        <Text style={styles.section}>CUPÓN</Text>
        <TextInput
          value={promoCode}
          onChangeText={setPromoCode}
          autoCapitalize="characters"
          placeholder="Código promocional"
          style={styles.coupon}
        />
        <View style={styles.security}>
          <Text style={styles.securityTitle}>Cálculo protegido</Text>
          <Text style={styles.securityText}>
            Nunca enviamos precios calculados por la app. El total final se genera en
            orders-service.
          </Text>
        </View>
        <Button
          label="Confirmar pedido"
          onPress={() => checkout.mutate()}
          loading={checkout.isPending}
          variant="amber"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20, paddingBottom: 36 },
  back: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  section: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginTop: 22,
    marginBottom: 10,
  },
  address: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 16,
  },
  addressLabel: { color: colors.navy, fontSize: 13, fontWeight: '900' },
  addressText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  method: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 12,
  },
  selected: { borderColor: colors.amber, backgroundColor: '#FFFBF1' },
  methodIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF4F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodLabel: { flex: 1, color: colors.navy, fontSize: 13, fontWeight: '800' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.amber },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.amber },
  sandbox: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 12 },
  coupon: {
    height: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 15,
    color: colors.navy,
    fontSize: 14,
    fontWeight: '800',
  },
  security: { borderRadius: 16, backgroundColor: '#EAF0F6', padding: 15, marginVertical: 22 },
  securityTitle: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  securityText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 5 },
});

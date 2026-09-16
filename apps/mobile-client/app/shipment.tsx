import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, Field, ScreenHeader } from '@/components/ui';
import { LegalAcceptance } from '@/components/legal-acceptance';
import { PaymentMethods } from '@/components/payment-methods';
import { api } from '@/lib/api';
import { uploadAsset } from '@/lib/upload';
type Policy = { category: string; description: string; status: string };
type Vehicle = { vehicleType: string; maxWeightKg: string; maxLengthCm: string; maxWidthCm: string; maxHeightCm: string };
type Quote = { id: string; expiresAt: string; restrictionStatus: string; cashAllowed: boolean; policy: { description: string }; breakdown: { total: number; base: number; distance: number; weight: number; volume: number; fragile: number; serviceFee: number; distanceKm: number } };
const vehicleNames: Record<string, string> = { BICYCLE: 'Bicicleta', MOTORCYCLE: 'Moto', CAR: 'Auto' };
const declarations = [
  ['truthfulDescription', 'Declaro que la descripción y el valor del contenido son veraces.'],
  ['noProhibitedItems', 'Declaro que el paquete no contiene artículos prohibidos.'],
  ['acceptsShippingPolicy', 'Acepto las condiciones de envío y sus límites de responsabilidad.'],
  ['acceptsItemsPolicy', 'Acepto la política vigente de artículos permitidos y restringidos.'],
] as const;
export default function Shipment() {
  const cache = useQueryClient();
  const [form, setForm] = useState({ pickupAddress: '', pickupReference: '', pickupLatitude: '', pickupLongitude: '', dropoffAddress: '', dropoffReference: '', dropoffLatitude: '', dropoffLongitude: '', recipientName: '', packageCategory: '', contentDescription: '', weightKg: '', lengthCm: '', widthCm: '', heightCm: '', declaredValue: '', vehicleType: '' });
  const [fragile, setFragile] = useState(false);
  const [packageFileId, setPackageFileId] = useState('');
  const [method, setMethod] = useState('');
  const [checked, setChecked] = useState<string[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const policies = useQuery({ queryKey: ['shipment-policies'], queryFn: () => api<Policy[]>('/orders/shipments/policies') });
  const vehicles = useQuery({ queryKey: ['shipment-vehicles'], queryFn: () => api<Vehicle[]>('/orders/shipments/vehicles') });
  function field(key: keyof typeof form, value: string) { setForm(current => ({ ...current, [key]: value })); setQuote(null); }
  const calculate = useMutation({ mutationFn: () => {
    const numeric = ['pickupLatitude', 'pickupLongitude', 'dropoffLatitude', 'dropoffLongitude', 'weightKg', 'lengthCm', 'widthCm', 'heightCm', 'declaredValue'] as const;
    if (numeric.some(key => !form[key].trim() || !Number.isFinite(Number(form[key])))) throw new Error('Completa las coordenadas, dimensiones, peso y valor declarado con números válidos.');
    return api<Quote>('/orders/shipments/quote', { method: 'POST', body: JSON.stringify({ ...form, ...Object.fromEntries(numeric.map(key => [key, Number(form[key])])), fragile, packageFileId: packageFileId || undefined }) });
  }, onSuccess: value => { setQuote(value); setChecked([]); setMessage(''); }, onError: error => { setQuote(null); setMessage(error.message); } });
  const confirm = useMutation({ mutationFn: () => {
    if (!quote || new Date(quote.expiresAt).getTime() < Date.now()) throw new Error('La cotización venció. Solicita una nueva.');
    return api<{ order: { id: string } }>('/orders/shipments', { method: 'POST', body: JSON.stringify({ quoteId: quote.id, paymentMethod: method, ...Object.fromEntries(declarations.map(([key]) => [key, checked.includes(key)])) }) });
  }, onSuccess: async result => { await cache.invalidateQueries({ queryKey: ['orders'] }); router.replace({ pathname: '/order/[id]', params: { id: result.order.id } }); }, onError: error => setMessage(error.message) });
  async function locate(prefix: 'pickup' | 'dropoff') {
    setBusy(true); try {
      if (!(await Location.requestForegroundPermissionsAsync()).granted) throw new Error('Permite el GPS o ingresa las coordenadas manualmente.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setForm(current => ({ ...current, [prefix + 'Latitude']: position.coords.latitude.toFixed(6), [prefix + 'Longitude']: position.coords.longitude.toFixed(6) })); setQuote(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo ubicar'); } finally { setBusy(false); }
  }
  async function photo() { setBusy(true); try { const result = await uploadAsset('PACKAGE'); if (result) { setPackageFileId(result.id); setQuote(null); } } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo adjuntar'); } finally { setBusy(false); } }
  const policy = policies.data?.find(value => value.category === form.packageCategory);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22, gap: 16 }}>
    <Button label="Volver" variant="ghost" onPress={() => router.back()} />
    <ScreenHeader eyebrow="Envíos personales" title="De puerta a puerta" subtitle="Describe el paquete, revisa qué podemos transportar y cotiza tu envío." />
    {(['pickup', 'dropoff'] as const).map(prefix => <View key={prefix} style={{ padding: 18, borderRadius: 20, backgroundColor: 'white', gap: 13 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.navy }}>{prefix === 'pickup' ? '1. Recogida' : '2. Destino'}</Text>
      <Field label="Dirección completa" value={form[prefix === 'pickup' ? 'pickupAddress' : 'dropoffAddress']} onChangeText={value => field(prefix === 'pickup' ? 'pickupAddress' : 'dropoffAddress', value)} />
      <Field label="Referencia" value={form[prefix === 'pickup' ? 'pickupReference' : 'dropoffReference']} onChangeText={value => field(prefix === 'pickup' ? 'pickupReference' : 'dropoffReference', value)} />
      <Button label="Usar mi ubicación actual" variant="ghost" loading={busy} onPress={() => locate(prefix)} />
      <Field label="Latitud del punto exacto" keyboardType="numbers-and-punctuation" value={form[prefix === 'pickup' ? 'pickupLatitude' : 'dropoffLatitude']} onChangeText={value => field(prefix === 'pickup' ? 'pickupLatitude' : 'dropoffLatitude', value)} />
      <Field label="Longitud del punto exacto" keyboardType="numbers-and-punctuation" value={form[prefix === 'pickup' ? 'pickupLongitude' : 'dropoffLongitude']} onChangeText={value => field(prefix === 'pickup' ? 'pickupLongitude' : 'dropoffLongitude', value)} />
    </View>)}
    <Field label="Nombre del destinatario" value={form.recipientName} onChangeText={value => field('recipientName', value)} />
    <Text style={{ fontSize: 20, fontWeight: '800', color: colors.navy }}>3. Contenido del paquete</Text>
    {policies.isError && <Text style={{ color: colors.red }}>{policies.error.message}</Text>}
    {policies.data?.map(value => <Pressable key={value.category} accessibilityRole="radio" accessibilityState={{ checked: form.packageCategory === value.category }} onPress={() => field('packageCategory', value.category)} style={{ padding: 15, borderRadius: 15, backgroundColor: form.packageCategory === value.category ? '#fff5d6' : 'white', borderColor: colors.line, borderWidth: 1 }}><Text style={{ color: value.status === 'PROHIBITED' ? colors.red : colors.navy, fontWeight: '800' }}>{value.category} · {value.status === 'ALLOWED' ? 'Permitido' : value.status === 'RESTRICTED' ? 'Requiere revisión' : 'Prohibido'}</Text>{form.packageCategory === value.category && <Text style={{ marginTop: 8 }}>{value.description}</Text>}</Pressable>)}
    {!policies.isLoading && !policies.data?.length && <Text>No hay políticas publicadas para operar envíos.</Text>}
    <Field label="Descripción detallada del contenido (mínimo 15 caracteres)" value={form.contentDescription} onChangeText={value => field('contentDescription', value)} multiline style={{ minHeight: 95, padding: 15, backgroundColor: 'white', borderRadius: 14 }} />
    {([['weightKg', 'Peso (kg)'], ['lengthCm', 'Largo (cm)'], ['widthCm', 'Ancho (cm)'], ['heightCm', 'Alto (cm)'], ['declaredValue', 'Valor declarado (S/)']] as const).map(([key, label]) => <Field key={key} label={label} value={form[key]} keyboardType="decimal-pad" onChangeText={value => field(key, value)} />)}
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text>Paquete frágil</Text><Switch accessibilityLabel="Paquete frágil" value={fragile} onValueChange={value => { setFragile(value); setQuote(null); }} /></View>
    <Button label={packageFileId ? 'Foto adjunta · cambiar' : 'Adjuntar foto del paquete (opcional)'} variant="ghost" loading={busy} onPress={photo} />
    <Text style={{ fontSize: 20, fontWeight: '800', color: colors.navy }}>4. Vehículo</Text>
    {vehicles.isError && <Text style={{ color: colors.red }}>{vehicles.error.message}</Text>}
    {vehicles.data?.map(vehicle => <Pressable key={vehicle.vehicleType} accessibilityRole="radio" accessibilityState={{ checked: form.vehicleType === vehicle.vehicleType }} onPress={() => field('vehicleType', vehicle.vehicleType)} style={{ padding: 18, borderRadius: 18, backgroundColor: form.vehicleType === vehicle.vehicleType ? '#fff5d6' : 'white' }}><Text style={{ fontWeight: '800' }}>{vehicleNames[vehicle.vehicleType]}</Text><Text>Hasta {vehicle.maxWeightKg} kg · {vehicle.maxLengthCm} × {vehicle.maxWidthCm} × {vehicle.maxHeightCm} cm</Text></Pressable>)}
    {!vehicles.isLoading && !vehicles.data?.length && <Text>Los vehículos todavía no han sido habilitados por administración.</Text>}
    <Button label="Calcular tarifa" disabled={!form.vehicleType || !form.packageCategory || policy?.status === 'PROHIBITED'} loading={calculate.isPending} onPress={() => calculate.mutate()} />
    {quote && <>
      <View style={{ padding: 20, backgroundColor: colors.navy, borderRadius: 20, gap: 10 }}><Text style={{ color: 'white', fontSize: 24, fontWeight: '800' }}>S/ {quote.breakdown.total.toFixed(2)}</Text><Text style={{ color: '#cbd5e1' }}>Distancia tarifaria en línea recta: {quote.breakdown.distanceKm} km. No representa la ruta vial.</Text>
        {([['Base', 'base'], ['Distancia', 'distance'], ['Peso', 'weight'], ['Volumen', 'volume'], ['Fragilidad', 'fragile'], ['Servicio', 'serviceFee']] as const).map(([label, key]) => <Text key={key} style={{ color: 'white' }}>{label}: S/ {quote.breakdown[key].toFixed(2)}</Text>)}
        <Text style={{ color: '#fde68a' }}>Válida hasta {new Date(quote.expiresAt).toLocaleTimeString('es-PE')}</Text>
      </View>
      {quote.restrictionStatus === 'RESTRICTED' && <Text style={{ color: '#92400e' }}>Tu categoría requiere autorización. El envío no se asignará ni se solicitará pago hasta que sea aprobado.</Text>}
      <PaymentMethods value={method} onChange={setMethod} cashAllowed={quote.cashAllowed} />
      <LegalAcceptance types={['GENERAL_TERMS', 'PRIVACY_POLICY', 'SHIPPING_TERMS', 'PROHIBITED_ITEMS_POLICY']} />
      {declarations.map(([key, label]) => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: checked.includes(key) }} key={key} onPress={() => setChecked(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])} style={{ flexDirection: 'row', gap: 10, padding: 12 }}><Text>{checked.includes(key) ? '☑' : '☐'}</Text><Text style={{ flex: 1 }}>{label}</Text></Pressable>)}
      <Button label={quote.restrictionStatus === 'RESTRICTED' ? 'Enviar solicitud a revisión' : 'Confirmar envío · S/ ' + quote.breakdown.total.toFixed(2)} variant="amber" loading={confirm.isPending} disabled={checked.length !== 4 || !method || (!quote.cashAllowed && method === 'CASH')} onPress={() => confirm.mutate()} />
    </>}
    {!!message && <Text accessibilityRole="alert" style={{ color: colors.red }}>{message}</Text>}
  </ScrollView></SafeAreaView>;
}


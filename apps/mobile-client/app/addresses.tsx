import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, Field, ScreenHeader } from '@/components/ui';
import { api } from '@/lib/api';
type Address = { id: string; label: string; address: string; reference?: string; latitude: string; longitude: string; isDefault: boolean };
export default function Addresses() {
  const cache = useQueryClient();
  const [form, setForm] = useState({ label: '', address: '', reference: '', latitude: '', longitude: '' });
  const [message, setMessage] = useState('');
  const [locating, setLocating] = useState(false);
  const list = useQuery({ queryKey: ['addresses'], queryFn: () => api<Address[]>('/users/users/me/addresses') });
  const save = useMutation({ mutationFn: () => {
    if (!form.latitude.trim() || !form.longitude.trim()) throw new Error('Selecciona las coordenadas de la dirección.');
    return api('/users/users/me/addresses', { method: 'POST', body: JSON.stringify({ ...form, latitude: Number(form.latitude), longitude: Number(form.longitude), district: 'Ayacucho', isDefault: !list.data?.length }) });
  }, onSuccess: async () => { await cache.invalidateQueries({ queryKey: ['addresses'] }); setForm({ label: '', address: '', reference: '', latitude: '', longitude: '' }); setMessage('Dirección guardada.'); }, onError: error => setMessage(error.message) });
  async function locate() {
    setLocating(true); setMessage('');
    try {
      if (!(await Location.requestForegroundPermissionsAsync()).granted) throw new Error('Permite la ubicación o ingresa las coordenadas manualmente.');
      const point = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setForm(current => ({ ...current, latitude: point.coords.latitude.toFixed(6), longitude: point.coords.longitude.toFixed(6) }));
      setMessage('Ubicación capturada. Comprueba que coincide con la dirección de entrega.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo obtener la ubicación'); }
    finally { setLocating(false); }
  }
  async function change(id: string, remove = false) {
    try { await api('/users/users/me/addresses/' + id, { method: remove ? 'DELETE' : 'PATCH', ...(remove ? {} : { body: JSON.stringify({ isDefault: true }) }) }); await cache.invalidateQueries({ queryKey: ['addresses'] }); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo actualizar'); }
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}><ScrollView contentContainerStyle={{ padding: 22, gap: 15 }}>
    <Button label="Volver" variant="ghost" onPress={() => router.back()} />
    <ScreenHeader eyebrow="Tu cuenta" title="Direcciones" subtitle="Elige tu dirección principal y guarda puntos de entrega exactos." />
    {list.isError && <Text style={{ color: colors.red }}>{list.error.message}</Text>}
    {list.data?.map(item => <View key={item.id} style={{ padding: 18, borderRadius: 18, backgroundColor: 'white', gap: 8 }}>
      <Text style={{ color: colors.navy, fontWeight: '800' }}>{item.label}{item.isDefault ? ' · Principal' : ''}</Text><Text>{item.address}</Text><Text>{item.reference}</Text>
      {!item.isDefault && <Button label="Usar como principal" variant="ghost" onPress={() => change(item.id)} />}
      <Pressable accessibilityRole="button" onPress={() => Alert.alert('Eliminar dirección', item.address, [{ text: 'Conservar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: () => change(item.id, true) }])}><Text style={{ color: colors.red, padding: 8 }}>Eliminar dirección</Text></Pressable>
    </View>)}
    <Text style={{ fontSize: 20, fontWeight: '800', color: colors.navy }}>Agregar dirección</Text>
    <Field label="Nombre (casa, trabajo…)" value={form.label} onChangeText={label => setForm({ ...form, label })} />
    <Field label="Dirección completa" value={form.address} onChangeText={address => setForm({ ...form, address })} />
    <Field label="Referencia" value={form.reference} onChangeText={reference => setForm({ ...form, reference })} />
    <Button label="Usar mi ubicación actual" loading={locating} variant="ghost" onPress={locate} />
    <Field label="Latitud" keyboardType="numbers-and-punctuation" value={form.latitude} onChangeText={latitude => setForm({ ...form, latitude })} />
    <Field label="Longitud" keyboardType="numbers-and-punctuation" value={form.longitude} onChangeText={longitude => setForm({ ...form, longitude })} />
    {!!message && <Text accessibilityRole="alert" style={{ color: colors.navy }}>{message}</Text>}
    <Button label="Guardar dirección" onPress={() => save.mutate()} loading={save.isPending} />
  </ScrollView></SafeAreaView>;
}


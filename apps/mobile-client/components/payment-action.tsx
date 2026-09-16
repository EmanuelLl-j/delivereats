import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Image, Linking, Text, View } from 'react-native';
import { api, assetUrl } from '@/lib/api';
import { uploadAsset } from '@/lib/upload';
import { Button, colors, Field } from './ui';
type Intent = { id: string; status: string; reviewReason?: string; client?: { checkoutUrl?: string; accountLabel?: string; instructions?: string; qrImageUrl?: string } };
export function PaymentAction({ orderId, method, status }: { orderId: string; method: string; status: string }) {
  const cache = useQueryClient();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [operationCode, setOperationCode] = useState('');
  const [evidence, setEvidence] = useState('');
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const begin = useMutation({ mutationFn: () => api<Intent>('/orders/payments/orders/' + orderId, { method: 'POST', body: '{}' }), onSuccess: setIntent, onError: error => setMessage(error.message) });
  const submit = useMutation({ mutationFn: () => api('/orders/payments/' + intent!.id + '/evidence', { method: 'POST', body: JSON.stringify({ operationCode, evidenceFileId: evidence }) }), onSuccess: async () => { setMessage('Comprobante enviado. La revisión puede demorar; aún no está confirmado el pago.'); setIntent(null); await cache.invalidateQueries({ queryKey: ['order', orderId] }); }, onError: error => setMessage(error.message) });
  async function attach() { setUploading(true); try { const file = await uploadAsset('PAYMENT_EVIDENCE'); if (file) setEvidence(file.id); } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo subir'); } finally { setUploading(false); } }
  async function openCheckout() {
    try { const url = new URL(intent!.client!.checkoutUrl!); if (url.protocol !== 'https:' || !/(^|\.)mercadopago\.(com|com\.pe)$/.test(url.hostname)) throw new Error('El proveedor no devolvió una URL de pago válida.'); await Linking.openURL(url.toString()); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo abrir el pago'); }
  }
  if (method === 'CASH') return <Text style={{ color: colors.muted }}>Pagarás en efectivo al completar la entrega.</Text>;
  if (status === 'PAYMENT_PENDING_VERIFICATION') return <Text style={{ color: '#92400e' }}>Comprobante en revisión. Recibirás el resultado sin necesidad de repetir el pago.</Text>;
  if (['APPROVED', 'PAID', 'REFUNDED'].includes(status)) return null;
  return <View style={{ padding: 18, backgroundColor: 'white', borderRadius: 18, gap: 12 }}>
    <Text style={{ fontSize: 18, fontWeight: '800', color: colors.navy }}>Completar pago</Text>
    {!intent && <Button label="Consultar instrucciones de pago" loading={begin.isPending} onPress={() => begin.mutate()} />}
    {intent?.client?.checkoutUrl && <Button label="Abrir Mercado Pago" onPress={openCheckout} />}
    {intent && method.endsWith('_MANUAL') && <>
      <Text style={{ fontWeight: '800' }}>{intent.client?.accountLabel}</Text><Text>{intent.client?.instructions}</Text>
      {intent.client?.qrImageUrl && <Image accessibilityLabel="QR de la cuenta de pago configurada" source={{ uri: assetUrl(intent.client.qrImageUrl) }} style={{ width: 230, height: 230, alignSelf: 'center' }} resizeMode="contain" />}
      <Text style={{ color: colors.muted }}>Adjunta el comprobante solo después de pagar. La foto no confirma el pago automáticamente.</Text>
      <Field label="Código de operación" value={operationCode} onChangeText={setOperationCode} />
      <Button variant="ghost" label={evidence ? 'Comprobante adjunto · cambiar' : 'Adjuntar comprobante'} loading={uploading} onPress={attach} />
      <Button label="Enviar a verificación" disabled={!evidence || operationCode.trim().length < 4} loading={submit.isPending} onPress={() => submit.mutate()} />
    </>}
    {!!message && <Text accessibilityRole="alert" style={{ color: colors.navy }}>{message}</Text>}
  </View>;
}


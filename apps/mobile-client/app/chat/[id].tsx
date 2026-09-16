import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { AudioCall } from '@/components/audio-call';
import { colors } from '@/components/ui';
import { api, assetUrl, socketUrl } from '@/lib/api';
import { getSession } from '@/lib/session';
type Message = { id: string; senderUserId: string; body: string; readAt?: string; createdAt: string };
type Call = { id: string; status: string; callerUserId: string; calleeUserId: string };
type Conversation = { counterpart: { displayName: string; avatar?: string; vehicleType?: string; vehiclePlate?: string }; messages: Message[]; audioAvailable: boolean; call?: Call };
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cache = useQueryClient();
  const [userId, setUserId] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');
  const pending = useRef<{ clientMessageId: string; body: string } | null>(null);
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const conversation = useQuery({ queryKey: ['conversation', id], queryFn: () => api<Conversation>('/drivers/communications/orders/' + id), refetchInterval: focused ? 3000 : false, enabled: focused, retry: false });
  useEffect(() => { let alive = true; void getSession().then(value => { if (alive) setUserId(value?.user.id ?? ''); }); return () => { alive = false; }; }, []);
  useEffect(() => {
    if (!focused) return;
    let alive = true, socket: ReturnType<typeof io> | undefined;
    let retry: ReturnType<typeof setInterval> | undefined;
    void getSession().then(value => {
      if (!alive || !value) return;
      socket = io(socketUrl + '/communications', { path: '/socket.io/communications', auth: { token: value.accessToken }, transports: ['websocket', 'polling'] });
      const subscribe = () => socket?.timeout(2000).emit('chat.subscribe', id, (error: unknown, result?: { subscribed?: boolean }) => { if (!error && result?.subscribed && retry) clearInterval(retry); });
      socket.on('connect', () => { subscribe(); if (retry) clearInterval(retry); retry = setInterval(subscribe, 3000); });
      for (const event of ['chat.message', 'chat.read', 'call.updated']) socket.on(event, () => { void cache.invalidateQueries({ queryKey: ['conversation', id] }); });
    });
    return () => { alive = false; if (retry) clearInterval(retry); socket?.disconnect(); };
  }, [cache, focused, id]);
  const unread = conversation.data?.messages.filter(value => value.senderUserId !== userId && !value.readAt).length ?? 0;
  useEffect(() => { if (focused && unread && userId) void api('/drivers/communications/orders/' + id + '/read', { method: 'POST', body: '{}' }).then(() => cache.invalidateQueries({ queryKey: ['conversation', id] })).catch(() => undefined); }, [cache, focused, id, unread, userId]);
  const send = useMutation({ mutationFn: () => {
    const text = body.trim(); if (!text) throw new Error('Escribe un mensaje');
    if (pending.current?.body !== text) pending.current = { clientMessageId: randomUUID(), body: text };
    return api('/drivers/communications/orders/' + id + '/messages', { method: 'POST', body: JSON.stringify(pending.current) });
  }, onSuccess: async () => { setBody(''); pending.current = null; setMessage(''); await cache.invalidateQueries({ queryKey: ['conversation', id] }); }, onError: error => setMessage(error.message) });
  const call = conversation.data?.call;
  const action = useMutation({ mutationFn: (value: string) => value === 'START' ? api('/drivers/communications/orders/' + id + '/calls', { method: 'POST', body: '{}' }) : api('/drivers/communications/calls/' + call!.id + '/action', { method: 'POST', body: JSON.stringify({ action: value }) }), onSuccess: () => cache.invalidateQueries({ queryKey: ['conversation', id] }), onError: error => setMessage(error.message) });
  const control = (label: string, onPress: () => void, danger = false, disabled = false) => <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={{ padding: 14, borderRadius: 13, backgroundColor: danger ? '#fee2e2' : '#e2e8f0', opacity: disabled ? 0.5 : 1 }}><Text style={{ color: danger ? colors.red : colors.navy, fontWeight: '800', textAlign: 'center' }}>{label}</Text></Pressable>;
  const counterpart = conversation.data?.counterpart;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={{ padding: 18, gap: 12, backgroundColor: 'white' }}>
      {control(call?.status === 'ACTIVE' ? 'Volver (se desconectará tu audio)' : 'Volver al pedido', () => router.back())}
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>{counterpart?.avatar && <Image source={{ uri: assetUrl(counterpart.avatar) }} style={{ width: 42, height: 42, borderRadius: 21 }} />}<View><Text style={{ fontSize: 21, fontWeight: '800', color: colors.navy }}>{counterpart?.displayName ?? 'Chat del pedido'}</Text>{counterpart?.vehicleType && <Text>{counterpart.vehicleType} {counterpart.vehiclePlate ?? ''}</Text>}</View></View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>Tu teléfono y correo no se comparten. Usa este espacio solo para coordinar la entrega.</Text>
      {!call && conversation.data?.audioAvailable && control('Llamar por audio', () => action.mutate('START'), false, action.isPending)}
      {!conversation.data?.audioAvailable && conversation.data && <Text style={{ color: colors.muted }}>Llamadas no disponibles en este momento. Puedes usar el chat.</Text>}
      {call?.status === 'RINGING' && <><Text style={{ fontWeight: '800' }}>{call.calleeUserId === userId ? 'Llamada entrante' : 'Llamando…'}</Text>{call.calleeUserId === userId && control('Aceptar llamada', () => action.mutate('ACCEPT'), false, action.isPending)}{control(call.calleeUserId === userId ? 'Rechazar' : 'Cancelar llamada', () => action.mutate(call.calleeUserId === userId ? 'REJECT' : 'END'), true, action.isPending)}</>}
      {call?.status === 'ACTIVE' && focused && <><AudioCall key={call.id} callId={call.id} />{control('Finalizar llamada', () => action.mutate('END'), true, action.isPending)}</>}
    </View>
    <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
      {conversation.isError && <Text accessibilityRole="alert" style={{ color: colors.red }}>{conversation.error.message}</Text>}
      {!conversation.isLoading && !conversation.isError && !conversation.data?.messages.length && <Text style={{ color: colors.muted }}>Todavía no hay mensajes. Escribe para coordinar la entrega.</Text>}
      {conversation.data?.messages.map(item => <View key={item.id} style={{ alignSelf: item.senderUserId === userId ? 'flex-end' : 'flex-start', maxWidth: '88%', backgroundColor: item.senderUserId === userId ? colors.navy : 'white', borderRadius: 17, padding: 14, gap: 6 }}><Text selectable style={{ color: item.senderUserId === userId ? 'white' : colors.navy, lineHeight: 21 }}>{item.body}</Text><Text style={{ color: item.senderUserId === userId ? '#cbd5e1' : colors.muted, fontSize: 10 }}>{new Date(item.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}{item.senderUserId === userId ? item.readAt ? ' · Leído' : ' · Enviado' : ''}</Text></View>)}
    </ScrollView>
    <View style={{ padding: 16, backgroundColor: 'white', gap: 10 }}>
      {!!message && <Text accessibilityRole="alert" style={{ color: colors.red }}>{message}</Text>}
      <TextInput accessibilityLabel="Mensaje" placeholder="Escribe un mensaje…" multiline maxLength={2000} value={body} onChangeText={setBody} style={{ minHeight: 48, maxHeight: 110, padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 14 }} />
      {control(send.isPending ? 'Enviando…' : 'Enviar mensaje', () => send.mutate(), false, send.isPending || !body.trim() || conversation.isError)}
    </View>
  </KeyboardAvoidingView></SafeAreaView>;
}


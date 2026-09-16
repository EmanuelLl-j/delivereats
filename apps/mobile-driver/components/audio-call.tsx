import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { connectAudio } from '@/lib/audio-platform';
import { colors } from './ui';
export function AudioCall({ callId }: { callId: string }) {
  const connection = useRef<Awaited<ReturnType<typeof connectAudio>> | null>(null);
  const [state, setState] = useState('connecting');
  const [message, setMessage] = useState('');
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setMuted(false); setSpeaker(false);
    setState('connecting'); setMessage('');
    void (async () => {
      const credentials = await api<{ token: string; serverUrl: string }>('/drivers/communications/calls/' + callId + '/token', { method: 'POST', body: '{}' });
      if (!alive) return;
      const value = await connectAudio(credentials.serverUrl, credentials.token, next => { if (alive) setState(next); }, controller.signal);
      if (!alive) { await value.close(); return; }
      connection.current = value;
    })().catch(error => { if (alive) { setMessage(error instanceof Error ? error.message : 'No se pudo conectar el audio'); setState('disconnected'); } });
    return () => { alive = false; controller.abort(); const current = connection.current; connection.current = null; void current?.close().catch(() => undefined); };
  }, [callId, attempt]);
  async function toggle(kind: 'mute' | 'speaker') {
    try { if (!connection.current) return; if (kind === 'mute') { await connection.current.mute(!muted); setMuted(!muted); } else { await connection.current.speaker(!speaker); setSpeaker(!speaker); } }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo cambiar el audio'); }
  }
  return <View style={{ padding: 18, backgroundColor: colors.navy, borderRadius: 18, gap: 12 }}>
    <Text style={{ color: 'white', fontWeight: '800' }}>Audio: {({ connected: 'conectado', connecting: 'conectando', reconnecting: 'reconectando', disconnected: 'desconectado' } as Record<string, string>)[state] ?? state}</Text>
    <Text style={{ color: '#cbd5e1' }}>Solo voz. Esta llamada no se graba.</Text>
    <Pressable accessibilityRole="button" onPress={() => toggle('mute')} style={{ padding: 12, backgroundColor: '#e2e8f0', borderRadius: 10 }}><Text>{muted ? 'Activar micrófono' : 'Silenciar micrófono'}</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => toggle('speaker')} style={{ padding: 12, backgroundColor: '#e2e8f0', borderRadius: 10 }}><Text>{speaker ? 'Usar auricular' : 'Usar altavoz'}</Text></Pressable>
    {state === 'disconnected' && <Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)}><Text style={{ color: '#fde68a' }}>Reintentar conexión de audio</Text></Pressable>}
    {!!message && <Text accessibilityRole="alert" style={{ color: '#fecaca' }}>{message}</Text>}
  </View>;
}

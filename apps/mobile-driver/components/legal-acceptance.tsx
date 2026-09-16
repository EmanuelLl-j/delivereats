import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { api } from '../lib/api';
import { getSession } from '../lib/session';
import { Button, colors } from './ui';

type Document = { id: string; type: string; title: string; version: string; content: string; mandatory: boolean };
export function LegalAcceptance({ types }: { types?: string[] }) {
  const cache = useQueryClient();
  const [checked, setChecked] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const documents = useQuery({ queryKey: ['legal-documents'], queryFn: () => api<Document[]>('/users/legal/documents') });
  const acceptances = useQuery({ queryKey: ['legal-acceptances'], queryFn: async () => await getSession() ? api<Array<{ legalDocumentId: string }>>('/users/legal/acceptances') : [] });
  const rows = (documents.data ?? []).filter(document => !types || types.includes(document.type));
  const accepted = new Set(acceptances.data?.map(value => value.legalDocumentId));
  async function accept() {
    if (!await getSession()) { router.push('/login'); return; }
    setBusy(true); setMessage('');
    try { await api('/users/legal/acceptances', { method: 'POST', body: JSON.stringify({ documentIds: checked }) }); await cache.invalidateQueries({ queryKey: ['legal-acceptances'] }); setChecked([]); setMessage('Aceptaciones registradas para estas versiones.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo registrar la aceptación'); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 12 }}>
    {documents.isLoading && <ActivityIndicator color={colors.navy} />}
    {documents.isError && <Text accessibilityRole="alert" style={{ color: colors.red }}>{documents.error.message}</Text>}
    {!documents.isLoading && (!rows.length || (types && rows.length < types.length)) && <Text style={{ color: '#92400e', padding: 15, backgroundColor: '#fffbeb', borderRadius: 12 }}>Faltan documentos por publicar. Las operaciones afectadas permanecerán bloqueadas.</Text>}
    {rows.map(document => <View key={document.id} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 15, backgroundColor: 'white', gap: 12 }}>
      <Pressable onPress={() => setExpanded(expanded === document.id ? null : document.id)} accessibilityRole="button"><Text style={{ color: colors.navy, fontWeight: '800' }}>{document.title}</Text><Text style={{ color: colors.muted, marginTop: 5, fontSize: 12 }}>Versión {document.version} · {expanded === document.id ? 'Ocultar texto' : 'Leer documento'}</Text></Pressable>
      {expanded === document.id && <Text selectable style={{ fontSize: 13, lineHeight: 21, color: colors.navy }}>{document.content}</Text>}
      {accepted.has(document.id) ? <Text style={{ color: colors.green, fontWeight: '700' }}>Versión aceptada</Text> : <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: checked.includes(document.id) }} onPress={() => setChecked(current => current.includes(document.id) ? current.filter(id => id !== document.id) : [...current, document.id])} style={{ flexDirection: 'row', gap: 10, paddingVertical: 7 }}><Text style={{ color: colors.navy, fontWeight: '800' }}>{checked.includes(document.id) ? '☑' : '☐'}</Text><Text style={{ color: colors.navy, flex: 1, fontSize: 13 }}>He leído y acepto esta versión</Text></Pressable>}
    </View>)}
    {!!checked.length && <Button label="Registrar aceptaciones" onPress={accept} loading={busy} />}
    {!!message && <Text accessibilityRole="alert" style={{ color: colors.navy }}>{message}</Text>}
  </View>;
}

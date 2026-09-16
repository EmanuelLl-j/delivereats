'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest, json } from '@/lib/api';
import { ErrorPanel } from './ui';
type Document = { id: string; type: string; title: string; version: string; content: string };
export function LegalAcceptance({ types }: { types: string[] }) {
  const cache = useQueryClient();
  const [checked, setChecked] = useState<string[]>([]);
  const docs = useQuery({ queryKey: ['legal-current'], queryFn: () => apiRequest<Document[]>('/api/backend/users/legal/documents') });
  const accepted = useQuery({ queryKey: ['legal-accepted'], queryFn: () => apiRequest<Array<{ legalDocumentId: string }>>('/api/backend/users/legal/acceptances') });
  const save = useMutation({ mutationFn: () => apiRequest('/api/backend/users/legal/acceptances', json('POST', { documentIds: checked })), onSuccess: async () => { setChecked([]); await cache.invalidateQueries({ queryKey: ['legal-accepted'] }); } });
  const rows = docs.data?.filter(row => types.includes(row.type)) ?? [];
  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-extrabold text-slate-800">Condiciones del servicio</h2>
    {!docs.isLoading && rows.length < types.length && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Faltan documentos por publicar. Las operaciones afectadas están bloqueadas hasta que existan versiones vigentes.</p>}
    {rows.map(doc => <article key={doc.id} className="rounded-xl border border-slate-200 p-4"><details><summary className="cursor-pointer text-sm font-bold text-indigo-950">{doc.title} · versión {doc.version}</summary><p className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap text-sm leading-7 text-slate-600">{doc.content}</p></details>{accepted.data?.some(value => value.legalDocumentId === doc.id) ? <p className="mt-3 text-xs font-bold text-emerald-700">Versión aceptada</p> : <label className="mt-4 flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={checked.includes(doc.id)} onChange={event => setChecked(current => event.target.checked ? [...current, doc.id] : current.filter(id => id !== doc.id))} />He leído y acepto esta versión</label>}</article>)}
    {!!checked.length && <button disabled={save.isPending} onClick={() => save.mutate()} className="rounded-xl bg-[#1e194b] px-5 py-3 text-sm font-bold text-white">Registrar aceptaciones</button>}
    {(docs.isError || accepted.isError || save.isError) && <ErrorPanel message={docs.error?.message ?? accepted.error?.message ?? save.error?.message} />}
  </section>;
}


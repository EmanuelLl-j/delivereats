'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
export default function LegalPage() {
  const query = useQuery({ queryKey: ['public-legal'], queryFn: () => apiRequest<Array<{ id: string; title: string; version: string; content: string; effectiveAt: string }>>('/api/public/legal/documents') });
  return <main className="mx-auto max-w-4xl p-6 sm:p-12"><Link className="font-bold text-indigo-900" href="/login">← DeliverEats</Link><h1 className="my-8 text-3xl font-extrabold">Términos y privacidad</h1>
    {query.isLoading && <p>Cargando documentos…</p>}{query.isError && <p role="alert">No se pudieron cargar los documentos.</p>}
    {query.data?.length === 0 && <p className="rounded-2xl border bg-white p-6">Aún no se han publicado los documentos. Las operaciones que requieren aceptación permanecerán bloqueadas hasta su publicación.</p>}
    {query.data?.map(document => <article className="mb-5 rounded-2xl border border-slate-200 bg-white p-6" key={document.id}><h2 className="text-xl font-bold">{document.title}</h2><p className="mt-2 text-xs text-slate-500">Versión {document.version} · Vigente desde {new Date(document.effectiveAt).toLocaleDateString('es-PE')}</p><div className="mt-6 whitespace-pre-wrap text-sm leading-7">{document.content}</div></article>)}
  </main>;
}

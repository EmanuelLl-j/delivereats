'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { apiRequest, json, uploadFile } from '@/lib/api';
import { ErrorPanel, StatusBadge } from './ui';
export type RecordData = Record<string, unknown>;
export type FieldSpec = { name: string; label: string; type?: 'text' | 'textarea' | 'number' | 'email' | 'password' | 'date' | 'datetime-local' | 'checkbox' | 'select' | 'file'; options?: Array<string | { value: string; label: string }>; optional?: boolean; min?: number; max?: number; purpose?: string; store?: 'id' | 'url'; multiple?: boolean; hint?: string };
export const buttonClass = 'rounded-xl bg-[#1e194b] px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-900 disabled:opacity-40';
export const quietButton = 'rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40';
export function getValue(record: unknown, path: string): unknown { return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as RecordData)[key] : undefined, record); }
export function display(value: unknown): string { return value == null || value === '' ? '—' : typeof value === 'boolean' ? value ? 'Sí' : 'No' : Array.isArray(value) ? value.map(display).join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value); }
export function OperationForm({ fields, initial = {}, endpoint, method = 'PATCH', label = 'Guardar cambios', onSuccess, transform }: { fields: FieldSpec[]; initial?: RecordData; endpoint: string; method?: string; label?: string; onSuccess?: () => void; transform?: (data: RecordData) => RecordData }) {
  const cache = useQueryClient();
  const [values, setValues] = useState<RecordData>(() => Object.fromEntries(fields.map(field => [field.name, initial[field.name] ?? (field.type === 'checkbox' ? false : field.multiple ? [] : '')])));
  const [uploading, setUploading] = useState('');
  const [uploadError, setUploadError] = useState('');
  const mutation = useMutation({ mutationFn: () => {
    const data: RecordData = {};
    for (const field of fields) {
      const value = values[field.name];
      if (field.optional && (value === '' || value == null || (Array.isArray(value) && !value.length))) continue;
      data[field.name] = field.type === 'number' ? Number(value) : field.type === 'datetime-local' ? new Date(String(value)).toISOString() : value;
    }
    return apiRequest(endpoint, json(method, transform ? transform(data) : data));
  }, onSuccess: async () => { await cache.invalidateQueries(); onSuccess?.(); } });
  async function upload(field: FieldSpec, files: FileList | null) {
    if (!files?.length) return;
    setUploadError(''); setUploading(field.name);
    try {
      const selected = Array.from(files);
      if (selected.length > 6 || selected.some(file => file.size > 8 * 1024 * 1024)) throw new Error('Máximo 6 archivos de hasta 8 MB cada uno.');
      const result = await Promise.all(selected.map(file => uploadFile(file, field.purpose!)));
      setValues(current => ({ ...current, [field.name]: field.multiple ? result.map(file => file.id) : field.store === 'url' ? result[0]!.url : result[0]!.id }));
    } catch (error) { setUploadError(error instanceof Error ? error.message : 'No se pudo subir el archivo'); }
    finally { setUploading(''); }
  }
  return <form className="space-y-4" onSubmit={event => { event.preventDefault(); mutation.mutate(); }}>
    <div className="grid gap-4 sm:grid-cols-2">{fields.map(field => <label key={field.name} className={'block text-xs font-bold text-slate-600 ' + (field.type === 'textarea' ? 'sm:col-span-2' : '')}>
      {field.label}{!field.optional && field.type !== 'checkbox' ? ' *' : ''}
      {field.type === 'checkbox' ? <input className="ml-3 size-4 accent-indigo-950" type="checkbox" checked={Boolean(values[field.name])} onChange={event => setValues({ ...values, [field.name]: event.target.checked })} /> : field.type === 'select' ? <select required={!field.optional} value={String(values[field.name] ?? '')} onChange={event => setValues({ ...values, [field.name]: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3"><option value="">Selecciona…</option>{field.options?.map(option => <option key={typeof option === 'string' ? option : option.value} value={typeof option === 'string' ? option : option.value}>{typeof option === 'string' ? option : option.label}</option>)}</select> : field.type === 'file' ? <><input aria-label={field.label} type="file" accept={field.purpose?.endsWith('_DOCUMENT') ? 'image/png,image/jpeg,image/webp,application/pdf' : 'image/png,image/jpeg,image/webp'} multiple={field.multiple} disabled={!!uploading} onChange={event => { void upload(field, event.target.files); event.target.value = ''; }} className="mt-2 block w-full text-xs" /><span className="mt-2 block font-normal">{uploading === field.name ? 'Subiendo…' : values[field.name] && (!Array.isArray(values[field.name]) || (values[field.name] as unknown[]).length) ? 'Archivo(s) cargado(s)' : 'Sin archivo adjunto'}</span></> : field.type === 'textarea' ? <textarea required={!field.optional} minLength={field.min} maxLength={field.max} rows={8} value={String(values[field.name] ?? '')} onChange={event => setValues({ ...values, [field.name]: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal leading-6" /> : <input required={!field.optional} type={field.type ?? 'text'} min={field.type === 'number' ? field.min : undefined} max={field.type === 'number' ? field.max : undefined} minLength={field.type !== 'number' ? field.min : undefined} maxLength={field.type !== 'number' ? field.max : undefined} step={field.type === 'number' ? 'any' : undefined} value={String(values[field.name] ?? '')} onChange={event => setValues({ ...values, [field.name]: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal" />}
      {field.hint && <span className="mt-2 block text-xs font-normal leading-5 text-slate-400">{field.hint}</span>}
    </label>)}</div>
    {uploadError && <ErrorPanel message={uploadError} />}{mutation.isError && <ErrorPanel message={mutation.error.message} />}
    {mutation.isSuccess && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Operación guardada correctamente.</p>}
    <button className={buttonClass} disabled={mutation.isPending || !!uploading || fields.some(field => field.type === 'file' && !field.optional && (!values[field.name] || (Array.isArray(values[field.name]) && !(values[field.name] as unknown[]).length)))}>{mutation.isPending ? 'Guardando…' : label}</button>
  </form>;
}
export function PrivateFile({ id, label = 'Archivo privado' }: { id: string; label?: string }) {
  const [url, setUrl] = useState('');
  const request = useMutation({ mutationFn: () => apiRequest<{ url: string }>('/api/backend/users/files/' + id + '/url'), onSuccess: result => setUrl(result.url) });
  return <div className="space-y-2">{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-indigo-800 underline">Abrir {label} (enlace temporal)</a> : <button className={quietButton} disabled={request.isPending} onClick={() => request.mutate()}>{request.isPending ? 'Preparando enlace…' : label}</button>}{request.isError && <p role="alert" className="text-xs text-red-700">{request.error.message}</p>}</div>;
}
export function Documents({ value }: { value: unknown }) { return <div className="flex flex-wrap gap-3">{Array.isArray(value) && value.filter((id): id is string => typeof id === 'string').map((id, index) => <PrivateFile key={id} id={id} label={'Documento ' + (index + 1)} />)}</div>; }
export function OperationsTable({ rows, columns, details }: { rows: RecordData[]; columns: Array<[string, string]>; details?: (row: RecordData) => ReactNode }) {
  const [search, setSearch] = useState('');
  const filtered = rows.filter(row => columns.some(([, key]) => display(getValue(row, key)).toLocaleLowerCase('es-PE').includes(search.toLocaleLowerCase('es-PE'))));
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><input aria-label="Buscar en los registros" placeholder="Buscar por estado, nombre o identificador…" value={search} onChange={event => setSearch(event.target.value)} className="h-11 w-full max-w-md rounded-xl border border-slate-200 px-4 text-sm" /><p className="text-xs text-slate-500">{filtered.length} de {rows.length} registros cargados</p></div>
    {!filtered.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">No hay registros que coincidan con esta consulta.</div>}
    {filtered.map((row, index) => <article key={String(row.id ?? row.vehicleType ?? row.method ?? row.role ?? index)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">{columns.map(([label, key]) => <div key={key}><p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>{key.toLowerCase().includes('status') ? <StatusBadge value={display(getValue(row, key))} /> : <p className="break-words text-sm font-semibold text-slate-700">{display(getValue(row, key))}</p>}</div>)}</div>
      {details && <details className="border-t border-slate-100"><summary className="cursor-pointer px-5 py-3 text-xs font-bold text-indigo-900">Ver detalle y acciones</summary><div className="space-y-5 bg-slate-50/60 p-5">{details(row)}</div></details>}
    </article>)}
  </div>;
}

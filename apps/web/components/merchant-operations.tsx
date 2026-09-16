'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock3, ShoppingBag } from 'lucide-react';
import { apiRequest, ApiError, json } from '@/lib/api';
import { ErrorPanel, KpiCard, LoadingPanel, PageHeading, StatusBadge } from './ui';
import { Documents, OperationForm, OperationsTable, display, getValue, type FieldSpec, type RecordData, buttonClass } from './operations-ui';
import { LegalAcceptance } from './legal-acceptance';
const merchantFields: FieldSpec[] = [
  { name: 'name', label: 'Nombre comercial', min: 2, max: 120 }, { name: 'category', label: 'Categoría', type: 'select', options: ['RESTAURANT', 'PHARMACY', 'SUPERMARKET', 'EXPRESS'] },
  { name: 'description', label: 'Descripción del negocio', type: 'textarea', min: 10, max: 1000 }, { name: 'ruc', label: 'RUC', min: 11, max: 11 },
  { name: 'phone', label: 'Teléfono del establecimiento', min: 7, max: 20 }, { name: 'email', label: 'Correo del establecimiento', type: 'email' },
  { name: 'address', label: 'Dirección de recogida', min: 5, max: 240 }, { name: 'latitude', label: 'Latitud exacta', type: 'number', min: -90, max: 90 }, { name: 'longitude', label: 'Longitud exacta', type: 'number', min: -180, max: 180 },
  { name: 'deliveryEstimateMin', label: 'Tiempo mínimo estimado (min)', type: 'number', min: 5, max: 180 }, { name: 'deliveryEstimateMax', label: 'Tiempo máximo estimado (min)', type: 'number', min: 5, max: 240 },
  { name: 'logoUrl', label: 'Logo del comercio', type: 'file', purpose: 'MERCHANT_LOGO', store: 'url', optional: true }, { name: 'coverUrl', label: 'Portada del comercio', type: 'file', purpose: 'MERCHANT_COVER', store: 'url', optional: true },
];
type Merchant = RecordData & { id: string; name: string; applicationStatus: string; businessHours?: Array<{ day: number; closed: boolean; open: string; close: string }> };
export function useOwnMerchant() { return useQuery({ queryKey: ['merchant-catalog'], queryFn: async () => { try { return await apiRequest<Merchant>('/api/backend/orders/commerce/me'); } catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; } }, retry: false }); }
function BusinessHours({ merchant }: { merchant: Merchant }) {
  const cache = useQueryClient();
  const [rows, setRows] = useState(() => Array.from({ length: 7 }, (_, day) => merchant.businessHours?.find(value => value.day === day) ?? { day, closed: true, open: '09:00', close: '18:00' }));
  const save = useMutation({ mutationFn: () => apiRequest('/api/backend/orders/merchants/' + merchant.id, json('PATCH', { businessHours: rows })), onSuccess: () => cache.invalidateQueries({ queryKey: ['merchant-catalog'] }) });
  return <form className="space-y-4" onSubmit={event => { event.preventDefault(); save.mutate(); }}><h2 className="text-lg font-bold text-slate-800">Horario de atención</h2><p className="text-xs text-slate-500">Los horarios se informan al cliente. El interruptor de recepción permite cerrar temporalmente el comercio.</p>{rows.map((row, index) => <div key={row.day} className="flex flex-wrap items-center gap-3 text-sm"><span className="w-24 font-semibold">{['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][row.day]}</span><label><input className="mr-2" type="checkbox" checked={row.closed} onChange={event => setRows(current => current.map((value, i) => i === index ? { ...value, closed: event.target.checked } : value))} />Cerrado</label>{!row.closed && <><input aria-label={'Apertura día ' + row.day} type="time" value={row.open} onChange={event => setRows(current => current.map((value, i) => i === index ? { ...value, open: event.target.value } : value))} className="rounded-lg border p-2" /><input aria-label={'Cierre día ' + row.day} type="time" value={row.close} onChange={event => setRows(current => current.map((value, i) => i === index ? { ...value, close: event.target.value } : value))} className="rounded-lg border p-2" /></>}</div>)}{save.isError && <ErrorPanel message={save.error.message} />}{save.isSuccess && <p role="status" className="text-sm text-emerald-700">Horario guardado.</p>}<button disabled={save.isPending} className={buttonClass}>Guardar horario</button></form>;
}
function MerchantConfiguration() {
  const query = useOwnMerchant();
  const merchant = query.data;
  return <><PageHeading eyebrow="Tu establecimiento" title="Configuración del comercio" description="Alta real, documentación privada y datos de atención. La activación requiere aprobación administrativa." />
    {query.isLoading ? <LoadingPanel /> : query.isError ? <ErrorPanel message={query.error.message} /> : <div className="space-y-6">
      <LegalAcceptance types={['GENERAL_TERMS', 'PRIVACY_POLICY', 'MERCHANT_TERMS']} />
      {merchant && <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><StatusBadge value={merchant.applicationStatus} /><p className="text-sm text-slate-600">{display(merchant.reviewReason)}</p><Documents value={merchant.applicationDocuments} /></div>}
      {!merchant || merchant.applicationStatus === 'REJECTED' ? <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="mb-5 text-lg font-bold">Solicitud de afiliación</h2><OperationForm endpoint="/api/backend/orders/commerce/application" method="POST" fields={[...merchantFields, { name: 'documentIds', label: 'Documentación del negocio (hasta 6 archivos)', type: 'file', purpose: 'MERCHANT_DOCUMENT', multiple: true }]} initial={merchant ? { ...merchant, documentIds: merchant.applicationDocuments } : {}} label="Enviar solicitud a revisión" /></section> : merchant.applicationStatus === 'APPROVED' ? <>
        <section className="rounded-2xl border border-slate-200 bg-white p-6"><OperationForm key={String(merchant.updatedAt)} endpoint={'/api/backend/orders/merchants/' + merchant.id} fields={[{ name: 'isOpen', label: 'Recibir pedidos', type: 'checkbox' }, ...merchantFields.filter(field => field.name !== 'ruc')]} initial={merchant} /></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6"><BusinessHours merchant={merchant} /></section>
      </> : <p className="rounded-xl bg-amber-50 p-5 text-sm text-amber-900">Tu establecimiento no puede recibir pedidos hasta que administración finalice la revisión.</p>}
      <Link href="/comercio/cuenta" className="inline-block font-bold text-indigo-900 underline">Administrar mi cuenta, contraseña y privacidad</Link>
    </div>}
  </>;
}
type Metrics = { orders: number; completed: number; revenue: number; averageTicket: number; averagePreparationMinutes: number | null; history: RecordData[] };
function MerchantData({ section }: { section: string }) {
  const [period, setPeriod] = useState('day');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const params = new URLSearchParams({ period, ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
  const query = useQuery({ queryKey: ['merchant-metrics', params], queryFn: () => apiRequest<Metrics>('/api/backend/orders/commerce/metrics?' + params) });
  const data = query.data;
  return <><PageHeading eyebrow="Operación de tu comercio" title={section === 'metricas' ? 'Métricas' : section === 'repartidores' ? 'Recogidas y repartidores' : 'Historial de pedidos'} description="Información de tus subpedidos, sin datos de otros comercios ni información privada del cliente." />
    <div className="mb-6 flex flex-wrap gap-4"><select aria-label="Periodo" className="h-11 rounded-xl border border-slate-200 bg-white px-4" value={period} onChange={event => { setPeriod(event.target.value); setFrom(''); setTo(''); }}><option value="day">Hoy</option><option value="week">Últimos 7 días</option><option value="month">Últimos 30 días</option></select><label className="text-xs text-slate-500">Desde<input type="date" value={from} onChange={event => setFrom(event.target.value)} className="ml-2 rounded-xl border p-3" /></label><label className="text-xs text-slate-500">Hasta<input type="date" value={to} onChange={event => setTo(event.target.value)} className="ml-2 rounded-xl border p-3" /></label></div>
    {query.isLoading ? <LoadingPanel /> : query.isError ? <ErrorPanel message={query.error.message} /> : data && <>
      {section === 'metricas' && <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><KpiCard label="Pedidos" value={String(data.orders)} hint="Periodo seleccionado" icon={ShoppingBag} /><KpiCard label="Ventas entregadas" value={'S/ ' + data.revenue.toFixed(2)} hint={data.completed + ' completados'} icon={CheckCircle2} tone="green" /><KpiCard label="Ticket promedio" value={'S/ ' + data.averageTicket.toFixed(2)} hint="Sobre subpedidos entregados" icon={ShoppingBag} /><KpiCard label="Preparación" value={data.averagePreparationMinutes == null ? '—' : data.averagePreparationMinutes + ' min'} hint="Desde aceptación hasta listo" icon={Clock3} tone="amber" /></div>}
      {section === 'repartidores' && <p className="mb-4 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-900">La asignación se produce cuando todos los comercios marcan sus subpedidos como listos. El estado de recogida y su hora se muestran abajo.</p>}
      <OperationsTable rows={section === 'repartidores' ? data.history.filter(row => row.pickedUpAt || ['READY_FOR_PICKUP', 'PICKING_UP'].includes(String(row.status))) : data.history} columns={[['Pedido', 'order.orderNumber'], ['Estado', 'status'], ['Subtotal (S/)', 'subtotal'], ['Recogido', 'pickedUpAt']]} details={row => <><p className="text-sm">Creado: {display(getValue(row, 'order.createdAt'))}</p>{Array.isArray(row.items) && row.items.map((item, index) => <p className="text-sm" key={index}>{display(getValue(item, 'quantity'))} × {display(getValue(item, 'productName'))}</p>)}</>} />
    </>}
  </>;
}
function MerchantNotifications() {
  const query = useQuery({ queryKey: ['own-notifications'], queryFn: () => apiRequest<RecordData[]>('/api/backend/notifications/notifications'), refetchInterval: 15000 });
  return <><PageHeading eyebrow="Tu cuenta" title="Notificaciones" description="Mensajes operativos y estado de lectura." />{query.isLoading ? <LoadingPanel /> : query.isError ? <ErrorPanel message={query.error.message} /> : <OperationsTable rows={query.data ?? []} columns={[['Título', 'title'], ['Mensaje', 'message'], ['Fecha', 'createdAt'], ['Leído', 'readAt']]} details={row => !row.readAt && <OperationForm endpoint={'/api/backend/notifications/notifications/' + row.id + '/read'} fields={[]} label="Marcar como leído" />} />}</>;
}
export function MerchantOperations({ section }: { section: string }) {
  if (section === 'configuracion') return <MerchantConfiguration />;
  if (section === 'notificaciones') return <MerchantNotifications />;
  if (['historial', 'metricas', 'repartidores'].includes(section)) return <MerchantData section={section} />;
  return <ErrorPanel message="Sección no encontrada." />;
}

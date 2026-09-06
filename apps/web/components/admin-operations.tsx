'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Bell,
  ClipboardList,
  CreditCard,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { ErrorPanel, LoadingPanel, PageHeading, StatusBadge } from './ui';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? 'La operación no pudo completarse');
  }
  return response.json() as Promise<T>;
}

const actionClass = 'rounded-lg px-3 py-2 text-xs font-extrabold disabled:opacity-40';
const tableClass = 'w-full min-w-[820px] text-left';
const headClass = 'bg-slate-50 text-[10px] font-extrabold uppercase tracking-[.1em] text-slate-400';

type Driver = {
  id: string;
  userId: string;
  documentNumber: string;
  vehicleType: string;
  vehiclePlate?: string;
  status: string;
  rating: string;
  completedOrders: number;
  assignments: unknown[];
};

function DriversPanel() {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-drivers'],
    queryFn: () => request<Driver[]>('/api/backend/drivers/admin/drivers'),
  });
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      request(`/api/backend/drivers/admin/drivers/${id}/status`, json('PATCH', { status })),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['admin-drivers'] }),
  });
  return (
    <Panel
      title="Repartidores"
      eyebrow="Control de flota"
      description="Aprueba, suspende y revisa actividad. La API impide liberar un driver con entrega activa."
    >
      {query.isLoading ? (
        <LoadingPanel />
      ) : query.isError ? (
        <ErrorPanel />
      ) : (
        <Table>
          <table className={tableClass}>
            <thead className={headClass}>
              <tr>
                <Th>Driver</Th>
                <Th>Vehículo</Th>
                <Th>Estado</Th>
                <Th>Actividad</Th>
                <Th right>Control</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {query.data!.map((driver) => (
                <tr key={driver.id}>
                  <Td>
                    <strong className="text-[#071a2f]">DNI {driver.documentNumber}</strong>
                    <Small>{driver.userId}</Small>
                  </Td>
                  <Td>
                    {driver.vehicleType}
                    <Small>{driver.vehiclePlate ?? 'Sin placa'}</Small>
                  </Td>
                  <Td>
                    <StatusBadge value={driver.status} />
                  </Td>
                  <Td>
                    {driver.completedOrders} entregas · ★ {Number(driver.rating).toFixed(1)}
                    <Small>{driver.assignments.length} asignación activa</Small>
                  </Td>
                  <Td right>
                    <button
                      disabled={mutation.isPending || driver.status === 'BUSY'}
                      className={`${actionClass} ${driver.status === 'SUSPENDED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
                      onClick={() =>
                        mutation.mutate({
                          id: driver.id,
                          status: driver.status === 'SUSPENDED' ? 'AVAILABLE' : 'SUSPENDED',
                        })
                      }
                    >
                      {driver.status === 'SUSPENDED' ? 'Aprobar / activar' : 'Suspender'}
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Table>
      )}
    </Panel>
  );
}

type Merchant = {
  id: string;
  name: string;
  category: string;
  ruc: string;
  address: string;
  isOpen: boolean;
  isActive: boolean;
  _count: { products: number; subOrders: number };
};

function MerchantsPanel() {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-merchants'],
    queryFn: () => request<Merchant[]>('/api/backend/orders/admin/merchants'),
  });
  const mutation = useMutation({
    mutationFn: (merchant: Merchant) =>
      request(
        `/api/backend/orders/merchants/${merchant.id}`,
        json('PATCH', { isActive: !merchant.isActive }),
      ),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['admin-merchants'] }),
  });
  return (
    <Panel
      title="Comercios"
      eyebrow="Red afiliada"
      description="Revisa catálogo, volumen y operación; activa o suspende cada establecimiento."
    >
      {query.isLoading ? (
        <LoadingPanel />
      ) : query.isError ? (
        <ErrorPanel />
      ) : (
        <Table>
          <table className={tableClass}>
            <thead className={headClass}>
              <tr>
                <Th>Establecimiento</Th>
                <Th>Categoría</Th>
                <Th>Operación</Th>
                <Th>Volumen</Th>
                <Th right>Acción</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {query.data!.map((merchant) => (
                <tr key={merchant.id}>
                  <Td>
                    <strong className="text-[#071a2f]">{merchant.name}</strong>
                    <Small>
                      RUC {merchant.ruc} · {merchant.address}
                    </Small>
                  </Td>
                  <Td>{merchant.category}</Td>
                  <Td>
                    <StatusBadge
                      value={
                        merchant.isActive
                          ? merchant.isOpen
                            ? 'ACTIVE · OPEN'
                            : 'ACTIVE · CLOSED'
                          : 'SUSPENDED'
                      }
                    />
                  </Td>
                  <Td>
                    {merchant._count.products} productos · {merchant._count.subOrders} pedidos
                  </Td>
                  <Td right>
                    <button
                      disabled={mutation.isPending}
                      className={`${actionClass} ${merchant.isActive ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
                      onClick={() => mutation.mutate(merchant)}
                    >
                      {merchant.isActive ? 'Suspender' : 'Aprobar y activar'}
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Table>
      )}
    </Panel>
  );
}

type Payment = { id: string; provider: string; method: string; status: string; amount: string };
type Order = {
  id: string;
  orderNumber: string;
  customerId: string;
  status: string;
  paymentStatus: string;
  total: string;
  assignedDriverId?: string;
  createdAt: string;
  subOrders: Array<{
    id: string;
    merchant: { name: string };
    items: Array<{ id: string; productName: string; quantity: number }>;
  }>;
  payments: Payment[];
};

function OrdersPanel({ paymentsOnly = false }: { paymentsOnly?: boolean }) {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => request<Order[]>('/api/backend/orders/orders'),
    refetchInterval: 10_000,
  });
  const decision = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      request(`/api/backend/orders/payments/${id}/mock-decision`, json('POST', { approved })),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['admin-orders'] }),
  });
  return (
    <Panel
      title={paymentsOnly ? 'Pagos' : 'Pedidos y trazabilidad'}
      eyebrow={paymentsOnly ? 'Validación backend' : 'Operación completa'}
      description={
        paymentsOnly
          ? 'Aprueba o rechaza intents simulados sin confiar en una respuesta del frontend.'
          : 'Consulta estado, subpedidos, driver, pago y detalle de cada orden.'
      }
    >
      {query.isLoading ? (
        <LoadingPanel />
      ) : query.isError ? (
        <ErrorPanel />
      ) : (
        <div className="space-y-4">
          {query.data!.map((order) => {
            const payment = order.payments[0];
            return (
              <article
                key={order.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row">
                  <div>
                    <p className="font-extrabold text-[#071a2f]">{order.orderNumber}</p>
                    <Small>
                      {new Date(order.createdAt).toLocaleString('es-PE')} · cliente{' '}
                      {order.customerId.slice(0, 8)}
                    </Small>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={order.status} />
                    <StatusBadge value={order.paymentStatus} />
                    <strong className="text-lg text-[#071a2f]">
                      S/ {Number(order.total).toFixed(2)}
                    </strong>
                  </div>
                </div>
                {!paymentsOnly && (
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {order.subOrders.map((sub) => (
                      <div key={sub.id} className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-extrabold text-[#071a2f]">{sub.merchant.name}</p>
                        <p className="mt-2 text-[10px] leading-5 text-slate-500">
                          {sub.items
                            .map((item) => `${item.quantity}× ${item.productName}`)
                            .join(' · ')}
                        </p>
                      </div>
                    ))}
                    <div className="rounded-xl bg-[#eaf0f6] p-3 text-xs font-bold text-[#0c2747]">
                      Driver<Small>{order.assignedDriverId ?? 'Aún sin asignar'}</Small>
                    </div>
                  </div>
                )}
                {payment && (
                  <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-xs font-extrabold text-slate-700">
                        {payment.provider} · {payment.method}
                      </p>
                      <Small>
                        Intent {payment.id} · S/ {Number(payment.amount).toFixed(2)}
                      </Small>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={payment.status} />
                      {payment.provider === 'MOCK' && payment.status === 'PENDING' && (
                        <>
                          <button
                            className={`${actionClass} bg-emerald-50 text-emerald-700`}
                            onClick={() => decision.mutate({ id: payment.id, approved: true })}
                          >
                            Aprobar
                          </button>
                          <button
                            className={`${actionClass} bg-red-50 text-red-700`}
                            onClick={() => decision.mutate({ id: payment.id, approved: false })}
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
          {!query.data!.length && (
            <Empty
              icon={paymentsOnly ? CreditCard : ClipboardList}
              text="Todavía no existen operaciones."
            />
          )}
        </div>
      )}
    </Panel>
  );
}

type Promotion = {
  id: string;
  code: string;
  type: string;
  value: string;
  startsAt: string;
  expiresAt: string;
  usageLimit?: number;
  usageCount: number;
  isActive: boolean;
};

function PromotionsPanel() {
  const cache = useQueryClient();
  const [form, setForm] = useState({
    code: '',
    type: 'PERCENTAGE',
    value: '10',
    minimumAmount: '30',
    maximumDiscount: '25',
    startsAt: new Date().toISOString().slice(0, 10),
    expiresAt: '2035-12-31',
    usageLimit: '1000',
  });
  const query = useQuery({
    queryKey: ['promotions'],
    queryFn: () => request<Promotion[]>('/api/backend/orders/promotions'),
  });
  const create = useMutation({
    mutationFn: () =>
      request(
        '/api/backend/orders/promotions',
        json('POST', {
          ...form,
          value: Number(form.value),
          minimumAmount: Number(form.minimumAmount),
          maximumDiscount: Number(form.maximumDiscount),
          usageLimit: Number(form.usageLimit),
          startsAt: new Date(form.startsAt).toISOString(),
          expiresAt: new Date(form.expiresAt).toISOString(),
        }),
      ),
    onSuccess: () => {
      setForm((value) => ({ ...value, code: '' }));
      return cache.invalidateQueries({ queryKey: ['promotions'] });
    },
  });
  const toggle = useMutation({
    mutationFn: (promo: Promotion) =>
      request(
        `/api/backend/orders/promotions/${promo.id}`,
        json('PATCH', { isActive: !promo.isActive }),
      ),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['promotions'] }),
  });
  return (
    <Panel
      title="Promociones"
      eyebrow="Campañas"
      description="Crea cupones con vigencia y límites; el checkout valida todas las reglas en servidor."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
        className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-4"
      >
        <Field
          label="Código"
          value={form.code}
          onChange={(code) => setForm({ ...form, code: code.toUpperCase() })}
          required
        />
        <label className="text-[10px] font-extrabold uppercase text-slate-400">
          Tipo
          <select
            className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3"
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value })}
          >
            <option>PERCENTAGE</option>
            <option>FIXED</option>
            <option>FREE_DELIVERY</option>
          </select>
        </label>
        <Field
          label="Valor"
          type="number"
          value={form.value}
          onChange={(value) => setForm({ ...form, value })}
        />
        <Field
          label="Compra mínima"
          type="number"
          value={form.minimumAmount}
          onChange={(minimumAmount) => setForm({ ...form, minimumAmount })}
        />
        <Field
          label="Descuento máximo"
          type="number"
          value={form.maximumDiscount}
          onChange={(maximumDiscount) => setForm({ ...form, maximumDiscount })}
        />
        <Field
          label="Inicio"
          type="date"
          value={form.startsAt}
          onChange={(startsAt) => setForm({ ...form, startsAt })}
        />
        <Field
          label="Vencimiento"
          type="date"
          value={form.expiresAt}
          onChange={(expiresAt) => setForm({ ...form, expiresAt })}
        />
        <button
          disabled={create.isPending}
          className={`${actionClass} mt-auto h-11 bg-[#0c2747] text-white`}
        >
          Crear promoción
        </button>
      </form>
      {query.isLoading ? (
        <LoadingPanel />
      ) : query.isError ? (
        <ErrorPanel />
      ) : (
        <Table>
          <table className={tableClass}>
            <thead className={headClass}>
              <tr>
                <Th>Código</Th>
                <Th>Beneficio</Th>
                <Th>Vigencia</Th>
                <Th>Uso</Th>
                <Th right>Acción</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {query.data!.map((promo) => (
                <tr key={promo.id}>
                  <Td>
                    <strong className="text-[#071a2f]">{promo.code}</strong>
                    <Small>{promo.isActive ? 'Activo' : 'Inactivo'}</Small>
                  </Td>
                  <Td>
                    {promo.type} · {Number(promo.value).toFixed(2)}
                  </Td>
                  <Td>
                    {new Date(promo.startsAt).toLocaleDateString('es-PE')} —{' '}
                    {new Date(promo.expiresAt).toLocaleDateString('es-PE')}
                  </Td>
                  <Td>
                    {promo.usageCount} / {promo.usageLimit ?? '∞'}
                  </Td>
                  <Td right>
                    <button
                      className={`${actionClass} ${promo.isActive ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
                      onClick={() => toggle.mutate(promo)}
                    >
                      {promo.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Table>
      )}
    </Panel>
  );
}

type Notification = {
  id: string;
  userId: string;
  channel: string;
  title: string;
  message: string;
  status: string;
  createdAt: string;
};
function NotificationsPanel() {
  const query = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => request<Notification[]>('/api/backend/notifications/notifications/admin/all'),
  });
  return (
    <Panel
      title="Notificaciones"
      eyebrow="Centro de mensajes"
      description="Entrega in-app, push y email consumida desde la cola de eventos."
    >
      {query.isLoading ? (
        <LoadingPanel />
      ) : query.isError ? (
        <ErrorPanel />
      ) : (
        <div className="space-y-3">
          {query.data!.map((item) => (
            <article
              key={item.id}
              className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
            >
              <div>
                <p className="text-sm font-extrabold text-[#071a2f]">{item.title}</p>
                <p className="mt-2 text-xs text-slate-500">{item.message}</p>
                <Small>
                  {item.userId} · {new Date(item.createdAt).toLocaleString('es-PE')}
                </Small>
              </div>
              <div className="flex gap-2">
                <StatusBadge value={item.channel} />
                <StatusBadge value={item.status} />
              </div>
            </article>
          ))}
          {!query.data!.length && <Empty icon={Bell} text="Aún no hay notificaciones." />}
        </div>
      )}
    </Panel>
  );
}

type Audit = {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};
function AuditPanel() {
  const query = useQuery({
    queryKey: ['audit'],
    queryFn: () => request<Audit[]>('/api/backend/users/users/audit'),
  });
  return (
    <Panel
      title="Auditoría"
      eyebrow="Gobernanza"
      description="Registro de acciones administrativas y eventos de seguridad relevantes."
    >
      {query.isLoading ? (
        <LoadingPanel />
      ) : query.isError ? (
        <ErrorPanel />
      ) : (
        <div className="space-y-3">
          {query.data!.map((item) => (
            <article
              key={item.id}
              className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3"
            >
              <div>
                <p className="text-xs font-extrabold text-[#071a2f]">{item.action}</p>
                <Small>{new Date(item.createdAt).toLocaleString('es-PE')}</Small>
              </div>
              <p className="text-xs font-semibold text-slate-600">
                {item.entity} · {item.entityId ?? 's/n'}
              </p>
              <p className="truncate text-[10px] text-slate-400">
                {JSON.stringify(item.metadata ?? {})}
              </p>
            </article>
          ))}
          {!query.data!.length && (
            <Empty icon={ScrollText} text="Aún no existen eventos auditados." />
          )}
        </div>
      )}
    </Panel>
  );
}

function MonitoringPanel() {
  const services = ['users', 'orders', 'drivers', 'notifications'] as const;
  const query = useQuery({
    queryKey: ['health'],
    queryFn: () =>
      Promise.all(
        services.map(async (key) => {
          try {
            return {
              key,
              ...(await request<{ status: string; service: string }>(`/api/backend/${key}/health`)),
            };
          } catch {
            return { key, status: 'unavailable', service: `${key}-service` };
          }
        }),
      ),
    refetchInterval: 10_000,
  });
  return (
    <Panel
      title="Monitoreo"
      eyebrow="Observabilidad"
      description="Health checks reales actualizados cada diez segundos."
    >
      {query.isLoading ? (
        <LoadingPanel />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {query.data!.map((item) => (
            <article key={item.key} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex justify-between">
                <Activity className={item.status === 'ok' ? 'text-emerald-600' : 'text-red-600'} />
                <StatusBadge value={item.status} />
              </div>
              <p className="mt-5 text-sm font-extrabold text-[#071a2f]">{item.service}</p>
              <Small>GET /health</Small>
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ConfigurationPanel() {
  const values = [
    ['Pagos', 'Mock local / Mercado Pago preparado'],
    ['Mapas', 'Haversine local / Google preparado'],
    ['Push', 'Mock local / Firebase preparado'],
    ['Email', 'SMTP local con Mailpit'],
    ['Mensajería', 'RabbitMQ durable + retry + DLQ'],
    ['Tracking', 'Redis TTL + fallback en memoria'],
  ];
  return (
    <Panel
      title="Configuración"
      eyebrow="Entorno"
      description="Resumen no sensible. Los secretos se cargan exclusivamente mediante variables de entorno."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {values.map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-extrabold uppercase text-slate-400">{label}</p>
            <p className="mt-2 text-sm font-extrabold text-[#071a2f]">{value}</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}

export function AdminOperations({ section }: { section: string }) {
  if (section === 'repartidores') return <DriversPanel />;
  if (section === 'comercios') return <MerchantsPanel />;
  if (section === 'pedidos') return <OrdersPanel />;
  if (section === 'pagos') return <OrdersPanel paymentsOnly />;
  if (section === 'promociones') return <PromotionsPanel />;
  if (section === 'notificaciones') return <NotificationsPanel />;
  if (section === 'monitoreo') return <MonitoringPanel />;
  if (section === 'auditoria') return <AuditPanel />;
  return <ConfigurationPanel />;
}

function json(method: string, body: object): RequestInit {
  return { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
function Panel({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHeading title={title} eyebrow={eyebrow} description={description} />
      {children}
    </>
  );
}
function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
function Th({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-5 py-4 ${right ? 'text-right' : ''}`}>{children}</th>;
}
function Td({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <td className={`px-5 py-4 text-xs font-semibold text-slate-600 ${right ? 'text-right' : ''}`}>
      {children}
    </td>
  );
}
function Small({ children }: { children: React.ReactNode }) {
  return <span className="mt-1 block text-[10px] font-medium text-slate-400">{children}</span>;
}
function Empty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white">
      <div className="text-center">
        <Icon className="mx-auto size-9 text-slate-300" />
        <p className="mt-3 text-sm font-bold text-slate-400">{text}</p>
      </div>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-[10px] font-extrabold uppercase text-slate-400">
      {label}
      <input
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-amber-400"
      />
    </label>
  );
}

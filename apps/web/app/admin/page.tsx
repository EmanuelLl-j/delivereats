'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest as getJson } from '@/lib/api';
import type { Analytics, ServiceState } from '@/components/system-panels';
import {
  Activity,
  Bike,
  Building2,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ErrorPanel, KpiCard, LoadingPanel, PageHeading, StatusBadge } from '@/components/ui';

type Driver = { id: string; status: string };
type Metrics = {
  merchants: number;
  ordersToday: number;
  activeOrders: number;
  approvedPayments: number;
  rejectedPayments: number;
  revenue: number;
};
type Order = {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  paymentStatus: string;
  createdAt: string;
};

export default function AdminDashboard() {
  const analytics = useQuery({ queryKey: ['admin-hourly'], queryFn: () => getJson<Analytics>('/api/backend/orders/admin/analytics'), refetchInterval: 15000 });
  const system = useQuery({ queryKey: ['system-readiness'], queryFn: () => getJson<ServiceState[]>('/api/backend/orders/admin/system'), refetchInterval: 10000 });
  const readyCount = system.data?.filter(service => service.status === 'ready').length;
  const ready = !!system.data?.length && readyCount === system.data.length;
  const metrics = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => getJson<Metrics>('/api/backend/orders/admin/metrics'),
    refetchInterval: 15_000,
  });
  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => getJson<{ active: number }>('/api/backend/users/admin/user-metrics'),
  });
  const drivers = useQuery({
    queryKey: ['admin-drivers'],
    queryFn: () => getJson<Driver[]>('/api/backend/drivers/admin/drivers'),
  });
  const orders = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => getJson<Order[]>('/api/backend/orders/orders'),
    refetchInterval: 10_000,
  });
  if (metrics.isLoading || users.isLoading || drivers.isLoading || orders.isLoading)
    return <LoadingPanel />;
  if (metrics.isError || users.isError || drivers.isError || orders.isError) return <ErrorPanel />;
  const m = metrics.data!;
  const activeUsers = users.data!.active;
  const activeDrivers = drivers.data!.filter((driver) =>
    ['AVAILABLE', 'RESERVED', 'BUSY'].includes(driver.status),
  ).length;

  return (
    <>
      <PageHeading
        eyebrow="Centro de control"
        title="Operación general"
        description="Un vistazo ejecutivo a la red DeliverEats Ayacucho y sus servicios activos."
        action={
          <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-extrabold ${ready ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <span className={`size-2 rounded-full ${ready ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {system.isLoading ? 'Consultando servicios…' : ready ? 'Dependencias operativas' : 'Servicios por revisar'}
          </span>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Usuarios activos"
          value={String(activeUsers)}
          hint="Cuentas habilitadas"
          icon={Users}
        />
        <KpiCard
          label="Drivers activos"
          value={String(activeDrivers)}
          hint={`${drivers.data!.length} registrados`}
          icon={Bike}
          tone="green"
        />
        <KpiCard
          label="Comercios"
          value={String(m.merchants)}
          hint="Afiliados aprobados"
          icon={Building2}
          tone="amber"
        />
        <KpiCard
          label="Pedidos hoy"
          value={String(m.ordersToday)}
          hint={`${m.activeOrders} en curso`}
          icon={ClipboardList}
          tone="blue"
        />
      </section>
      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Ingresos procesados"
          value={`S/ ${m.revenue.toFixed(2)}`}
          hint="Pagos verificados"
          icon={CircleDollarSign}
          tone="green"
        />
        <KpiCard
          label="Pagos aprobados"
          value={String(m.approvedPayments)}
          hint="Validación backend"
          icon={CreditCard}
          tone="green"
        />
        <KpiCard
          label="Pagos rechazados"
          value={String(m.rejectedPayments)}
          hint="Requieren seguimiento"
          icon={CreditCard}
          tone="amber"
        />
        <KpiCard
          label="Servicios"
          value={system.data ? `${readyCount} / ${system.data.length}` : '—'}
          hint="Readiness verificado"
          icon={Activity}
          tone="blue"
        />
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="mb-7 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-[#071a2f]">Demanda por hora</h2>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                Comportamiento operativo de la jornada
              </p>
            </div>
            <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-700">
              Hoy
            </span>
          </div>
          {analytics.isError && <ErrorPanel message={analytics.error.message} />}
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.data?.hours ?? []}>
                <defs>
                  <linearGradient id="orders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e9eef3" />
                <XAxis
                  dataKey="hour"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="orders"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  fill="url(#orders)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-extrabold text-[#071a2f]">Pedidos recientes</h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">Actualización automática</p>
          </div>
          <div className="space-y-3">
            {orders.data!.slice(0, 6).map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-[#071a2f]">
                    {order.orderNumber}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    S/ {Number(order.total).toFixed(2)}
                  </p>
                </div>
                <StatusBadge value={order.status} />
              </div>
            ))}
            {!orders.data!.length && (
              <p className="rounded-xl bg-slate-50 p-6 text-center text-sm font-semibold text-slate-400">
                Aún no hay pedidos.
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

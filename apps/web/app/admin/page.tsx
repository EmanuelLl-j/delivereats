'use client';

import { useQuery } from '@tanstack/react-query';
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

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
};
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

const chartData = [
  { hour: '08h', orders: 4 },
  { hour: '10h', orders: 12 },
  { hour: '12h', orders: 28 },
  { hour: '14h', orders: 21 },
  { hour: '16h', orders: 31 },
  { hour: '18h', orders: 42 },
  { hour: '20h', orders: 35 },
];

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Request failed');
  return response.json() as Promise<T>;
}

export default function AdminDashboard() {
  const metrics = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => getJson<Metrics>('/api/backend/orders/admin/metrics'),
    refetchInterval: 15_000,
  });
  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => getJson<User[]>('/api/backend/users/users'),
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
  const activeUsers = users.data!.filter((user) => user.status === 'ACTIVE').length;
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
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-extrabold text-emerald-700">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" /> Plataforma
            operativa
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
          value="4 / 4"
          hint="Microservicios configurados"
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
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
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

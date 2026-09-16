'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  CheckCircle2,
  ChefHat,
  Clock3,
  PackageCheck,
  ReceiptText,
  ShoppingBag,
} from 'lucide-react';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { ErrorPanel, KpiCard, LoadingPanel, PageHeading, StatusBadge } from '@/components/ui';
import { apiRequest, json } from '../../lib/api';
import Link from 'next/link';
import { OperationForm } from '@/components/operations-ui';

type Item = { id: string; productName: string; quantity: number };
type SubOrder = {
  id: string;
  status: string;
  subtotal: string;
  merchant: { name: string; isOpen: boolean; isActive: boolean; applicationStatus: string };
  items: Item[];
  order: {
    id: string;
    orderNumber: string;
    status: string;
    total: string;
    paymentMethod: string;
    createdAt: string;
  };
};
type Dashboard = {
  merchant: { name: string; isOpen: boolean; isActive: boolean; applicationStatus: string };
  merchants: Array<{ id: string; name: string }>;
  kpis: {
    ordersToday: number;
    activeOrders: number;
    revenue: number;
    averageTicket: number;
    averagePreparationMinutes: number | null;
    completedOrders: number;
  };
  orders: SubOrder[];
};

const columns = [
  {
    title: 'Ingresados',
    statuses: ['PENDING', 'CONFIRMED', 'SEARCHING_DRIVER', 'ASSIGNED'],
    icon: ReceiptText,
    tone: 'text-blue-600 bg-blue-50',
  },
  {
    title: 'En preparación',
    statuses: ['PREPARING'],
    icon: ChefHat,
    tone: 'text-amber-600 bg-amber-50',
    action: 'READY_FOR_PICKUP',
    actionLabel: 'Marcar listo',
  },
  {
    title: 'Listos',
    statuses: ['READY_FOR_PICKUP'],
    icon: PackageCheck,
    tone: 'text-emerald-600 bg-emerald-50',
  },
  {
    title: 'Despachados',
    statuses: ['PICKING_UP', 'ON_THE_WAY', 'DELIVERED'],
    icon: ShoppingBag,
    tone: 'text-violet-600 bg-violet-50',
  },
] as const;

export default function MerchantDashboard() {
  const queryClient = useQueryClient();
  const dashboard = useQuery({
    queryKey: ['merchant-dashboard'],
    queryFn: () => apiRequest<Dashboard>('/api/backend/orders/commerce/dashboard'),
    refetchInterval: 15_000,
  });
  const transition = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return apiRequest(`/api/backend/orders/orders/suborders/${orderId}/status`, json('PATCH', { status }));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['merchant-dashboard'] }),
  });

  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_SOCKET_URL ?? window.location.origin}/orders`, {
      path: '/socket.io/orders',
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    socket.on('merchant.order.updated', () =>
      queryClient.invalidateQueries({ queryKey: ['merchant-dashboard'] }),
    );
    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  if (dashboard.isLoading) return <LoadingPanel />;
  if (dashboard.isError) return <><ErrorPanel message={dashboard.error.message} /><Link className="mt-5 inline-block rounded-xl bg-indigo-950 px-5 py-3 font-bold text-white" href="/comercio/configuracion">Configurar mi comercio</Link></>;
  const data = dashboard.data!;
  return (
    <>
      <PageHeading
        eyebrow="Operación de comercio"
        title={`Hola, ${data.merchant.name}`}
        description={`${data.merchants.length} establecimiento(s) bajo esta cuenta. Gestiona los pedidos sin recargar la página.`}
        action={
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-extrabold text-emerald-700">
            <span className={`size-2 rounded-full ${data.merchant.isActive && data.merchant.isOpen ? 'bg-emerald-500' : 'bg-amber-500'}`} /> {data.merchant.isActive && data.merchant.isOpen ? 'Recibiendo pedidos' : data.merchant.applicationStatus === 'APPROVED' ? 'Comercio cerrado' : 'Solicitud en revisión'}
          </span>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          label="Pedidos hoy"
          value={String(data.kpis.ordersToday)}
          hint="Todos los locales"
          icon={ShoppingBag}
        />
        <KpiCard
          label="Pedidos activos"
          value={String(data.kpis.activeOrders)}
          hint="Requieren atención"
          icon={Clock3}
          tone="amber"
        />
        <KpiCard
          label="Ingresos"
          value={`S/ ${data.kpis.revenue.toFixed(2)}`}
          hint="Entregados"
          icon={Banknote}
          tone="green"
        />
        <KpiCard
          label="Ticket promedio"
          value={`S/ ${data.kpis.averageTicket.toFixed(2)}`}
          hint="Por pedido"
          icon={ReceiptText}
          tone="blue"
        />
        <KpiCard
          label="Preparación"
          value={data.kpis.averagePreparationMinutes === null ? 'Sin datos' : `${data.kpis.averagePreparationMinutes} min`}
          hint="Preparaciones registradas"
          icon={ChefHat}
          tone="amber"
        />
        <KpiCard
          label="Completados"
          value={String(data.kpis.completedOrders)}
          hint="Durante el día"
          icon={CheckCircle2}
          tone="green"
        />
      </section>
      <section className="mt-8">
        {transition.isError && <ErrorPanel message={transition.error.message} />}
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-[#071a2f]">Tablero de pedidos</h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">Flujo Kanban en tiempo real</p>
          </div>
          <span className="text-xs font-bold text-slate-400">{data.orders.length} subpedidos</span>
        </div>
        <div className="grid gap-4 xl:grid-cols-4">
          {columns.map((column) => {
            const items = data.orders.filter((item) =>
              column.statuses.includes(item.status as never),
            );
            const Icon = column.icon;
            return (
              <div key={column.title} className="min-h-[360px] rounded-2xl bg-slate-100/70 p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={`grid size-8 place-items-center rounded-lg ${column.tone}`}>
                      <Icon className="size-4" />
                    </span>
                    <h3 className="text-xs font-extrabold uppercase tracking-[.08em] text-slate-600">
                      {column.title}
                    </h3>
                  </div>
                  <span className="grid size-6 place-items-center rounded-full bg-white text-[10px] font-extrabold text-slate-500">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {items.map((item) => {
                    const next =
                      item.status === 'CONFIRMED'
                        ? { status: 'PREPARING', label: 'Aceptar y preparar' }
                        : item.status === 'ASSIGNED' || item.status === 'SEARCHING_DRIVER'
                          ? { status: 'PREPARING', label: 'Iniciar preparación' }
                          : item.status === 'PREPARING'
                            ? { status: 'READY_FOR_PICKUP', label: 'Marcar listo' }
                            : null;
                    return (
                      <article
                        key={item.id}
                        className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-extrabold text-[#071a2f]">
                              {item.order.orderNumber}
                            </p>
                            <p className="mt-1 text-[11px] font-bold text-amber-600">
                              {item.merchant.name}
                            </p>
                          </div>
                          <StatusBadge value={item.status} />
                        </div>
                        <div className="my-3 border-t border-dashed border-slate-200" />
                        <div className="space-y-1.5">
                          {item.items.map((product) => (
                            <p key={product.id} className="text-xs font-semibold text-slate-500">
                              <strong className="mr-1 text-slate-700">{product.quantity}×</strong>
                              {product.productName}
                            </p>
                          ))}
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-sm font-extrabold text-[#071a2f]">
                            S/ {Number(item.subtotal).toFixed(2)}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {item.order.paymentMethod}
                          </span>
                        </div>
                        {next && (
                          <button
                            disabled={transition.isPending}
                            onClick={() =>
                              transition.mutate({ orderId: item.id, status: next.status })
                            }
                            className="mt-4 w-full rounded-lg bg-[#0c2747] px-3 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#12385f] disabled:opacity-50"
                          >
                            {next.label}
                          </button>
                        )}
                        {['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'].includes(item.status) && <details className="mt-3 border-t pt-3"><summary className="cursor-pointer text-xs font-bold text-red-700">No puedo atender este pedido</summary><p className="my-3 text-xs text-slate-600">El rechazo cancela el pedido completo, incluidos los demás comercios, únicamente antes de la primera recogida. Un pago verificado requerirá devolución; esta acción no confirma que se haya reembolsado.</p><OperationForm endpoint={'/api/backend/orders/orders/suborders/' + item.id + '/status'} fields={[{ name: 'reason', label: 'Motivo del rechazo', type: 'textarea', min: 10, max: 500 }]} transform={value => ({ ...value, status: 'CANCELLED' })} label="Confirmar rechazo y cancelación" /></details>}
                      </article>
                    );
                  })}
                  {!items.length && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white/55 p-8 text-center text-xs font-bold text-slate-400">
                      Sin pedidos en esta etapa
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

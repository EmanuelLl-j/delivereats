'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Bike, CheckCircle2, Clock3, Settings, ShoppingBag } from 'lucide-react';
import { ErrorPanel, KpiCard, LoadingPanel, PageHeading, StatusBadge } from './ui';

type SubOrder = {
  id: string;
  status: string;
  subtotal: string;
  merchant: { name: string };
  items: Array<{ id: string; productName: string; quantity: number }>;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    assignedDriverId?: string;
    createdAt: string;
  };
};
type Dashboard = {
  merchant: { id: string; name: string; isOpen: boolean; isActive: boolean; address: string };
  kpis: {
    ordersToday: number;
    activeOrders: number;
    revenue: number;
    averageTicket: number;
    averagePreparationMinutes: number;
    completedOrders: number;
  };
  orders: SubOrder[];
};
type Notification = {
  id: string;
  title: string;
  message: string;
  channel: string;
  status: string;
  createdAt: string;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error('No se pudo completar la operación');
  return response.json() as Promise<T>;
}

function useDashboard() {
  return useQuery({
    queryKey: ['merchant-dashboard'],
    queryFn: () => request<Dashboard>('/api/backend/orders/commerce/dashboard'),
    refetchInterval: 12_000,
  });
}

export function MerchantOperations({ section }: { section: string }) {
  if (section === 'notificaciones') return <MerchantNotifications />;
  if (section === 'configuracion') return <MerchantConfiguration />;
  return <MerchantData section={section} />;
}

function MerchantData({ section }: { section: string }) {
  const dashboard = useDashboard();
  if (dashboard.isLoading) return <LoadingPanel />;
  if (dashboard.isError) return <ErrorPanel />;
  const data = dashboard.data!;
  if (section === 'metricas')
    return (
      <>
        <PageHeading
          eyebrow="Rendimiento"
          title="Métricas del comercio"
          description="Indicadores calculados sobre pedidos reales del día."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            label="Pedidos hoy"
            value={String(data.kpis.ordersToday)}
            hint="Todos los estados"
            icon={ShoppingBag}
          />
          <KpiCard
            label="Ingresos"
            value={`S/ ${data.kpis.revenue.toFixed(2)}`}
            hint="Pedidos entregados"
            icon={CheckCircle2}
            tone="green"
          />
          <KpiCard
            label="Ticket promedio"
            value={`S/ ${data.kpis.averageTicket.toFixed(2)}`}
            hint="Por pedido"
            icon={ShoppingBag}
            tone="blue"
          />
          <KpiCard
            label="Preparación"
            value={`${data.kpis.averagePreparationMinutes} min`}
            hint="Promedio operativo"
            icon={Clock3}
            tone="amber"
          />
          <KpiCard
            label="Activos"
            value={String(data.kpis.activeOrders)}
            hint="En atención"
            icon={Clock3}
            tone="amber"
          />
          <KpiCard
            label="Completados"
            value={String(data.kpis.completedOrders)}
            hint="Durante el día"
            icon={CheckCircle2}
            tone="green"
          />
        </div>
      </>
    );
  if (section === 'repartidores') {
    const assigned = data.orders.filter((item) => item.order.assignedDriverId);
    return (
      <>
        <PageHeading
          eyebrow="Coordinación"
          title="Repartidores"
          description="Drivers asignados a los pedidos de tus establecimientos."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {assigned.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-amber-100 text-amber-700">
                  <Bike className="size-5" />
                </span>
                <StatusBadge value={item.status} />
              </div>
              <p className="mt-4 text-sm font-extrabold text-[#071a2f]">
                Pedido {item.order.orderNumber}
              </p>
              <p className="mt-2 text-xs text-slate-400">Driver {item.order.assignedDriverId}</p>
            </article>
          ))}
          {!assigned.length && (
            <Empty icon={Bike} text="No hay drivers asignados en este momento." />
          )}
        </div>
      </>
    );
  }
  const history = data.orders.filter((item) => ['DELIVERED', 'CANCELLED'].includes(item.status));
  return (
    <>
      <PageHeading
        eyebrow="Operación histórica"
        title="Historial"
        description="Pedidos entregados y cancelados de la jornada."
      />
      <div className="space-y-3">
        {history.map((item) => (
          <article
            key={item.id}
            className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
          >
            <div>
              <p className="text-sm font-extrabold text-[#071a2f]">
                {item.order.orderNumber} · {item.merchant.name}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {item.items
                  .map((product) => `${product.quantity}× ${product.productName}`)
                  .join(' · ')}
              </p>
              <p className="mt-2 text-[10px] text-slate-400">
                {new Date(item.order.createdAt).toLocaleString('es-PE')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge value={item.status} />
              <strong className="text-sm text-[#071a2f]">
                S/ {Number(item.subtotal).toFixed(2)}
              </strong>
            </div>
          </article>
        ))}
        {!history.length && <Empty icon={ShoppingBag} text="Todavía no hay pedidos finalizados." />}
      </div>
    </>
  );
}

function MerchantNotifications() {
  const query = useQuery({
    queryKey: ['merchant-notifications'],
    queryFn: () => request<Notification[]>('/api/backend/notifications/notifications'),
  });
  return (
    <>
      <PageHeading
        eyebrow="Actualizaciones"
        title="Notificaciones"
        description="Mensajes operativos asociados a tu cuenta de comercio."
      />
      {query.isLoading ? (
        <LoadingPanel />
      ) : query.isError ? (
        <ErrorPanel />
      ) : (
        <div className="space-y-3">
          {query.data!.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-[#071a2f]">{item.title}</p>
                  <p className="mt-2 text-xs text-slate-500">{item.message}</p>
                  <p className="mt-2 text-[10px] text-slate-400">
                    {new Date(item.createdAt).toLocaleString('es-PE')}
                  </p>
                </div>
                <StatusBadge value={item.status} />
              </div>
            </article>
          ))}
          {!query.data!.length && <Empty icon={Bell} text="No tienes notificaciones." />}
        </div>
      )}
    </>
  );
}

function MerchantConfiguration() {
  const cache = useQueryClient();
  const dashboard = useDashboard();
  const mutation = useMutation({
    mutationFn: ({ id, isOpen }: { id: string; isOpen: boolean }) =>
      request(`/api/backend/orders/merchants/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isOpen }),
      }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['merchant-dashboard'] }),
  });
  if (dashboard.isLoading) return <LoadingPanel />;
  if (dashboard.isError) return <ErrorPanel />;
  const merchant = dashboard.data!.merchant;
  return (
    <>
      <PageHeading
        eyebrow="Establecimiento"
        title="Configuración"
        description="Controla la disponibilidad pública de tu comercio."
      />
      <article className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-xl bg-[#eaf0f6] text-[#0c2747]">
            <Settings className="size-5" />
          </span>
          <div>
            <p className="text-lg font-extrabold text-[#071a2f]">{merchant.name}</p>
            <p className="mt-1 text-xs text-slate-400">{merchant.address}</p>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between rounded-xl bg-slate-50 p-4">
          <div>
            <p className="text-sm font-extrabold text-[#071a2f]">Recepción de pedidos</p>
            <p className="mt-1 text-xs text-slate-400">
              {merchant.isOpen ? 'Visible y aceptando pedidos' : 'El comercio aparece cerrado'}
            </p>
          </div>
          <button
            disabled={mutation.isPending || !merchant.isActive}
            onClick={() => mutation.mutate({ id: merchant.id, isOpen: !merchant.isOpen })}
            className={`rounded-lg px-4 py-2 text-xs font-extrabold ${merchant.isOpen ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
          >
            {merchant.isOpen ? 'Cerrar temporalmente' : 'Abrir comercio'}
          </button>
        </div>
      </article>
    </>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof Bike; text: string }) {
  return (
    <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white">
      <div className="text-center">
        <Icon className="mx-auto size-9 text-slate-300" />
        <p className="mt-3 text-sm font-bold text-slate-400">{text}</p>
      </div>
    </div>
  );
}

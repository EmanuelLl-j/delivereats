'use client';

import {
  Bell,
  Bike,
  Building2,
  ChartNoAxesCombined,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  Tag,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/api';

const adminNavigation = [
  ['Dashboard', '/admin', LayoutDashboard],
  ['Usuarios', '/admin/usuarios', Users],
  ['Repartidores', '/admin/repartidores', Bike],
  ['Comercios', '/admin/comercios', Building2],
  ['Pedidos', '/admin/pedidos', ClipboardList],
  ['Envíos personales', '/admin/envios', Package],
  ['Pagos', '/admin/pagos', CreditCard],
  ['Reembolsos', '/admin/reembolsos', CreditCard],
  ['Promociones', '/admin/promociones', Tag],
  ['Notificaciones', '/admin/notificaciones', Bell],
  ['Incidencias', '/admin/incidencias', ClipboardList],
  ['Soporte', '/admin/soporte', Bell],
  ['Privacidad', '/admin/privacidad', ShieldCheck],
  ['Documentos legales', '/admin/legal', ScrollText],
  ['Artículos y políticas', '/admin/politicas', Package],
  ['Logística y tarifas', '/admin/logistica', Settings],
  ['Roles y permisos', '/admin/roles', ShieldCheck],
  ['Analítica', '/admin/analitica', ChartNoAxesCombined],
  ['Monitoreo', '/admin/monitoreo', ShieldCheck],
  ['Auditoría', '/admin/auditoria', ScrollText],
  ['Configuración', '/admin/configuracion', Settings],
  ['Mi cuenta', '/admin/cuenta', Users],
] as const;

const merchantNavigation = [
  ['Dashboard', '/comercio', LayoutDashboard],
  ['Pedidos', '/comercio/pedidos', ClipboardList],
  ['Productos', '/comercio/productos', Package],
  ['Historial', '/comercio/historial', History],
  ['Repartidores', '/comercio/repartidores', Bike],
  ['Métricas', '/comercio/metricas', ChartNoAxesCombined],
  ['Notificaciones', '/comercio/notificaciones', Bell],
  ['Configuración', '/comercio/configuracion', Settings],
  ['Mi cuenta', '/comercio/cuenta', Users],
] as const;

export function DashboardShell({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: 'admin' | 'merchant';
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const profile = useQuery({ queryKey: ['own-profile'], queryFn: () => apiRequest<{ firstName: string; lastName: string; emailVerifiedAt: string | null }>('/api/backend/users/auth/profile') });
  const unread = useQuery({ queryKey: ['own-unread'], queryFn: () => apiRequest<{ count: number }>('/api/backend/notifications/notifications/unread-count'), refetchInterval: 30_000 });
  const navigation = variant === 'admin' ? adminNavigation : merchantNavigation;

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/login');
  }

  const sidebar = (
    <div className={variant === 'merchant' ? 'flex h-full flex-col border-r border-slate-200 bg-white text-[#1e194b]' : 'flex h-full flex-col bg-[#071a2f] text-white'}>
      <div className="flex h-20 items-center justify-between border-b border-white/8 px-5">
        <Link
          href={variant === 'admin' ? '/admin' : '/comercio'}
          className="flex min-w-0 items-center gap-3"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-400 font-black text-[#071a2f]">
            D
          </span>
          {!collapsed && (
            <span className="truncate text-base font-extrabold leading-4">
              DeliverEats
              <small className="mt-1 block text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">
                {variant === 'admin' ? 'Administración' : 'Portal comercio'}
              </small>
            </span>
          )}
        </Link>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg p-2 text-slate-400 lg:hidden"
          aria-label="Cerrar menú"
        >
          <X className="size-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {navigation.map(([label, href, Icon]) => {
          const active =
            pathname === href ||
            (href !== `/${variant === 'admin' ? 'admin' : 'comercio'}` &&
              pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              onClick={() => setOpen(false)}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${
                active
                  ? (variant === 'merchant' ? 'bg-[#1e194b] text-white' : 'bg-amber-400 text-[#071a2f]')
                  : (variant === 'merchant' ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-300 hover:bg-white/7 hover:text-white')
              }`}
            >
              <Icon className="size-[18px] shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/8 p-3">
        <button
          onClick={logout}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-slate-300 transition hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut className="size-[18px]" /> {!collapsed && 'Cerrar sesión'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f7fa] lg:flex">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 -translate-x-full transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? 'translate-x-0' : ''} ${collapsed ? 'lg:w-[84px]' : 'lg:w-72'}`}
      >
        {sidebar}
      </aside>
      {open && (
        <button
          className="fixed inset-0 z-40 bg-[#071a2f]/55 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
        />
      )}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="rounded-xl border border-slate-200 p-2.5 text-slate-600 lg:hidden"
              aria-label="Abrir menú"
            >
              <Menu className="size-5" />
            </button>
            <button
              onClick={() => setCollapsed((current) => !current)}
              className="hidden rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50 lg:block"
              aria-label="Colapsar barra lateral"
            >
              <ChevronLeft
                className={`size-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
              />
            </button>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.15em] text-amber-600">
                Ayacucho en vivo
              </p>
              <p className="mt-1 text-sm font-bold text-slate-500">{new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={variant === 'admin' ? '/admin/notificaciones' : '/comercio/notificaciones'}
              className="relative rounded-xl border border-slate-200 p-2.5 text-slate-500"
              aria-label="Notificaciones"
            >
              <Bell className="size-5" />
              {!!unread.data?.count && <span className="absolute -right-1 -top-1 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-indigo-950">{unread.data.count}</span>}
            </Link>
            <Link href={variant === 'admin' ? '/admin/cuenta' : '/comercio/cuenta'} className="hidden items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 sm:flex">
              <span className="grid size-9 place-items-center rounded-lg bg-[#0c2747] text-xs font-extrabold text-white">
                {profile.data ? `${profile.data.firstName[0]}${profile.data.lastName[0]}` : '—'}
              </span>
              <span className="pr-2 text-sm font-extrabold text-[#071a2f]">
                {profile.data ? `${profile.data.firstName} ${profile.data.lastName}` : 'Cargando cuenta…'}
              </span>
            </Link>
          </div>
        </header>
        <main className="p-5 sm:p-8 xl:p-10">
          {profile.data && !profile.data.emailVerifiedAt && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">Verifica tu correo antes de realizar operaciones. <Link href="/auth/verify" className="font-bold underline">Ingresar código</Link><button className="ml-4 font-semibold underline" onClick={() => apiRequest('/api/backend/users/auth/resend-verification', { method: 'POST' }).then(() => window.alert('Revisa tu correo.')).catch(error => window.alert(error.message))}>Reenviar correo</button></div>}
          {children}
        </main>
      </div>
    </div>
  );
}

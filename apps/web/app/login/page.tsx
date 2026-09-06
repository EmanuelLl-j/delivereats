'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Bike, Building2, Eye, EyeOff, MapPin, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const schema = z.object({
  email: z.email('Ingresa un correo válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

type LoginValues = z.infer<typeof schema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: 'comercio@delivereats.local', password: 'Demo12345!' },
  });

  async function onSubmit(values: LoginValues) {
    setServerError('');
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    const body = (await response.json()) as { message?: string; role?: string };
    if (!response.ok) {
      setServerError(body.message ?? 'No fue posible iniciar sesión');
      return;
    }
    window.location.assign(body.role === 'ADMIN' ? '/admin' : '/comercio');
  }

  const highlights = [
    { Icon: Building2, value: '4', label: 'comercios demo' },
    { Icon: Bike, value: 'GPS', label: 'seguimiento vivo' },
    { Icon: ShieldCheck, value: '4 roles', label: 'acceso seguro' },
  ];

  return (
    <main className="min-h-screen bg-[#071a2f] lg:grid lg:grid-cols-[1.08fr_.92fr]">
      <section className="brand-grid relative hidden min-h-screen overflow-hidden px-16 py-14 text-white lg:flex lg:flex-col">
        <div className="absolute -left-40 top-1/3 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute -right-24 -top-20 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative flex items-center gap-3 text-xl font-extrabold tracking-tight">
          <span className="grid size-11 place-items-center rounded-2xl bg-amber-400 text-[#071a2f] shadow-lg shadow-amber-400/20">
            D
          </span>
          DeliverEats <span className="font-medium text-white/45">Ayacucho</span>
        </div>
        <div className="relative my-auto max-w-2xl pb-8">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-amber-300">
            <MapPin className="size-4" /> Hecho para Huamanga
          </div>
          <h1 className="text-5xl font-extrabold leading-[1.08] tracking-[-.045em] xl:text-6xl">
            Pedidos locales,
            <br /> operados <span className="text-amber-400">en tiempo real.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-300">
            Una sola plataforma para coordinar comercios, repartidores y cada entrega de Ayacucho
            con trazabilidad completa.
          </p>
          <div className="mt-12 grid max-w-xl grid-cols-3 gap-4">
            {highlights.map(({ Icon, value, label }) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/[.055] p-4 backdrop-blur"
              >
                <Icon className="mb-5 size-5 text-amber-400" />
                <div className="text-lg font-extrabold">{value}</div>
                <div className="mt-1 text-xs text-slate-400">{label}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/35">PDGP-PN · Demostración académica avanzada</p>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-white px-6 py-12 sm:px-12">
        <div className="w-full max-w-[440px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-400 font-black text-[#071a2f]">
              D
            </span>
            <span className="text-lg font-extrabold text-[#071a2f]">DeliverEats Ayacucho</span>
          </div>
          <p className="text-sm font-extrabold uppercase tracking-[.18em] text-amber-600">
            Portal de operaciones
          </p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-[-.04em] text-[#071a2f]">
            Bienvenido de vuelta
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Ingresa con tu cuenta de comercio o administración.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-9 space-y-5" noValidate>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Correo electrónico
              </span>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                className="focus-ring h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white"
              />
              {errors.email && (
                <span className="mt-1.5 block text-xs font-semibold text-red-600">
                  {errors.email.message}
                </span>
              )}
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Contraseña</span>
              <span className="relative block">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="focus-ring h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-12 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="focus-ring absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
              {errors.password && (
                <span className="mt-1.5 block text-xs font-semibold text-red-600">
                  {errors.password.message}
                </span>
              )}
            </label>
            {serverError && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
              >
                {serverError}
              </div>
            )}
            <button
              disabled={isSubmitting}
              className="focus-ring group flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#0c2747] px-5 text-sm font-extrabold text-white shadow-lg shadow-[#0c2747]/15 transition hover:bg-[#12385f] disabled:cursor-wait disabled:opacity-60"
            >
              {isSubmitting ? 'Verificando…' : 'Ingresar a la plataforma'}
              {!isSubmitting && (
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              )}
            </button>
          </form>

          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs leading-5 text-amber-900">
            <strong className="block text-sm">Acceso de demostración</strong>
            comercio@delivereats.local · Demo12345!
          </div>
        </div>
      </section>
    </main>
  );
}

'use client';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { apiRequest, json } from '../../../lib/api';

const actions: Record<string, { title: string; description: string; endpoint: string; fields: Array<[string, string, string]> }> = {
  register: { title: 'Tu negocio en DeliverEats', description: 'Crea tu cuenta. Después podrás enviar los datos y documentos de tu comercio para revisión.', endpoint: 'register', fields: [['firstName', 'Nombres', 'text'], ['lastName', 'Apellidos', 'text'], ['email', 'Correo electrónico', 'email'], ['password', 'Contraseña (mínimo 12 caracteres)', 'password']] },
  forgot: { title: 'Recupera tu cuenta', description: 'Si el correo está registrado, recibirás instrucciones de recuperación.', endpoint: 'forgot-password', fields: [['email', 'Correo electrónico', 'email']] },
  reset: { title: 'Nueva contraseña', description: 'Usa el código recibido por correo. El enlace vence después de 30 minutos y solo puede utilizarse una vez.', endpoint: 'reset-password', fields: [['token', 'Código de recuperación', 'text'], ['newPassword', 'Nueva contraseña (mínimo 12 caracteres)', 'password']] },
  verify: { title: 'Verifica tu correo', description: 'Confirma que el correo de tu cuenta te pertenece antes de realizar operaciones.', endpoint: 'verify-email', fields: [['token', 'Código de verificación', 'text']] },
};
export default function AuthActionPage({ params }: { params: Promise<{ action: string }> }) {
  const { action } = use(params);
  const config = actions[action];
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (token) { setValues(current => ({ ...current, token })); window.history.replaceState(null, '', window.location.pathname); }
  }, []);
  if (!config) return <main className="p-10">Página no disponible. <Link href="/login">Volver al ingreso</Link></main>;
  async function submit(event: React.FormEvent) {
    if (!config) return;
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const result = await apiRequest<{ message?: string }>('/api/public/auth/' + config.endpoint, json('POST', values));
      if (action === 'register') window.location.assign('/comercio/configuracion');
      else setMessage(result.message ?? (action === 'verify' ? 'Correo verificado. Ya puedes continuar en tu cuenta.' : 'Contraseña actualizada. Inicia sesión con la nueva contraseña.'));
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo completar la solicitud'); }
    finally { setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-[#f4f5fa] p-6"><section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
    <Link href="/login" className="text-xl font-black text-indigo-950">DeliverEats <span className="font-medium text-slate-400">Biz</span></Link>
    <h1 className="mt-9 text-3xl font-extrabold tracking-tight">{config.title}</h1><p className="mt-3 text-sm leading-6 text-slate-500">{config.description}</p>
    <form onSubmit={submit} className="mt-7 space-y-4">
      {config.fields.map(([name, label, type]) => <label className="block text-sm font-semibold" key={name}>{label}<input required name={name} type={type} autoComplete={type === 'password' ? 'new-password' : name === 'email' ? 'email' : 'off'} minLength={type === 'password' ? 12 : undefined} maxLength={type === 'password' ? 72 : 150} value={values[name] ?? ''} onChange={e => setValues(current => ({ ...current, [name]: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-indigo-500" /></label>)}
      {action === 'register' && <p className="text-xs leading-5 text-slate-500">La contraseña debe incluir mayúscula, minúscula, número y símbolo. La revisión comercial no es automática. <Link className="text-indigo-800 underline" href="/legal">Consultar términos y privacidad.</Link></p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-indigo-950 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? 'Enviando…' : 'Continuar'}</button>
    </form><Link href="/login" className="mt-6 block text-center text-sm font-semibold text-indigo-900">Volver al ingreso</Link>
  </section></main>;
}

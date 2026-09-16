import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function PaymentReturn({ params }: { params: Promise<{ resultado: string }> }) {
  const { resultado } = await params;
  const messages: Record<string, { title: string; description: string }> = {
    exito: { title: 'Regresaste del proveedor de pagos', description: 'Estamos esperando la verificación del pago en el servidor. Esta pantalla no acredita ni aprueba un cobro.' },
    pendiente: { title: 'Pago pendiente de verificación', description: 'El proveedor todavía puede estar procesando tu operación. No vuelvas a pagar sin revisar antes el estado del pedido.' },
    error: { title: 'El pago no se completó en el proveedor', description: 'Revisa el estado actualizado en tu pedido antes de intentarlo otra vez. Si existe un cargo, registra una consulta de soporte.' },
  };
  const message = messages[resultado];
  if (!message) notFound();
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><section className="w-full max-w-lg space-y-5 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"><p className="text-sm font-bold text-indigo-900">DeliverEats Ayacucho</p><h1 className="text-2xl font-extrabold text-slate-900">{message.title}</h1><p className="leading-7 text-slate-600">{message.description}</p><p className="text-sm text-slate-600">Vuelve a la aplicación DeliverEats Cliente → Mis pedidos. Solo allí se muestra el estado verificado de tu operación.</p><Link href="delivereats-client://orders" className="inline-block rounded-xl bg-indigo-950 px-5 py-3 font-bold text-white">Abrir aplicación cliente</Link><p className="text-xs text-slate-500">Si no se abre automáticamente, cambia a la aplicación desde tu dispositivo.</p></section></main>;
}

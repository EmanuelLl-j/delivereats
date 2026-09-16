'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { apiRequest, ApiError } from '@/lib/api';
import { OperationForm, OperationsTable, type FieldSpec, type RecordData } from '@/components/operations-ui';
import { ErrorPanel, LoadingPanel, PageHeading } from '@/components/ui';
type Category = RecordData & { id: string; name: string; isActive: boolean; products: RecordData[] };
type Merchant = { id: string; categories: Category[] };
export default function ProductsPage() {
  const [creating, setCreating] = useState(false);
  const merchant = useQuery({ queryKey: ['merchant-catalog'], queryFn: async () => { try { return await apiRequest<Merchant>('/api/backend/orders/commerce/me'); } catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; } } });
  if (merchant.isLoading) return <LoadingPanel />;
  if (merchant.isError) return <ErrorPanel message={merchant.error.message} />;
  if (!merchant.data) return <Link href="/comercio/configuracion" className="font-bold underline">Completa tu afiliación para gestionar un catálogo.</Link>;
  const own = merchant.data;
  const fields: FieldSpec[] = [
    { name: 'name', label: 'Nombre del producto', min: 2, max: 140 },
    { name: 'categoryId', label: 'Categoría', type: 'select', options: own.categories.filter(row => row.isActive).map(row => ({ value: row.id, label: row.name })) },
    { name: 'description', label: 'Descripción', type: 'textarea', min: 5, max: 1000 },
    { name: 'price', label: 'Precio en soles', type: 'number', min: 0.01, max: 10000 },
    { name: 'imageUrl', label: 'Imagen real del producto', type: 'file', purpose: 'PRODUCT', store: 'url', optional: true },
  ];
  const products = own.categories.flatMap(category => category.products.map(product => ({ ...product, categoryId: category.id, category: category.name })));
  return <div className="space-y-6">
    <PageHeading eyebrow="Mi comercio" title="Productos y categorías" description="Fotos, precios y disponibilidad de tu catálogo. Los pedidos conservan el precio e información con que se compraron." action={<button className="rounded-xl bg-indigo-950 px-5 py-3 text-sm font-bold text-white" onClick={() => setCreating(value => !value)}>{creating ? 'Cerrar formulario' : 'Nuevo producto'}</button>} />
    {creating && <section className="rounded-2xl border border-slate-200 bg-white p-6">{!own.categories.some(row => row.isActive) ? <p>Crea primero una categoría activa.</p> : <OperationForm fields={fields} endpoint={'/api/backend/orders/merchants/' + own.id + '/products'} method="POST" label="Crear producto" onSuccess={() => setCreating(false)} />}</section>}
    <details className="rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer font-bold text-indigo-950">Gestionar categorías</summary><div className="mt-5 space-y-6">
      <OperationForm fields={[{ name: 'name', label: 'Nueva categoría', min: 2, max: 80 }, { name: 'sortOrder', label: 'Orden', type: 'number', optional: true }]} endpoint={'/api/backend/orders/merchants/' + own.id + '/categories'} method="POST" label="Crear categoría" />
      {own.categories.map(row => <details key={row.id} className="border-t border-slate-100 pt-4"><summary>{row.name} · {row.isActive ? 'Activa' : 'Archivada'}</summary><div className="pt-4"><OperationForm initial={row} fields={[{ name: 'name', label: 'Nombre', min: 2, max: 80 }, { name: 'sortOrder', label: 'Orden', type: 'number' }, { name: 'isActive', label: 'Categoría activa', type: 'checkbox', hint: 'Archivar desactiva sus productos; reactivar no los publica automáticamente.' }]} endpoint={'/api/backend/orders/merchants/categories/' + row.id} /></div></details>)}
    </div></details>
    <OperationsTable rows={products} columns={[['Producto','name'],['Categoría','category'],['Precio S/','price'],['Disponible','isAvailable']]} details={row => <div className="space-y-5">{typeof row.imageUrl === 'string' && row.imageUrl.startsWith('/api/users/files/public/') && <img src={row.imageUrl} alt={String(row.name)} className="h-40 w-48 rounded-xl object-cover" />}<OperationForm initial={row} fields={[...fields, { name: 'isAvailable', label: 'Disponible para pedidos', type: 'checkbox' }]} endpoint={'/api/backend/orders/merchants/products/' + row.id} /></div>} />
  </div>;
}

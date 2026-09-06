'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PackagePlus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ErrorPanel, LoadingPanel, PageHeading, StatusBadge } from '@/components/ui';

type Product = {
  id: string;
  name: string;
  description: string;
  price: string;
  isAvailable: boolean;
  imageUrl?: string;
};
type Category = { id: string; name: string; products: Product[] };
type Merchant = { id: string; name: string; categories: Category[] };

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '', categoryId: '' });
  const client = useQueryClient();
  const merchant = useQuery({
    queryKey: ['merchant-catalog'],
    queryFn: async () => {
      const response = await fetch('/api/backend/orders/commerce/me');
      if (!response.ok) throw new Error('Request failed');
      return response.json() as Promise<Merchant>;
    },
  });
  const toggle = useMutation({
    mutationFn: async (product: Product) => {
      const response = await fetch(`/api/backend/orders/merchants/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isAvailable: !product.isAvailable }),
      });
      if (!response.ok) throw new Error('Update failed');
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['merchant-catalog'] }),
  });
  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/backend/orders/merchants/${merchant.data!.id}/products`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, price: Number(form.price) }),
      });
      if (!response.ok) throw new Error('Create failed');
    },
    onSuccess: () => {
      setCreating(false);
      setForm({ name: '', description: '', price: '', categoryId: '' });
      client.invalidateQueries({ queryKey: ['merchant-catalog'] });
    },
  });
  const products = useMemo(
    () =>
      merchant.data?.categories
        .flatMap((category) =>
          category.products.map((product) => ({ ...product, category: category.name })),
        )
        .filter((product) => product.name.toLowerCase().includes(search.toLowerCase())) ?? [],
    [merchant.data, search],
  );
  if (merchant.isLoading) return <LoadingPanel />;
  if (merchant.isError) return <ErrorPanel />;

  return (
    <>
      <PageHeading
        eyebrow="Catálogo"
        title="Productos"
        description="Gestiona precios y disponibilidad sin alterar el historial de pedidos."
        action={
          <button
            onClick={() => setCreating((value) => !value)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0c2747] px-4 py-3 text-xs font-extrabold text-white"
          >
            <PackagePlus className="size-4" /> Nuevo producto
          </button>
        }
      />
      {creating && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
          className="mb-6 grid gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 md:grid-cols-2 xl:grid-cols-5"
        >
          <input
            required
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-11 rounded-lg border border-amber-200 bg-white px-3 text-sm outline-none"
          />
          <input
            required
            placeholder="Descripción"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="h-11 rounded-lg border border-amber-200 bg-white px-3 text-sm outline-none xl:col-span-2"
          />
          <input
            required
            type="number"
            min="0.1"
            step="0.01"
            placeholder="Precio S/"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="h-11 rounded-lg border border-amber-200 bg-white px-3 text-sm outline-none"
          />
          <select
            required
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            className="h-11 rounded-lg border border-amber-200 bg-white px-3 text-sm outline-none"
          >
            <option value="">Categoría</option>
            {merchant.data!.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button
            disabled={create.isPending}
            className="h-11 rounded-lg bg-amber-500 px-4 text-xs font-extrabold text-[#071a2f] md:col-span-2 xl:col-span-5"
          >
            {create.isPending ? 'Guardando…' : 'Crear producto'}
          </button>
        </form>
      )}
      <div className="mb-5 flex max-w-md items-center gap-3 rounded-xl border border-slate-200 bg-white px-4">
        <Search className="size-4 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar productos"
          className="h-12 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {products.map((product) => (
          <article
            key={product.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="grid h-36 place-items-center bg-gradient-to-br from-[#eaf0f6] to-slate-50 text-5xl">
              {product.category === 'Botiquín' ? '💊' : product.category === 'Packs' ? '🛒' : '🍽️'}
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-amber-600">
                    {product.category}
                  </p>
                  <h2 className="mt-1 text-base font-extrabold text-[#071a2f]">{product.name}</h2>
                </div>
                <StatusBadge value={product.isAvailable ? 'ACTIVE' : 'SUSPENDED'} />
              </div>
              <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">
                {product.description}
              </p>
              <div className="mt-5 flex items-center justify-between">
                <span className="text-xl font-extrabold text-[#071a2f]">
                  S/ {Number(product.price).toFixed(2)}
                </span>
                <button
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate(product)}
                  className={`rounded-lg px-3 py-2 text-xs font-extrabold ${product.isAvailable ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
                >
                  {product.isAvailable ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

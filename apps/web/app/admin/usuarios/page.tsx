'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserRoundCheck } from 'lucide-react';
import { useState } from 'react';
import { ErrorPanel, LoadingPanel, PageHeading, StatusBadge } from '@/components/ui';
import { apiRequest, json } from '@/lib/api';

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  createdAt: string;
};

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const users = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () => apiRequest<User[]>(`/api/backend/users/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  });
  const status = useMutation({
    mutationFn: async (user: User) => {
      return apiRequest(`/api/backend/users/users/${user.id}/status`, json('PATCH', { status: user.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED' }));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  return (
    <>
      <PageHeading
        eyebrow="Administración"
        title="Usuarios"
        description="Busca, revisa y controla el acceso sin exponer credenciales ni datos sensibles."
      />
      <div className="mb-5 flex max-w-md items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 shadow-sm">
        <Search className="size-4 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre o correo"
          className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {status.isError && <ErrorPanel message={status.error.message} />}
      {users.isLoading ? (
        <LoadingPanel />
      ) : users.isError ? (
        <ErrorPanel message={users.error.message} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-[.1em] text-slate-400">
                <tr>
                  <th className="px-5 py-4">Usuario</th>
                  <th className="px-5 py-4">Rol</th>
                  <th className="px-5 py-4">Estado</th>
                  <th className="px-5 py-4">Registro</th>
                  <th className="px-5 py-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.data!.map((user) => (
                  <tr key={user.id} className="text-sm">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 place-items-center rounded-xl bg-[#eaf0f6] font-extrabold text-[#0c2747]">
                          {user.firstName[0]}
                          {user.lastName[0]}
                        </span>
                        <div>
                          <p className="font-extrabold text-[#071a2f]">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-600">{user.role}</td>
                    <td className="px-5 py-4">
                      <StatusBadge value={user.status} />
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-400">
                      {new Date(user.createdAt).toLocaleDateString('es-PE')}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        disabled={status.isPending || user.status === 'DELETED'}
                        onClick={() => status.mutate(user)}
                        className={`rounded-lg px-3 py-2 text-xs font-extrabold ${user.status === 'SUSPENDED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
                      >
                        {user.status === 'SUSPENDED' ? 'Reactivar' : 'Suspender'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!users.data!.length && (
            <div className="grid place-items-center p-12 text-center">
              <UserRoundCheck className="mb-3 size-8 text-slate-300" />
              <p className="text-sm font-bold text-slate-400">No encontramos usuarios.</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

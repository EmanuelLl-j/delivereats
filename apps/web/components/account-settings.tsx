'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { LegalAcceptance } from './legal-acceptance';
import { OperationForm, OperationsTable, type RecordData, quietButton } from './operations-ui';
import { ErrorPanel, LoadingPanel, PageHeading } from './ui';
export function AccountSettings() {
  const [section, setSection] = useState('profile');
  const profile = useQuery({ queryKey: ['own-profile'], queryFn: () => apiRequest<RecordData>('/api/backend/users/auth/profile') });
  const tickets = useQuery({ queryKey: ['own-support'], queryFn: () => apiRequest<RecordData[]>('/api/backend/users/support/tickets'), enabled: section === 'support' });
  const privacy = useQuery({ queryKey: ['own-privacy'], queryFn: () => apiRequest<RecordData[]>('/api/backend/users/privacy/requests'), enabled: section === 'privacy' });
  const consent = useQuery({ queryKey: ['own-consent'], queryFn: () => apiRequest<RecordData>('/api/backend/users/privacy/consent'), enabled: section === 'privacy' });
  const download = useMutation({ mutationFn: async () => { const data = await apiRequest('/api/backend/users/privacy/export'); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'delivereats-mis-datos.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } });
  if (profile.isLoading) return <LoadingPanel />;
  if (profile.isError) return <ErrorPanel message={profile.error.message} />;
  return <div className="space-y-6"><PageHeading eyebrow="Cuenta personal" title="Tu cuenta" description="Tus datos, seguridad y solicitudes. Nunca compartas tu contraseña con soporte." />
    <nav className="flex flex-wrap gap-2">{[['profile','Mi perfil'],['security','Seguridad'],['legal','Términos'],['privacy','Privacidad'],['support','Ayuda']].map(([value,label]) => <button key={value} className={quietButton + (section === value ? ' ring-2 ring-indigo-800' : '')} onClick={() => setSection(value!)}>{label}</button>)}</nav>
    <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
      {section === 'profile' && <><p className="text-sm text-slate-500">{String(profile.data?.email ?? '')}</p><OperationForm key={String(profile.data?.id)} initial={profile.data} endpoint="/api/backend/users/auth/profile" fields={[{ name:'firstName',label:'Nombres',min:2,max:80 },{ name:'lastName',label:'Apellidos',min:2,max:80 },{ name:'phone',label:'Celular',optional:true },{ name:'avatarUrl',label:'Foto de perfil',type:'file',purpose:'AVATAR',store:'url',optional:true }]} /></>}
      {section === 'security' && <><p className="text-sm text-slate-500">Mínimo 12 caracteres, mayúscula, minúscula, número y símbolo. Se cerrarán todas las sesiones.</p><OperationForm method="POST" endpoint="/api/backend/users/auth/change-password" label="Cambiar contraseña" fields={[{ name:'currentPassword',label:'Contraseña actual',type:'password' },{ name:'newPassword',label:'Nueva contraseña',type:'password',min:12,max:72 }]} onSuccess={() => { void fetch('/api/auth/logout', { method:'POST' }).finally(() => window.location.assign('/login')); }} /></>}
      {section === 'legal' && <LegalAcceptance types={['GENERAL_TERMS','PRIVACY_POLICY', ...(profile.data?.role === 'MERCHANT' ? ['MERCHANT_TERMS'] : [])]} />}
      {section === 'privacy' && <>
        <button className={quietButton} disabled={download.isPending} onClick={() => download.mutate()}>Descargar mis datos</button>{download.isError && <ErrorPanel message={download.error.message} />}
        {consent.data && <OperationForm initial={consent.data} endpoint="/api/backend/users/privacy/consent" fields={[{ name:'marketing',label:'Acepto comunicaciones promocionales (opcional)',type:'checkbox' }]} />}
        <OperationForm method="POST" endpoint="/api/backend/users/privacy/requests" label="Registrar solicitud" fields={[{ name:'type',label:'Tipo',type:'select',options:[{ value:'ACCESS',label:'Acceso' },{ value:'CORRECTION',label:'Rectificación' },{ value:'DELETION',label:'Eliminar cuenta' },{ value:'OBJECTION',label:'Oposición' }] },{ name:'description',label:'Describe tu solicitud',type:'textarea',min:10,max:3000 }]} />
        {privacy.isError ? <ErrorPanel message={privacy.error.message} /> : <OperationsTable rows={privacy.data ?? []} columns={[["Solicitud","type"],["Estado","status"],["Respuesta","resolution"]]} />}
      </>}
      {section === 'support' && <><OperationForm method="POST" endpoint="/api/backend/users/support/tickets" label="Enviar consulta" initial={{ type:'SUPPORT' }} fields={[{ name:'type',label:'Tipo',type:'select',options:['SUPPORT','INCIDENT'] },{ name:'subject',label:'Asunto',min:5,max:160 },{ name:'description',label:'Descripción',type:'textarea',min:10,max:3000 }]} />{tickets.isError ? <ErrorPanel message={tickets.error.message} /> : <OperationsTable rows={tickets.data ?? []} columns={[["Asunto","subject"],["Estado","status"],["Respuesta","response"]]} />}</>}
    </section>
  </div>;
}

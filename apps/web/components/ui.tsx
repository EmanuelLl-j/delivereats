import type { LucideIcon } from 'lucide-react';

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[.18em] text-amber-600">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-.035em] text-[#071a2f] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'navy',
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone?: 'navy' | 'amber' | 'green' | 'blue';
}) {
  const colors = {
    navy: 'bg-[#eaf0f6] text-[#0c2747]',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-emerald-100 text-emerald-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/[.025]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.11em] text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-extrabold tracking-[-.04em] text-[#071a2f]">{value}</p>
          <p className="mt-2 text-xs font-semibold text-slate-400">{hint}</p>
        </div>
        <span className={`grid size-11 place-items-center rounded-xl ${colors[tone]}`}>
          <Icon className="size-5" />
        </span>
      </div>
    </article>
  );
}

export function LoadingPanel() {
  return <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />;
}

export function ErrorPanel({
  message = 'No fue posible cargar los datos. Verifica que los servicios estén activos.',
}: {
  message?: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700"
    >
      {message}
    </div>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const tone =
    value.includes('DELIVERED') ||
    value.includes('APPROVED') ||
    value.includes('ACTIVE') ||
    value.includes('AVAILABLE')
      ? 'bg-emerald-100 text-emerald-700'
      : value.includes('CANCEL') || value.includes('REJECT') || value.includes('SUSPEND')
        ? 'bg-red-100 text-red-700'
        : value.includes('PENDING') || value.includes('SEARCH')
          ? 'bg-amber-100 text-amber-700'
          : 'bg-blue-100 text-blue-700';
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${tone}`}
    >
      {value.replaceAll('_', ' ')}
    </span>
  );
}

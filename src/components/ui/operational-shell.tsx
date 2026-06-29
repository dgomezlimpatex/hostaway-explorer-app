import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, LucideIcon, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface OperationalPageShellProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const OperationalPageShell = ({
  eyebrow = 'Gestión Limpatex',
  title,
  description,
  children,
  actions,
  className,
}: OperationalPageShellProps) => (
  <div className={cn('min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(49,9,132,0.12),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-3 py-4 text-slate-950 sm:px-6 lg:px-8', className)}>
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/86 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur md:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-[3rem] bg-gradient-to-br from-[#310984]/18 via-fuchsia-300/25 to-cyan-300/20 blur-2xl" />
        <div className="pointer-events-none absolute right-10 top-7 hidden h-20 w-20 rotate-12 rounded-3xl border border-white/70 bg-gradient-to-br from-white to-violet-100 shadow-2xl lg:block" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#310984]/15 bg-[#310984]/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#310984]">
              <Sparkles className="h-3.5 w-3.5" />
              {eyebrow}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="relative flex flex-wrap gap-2">{actions}</div>}
        </div>
      </section>
      {children}
    </div>
  </div>
);

interface OperationalMetricCardProps {
  label: string;
  value: React.ReactNode;
  detail?: string;
  icon: LucideIcon;
  tone?: 'purple' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate';
  className?: string;
}

const toneClasses = {
  purple: 'border-violet-200/70 bg-violet-50/80 text-violet-950 shadow-violet-950/5',
  cyan: 'border-cyan-200/70 bg-cyan-50/80 text-cyan-950 shadow-cyan-950/5',
  emerald: 'border-emerald-200/70 bg-emerald-50/80 text-emerald-950 shadow-emerald-950/5',
  amber: 'border-amber-200/70 bg-amber-50/80 text-amber-950 shadow-amber-950/5',
  rose: 'border-rose-200/70 bg-rose-50/80 text-rose-950 shadow-rose-950/5',
  slate: 'border-slate-200/70 bg-white/85 text-slate-950 shadow-slate-950/5',
};

export const OperationalMetricCard = ({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'slate',
  className,
}: OperationalMetricCardProps) => (
  <div className={cn('group relative overflow-hidden rounded-3xl border p-4 shadow-lg transition duration-200 hover:-translate-y-0.5 hover:shadow-xl', toneClasses[tone], className)}>
    <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-[2rem] bg-white/45 blur-xl transition group-hover:scale-110" />
    <div className="relative flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.16em] opacity-70">{label}</p>
        <p className="mt-2 text-3xl font-black tabular-nums tracking-tight">{value}</p>
        {detail && <p className="mt-1 text-xs font-semibold opacity-75">{detail}</p>}
      </div>
      <div className="rounded-2xl border border-white/70 bg-white/65 p-2 shadow-sm">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

interface OperationalEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'success' | 'warning' | 'neutral';
}

export const OperationalEmptyState = ({
  icon: Icon = CheckCircle2,
  title,
  description,
  actionLabel,
  onAction,
  tone = 'neutral',
}: OperationalEmptyStateProps) => (
  <div className={cn(
    'flex min-h-[240px] flex-col items-center justify-center rounded-3xl border border-dashed p-8 text-center',
    tone === 'success' && 'border-emerald-200 bg-emerald-50/70 text-emerald-950',
    tone === 'warning' && 'border-amber-200 bg-amber-50/70 text-amber-950',
    tone === 'neutral' && 'border-slate-200 bg-white/70 text-slate-950',
  )}>
    <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-sm">
      <Icon className="h-8 w-8" />
    </div>
    <h3 className="mt-4 text-lg font-black">{title}</h3>
    {description && <p className="mt-2 max-w-sm text-sm leading-6 opacity-75">{description}</p>}
    {actionLabel && onAction && (
      <Button className="mt-5 rounded-2xl" onClick={onAction}>
        {actionLabel}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    )}
  </div>
);

export const OperationalRiskBadge = ({ count, label = 'riesgos' }: { count: number; label?: string }) => {
  if (count <= 0) {
    return <Badge className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">Sin alertas</Badge>;
  }

  return (
    <Badge className="rounded-full border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-50" variant="outline">
      <AlertTriangle className="mr-1 h-3.5 w-3.5" />
      {count} {label}
    </Badge>
  );
};

export const OperationalLoadingState = ({ label = 'Cargando datos operativos...' }: { label?: string }) => (
  <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-white/70 bg-white/80 shadow-sm">
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm">
      <Clock3 className="h-4 w-4 animate-pulse text-[#310984]" />
      {label}
    </div>
  </div>
);

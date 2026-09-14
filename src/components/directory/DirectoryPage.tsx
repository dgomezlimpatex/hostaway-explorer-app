import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface DirectoryStat {
  label: string;
  value: number | string;
  helper: string;
  tone: 'sky' | 'green' | 'muted' | 'violet' | 'neutral';
}
const tones = {
  sky: 'border-sky-200 bg-sky-50 text-sky-950',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  muted: 'border-slate-200 bg-white text-slate-950',
  violet: 'border-violet-200 bg-violet-50 text-violet-950',
  neutral: 'border-slate-200 bg-white text-slate-950',
};

export function DirectoryPage({ title, eyebrow, description, icon: Icon, actions, stats, children, className }: {
  title: string; eyebrow: string; description: string; icon: LucideIcon;
  actions: ReactNode; stats: DirectoryStat[]; children: ReactNode; className?: string;
}) {
  return (
    <div className={cn('min-h-dvh overflow-x-hidden bg-slate-50 pb-24 text-slate-950 lg:pb-6', className)}>
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="hidden xl:inline-flex">
              <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Volver al menú</Link>
            </Button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#310984]">{eyebrow}</p>
              <h1 className="mt-0.5 flex items-center gap-2 text-2xl font-semibold tracking-tight"><Icon aria-hidden="true" className="h-6 w-6 text-slate-500" />{title}</h1>
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
      </header>
      <div className="mx-auto max-w-[1800px] space-y-4 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {stats.map(stat => (
            <Card key={stat.label} className={cn('p-4 shadow-sm', tones[stat.tone])}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{stat.value}</p>
              <p className="text-xs opacity-70">{stat.helper}</p>
            </Card>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

export function DirectorySearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input aria-label={placeholder} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} className="h-11 rounded-xl bg-white pl-10" />
    </div>
  );
}

export function DirectorySegments({ value, onChange, options }: {
  value: string; onChange: (value: string) => void; options: { value: string; label: string; count: number | string }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
      {options.map(option => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={cn(
          'rounded-lg px-1 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#310984] focus-visible:ring-offset-2',
          value === option.value ? 'bg-[#310984] text-white shadow-sm' : 'text-slate-600 hover:bg-white',
        )}>
          {option.label}<span className="mt-0.5 block text-[11px] tabular-nums opacity-75">{option.count}</span>
        </button>
      ))}
    </div>
  );
}

export function DirectoryEmpty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
      <Search className="mx-auto h-9 w-9 text-slate-300" />
      <h2 className="mt-3 font-bold text-slate-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-line break-words text-sm font-semibold text-slate-900">{children}</dd></div>;
}

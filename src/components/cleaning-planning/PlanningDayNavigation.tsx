import { addDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMadridDate, getTodayMadrid } from '@/utils/date';

interface PlanningDayNavigationProps {
  date: Date;
  disabled?: boolean;
  onChange: (date: Date) => void;
}

export function PlanningDayNavigation({ date, disabled, onChange }: PlanningDayNavigationProps) {
  return (
    <nav aria-label="Cambiar día del planning" className="mb-4 rounded-xl border border-line bg-white p-3 shadow-sober">
      <div className="flex flex-wrap items-center gap-2">
        <div className="grid min-w-0 w-full grid-cols-[44px_minmax(0,1fr)_44px] gap-2 sm:w-auto sm:grid-cols-[44px_190px_44px]">
          <Button variant="outline" className="h-11 w-11 p-0 focus-visible:ring-2 focus-visible:ring-brand" aria-label="Día anterior" disabled={disabled} onClick={() => onChange(addDays(date, -1))}><ChevronLeft className="h-5 w-5" /></Button>
          <input
            aria-label="Día del planning"
            type="date"
            value={formatMadridDate(date)}
            disabled={disabled}
            className="h-11 min-w-0 w-full rounded-lg border border-line bg-paper px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            onChange={(event) => {
              const value = event.target.value;
              if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
              const next = new Date(`${value}T12:00:00`);
              if (!Number.isNaN(next.getTime())) onChange(next);
            }}
          />
          <Button variant="outline" className="h-11 w-11 p-0 focus-visible:ring-2 focus-visible:ring-brand" aria-label="Día siguiente" disabled={disabled} onClick={() => onChange(addDays(date, 1))}><ChevronRight className="h-5 w-5" /></Button>
        </div>
        <Button variant="ghost" className="h-11 border border-line px-4 text-brand sm:border-0" disabled={disabled} onClick={() => onChange(getTodayMadrid())}>Hoy</Button>
        <p className="w-full text-xs text-ink-3 sm:ml-auto sm:w-auto">Cambiar de día no guarda el reparto.</p>
      </div>
    </nav>
  );
}

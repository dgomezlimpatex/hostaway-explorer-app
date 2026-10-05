import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Clock } from 'lucide-react';
import { useDashboardWeeklyWorkload } from '@/hooks/useDashboardWeeklyWorkload';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import type { DashboardHoursStatus } from '@/utils/dashboardWeeklyWorkload';

const colors: Record<DashboardHoursStatus, { bar: string; text: string }> = {
  covered: { bar: 'bg-green-500', text: 'text-green-700' },
  shortfall: { bar: 'bg-orange-500', text: 'text-orange-700' },
  critical: { bar: 'bg-red-500', text: 'text-red-700' },
  'no-contract': { bar: 'bg-zinc-400', text: 'text-muted-foreground' },
  partial: { bar: 'bg-zinc-400', text: 'text-muted-foreground' },
};
const hours = (value: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value);

export const WorkloadWidget = () => {
  const { data, isLoading, error, startDate, endDate } = useDashboardWeeklyWorkload();
  const orderedWorkers = [
    ...data.filter(worker => worker.contractHours > 0),
    ...data.filter(worker => worker.contractHours <= 0),
  ];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />Control de horas semanal
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {format(new Date(startDate + 'T12:00:00'), 'd MMM', { locale: es })} – {format(new Date(endDate + 'T12:00:00'), 'd MMM yyyy', { locale: es })}
          {' · Horas asignadas / horas de contrato'}
        </p>
        <p className="text-xs text-muted-foreground">Tareas asignadas y mantenimientos · Verde ≥ 100 % · Naranja 75–99 % · Rojo &lt; 75 %</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><LoadingSpinner size="sm" /></div>
        ) : error ? (
          <p role="alert" className="py-4 text-sm text-destructive">No se han podido cargar las horas semanales. Inténtalo de nuevo más tarde.</p>
        ) : data.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No hay trabajadores activos en esta sede.</p>
        ) : (
          <div className="space-y-4">
            {orderedWorkers.map(worker => (
              <div key={worker.cleanerId} className="grid items-center gap-2 sm:grid-cols-[minmax(160px,240px)_minmax(0,1fr)_auto]">
                <span className="break-words text-sm font-medium">{worker.cleanerName}</span>
                <Progress value={Math.min(worker.percentage, 100)} className="h-2" indicatorClassName={colors[worker.dashboardStatus].bar}
                  aria-label={worker.cleanerName + ': horas asignadas respecto al contrato'} />
                <div className={cn('text-sm font-semibold tabular-nums sm:text-right', colors[worker.dashboardStatus].text)}>
                  {hours(worker.assignedHours)} / {hours(worker.contractHours)} h
                  {worker.dashboardStatus === 'no-contract' && <span className="block text-xs font-normal">Sin horas de contrato</span>}
                  {worker.isPartial && <span className="block text-xs font-normal">Parcial: falta duración</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkloadWidget;

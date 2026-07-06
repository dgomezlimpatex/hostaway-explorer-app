import { AlertTriangle, CalendarDays, CheckCircle2, Eye, Flame } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PlanningBuildingCrmDay } from '@/types/operationalPlanning';
import { formatCrmDateLabel, formatCrmHours } from './buildingCrmFormatters';

interface BuildingDemandCalendarProps {
  days: PlanningBuildingCrmDay[];
}

const statusStyles: Record<PlanningBuildingCrmDay['status'], string> = {
  empty: 'border-slate-200 bg-white text-slate-500',
  covered: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  watch: 'border-amber-200 bg-amber-50 text-amber-900',
  critical: 'border-red-200 bg-red-50 text-red-900',
};

const statusIcon = {
  empty: Eye,
  covered: CheckCircle2,
  watch: AlertTriangle,
  critical: Flame,
};

export const BuildingDemandCalendar = ({ days }: BuildingDemandCalendarProps) => {
  const visibleDays = days.filter((day) => day.tasks.length > 0 || day.status !== 'empty');
  const calendarDays = visibleDays.length > 0 ? visibleDays : days.slice(0, 14);

  return (
    <Card className="border-[#310984]/10 bg-white shadow-sm shadow-[#310984]/5">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-[#171321]">
              <CalendarDays className="h-5 w-5 text-[#310984]" />
              Calendario de demanda
            </CardTitle>
            <p className="mt-1 text-sm text-[#6b627a]">Cada día separa Confirmado y Previsto para no mezclar tareas reales con forecast.</p>
          </div>
          <Badge variant="outline" className="w-fit border-[#310984]/15 bg-[#faf8ff] text-[#310984]">
            {days.length} días
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {calendarDays.map((day) => {
            const Icon = statusIcon[day.status];
            return (
              <article key={day.date} className={`min-h-[150px] rounded-2xl border p-3 ${statusStyles[day.status]}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{formatCrmDateLabel(day.date)}</p>
                    <p className="mt-1 text-lg font-bold">{day.confirmedCleanings + day.forecastCleanings}</p>
                  </div>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="mt-3 space-y-1 text-xs">
                  <p><span className="font-semibold">Confirmado:</span> {day.confirmedCleanings}</p>
                  <p><span className="font-semibold">Previsto:</span> {day.forecastCleanings}</p>
                  <p><span className="font-semibold">Servicio:</span> {formatCrmHours(day.serviceMinutes)}</p>
                  <p><span className="font-semibold">h-persona:</span> {formatCrmHours(day.personMinutes)}</p>
                </div>
                {day.warnings.length > 0 && (
                  <p className="mt-2 line-clamp-2 text-[11px] opacity-75">{day.warnings[0]}</p>
                )}
              </article>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

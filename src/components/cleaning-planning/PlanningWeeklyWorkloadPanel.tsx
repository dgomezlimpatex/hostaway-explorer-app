import { AlertTriangle, CheckCircle2, Clock3, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlanningWeeklyWorkload } from '@/utils/planningWeeklyWorkload';
import { formatMadridDate } from '@/utils/date';

interface PlanningWeeklyWorkloadPanelProps {
  rows: PlanningWeeklyWorkload[];
  startDate: string;
  endDate: string;
  isLoading?: boolean;
  isError?: boolean;
}

const formatHours = (hours: number) => `${hours.toFixed(1).replace('.0', '')} h`;

const statusForRow = (row: PlanningWeeklyWorkload) => {
  if (row.status === 'no-contract') return { label: 'Sin contrato', className: 'border-slate-300 bg-slate-50 text-slate-700' };
  if (row.status === 'overtime') return { label: `+${formatHours(row.overtimeHours)}`, className: 'border-red-200 bg-red-50 text-red-700' };
  if (row.status === 'near-limit') return { label: 'Cerca del límite', className: 'border-amber-200 bg-amber-50 text-amber-800' };
  return { label: 'En rango', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
};

export const PlanningWeeklyWorkloadPanel = ({ rows, startDate, endDate, isLoading, isError }: PlanningWeeklyWorkloadPanelProps) => (
  <Card className="border-[#310984]/10 bg-white shadow-sm" data-planning-weekly-workload>
    <CardHeader className="pb-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base text-[#171321]">
            <Users className="h-4 w-4 text-[#310984]" /> Carga semanal del equipo
          </CardTitle>
          <p className="mt-1 text-xs text-[#6b627a]">
            {formatMadridDate(new Date(`${startDate}T12:00:00`))} – {formatMadridDate(new Date(`${endDate}T12:00:00`))} · horas asignadas de limpiezas
          </p>
        </div>
        <span className="text-xs text-[#6b627a]">La casa grande se reparte entre sus personas</span>
      </div>
    </CardHeader>
    <CardContent className="space-y-2">
      {isLoading && <p className="text-sm text-[#6b627a]">Cargando horas semanales…</p>}
      {isError && <p className="text-sm text-red-700" role="alert">No pudimos cargar las horas semanales. Puedes continuar con la planificación diaria.</p>}
      {!isLoading && !isError && rows.length === 0 && <p className="text-sm text-[#6b627a]">No hay personal activo para mostrar.</p>}
      {!isLoading && !isError && rows.map((row) => {
        const status = statusForRow(row);
        const hasContract = row.contractHours > 0;
        const percentage = hasContract ? Math.min((row.assignedHours / row.contractHours) * 100, 100) : 0;
        return (
          <div key={row.cleanerId} className="rounded-xl border border-[#310984]/10 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#171321]">{row.cleanerName}</p>
                <p className="text-xs text-[#6b627a]">{row.assignedTaskCount} servicio{row.assignedTaskCount === 1 ? '' : 's'} asignado{row.assignedTaskCount === 1 ? '' : 's'}</p>
              </div>
              <Badge variant="outline" className={status.className}>{status.label}</Badge>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-[#171321]">
              <Clock3 className="h-3.5 w-3.5 text-[#310984]" />
              <strong>{formatHours(row.assignedHours)}</strong>
              <span className="text-[#6b627a]">/ {hasContract ? formatHours(row.contractHours) : 'sin horas de contrato'}</span>
              {row.status === 'overtime' ? <AlertTriangle className="ml-auto h-4 w-4 text-red-600" aria-label="Supera las horas de contrato" /> : row.status === 'on-track' ? <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" aria-label="Carga dentro de rango" /> : null}
            </div>
            {hasContract && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#efe9fb]" role="progressbar" aria-label={`Horas asignadas de ${row.cleanerName}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percentage)}>
                <div className={`h-full ${row.status === 'overtime' ? 'bg-red-500' : row.status === 'near-limit' ? 'bg-amber-400' : 'bg-[#310984]'}`} style={{ width: `${percentage}%` }} />
              </div>
            )}
            {row.missingDurationTaskCount > 0 && <p className="mt-1 text-xs text-amber-800">{row.missingDurationTaskCount} servicio{row.missingDurationTaskCount === 1 ? '' : 's'} sin duración de propiedad configurada.</p>}
          </div>
        );
      })}
    </CardContent>
  </Card>
);

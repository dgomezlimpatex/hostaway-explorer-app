import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CleanerPlanningDay } from '@/types/cleaningPlanning';
import { minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { BarChart3 } from 'lucide-react';

interface CleanerLoadTableProps {
  days: CleanerPlanningDay[];
}

const toneForUtilization = (utilization: number): string => {
  if (utilization >= 100) return 'bg-danger';
  if (utilization >= 85) return 'bg-ink';
  return 'bg-ink-4';
};

const legend = [
  { label: 'Con margen', className: 'bg-ink-4' },
  { label: 'Al límite', className: 'bg-ink' },
  { label: 'Sobrecarga', className: 'bg-danger' },
];

export const CleanerLoadTable = ({ days }: CleanerLoadTableProps) => (
  <Card className="border-line bg-white text-ink shadow-sober">
    <CardHeader className="border-b border-line">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg tracking-tight text-ink">
            <BarChart3 className="h-5 w-5 text-brand" /> Carga por trabajadora
          </CardTitle>
          <p className="mt-1 text-xs text-ink-3">Horas previstas por trabajadora en el periodo elegido.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-ink-3" aria-label="Leyenda de carga">
          {legend.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2 py-1">
              <span className={`h-2 w-2 rounded-full ${item.className}`} /> {item.label}
            </span>
          ))}
        </div>
      </div>
    </CardHeader>
    <CardContent className="p-0">
      <div className="overflow-x-auto" aria-label="Tabla de carga desplazable horizontalmente">
        <table className="w-full min-w-[680px] text-sm">
          <caption className="sr-only">Carga prevista por trabajadora en el periodo elegido</caption>
          <thead className="bg-paper text-xs uppercase tracking-wide text-ink-3">
            <tr>
              <th scope="col" className="sticky left-0 bg-paper px-4 py-3 text-left">Trabajadora</th>
              <th scope="col" className="px-4 py-3 text-left">Tareas</th>
              <th scope="col" className="px-4 py-3 text-left">Planificado</th>
              <th scope="col" className="px-4 py-3 text-left">Capacidad</th>
              <th scope="col" className="px-4 py-3 text-left">Carga</th>
              <th scope="col" className="px-4 py-3 text-left">Alertas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#310984]/10">
            {days.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-3">
                  No hay trabajadoras con tareas visibles. Prueba a limpiar filtros, cambiar rango o revisar sede activa.
                </td>
              </tr>
            ) : days.map((day) => {
              const overload = Math.max(day.utilizationPercent - 100, 0);
              return (
                <tr key={day.cleanerId} className="group hover:bg-paper">
                  <td className="sticky left-0 bg-white px-4 py-3 font-medium text-ink group-hover:bg-paper">{day.cleanerName}</td>
                  <td className="px-4 py-3 text-ink-3">{day.tasks.length}</td>
                  <td className="px-4 py-3 text-ink-3">{minutesToHoursLabel(day.plannedMinutes)}</td>
                  <td className="px-4 py-3 text-ink-3">{minutesToHoursLabel(day.capacityMinutes)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-28 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-label={`Carga de ${day.cleanerName}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(day.utilizationPercent, 100)}
                        aria-valuetext={`${day.utilizationPercent}% utilizado, ${minutesToHoursLabel(Math.max(day.capacityMinutes - day.plannedMinutes, 0))} libres`}
                      >
                        <div aria-hidden="true" className={`h-full ${toneForUtilization(day.utilizationPercent)}`} style={{ width: `${Math.min(day.utilizationPercent, 100)}%` }} />
                      </div>
                      <span className="w-10 shrink-0 text-right tabular-nums text-ink">{day.utilizationPercent}%</span>
                      {overload > 0 && <span className="text-xs font-medium text-danger">+{overload}%</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {day.riskFlags.length === 0 ? (
                      <Badge variant="outline" className="border-line bg-surface text-ink-2">OK</Badge>
                    ) : (
                      <Badge variant="outline" className="border-line bg-surface text-warning">{day.riskFlags.length} aviso(s)</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
);

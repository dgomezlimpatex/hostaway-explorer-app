import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CleanerPlanningDay } from '@/types/cleaningPlanning';
import { minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { BarChart3 } from 'lucide-react';

interface CleanerLoadTableProps {
  days: CleanerPlanningDay[];
}

const toneForUtilization = (utilization: number): string => {
  if (utilization >= 100) return 'bg-red-500';
  if (utilization >= 85) return 'bg-amber-400';
  if (utilization >= 55) return 'bg-emerald-500';
  return 'bg-sky-500';
};

const legend = [
  { label: 'Baja', className: 'bg-sky-500' },
  { label: 'Correcta', className: 'bg-emerald-500' },
  { label: 'Ajustada', className: 'bg-amber-400' },
  { label: 'Sobrecarga', className: 'bg-red-500' },
];

export const CleanerLoadTable = ({ days }: CleanerLoadTableProps) => (
  <Card className="border-[#310984]/10 bg-white text-[#171321] shadow-lg shadow-[#310984]/6">
    <CardHeader className="border-b border-[#310984]/10">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg tracking-tight text-[#171321]">
            <BarChart3 className="h-5 w-5 text-[#310984]" /> Carga por trabajadora
          </CardTitle>
          <p className="mt-1 text-xs text-[#6b627a]">Horas previstas por trabajadora en el periodo elegido.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[#6b627a]" aria-label="Leyenda de carga">
          {legend.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-[#310984]/10 bg-[#f7f5fb] px-2 py-1">
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
          <thead className="bg-[#f7f5fb] text-xs uppercase tracking-wide text-[#6b627a]">
            <tr>
              <th scope="col" className="sticky left-0 bg-[#f7f5fb] px-4 py-3 text-left">Trabajadora</th>
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
                <td colSpan={6} className="px-4 py-6 text-center text-[#6b627a]">
                  No hay trabajadoras con tareas visibles. Prueba a limpiar filtros, cambiar rango o revisar sede activa.
                </td>
              </tr>
            ) : days.map((day) => {
              const overload = Math.max(day.utilizationPercent - 100, 0);
              return (
                <tr key={day.cleanerId} className="group hover:bg-[#f7f5fb]">
                  <td className="sticky left-0 bg-white px-4 py-3 font-medium text-[#171321] group-hover:bg-[#f7f5fb]">{day.cleanerName}</td>
                  <td className="px-4 py-3 text-[#6b627a]">{day.tasks.length}</td>
                  <td className="px-4 py-3 text-[#6b627a]">{minutesToHoursLabel(day.plannedMinutes)}</td>
                  <td className="px-4 py-3 text-[#6b627a]">{minutesToHoursLabel(day.capacityMinutes)}</td>
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
                      <span className="w-10 shrink-0 text-right tabular-nums text-[#171321]">{day.utilizationPercent}%</span>
                      {overload > 0 && <span className="text-xs text-red-700">+{overload}%</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {day.riskFlags.length === 0 ? (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">OK</Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">{day.riskFlags.length} aviso(s)</Badge>
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

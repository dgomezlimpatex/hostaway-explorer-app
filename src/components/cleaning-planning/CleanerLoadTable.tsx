import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CleanerPlanningDay } from '@/types/cleaningPlanning';
import { minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { BarChart3 } from 'lucide-react';

interface CleanerLoadTableProps {
  days: CleanerPlanningDay[];
}

const toneForUtilization = (utilization: number): string => {
  if (utilization >= 100) return 'bg-red-500/80';
  if (utilization >= 85) return 'bg-amber-400/80';
  if (utilization >= 55) return 'bg-emerald-400/80';
  return 'bg-sky-400/70';
};

const legend = [
  { label: 'Baja', className: 'bg-sky-400/70' },
  { label: 'Correcta', className: 'bg-emerald-400/80' },
  { label: 'Ajustada', className: 'bg-amber-400/80' },
  { label: 'Sobrecarga', className: 'bg-red-500/80' },
];

export const CleanerLoadTable = ({ days }: CleanerLoadTableProps) => (
  <Card className="border-white/10 bg-white/[0.04] text-white shadow-xl shadow-black/20 backdrop-blur">
    <CardHeader className="border-b border-white/10">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg tracking-tight">
            <BarChart3 className="h-5 w-5 text-[#c7b8ff]" /> Carga por limpiadora
          </CardTitle>
          <p className="mt-1 text-xs text-white/65">Tabla operativa de capacidad prevista en el horizonte seleccionado.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-white/55" aria-label="Leyenda de carga">
          {legend.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2 py-1">
              <span className={`h-2 w-2 rounded-full ${item.className}`} /> {item.label}
            </span>
          ))}
        </div>
      </div>
    </CardHeader>
    <CardContent className="p-0">
      <div className="overflow-x-auto" aria-label="Tabla de carga desplazable horizontalmente">
        <table className="w-full min-w-[680px] text-sm">
          <caption className="sr-only">Carga prevista por limpiadora en el horizonte seleccionado</caption>
          <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-white/60">
            <tr>
              <th scope="col" className="sticky left-0 bg-[#111014] px-4 py-3 text-left">Limpiadora</th>
              <th scope="col" className="px-4 py-3 text-left">Tareas</th>
              <th scope="col" className="px-4 py-3 text-left">Planificado</th>
              <th scope="col" className="px-4 py-3 text-left">Capacidad</th>
              <th scope="col" className="px-4 py-3 text-left">Carga</th>
              <th scope="col" className="px-4 py-3 text-left">Alertas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {days.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-white/50">
                  No hay limpiadoras con tareas visibles. Prueba a limpiar filtros, cambiar rango o revisar sede activa.
                </td>
              </tr>
            ) : days.map((day) => {
              const overload = Math.max(day.utilizationPercent - 100, 0);
              return (
                <tr key={day.cleanerId} className="hover:bg-white/[0.03]">
                  <td className="sticky left-0 bg-[#111014] px-4 py-3 font-medium text-white">{day.cleanerName}</td>
                  <td className="px-4 py-3 text-white/70">{day.tasks.length}</td>
                  <td className="px-4 py-3 text-white/70">{minutesToHoursLabel(day.plannedMinutes)}</td>
                  <td className="px-4 py-3 text-white/70">{minutesToHoursLabel(day.capacityMinutes)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-28 overflow-hidden rounded-full bg-white/10"
                        role="progressbar"
                        aria-label={`Carga de ${day.cleanerName}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(day.utilizationPercent, 100)}
                        aria-valuetext={`${day.utilizationPercent}% utilizado, ${minutesToHoursLabel(Math.max(day.capacityMinutes - day.plannedMinutes, 0))} libres`}
                      >
                        <div aria-hidden="true" className={`h-full ${toneForUtilization(day.utilizationPercent)}`} style={{ width: `${Math.min(day.utilizationPercent, 100)}%` }} />
                      </div>
                      <span className="text-white/70">{day.utilizationPercent}%</span>
                      {overload > 0 && <span className="text-xs text-red-200">+{overload}%</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {day.riskFlags.length === 0 ? (
                      <Badge variant="outline" className="border-emerald-300/30 bg-emerald-400/10 text-emerald-100">OK</Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-300/30 bg-amber-400/10 text-amber-100">{day.riskFlags.length} alerta(s)</Badge>
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

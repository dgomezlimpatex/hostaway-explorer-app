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

export const CleanerLoadTable = ({ days }: CleanerLoadTableProps) => (
  <Card className="border-white/10 bg-white/[0.04] text-white shadow-xl shadow-black/20 backdrop-blur">
    <CardHeader className="border-b border-white/10">
      <CardTitle className="flex items-center gap-2 text-lg tracking-tight">
        <BarChart3 className="h-5 w-5 text-[#c7b8ff]" /> Heatmap de carga por limpiadora
      </CardTitle>
      <p className="text-xs text-white/55">Tabla operativa de capacidad prevista en el horizonte seleccionado.</p>
    </CardHeader>
    <CardContent className="p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-white/45">
            <tr>
              <th className="px-4 py-3 text-left">Limpiadora</th>
              <th className="px-4 py-3 text-left">Tareas</th>
              <th className="px-4 py-3 text-left">Planificado</th>
              <th className="px-4 py-3 text-left">Capacidad</th>
              <th className="px-4 py-3 text-left">Carga</th>
              <th className="px-4 py-3 text-left">Alertas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {days.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-white/50">No hay limpiadoras con tareas visibles.</td>
              </tr>
            ) : days.map((day) => (
              <tr key={day.cleanerId} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 font-medium text-white">{day.cleanerName}</td>
                <td className="px-4 py-3 text-white/70">{day.tasks.length}</td>
                <td className="px-4 py-3 text-white/70">{minutesToHoursLabel(day.plannedMinutes)}</td>
                <td className="px-4 py-3 text-white/70">{minutesToHoursLabel(day.capacityMinutes)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-28 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full ${toneForUtilization(day.utilizationPercent)}`} style={{ width: `${Math.min(day.utilizationPercent, 100)}%` }} />
                    </div>
                    <span className="text-white/70">{day.utilizationPercent}%</span>
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
            ))}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
);

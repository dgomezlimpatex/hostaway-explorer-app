import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Cleaner } from '@/types/calendar';
import { EffectiveWorkerAvailability } from '@/types/cleaningPlanning';
import { minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { CalendarClock, ShieldAlert, Sparkles } from 'lucide-react';

interface WorkerAvailabilityPanelProps {
  cleaners: Cleaner[];
  availabilities: EffectiveWorkerAvailability[];
}

interface AvailabilityAggregate {
  cleanerId: string;
  cleanerName: string;
  availableMinutes: number;
  assignedMinutes: number;
  remainingMinutes: number;
  blockedCount: number;
  fallbackDays: number;
  unavailableDays: number;
}

const aggregateAvailability = (
  cleaners: Cleaner[],
  availabilities: EffectiveWorkerAvailability[],
): AvailabilityAggregate[] => {
  const cleanerNames = new Map(cleaners.map((cleaner) => [cleaner.id, cleaner.name]));
  const aggregate = new Map<string, AvailabilityAggregate>();

  availabilities.forEach((availability) => {
    const cleanerName = cleanerNames.get(availability.cleanerId);
    if (!cleanerName) return;

    const current = aggregate.get(availability.cleanerId) || {
      cleanerId: availability.cleanerId,
      cleanerName,
      availableMinutes: 0,
      assignedMinutes: 0,
      remainingMinutes: 0,
      blockedCount: 0,
      fallbackDays: 0,
      unavailableDays: 0,
    };

    current.availableMinutes += availability.availableMinutes;
    current.assignedMinutes += availability.assignedMinutes;
    current.remainingMinutes += availability.remainingMinutes;
    current.blockedCount += availability.blockedWindows.length;
    current.fallbackDays += availability.source === 'contract_fallback' ? 1 : 0;
    current.unavailableDays += availability.isAvailable ? 0 : 1;
    aggregate.set(availability.cleanerId, current);
  });

  return Array.from(aggregate.values()).sort((a, b) => b.remainingMinutes - a.remainingMinutes);
};

export const WorkerAvailabilityPanel = ({ cleaners, availabilities }: WorkerAvailabilityPanelProps) => {
  const rows = aggregateAvailability(cleaners, availabilities);

  return (
    <Card className="border-white/10 bg-white/[0.04] text-white shadow-2xl shadow-[#310984]/10 backdrop-blur">
      <CardHeader className="space-y-2 border-b border-white/10">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold tracking-tight">Disponibilidad real</CardTitle>
          <Badge className="border-[#c7b8ff]/30 bg-[#310984]/60 text-white hover:bg-[#310984]/70">
            <Sparkles className="mr-1 h-3 w-3" /> MVP
          </Badge>
        </div>
        <p className="text-xs text-white/55">
          Capacidad calculada con horarios, ausencias, días libres, mantenimientos y tareas ya asignadas.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/55">
            No hay disponibilidad cargada para el rango.
          </div>
        ) : rows.map((row) => {
          const utilization = row.availableMinutes > 0 ? Math.round((row.assignedMinutes / row.availableMinutes) * 100) : 0;
          const isTight = row.remainingMinutes < 60 && row.availableMinutes > 0;

          return (
            <div key={row.cleanerId} className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white">{row.cleanerName}</p>
                  <p className="text-xs text-white/50">
                    Libre {minutesToHoursLabel(row.remainingMinutes)} · planificado {minutesToHoursLabel(row.assignedMinutes)}
                  </p>
                </div>
                {isTight && (
                  <Badge variant="outline" className="border-amber-300/40 bg-amber-400/10 text-amber-100">
                    Ajustada
                  </Badge>
                )}
              </div>
              <Progress value={Math.min(utilization, 100)} className="h-2 bg-white/10" />
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/50">
                <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />{minutesToHoursLabel(row.availableMinutes)} reales</span>
                {row.blockedCount > 0 && <span>{row.blockedCount} bloqueos</span>}
                {row.fallbackDays > 0 && <span className="inline-flex items-center gap-1 text-amber-100"><ShieldAlert className="h-3 w-3" />fallback</span>}
                {row.unavailableDays > 0 && <span>{row.unavailableDays} días no disponible</span>}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

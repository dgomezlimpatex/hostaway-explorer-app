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

interface DailyAvailabilitySummary {
  date: string;
  availableMinutes: number;
  assignedMinutes: number;
  remainingMinutes: number;
  isAvailable: boolean;
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
  tightDays: number;
  days: DailyAvailabilitySummary[];
}

const dayLabel = (date: string): string => {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
};

const dailyTone = (day: DailyAvailabilitySummary): string => {
  if (!day.isAvailable || day.availableMinutes === 0) return 'border-red-300/30 bg-red-400/10 text-red-100';
  const utilization = Math.round((day.assignedMinutes / day.availableMinutes) * 100);
  if (utilization >= 100 || day.remainingMinutes < 30) return 'border-red-300/30 bg-red-400/10 text-red-100';
  if (utilization >= 85 || day.remainingMinutes < 60) return 'border-amber-300/30 bg-amber-400/10 text-amber-100';
  return 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100';
};

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
      tightDays: 0,
      days: [],
    };

    current.availableMinutes += availability.availableMinutes;
    current.assignedMinutes += availability.assignedMinutes;
    current.remainingMinutes += availability.remainingMinutes;
    current.blockedCount += availability.blockedWindows.length;
    current.fallbackDays += availability.source === 'contract_fallback' ? 1 : 0;
    current.unavailableDays += availability.isAvailable ? 0 : 1;
    current.tightDays += availability.isAvailable && availability.availableMinutes > 0 && availability.remainingMinutes < 60 ? 1 : 0;
    current.days.push({
      date: availability.date,
      availableMinutes: availability.availableMinutes,
      assignedMinutes: availability.assignedMinutes,
      remainingMinutes: availability.remainingMinutes,
      isAvailable: availability.isAvailable,
    });
    aggregate.set(availability.cleanerId, current);
  });

  return Array.from(aggregate.values())
    .map((row) => ({ ...row, days: row.days.sort((a, b) => a.date.localeCompare(b.date)) }))
    .sort((a, b) => b.remainingMinutes - a.remainingMinutes);
};

export const WorkerAvailabilityPanel = ({ cleaners, availabilities }: WorkerAvailabilityPanelProps) => {
  const rows = aggregateAvailability(cleaners, availabilities);

  return (
    <Card className="border-white/10 bg-white/[0.04] text-white shadow-2xl shadow-[#310984]/10 backdrop-blur">
      <CardHeader className="space-y-2 border-b border-white/10">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold tracking-tight">Disponibilidad real</CardTitle>
          <Badge className="border-[#c7b8ff]/30 bg-[#310984]/60 text-white hover:bg-[#310984]/70">
            <Sparkles className="mr-1 h-3 w-3" /> Detalle
          </Badge>
        </div>
        <p className="text-xs text-white/55">
          Capacidad calculada con horarios, ausencias, días libres, mantenimientos y tareas ya asignadas. Revisa los chips diarios en rangos de 7/30 días.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/55">
            <p className="font-medium text-white/75">No hay disponibilidad cargada para el rango.</p>
            <p className="mt-1 text-xs">Revisa sede activa, horario semanal, ausencias o configuración de trabajadoras antes de proponer asignaciones.</p>
          </div>
        ) : rows.map((row) => {
          const utilization = row.availableMinutes > 0 ? Math.round((row.assignedMinutes / row.availableMinutes) * 100) : 0;
          const isTight = row.remainingMinutes < 60 && row.availableMinutes > 0;
          const visibleDays = row.days.slice(0, 7);
          const hiddenDays = row.days.length - visibleDays.length;

          return (
            <div key={row.cleanerId} className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white">{row.cleanerName}</p>
                  <p className="text-xs text-white/50">
                    Libre {minutesToHoursLabel(row.remainingMinutes)} · planificado {minutesToHoursLabel(row.assignedMinutes)}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {isTight && (
                    <Badge variant="outline" className="border-amber-300/40 bg-amber-400/10 text-amber-100">
                      Ajustada
                    </Badge>
                  )}
                  {row.tightDays > 0 && (
                    <Badge variant="outline" className="border-amber-300/40 bg-amber-400/10 text-amber-100">
                      {row.tightDays} día(s) límite
                    </Badge>
                  )}
                </div>
              </div>
              <Progress
                value={Math.min(utilization, 100)}
                className="h-2 bg-white/10"
                aria-label={`Disponibilidad de ${row.cleanerName}`}
                aria-valuetext={`${utilization}% ocupado, ${minutesToHoursLabel(row.remainingMinutes)} libres`}
              />
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/50">
                <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />{minutesToHoursLabel(row.availableMinutes)} reales</span>
                {row.blockedCount > 0 && <span>{row.blockedCount} bloqueos</span>}
                {row.fallbackDays > 0 && <span className="inline-flex items-center gap-1 text-amber-100"><ShieldAlert className="h-3 w-3" />horario estimado</span>}
                {row.unavailableDays > 0 && <span>{row.unavailableDays} días no disponible</span>}
              </div>
              {row.days.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {visibleDays.map((day) => (
                    <span key={day.date} className={`rounded-full border px-2 py-1 text-[10px] ${dailyTone(day)}`} title={`${day.date}: ${minutesToHoursLabel(day.remainingMinutes)} libres`}>
                      {dayLabel(day.date)} · {day.isAvailable ? minutesToHoursLabel(day.remainingMinutes) : 'no disp.'}
                    </span>
                  ))}
                  {hiddenDays > 0 && <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/50">+{hiddenDays} días</span>}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

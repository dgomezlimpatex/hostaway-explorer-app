import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CleaningPlanningSummary, CleaningPlanningTask } from '@/types/cleaningPlanning';
import { minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { AlertTriangle, CheckCircle2, Clock, Home, Users } from 'lucide-react';

interface PlanningAttentionSummaryProps {
  tasks: CleaningPlanningTask[];
  summary: CleaningPlanningSummary;
}

const timeToMinutes = (time?: string | null): number | null => {
  if (!time) return null;
  const [hoursRaw, minutesRaw = '0'] = time.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const isEarlyCheckIn = (task: CleaningPlanningTask): boolean => {
  const checkInMinutes = timeToMinutes(task.checkIn);
  return checkInMinutes !== null && checkInMinutes <= 14 * 60;
};

export const PlanningAttentionSummary = ({ tasks, summary }: PlanningAttentionSummaryProps) => {
  const unassigned = tasks.filter((task) => !task.cleanerId);
  const earlyCheckIns = tasks.filter(isEarlyCheckIn);
  const largeHomes = tasks.filter((task) => task.durationMinutes >= 240);
  const buildingReview = tasks.filter((task) => task.riskFlags.includes('missing-building') || task.riskFlags.includes('ambiguous-building'));
  const availabilityReview = tasks.filter((task) => task.riskFlags.includes('no-real-availability') || task.riskFlags.includes('overcapacity') || task.riskFlags.includes('overlap'));
  const hasAttention = unassigned.length > 0
    || earlyCheckIns.length > 0
    || largeHomes.length > 0
    || buildingReview.length > 0
    || availabilityReview.length > 0
    || summary.overcapacityCleaners > 0;

  const bullets = [
    unassigned.length > 0 ? {
      icon: Users,
      text: `${unassigned.length} limpieza${unassigned.length === 1 ? '' : 's'} sin asignar`,
      detail: 'La app puede proponer una asignación segura.',
      tone: 'text-warning',
    } : null,
    earlyCheckIns.length > 0 ? {
      icon: Clock,
      text: `${earlyCheckIns.length} entrada${earlyCheckIns.length === 1 ? '' : 's'} temprana${earlyCheckIns.length === 1 ? '' : 's'} antes de las 14:00`,
      detail: 'Conviene priorizarlas al planificar.',
      tone: 'text-ink-2',
    } : null,
    largeHomes.length > 0 ? {
      icon: Home,
      text: `${largeHomes.length} casa${largeHomes.length === 1 ? '' : 's'} grande${largeHomes.length === 1 ? '' : 's'} (${minutesToHoursLabel(largeHomes.reduce((total, task) => total + task.durationMinutes, 0))})`,
      detail: 'Pueden necesitar 2–3 trabajadoras.',
      tone: 'text-brand',
    } : null,
    summary.overcapacityCleaners > 0 || availabilityReview.length > 0 ? {
      icon: AlertTriangle,
      text: `${summary.overcapacityCleaners || availabilityReview.length} trabajadora${(summary.overcapacityCleaners || availabilityReview.length) === 1 ? '' : 's'} con demasiadas horas`,
      detail: 'Reparte antes de guardar para que nadie termine el día con exceso de horas.',
      tone: 'text-danger',
    } : null,
    buildingReview.length > 0 ? {
      icon: AlertTriangle,
      text: `${buildingReview.length} edificio${buildingReview.length === 1 ? '' : 's'} o propiedad${buildingReview.length === 1 ? '' : 'es'} a revisar`,
      detail: 'Puede afectar a equipos habituales.',
      tone: 'text-warning',
    } : null,
  ].filter(Boolean).slice(0, 5) as Array<{ icon: typeof AlertTriangle; text: string; detail: string; tone: string }>;

  return (
    <Card className="border-line bg-white text-ink shadow-sober">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl tracking-tight">Qué necesita atención</CardTitle>
            <p className="mt-1 text-sm text-ink-3">Resumen operativo antes de tocar el plan.</p>
          </div>
          <Badge variant="outline" className={hasAttention ? 'border-line text-warning' : 'border-line text-ink-2'}>
            {hasAttention ? 'Revisar' : 'Controlado'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0 pb-1">
        {!hasAttention ? (
          <div className="flex gap-3 px-4 py-4 text-ink">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div>
              <p className="font-medium">Todo lo visible está cubierto.</p>
              <p className="text-sm text-ink-3">Revisa cambios manuales si los hubo y confirma solo cuando el equipo lo tenga claro.</p>
            </div>
          </div>
        ) : bullets.map((bullet) => {
          const Icon = bullet.icon;
          return (
            <div key={bullet.text} className="flex gap-3 border-b border-line px-4 py-3 last:border-0">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${bullet.tone}`} />
              <div>
                <p className="text-sm font-medium">{bullet.text}</p>
                <p className="text-xs opacity-80">{bullet.detail}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

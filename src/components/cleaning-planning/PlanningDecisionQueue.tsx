import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cleaner } from '@/types/calendar';
import { CleaningPlanningTask } from '@/types/cleaningPlanning';
import { AlertTriangle, CheckCircle2, Clock, Home, Users } from 'lucide-react';
import { PlanningTaskCard } from './PlanningTaskCard';

interface PlanningDecisionQueueProps {
  tasks: CleaningPlanningTask[];
  cleaners: Cleaner[];
  onAssign: (taskId: string, cleaner: Cleaner) => void;
  onUnassign: (taskId: string) => void;
  isAssigning?: boolean;
}

interface DecisionGroup {
  key: string;
  title: string;
  description: string;
  icon: typeof AlertTriangle;
  badge: string;
  tasks: CleaningPlanningTask[];
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

const hasOperationalRisk = (task: CleaningPlanningTask): boolean => task.riskFlags.some((risk) => risk !== 'unassigned');

const buildDecisionGroups = (tasks: CleaningPlanningTask[]): { activeGroups: DecisionGroup[]; covered: CleaningPlanningTask[] } => {
  const used = new Set<string>();
  const take = (predicate: (task: CleaningPlanningTask) => boolean) => {
    const selected = tasks.filter((task) => !used.has(task.id) && predicate(task));
    selected.forEach((task) => used.add(task.id));
    return selected;
  };

  const activeGroups: DecisionGroup[] = [
    {
      key: 'early',
      title: 'Urgente: entradas tempranas',
      description: 'Prioriza estas limpiezas porque el cliente entra pronto.',
      icon: Clock,
      badge: 'Prioridad',
      tasks: take((task) => isEarlyCheckIn(task) && (!task.cleanerId || hasOperationalRisk(task))),
    },
    {
      key: 'unassigned',
      title: 'Sin cubrir',
      description: 'Necesitan responsable antes de operar.',
      icon: Users,
      badge: 'Asignar',
      tasks: take((task) => !task.cleanerId),
    },
    {
      key: 'large-homes',
      title: 'Casas grandes',
      description: 'Valora equipos de 2–3 personas para no sobrecargar.',
      icon: Home,
      badge: 'Equipo',
      tasks: take((task) => task.durationMinutes >= 240),
    },
    {
      key: 'risks',
      title: 'Requieren revisión',
      description: 'Tienen horarios, disponibilidad, edificio o capacidad a revisar.',
      icon: AlertTriangle,
      badge: 'Revisar',
      tasks: take(hasOperationalRisk),
    },
  ].filter((group) => group.tasks.length > 0);

  return {
    activeGroups,
    covered: tasks.filter((task) => !used.has(task.id)),
  };
};

export const PlanningDecisionQueue = ({ tasks, cleaners, onAssign, onUnassign, isAssigning }: PlanningDecisionQueueProps) => {
  const { activeGroups, covered } = buildDecisionGroups(tasks);
  const hasDecisions = activeGroups.length > 0;

  return (
    <Card className="border-[#310984]/10 bg-white text-[#171321] shadow-lg shadow-[#310984]/6">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-xl tracking-tight">Decisiones pendientes</CardTitle>
            <p className="mt-1 text-sm text-[#6b627a]">
              Lista priorizada para cerrar el plan sin revisar todo el dashboard técnico.
            </p>
          </div>
          <Badge variant="outline" className={hasDecisions ? 'w-fit border-amber-200 bg-amber-50 text-amber-700' : 'w-fit border-emerald-200 bg-emerald-50 text-emerald-700'}>
            {hasDecisions ? `${activeGroups.reduce((total, group) => total + group.tasks.length, 0)} por decidir` : 'Sin pendientes'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasDecisions && (
          <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">No hay decisiones urgentes en esta vista.</p>
              <p className="text-sm text-emerald-700/80">Si el plan está correcto, solo queda revisar y confirmar cambios cuando proceda.</p>
            </div>
          </div>
        )}

        {activeGroups.map((group) => {
          const Icon = group.icon;
          return (
            <section key={group.key} className="space-y-3 rounded-3xl border border-[#310984]/10 bg-[#faf8ff] p-3 md:p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-[#310984]/10 p-2 text-[#310984]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#171321]">{group.title}</h3>
                    <p className="text-sm text-[#6b627a]">{group.description}</p>
                  </div>
                </div>
                <Badge variant="outline" className="w-fit border-[#310984]/15 bg-white text-[#310984]">
                  {group.tasks.length} · {group.badge}
                </Badge>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {group.tasks.map((task) => (
                  <PlanningTaskCard
                    key={task.id}
                    task={task}
                    cleaners={cleaners}
                    onAssign={onAssign}
                    onUnassign={onUnassign}
                    isAssigning={isAssigning}
                    compact
                    variant="simple"
                  />
                ))}
              </div>
            </section>
          );
        })}

        {covered.length > 0 && (
          <details className="rounded-2xl border border-[#310984]/10 bg-white p-3">
            <summary className="cursor-pointer text-sm font-medium text-[#310984]">
              Ver {covered.length} limpieza{covered.length === 1 ? '' : 's'} ya cubierta{covered.length === 1 ? '' : 's'}
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {covered.map((task) => (
                <PlanningTaskCard
                  key={task.id}
                  task={task}
                  cleaners={cleaners}
                  onAssign={onAssign}
                  onUnassign={onUnassign}
                  isAssigning={isAssigning}
                  compact
                  variant="simple"
                />
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
};

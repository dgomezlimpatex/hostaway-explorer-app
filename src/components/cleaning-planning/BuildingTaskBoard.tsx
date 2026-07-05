import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cleaner } from '@/types/calendar';
import { CleaningPlanningTask } from '@/types/cleaningPlanning';
import { minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { extractBuildingCode } from '@/services/laundryScheduleService';
import { AlertTriangle, Building2, Layers3, Users } from 'lucide-react';
import { PlanningTaskCard } from './PlanningTaskCard';

interface BuildingTaskBoardProps {
  tasks: CleaningPlanningTask[];
  cleaners: Cleaner[];
  onAssign: (taskId: string, cleaner: Cleaner) => void;
  onUnassign?: (taskId: string) => void;
  isAssigning?: boolean;
}

interface BuildingGroup {
  key: string;
  name: string;
  status: 'detected' | 'prefix' | 'review';
  tasks: CleaningPlanningTask[];
}

const getBuildingFallback = (task: CleaningPlanningTask): { key: string; name: string; status: BuildingGroup['status'] } => {
  const detected = task.detectedBuilding;
  if (detected?.status === 'detected' && detected.propertyGroupId) {
    return {
      key: detected.propertyGroupId,
      name: detected.propertyGroupName || 'Edificio detectado',
      status: 'detected',
    };
  }

  const prefix = extractBuildingCode(task.propertyCode || task.property || 'SIN EDIFICIO');
  if (prefix && prefix !== 'SIN EDIFICIO') {
    return {
      key: `prefix-${task.zone}-${prefix}`,
      name: `Edificio ${prefix}`,
      status: 'prefix',
    };
  }

  return {
    key: `review-${task.zone}`,
    name: `Revisión · ${task.zone}`,
    status: 'review',
  };
};

const buildGroups = (tasks: CleaningPlanningTask[]): BuildingGroup[] => {
  const groups = new Map<string, BuildingGroup>();

  tasks.forEach((task) => {
    const building = getBuildingFallback(task);
    const group = groups.get(building.key) || {
      key: building.key,
      name: building.name,
      status: building.status,
      tasks: [],
    };

    group.tasks.push(task);
    groups.set(building.key, group);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      tasks: group.tasks.sort((a, b) => `${a.date} ${a.startTime} ${a.propertyCode || a.property}`.localeCompare(`${b.date} ${b.startTime} ${b.propertyCode || b.property}`)),
    }))
    .sort((a, b) => {
      const statusOrder = { review: 0, prefix: 1, detected: 2 } as const;
      if (a.status !== b.status) return statusOrder[a.status] - statusOrder[b.status];
      return a.name.localeCompare(b.name, 'es', { numeric: true });
    });
};

const groupStatusBadge = (status: BuildingGroup['status']) => {
  if (status === 'detected') return <Badge variant="outline" className="w-fit border-emerald-300/30 bg-emerald-400/10 text-emerald-100">Edificio OK</Badge>;
  if (status === 'prefix') return <Badge variant="outline" className="w-fit border-sky-300/30 bg-sky-400/10 text-sky-100">Por prefijo de código</Badge>;
  return <Badge variant="outline" className="w-fit border-amber-300/30 bg-amber-400/10 text-amber-100">Detectar edificio</Badge>;
};

export const BuildingTaskBoard = ({ tasks, cleaners, onAssign, onUnassign, isAssigning }: BuildingTaskBoardProps) => {
  const groups = buildGroups(tasks);

  return (
    <Card className="border-white/10 bg-white/[0.04] text-white shadow-2xl shadow-black/20 backdrop-blur">
      <CardHeader className="border-b border-white/10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg tracking-tight">
              <Layers3 className="h-5 w-5 text-[#c7b8ff]" /> Propiedades por edificio
            </CardTitle>
            <p className="mt-1 text-xs text-white/55">
              Vista detallada centrada en propiedad/apartamento. Agrupa por edificio configurado o prefijo de código y permite asignar/reasignar con confirmación.
            </p>
          </div>
          <Badge className="w-fit border-white/10 bg-white/10 text-white hover:bg-white/15">
            {tasks.length} tareas visibles
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-6 text-center text-sm text-white/55">
            <p className="font-medium text-white/75">No hay tareas con los filtros actuales.</p>
            <p className="mt-1 text-xs">Limpia búsqueda/filtros, cambia rango o comprueba que la sede activa tenga tareas cargadas.</p>
          </div>
        ) : groups.map((group) => {
          const minutes = group.tasks.reduce((total, task) => total + task.durationMinutes, 0);
          const uncovered = group.tasks.filter((task) => !task.cleanerId).length;
          const riskCount = group.tasks.filter((task) => task.riskFlags.length > 0).length;
          const largeHomes = group.tasks.filter((task) => task.durationMinutes >= 240).length;
          const team = Array.from(new Set(group.tasks.map((task) => task.cleaner).filter(Boolean)));

          return (
            <section key={group.key} className="rounded-3xl border border-white/10 bg-black/20 p-3">
              <div className="mb-3 flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-2xl border border-white/10 bg-[#310984]/40 p-2">
                      <Building2 className="h-4 w-4 text-[#dacfff]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{group.name}</h3>
                      <p className="text-xs text-white/50">
                        {group.tasks.length} apartamentos/tareas · {minutesToHoursLabel(minutes)} carga · {uncovered} sin cubrir · {riskCount} alertas
                      </p>
                    </div>
                  </div>
                  {groupStatusBadge(group.status)}
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-white/55">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                    <Users className="h-3 w-3" /> Asignadas ahora: {team.length > 0 ? team.join(', ') : 'pendiente'}
                  </span>
                  {largeHomes > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-1 text-amber-100">
                      <AlertTriangle className="h-3 w-3" /> {largeHomes} casa(s) grande(s): valorar 2–3 limpiadoras
                    </span>
                  )}
                  {uncovered > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-300/25 bg-red-400/10 px-2 py-1 text-red-100">
                      <AlertTriangle className="h-3 w-3" /> Tareas sin cubrir
                    </span>
                  )}
                </div>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {group.tasks.map((task) => (
                  <PlanningTaskCard
                    key={task.id}
                    task={task}
                    cleaners={cleaners}
                    onAssign={onAssign}
                    onUnassign={onUnassign}
                    isAssigning={isAssigning}
                    compact
                  />
                ))}
              </div>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
};

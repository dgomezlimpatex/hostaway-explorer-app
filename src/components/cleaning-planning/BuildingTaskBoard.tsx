import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cleaner } from '@/types/calendar';
import { CleaningPlanningTask } from '@/types/cleaningPlanning';
import { minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { Building2, Layers3 } from 'lucide-react';
import { PlanningTaskCard } from './PlanningTaskCard';

interface BuildingTaskBoardProps {
  tasks: CleaningPlanningTask[];
  cleaners: Cleaner[];
  onAssign: (taskId: string, cleaner: Cleaner) => void;
  isAssigning?: boolean;
}

interface BuildingGroup {
  key: string;
  name: string;
  status: 'detected' | 'review';
  tasks: CleaningPlanningTask[];
}

const buildGroups = (tasks: CleaningPlanningTask[]): BuildingGroup[] => {
  const groups = new Map<string, BuildingGroup>();

  tasks.forEach((task) => {
    const detected = task.detectedBuilding;
    const isDetected = detected?.status === 'detected' && detected.propertyGroupId;
    const key = isDetected ? detected.propertyGroupId || 'detected' : `review-${task.zone}`;
    const name = isDetected ? detected.propertyGroupName || 'Edificio detectado' : `Revisión · ${task.zone}`;
    const group = groups.get(key) || {
      key,
      name,
      status: isDetected ? 'detected' : 'review',
      tasks: [],
    };

    group.tasks.push(task);
    groups.set(key, group);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      tasks: group.tasks.sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)),
    }))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'review' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
};

export const BuildingTaskBoard = ({ tasks, cleaners, onAssign, isAssigning }: BuildingTaskBoardProps) => {
  const groups = buildGroups(tasks);

  return (
    <Card className="border-white/10 bg-white/[0.04] text-white shadow-2xl shadow-black/20 backdrop-blur">
      <CardHeader className="border-b border-white/10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg tracking-tight">
              <Layers3 className="h-5 w-5 text-[#c7b8ff]" /> Cola por edificio
            </CardTitle>
            <p className="mt-1 text-xs text-white/55">
              Las tareas sin asignar se agrupan para decidir por bloque operativo, no una por una.
            </p>
          </div>
          <Badge className="w-fit border-white/10 bg-white/10 text-white hover:bg-white/15">
            {tasks.length} pendientes
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-6 text-center text-sm text-white/55">
            No hay tareas sin asignar con los filtros actuales.
          </div>
        ) : groups.map((group) => {
          const minutes = group.tasks.reduce((total, task) => total + task.durationMinutes, 0);
          const riskCount = group.tasks.filter((task) => task.riskFlags.length > 0).length;

          return (
            <section key={group.key} className="rounded-3xl border border-white/10 bg-black/20 p-3">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-2xl border border-white/10 bg-[#310984]/40 p-2">
                    <Building2 className="h-4 w-4 text-[#dacfff]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{group.name}</h3>
                    <p className="text-xs text-white/50">
                      {group.tasks.length} tareas · {minutesToHoursLabel(minutes)} · {riskCount} con revisión
                    </p>
                  </div>
                </div>
                {group.status === 'review' ? (
                  <Badge variant="outline" className="w-fit border-amber-300/30 bg-amber-400/10 text-amber-100">Detectar edificio</Badge>
                ) : (
                  <Badge variant="outline" className="w-fit border-emerald-300/30 bg-emerald-400/10 text-emerald-100">Edificio OK</Badge>
                )}
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {group.tasks.map((task) => (
                  <PlanningTaskCard
                    key={task.id}
                    task={task}
                    cleaners={cleaners}
                    onAssign={onAssign}
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

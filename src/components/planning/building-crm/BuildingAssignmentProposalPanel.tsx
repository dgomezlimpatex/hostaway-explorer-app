import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Sparkles, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AssignmentConflict, AssignmentProposal, AssignmentProposalResult } from '@/types/cleaningPlanning';
import type { PlanningBuildingCrmProfile, PlanningBuildingCrmTask } from '@/types/operationalPlanning';
import { formatCrmHours } from './buildingCrmFormatters';

interface BuildingAssignmentProposalPanelProps {
  profile: PlanningBuildingCrmProfile;
  proposal: AssignmentProposalResult | null;
  onGenerate: () => void;
  onClear: () => void;
}

interface ProposalTaskGroup {
  taskId: string;
  task?: PlanningBuildingCrmTask;
  proposals: AssignmentProposal[];
}

const getAllTasks = (profile: PlanningBuildingCrmProfile): PlanningBuildingCrmTask[] => profile.days.flatMap((day) => day.tasks);

const getUnassignedConfirmedTasks = (profile: PlanningBuildingCrmProfile): PlanningBuildingCrmTask[] => getAllTasks(profile)
  .filter((task) => task.isConfirmed)
  .filter((task) => task.assignedCleanerIds.length < task.requiredCleaners);

const groupProposalsByTask = (proposal: AssignmentProposalResult | null, profile: PlanningBuildingCrmProfile): ProposalTaskGroup[] => {
  if (!proposal) return [];
  const taskById = new Map(getAllTasks(profile).map((task) => [task.id, task]));
  const groups = new Map<string, ProposalTaskGroup>();

  proposal.proposals.forEach((item) => {
    const group = groups.get(item.taskId) || {
      taskId: item.taskId,
      task: taskById.get(item.taskId),
      proposals: [],
    };
    group.proposals.push(item);
    groups.set(item.taskId, group);
  });

  return Array.from(groups.values()).sort((a, b) => {
    const left = `${a.task?.date || ''} ${a.task?.startTime || ''} ${a.task?.propertyCode || ''}`;
    const right = `${b.task?.date || ''} ${b.task?.startTime || ''} ${b.task?.propertyCode || ''}`;
    return left.localeCompare(right, 'es', { numeric: true });
  });
};

const getConflictTask = (conflict: AssignmentConflict, profile: PlanningBuildingCrmProfile): PlanningBuildingCrmTask | undefined => getAllTasks(profile).find((task) => task.id === conflict.taskId);

const confidenceTone = (confidence: number): string => {
  if (confidence >= 85) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (confidence >= 70) return 'border-sky-200 bg-sky-50 text-sky-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
};

const getPlanningHref = (profile: PlanningBuildingCrmProfile): string => {
  const firstTaskDate = getAllTasks(profile).find((task) => task.isConfirmed)?.date;
  return firstTaskDate ? `/planning?copilot=open&date=${firstTaskDate}` : '/planning?copilot=open';
};

export const BuildingAssignmentProposalPanel = ({ profile, proposal, onGenerate, onClear }: BuildingAssignmentProposalPanelProps) => {
  const pendingTasks = useMemo(() => getUnassignedConfirmedTasks(profile), [profile]);
  const proposalGroups = useMemo(() => groupProposalsByTask(proposal, profile), [proposal, profile]);
  const planningHref = useMemo(() => getPlanningHref(profile), [profile]);
  const buildingName = profile.building.displayName || profile.building.name;

  return (
    <Card className="border-[#310984]/12 bg-white shadow-sm">
      <CardHeader className="space-y-3 border-b border-[#310984]/10 pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl text-[#171321]">
              <Sparkles className="h-5 w-5 text-[#310984]" /> Proponer asignación
            </CardTitle>
            <p className="mt-1 text-sm text-[#6b627a]">
              Calcula una propuesta solo para {buildingName}. No guarda cambios ni notifica: sirve para probar y revisar antes de ir a Hermes Planificación.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {proposal && (
              <Button type="button" variant="outline" className="border-[#310984]/15 bg-white text-[#310984] hover:bg-[#f0eaff]" onClick={onClear}>
                Limpiar
              </Button>
            )}
            <Button type="button" className="bg-[#310984] text-white hover:bg-[#4c1bb0]" onClick={onGenerate}>
              <Sparkles className="mr-2 h-4 w-4" /> Proponer asignación
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-3">
            <p className="text-2xl font-semibold text-[#171321]">{pendingTasks.length}</p>
            <p className="text-xs text-[#6b627a]">pendientes del edificio</p>
          </div>
          <div className="rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-3">
            <p className="text-2xl font-semibold text-[#171321]">{proposal?.summary.proposedCount ?? '—'}</p>
            <p className="text-xs text-[#6b627a]">limpiezas propuestas</p>
          </div>
          <div className="rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-3">
            <p className="text-2xl font-semibold text-[#171321]">{proposal ? formatCrmHours(proposal.summary.proposedMinutes) : '—'}</p>
            <p className="text-xs text-[#6b627a]">horas-persona propuestas</p>
          </div>
        </div>

        {!proposal && (
          <div className="rounded-2xl border border-dashed border-[#310984]/20 bg-[#faf8ff] p-4 text-sm text-[#6b627a]">
            Pulsa “Proponer asignación” para ver qué trabajadoras del equipo de {buildingName} encajan con las limpiezas confirmadas sin asignar. No guarda cambios.
          </div>
        )}

        {proposal && proposal.summary.globalQuality?.criticalWarnings.length ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="flex items-center gap-2 font-semibold text-amber-900">
              <AlertTriangle className="h-4 w-4" /> Avisos del reparto individual
            </div>
            <ul className="mt-2 space-y-1">
              {proposal.summary.globalQuality.criticalWarnings.map((warning) => <li key={warning}>• {warning}</li>)}
            </ul>
          </div>
        ) : null}

        {proposal && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <p>No guarda cambios. Si te encaja, abre Hermes Planificación para confirmar/aplicar con el flujo seguro.</p>
              </div>
              <Button asChild className="w-fit bg-emerald-600 text-white hover:bg-emerald-500">
                <Link to={planningHref}>
                  Ver en planificación <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#171321]">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Listas para revisar
              </div>
              {proposalGroups.length === 0 ? (
                <div className="rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-4 text-sm text-[#6b627a]">
                  No hay asignaciones seguras para este edificio con los datos actuales.
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {proposalGroups.map((group) => {
                    const confidence = Math.min(...group.proposals.map((item) => item.confidence));
                    const cleanerNames = group.proposals.map((item) => item.cleanerName).join(', ');
                    const task = group.task;
                    return (
                      <div key={group.taskId} className="rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="font-semibold text-[#171321]">{task?.propertyCode || 'Limpieza'} · {task?.propertyName || 'Propiedad'}</p>
                            <p className="text-xs text-[#6b627a]">{task?.date || 'Sin fecha'} · {task?.startTime || '--:--'}–{task?.endTime || '--:--'} · {formatCrmHours(group.proposals[0]?.durationMinutes || 0)}</p>
                            <p className="mt-1 text-sm text-[#171321]">→ {cleanerNames}</p>
                          </div>
                          <Badge variant="outline" className={confidenceTone(confidence)}>{confidence}%</Badge>
                        </div>
                        <ul className="mt-2 space-y-2 text-xs text-[#6b627a]">
                          {group.proposals.map((item) => (
                            <li key={`${item.taskId}-${item.cleanerId}`} className="rounded-xl border border-[#310984]/10 bg-white/70 p-2">
                              <div className="font-medium text-[#171321]">
                                {item.cleanerName} · {item.proposedStartTime || '--:--'}–{item.proposedEndTime || '--:--'} · carga tras asignar {formatCrmHours(item.capacityAfterAssignment.assignedMinutes)}
                              </div>
                              <ul className="mt-1 space-y-0.5">
                                {item.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
                              </ul>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {proposal.conflicts.length > 0 && (
              <div className="space-y-3 rounded-3xl border border-red-200 bg-red-50/70 p-4">
                <div className="flex items-center gap-2 font-semibold text-[#171321]">
                  <XCircle className="h-5 w-5 text-red-600" /> Necesitan decisión manual
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {proposal.conflicts.map((conflict) => {
                    const task = getConflictTask(conflict, profile);
                    return (
                      <div key={`${conflict.taskId}-${conflict.code}`} className="rounded-2xl border border-red-200 bg-white p-4 text-sm">
                        <p className="font-semibold text-[#171321]">{task?.propertyCode || 'Limpieza'} · {task?.propertyName || 'Propiedad'}</p>
                        <p className="mt-1 text-xs text-[#6b627a]">{task?.date || 'Sin fecha'} · {conflict.code}</p>
                        <p className="mt-2 text-red-700">{conflict.message}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

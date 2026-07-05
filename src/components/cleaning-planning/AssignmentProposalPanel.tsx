import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AssignmentProposal, AssignmentProposalResult, CleaningPlanningTask } from '@/types/cleaningPlanning';
import { minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { AlertTriangle, CheckCircle2, Sparkles, XCircle } from 'lucide-react';

interface AssignmentProposalPanelProps {
  proposal: AssignmentProposalResult | null;
  tasks: CleaningPlanningTask[];
  isApplying?: boolean;
  isStale?: boolean;
  onApply: () => Promise<void>;
  onClear: () => void;
}

interface ProposalTaskGroup {
  taskId: string;
  task?: CleaningPlanningTask;
  proposals: AssignmentProposal[];
}

const proposalTone = (confidence: number): string => {
  if (confidence >= 85) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (confidence >= 65) return 'border-sky-200 bg-sky-50 text-sky-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
};

const uniqueText = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

const groupProposalsByTask = (proposal: AssignmentProposalResult | null, tasks: CleaningPlanningTask[]): ProposalTaskGroup[] => {
  if (!proposal) return [];
  const taskById = new Map(tasks.map((task) => [task.id, task]));
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
    const left = `${a.task?.date || ''} ${a.task?.startTime || ''} ${a.task?.property || ''}`;
    const right = `${b.task?.date || ''} ${b.task?.startTime || ''} ${b.task?.property || ''}`;
    return left.localeCompare(right, 'es', { numeric: true });
  });
};

export const AssignmentProposalPanel = ({
  proposal,
  tasks,
  isApplying,
  isStale = false,
  onApply,
  onClear,
}: AssignmentProposalPanelProps) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const proposalGroups = useMemo(() => groupProposalsByTask(proposal, tasks), [proposal, tasks]);
  const canApply = Boolean(proposal && proposal.proposals.length > 0 && !isApplying && !isStale);
  const groupedLargeHomes = proposalGroups.filter((group) => group.proposals.length > 1 || (group.proposals[0]?.requiredCleaners || 1) > 1).length;

  const handleConfirmApply = async () => {
    if (!canApply) return;
    await onApply();
    setIsConfirmOpen(false);
  };

  return (
    <>
      <Card className="border-[#310984]/12 bg-white text-[#171321] shadow-lg shadow-[#310984]/8">
        <CardHeader className="space-y-3 border-b border-[#310984]/10 pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
                <Sparkles className="h-5 w-5 text-[#310984]" /> Plan recomendado
              </CardTitle>
              <p className="mt-1 text-sm text-[#6b627a]">
                Revisa el plan antes de guardar. Las notificaciones salen solo después de confirmar.
              </p>
            </div>
            {proposal && (
              <Button size="sm" variant="outline" className="w-fit border-[#310984]/15 bg-white text-[#310984] hover:bg-[#f0eaff] hover:text-[#310984]" onClick={onClear}>
                Limpiar plan
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4">
          {!proposal ? (
            <div className="rounded-2xl border border-dashed border-[#310984]/15 bg-[#faf8ff] p-4 text-sm text-[#6b627a]">
              Todavía no hay plan recomendado. Usa el botón principal de arriba para preparar una propuesta sobre esta vista.
            </div>
          ) : (
            <>
              {isStale && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  El plan quedó desactualizado porque cambiaron fecha, sede, filtros o datos. Regenera antes de confirmar.
                </div>
              )}

              <div className="grid gap-2 text-center md:grid-cols-4">
                <div className="rounded-xl border border-[#310984]/10 bg-[#faf8ff] p-3">
                  <p className="text-2xl font-semibold">{proposalGroups.length}</p>
                  <p className="text-xs text-[#6b627a]">limpiezas cubiertas</p>
                </div>
                <div className="rounded-xl border border-[#310984]/10 bg-[#faf8ff] p-3">
                  <p className="text-2xl font-semibold">{proposal.conflicts.length}</p>
                  <p className="text-xs text-[#6b627a]">requieren decisión</p>
                </div>
                <div className="rounded-xl border border-[#310984]/10 bg-[#faf8ff] p-3">
                  <p className="text-2xl font-semibold">{groupedLargeHomes}</p>
                  <p className="text-xs text-[#6b627a]">equipos grandes</p>
                </div>
                <div className="rounded-xl border border-[#310984]/10 bg-[#faf8ff] p-3">
                  <p className="text-2xl font-semibold">{minutesToHoursLabel(proposal.summary.proposedMinutes)}</p>
                  <p className="text-xs text-[#6b627a]">repartidas</p>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-start gap-2 text-sm text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>Si el reparto es correcto, revisa el detalle y confirma. Se guardarán tareas existentes; no se crean tareas nuevas.</p>
                </div>
                <Button
                  className="mt-3 w-full bg-emerald-600 text-white hover:bg-emerald-500"
                  disabled={!canApply}
                  onClick={() => setIsConfirmOpen(true)}
                >
                  {isApplying ? 'Aplicando plan…' : `Revisar y confirmar ${proposalGroups.length} limpieza${proposalGroups.length === 1 ? '' : 's'}`}
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#171321]">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Listas para confirmar
                </div>
                {proposalGroups.length === 0 ? (
                  <div className="rounded-xl border border-[#310984]/10 bg-[#faf8ff] p-3 text-sm text-[#6b627a]">
                    No se pudo preparar ninguna asignación segura con los datos actuales.
                  </div>
                ) : (
                  <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                    {proposalGroups.map((group) => {
                      const cleanerNames = group.proposals.map((item) => item.cleanerName).join(', ');
                      const minConfidence = Math.min(...group.proposals.map((item) => item.confidence));
                      const first = group.proposals[0];
                      const reasons = uniqueText(group.proposals.flatMap((item) => item.reasons)).slice(0, 2);
                      const warnings = uniqueText(group.proposals.flatMap((item) => item.warnings));
                      const isTeam = group.proposals.length > 1 || (first.requiredCleaners || 1) > 1;

                      return (
                        <div key={group.taskId} className="rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-3">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold text-[#171321]">{group.task?.property || 'Limpieza'}</p>
                              <p className="text-xs text-[#6b627a]">{group.task?.date || 'Sin fecha'} · {group.task?.displayStartTime || '--:--'}–{group.task?.displayEndTime || '--:--'} · {minutesToHoursLabel(first.durationMinutes)}{isTeam ? ' por persona' : ''}</p>
                              <p className="text-xs text-[#6b627a]">→ {cleanerNames}{isTeam ? ` · equipo de ${group.proposals.length}` : ''}</p>
                              {group.task?.cleaner && <p className="text-[11px] text-[#6b627a]/80">Actual: {group.task.cleaner}</p>}
                            </div>
                            <Badge variant="outline" className={proposalTone(minConfidence)}>{minConfidence}%</Badge>
                          </div>
                          {reasons.length > 0 && (
                            <ul className="mt-2 space-y-1 text-xs text-[#6b627a]">
                              {reasons.map((reason) => <li key={reason}>• {reason}</li>)}
                            </ul>
                          )}
                          {warnings.length > 0 && (
                            <ul className="mt-2 space-y-1 text-xs text-amber-700">
                              {warnings.map((warning) => <li key={warning}>• {warning}</li>)}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {proposal.conflicts.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#171321]">
                    <XCircle className="h-4 w-4 text-red-600" /> Necesitan decisión
                  </div>
                  <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
                    {proposal.conflicts.map((conflict) => {
                      const task = tasks.find((item) => item.id === conflict.taskId);
                      return (
                        <div key={`${conflict.taskId}-${conflict.code}`} className="rounded-2xl border border-red-200 bg-red-50 p-3">
                          <p className="text-sm font-semibold text-[#171321]">{task?.property || 'Limpieza'}</p>
                          <p className="text-xs text-[#6b627a]">{task?.date || 'Sin fecha'} · {task?.displayStartTime || '--:--'}–{task?.displayEndTime || '--:--'}</p>
                          <p className="mt-1 flex gap-2 text-xs text-red-700">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {conflict.message}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isConfirmOpen} onOpenChange={(open) => {
        if (!isApplying) setIsConfirmOpen(open);
      }}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Confirmar plan recomendado</DialogTitle>
            <DialogDescription>
              Se actualizarán tareas existentes y después se crearán los eventos de notificación correspondientes. No se crearán tareas nuevas.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {proposalGroups.map((group) => {
              const cleanerNames = group.proposals.map((item) => item.cleanerName).join(', ');
              const first = group.proposals[0];
              return (
                <div key={group.taskId} className="rounded-xl border bg-muted/30 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 break-words">
                      <p className="font-medium">{group.task?.property || 'Limpieza'}</p>
                      <p className="text-muted-foreground">{group.task?.date} · {group.task?.displayStartTime}–{group.task?.displayEndTime}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {cleanerNames}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {first.propertyGroupName || 'Edificio'} · {minutesToHoursLabel(first.durationMinutes)}{group.proposals.length > 1 ? ' por persona' : ''} · {group.proposals.length} responsable{group.proposals.length === 1 ? '' : 's'}
                  </p>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={isApplying} onClick={() => setIsConfirmOpen(false)}>Cancelar</Button>
            <Button className="bg-[#310984] text-white hover:bg-[#4c1bb0]" disabled={!canApply} onClick={handleConfirmApply}>
              {isApplying ? 'Guardando…' : 'Confirmar y guardar plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

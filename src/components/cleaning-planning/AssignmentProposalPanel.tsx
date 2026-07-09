import { useEffect, useMemo, useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cleaner } from '@/types/calendar';
import { AssignmentProposal, AssignmentProposalResult, CleaningPlanningTask } from '@/types/cleaningPlanning';
import { CleanerGroupAssignment } from '@/types/propertyGroups';
import { minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { AlertTriangle, CheckCircle2, Sparkles, XCircle } from 'lucide-react';
import { PlanningProposalCalendar, PlanningProposalDraftWarning } from './PlanningProposalCalendar';

interface AssignmentProposalPanelProps {
  proposal: AssignmentProposalResult | null;
  tasks: CleaningPlanningTask[];
  calendarTasks?: CleaningPlanningTask[];
  cleaners?: Cleaner[];
  activeCleanerAssignments?: CleanerGroupAssignment[];
  excludedCleanerAssignments?: CleanerGroupAssignment[];
  isApplying?: boolean;
  isStale?: boolean;
  onApply: (draftProposals: AssignmentProposal[]) => Promise<void>;
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
  calendarTasks = tasks,
  cleaners = [],
  activeCleanerAssignments = [],
  excludedCleanerAssignments = [],
  isApplying,
  isStale = false,
  onApply,
  onClear,
}: AssignmentProposalPanelProps) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'conflicts'>('calendar');
  const [draftProposals, setDraftProposals] = useState<AssignmentProposal[]>([]);
  const [draftWarnings, setDraftWarnings] = useState<PlanningProposalDraftWarning[]>([]);

  useEffect(() => {
    setDraftProposals(proposal?.proposals || []);
    setDraftWarnings([]);
    setViewMode('calendar');
  }, [proposal]);

  const draftProposalResult = useMemo<AssignmentProposalResult | null>(() => {
    if (!proposal) return null;
    return {
      ...proposal,
      proposals: draftProposals,
      summary: {
        ...proposal.summary,
        proposedCount: draftProposals.length,
        proposedMinutes: draftProposals.reduce((total, item) => total + item.durationMinutes, 0),
      },
    };
  }, [draftProposals, proposal]);

  const proposalGroups = useMemo(() => groupProposalsByTask(draftProposalResult, tasks), [draftProposalResult, tasks]);
  const draftBlockingWarnings = draftWarnings.filter((warning) => warning.severity === 'blocking');
  const draftSoftWarnings = draftWarnings.filter((warning) => warning.severity === 'warning');
  const canApply = Boolean(proposal && draftProposals.length > 0 && !isApplying && !isStale && draftBlockingWarnings.length === 0);
  const groupedLargeHomes = proposalGroups.filter((group) => group.proposals.length > 1 || (group.proposals[0]?.requiredCleaners || 1) > 1).length;

  const handleConfirmApply = async () => {
    if (!canApply) return;
    await onApply(draftProposals);
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
                Revisa el plan en calendario antes de guardar. Las notificaciones salen solo después de confirmar.
              </p>
            </div>
            {proposal && (
              <Button size="sm" variant="outline" className="w-fit border-[#310984]/15 bg-white text-[#310984] hover:bg-[#f0eaff] hover:text-[#310984]" onClick={onClear}>
                Limpiar plan
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-4 md:p-5">
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

              <div className="grid gap-3 text-center sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-[#310984]/10 bg-[#faf8ff] p-3">
                  <p className="text-2xl font-semibold">{proposalGroups.length}</p>
                  <p className="text-xs text-[#6b627a]">limpiezas cubiertas</p>
                </div>
                <div className="rounded-xl border border-[#310984]/10 bg-[#faf8ff] p-3">
                  <p className="text-2xl font-semibold">{proposal.conflicts.length + draftBlockingWarnings.length}</p>
                  <p className="text-xs text-[#6b627a]">requieren decisión</p>
                </div>
                <div className="rounded-xl border border-[#310984]/10 bg-[#faf8ff] p-3">
                  <p className="text-2xl font-semibold">{groupedLargeHomes}</p>
                  <p className="text-xs text-[#6b627a]">equipos grandes</p>
                </div>
                <div className="rounded-xl border border-[#310984]/10 bg-[#faf8ff] p-3">
                  <p className="text-2xl font-semibold">{minutesToHoursLabel(draftProposalResult.summary.proposedMinutes)}</p>
                  <p className="text-xs text-[#6b627a]">repartidas</p>
                </div>
              </div>

              {proposal.summary.globalQuality && (
                <div className="rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#171321]">Calidad operativa del plan</p>
                      <p className="text-xs text-[#6b627a]">Hermes revisa el reparto completo, no solo tarjetas sueltas.</p>
                    </div>
                    <Badge variant="outline" className="w-fit border-[#310984]/20 bg-white text-[#310984]">
                      Score {proposal.summary.globalQuality.globalScore}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-center sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-emerald-200 bg-white p-3">
                      <p className="text-xl font-semibold text-emerald-700">{proposal.summary.globalQuality.fullBundlesCovered}</p>
                      <p className="text-[11px] text-[#6b627a]">centros completos</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-white p-3">
                      <p className="text-xl font-semibold text-amber-700">{proposal.summary.globalQuality.splitBundles}</p>
                      <p className="text-[11px] text-[#6b627a]">centros divididos</p>
                    </div>
                    <div className="rounded-xl border border-red-200 bg-white p-3">
                      <p className="text-xl font-semibold text-red-700">{proposal.summary.globalQuality.avoidableSplits}</p>
                      <p className="text-[11px] text-[#6b627a]">divisiones evitables</p>
                    </div>
                    <div className="rounded-xl border border-sky-200 bg-white p-3">
                      <p className="text-xl font-semibold text-sky-700">{proposal.summary.globalQuality.backupAssignments}</p>
                      <p className="text-[11px] text-[#6b627a]">backups usados</p>
                    </div>
                  </div>
                </div>
              )}

              {proposal.summary.globalQuality?.criticalWarnings.length ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                    <AlertTriangle className="h-4 w-4" /> Alertas críticas del plan
                  </div>
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-800">
                    {proposal.summary.globalQuality.criticalWarnings.map((warning) => <li key={warning}>• {warning}</li>)}
                  </ul>
                </div>
              ) : null}

              {draftBlockingWarnings.length > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  Hay {draftBlockingWarnings.length} bloqueo{draftBlockingWarnings.length === 1 ? '' : 's'} en el calendario editable. Corrígelo antes de confirmar.
                </div>
              )}

              {draftSoftWarnings.length > 0 && draftBlockingWarnings.length === 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Hay {draftSoftWarnings.length} aviso{draftSoftWarnings.length === 1 ? '' : 's'} operativo{draftSoftWarnings.length === 1 ? '' : 's'}. Puedes confirmar si la decisión es consciente.
                </div>
              )}

              <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'calendar' | 'list' | 'conflicts')} className="space-y-4">
                <TabsList className="grid h-auto w-full grid-cols-3 bg-[#f0eaff] p-1 text-[#6b627a] md:w-fit">
                  <TabsTrigger value="calendar">Calendario</TabsTrigger>
                  <TabsTrigger value="list">Lista</TabsTrigger>
                  <TabsTrigger value="conflicts">Conflictos</TabsTrigger>
                </TabsList>

                <TabsContent value="calendar" className="mt-0">
                  <PlanningProposalCalendar
                    originalProposals={proposal.proposals}
                    draftProposals={draftProposals}
                    tasks={tasks}
                    calendarTasks={calendarTasks}
                    cleaners={cleaners}
                    activeCleanerAssignments={activeCleanerAssignments}
                    excludedCleanerAssignments={excludedCleanerAssignments}
                    isStale={isStale}
                    onDraftProposalsChange={setDraftProposals}
                    onDraftWarningsChange={setDraftWarnings}
                  />
                </TabsContent>

                <TabsContent value="list" className="mt-0 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#171321]">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Listas para confirmar
                  </div>
                  {proposalGroups.length === 0 ? (
                    <div className="rounded-xl border border-[#310984]/10 bg-[#faf8ff] p-3 text-sm text-[#6b627a]">
                      No se pudo preparar ninguna asignación segura con los datos actuales.
                    </div>
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                      {proposalGroups.map((group) => {
                        const cleanerNames = group.proposals.map((item) => item.cleanerName).join(', ');
                        const minConfidence = Math.min(...group.proposals.map((item) => item.confidence));
                        const first = group.proposals[0];
                        const reasons = uniqueText(group.proposals.flatMap((item) => item.reasons)).slice(0, 2);
                        const warnings = uniqueText(group.proposals.flatMap((item) => item.warnings));
                        const isTeam = group.proposals.length > 1 || (first.requiredCleaners || 1) > 1;
                        const originalTimeLabel = `${group.task?.displayStartTime || '--:--'}–${group.task?.displayEndTime || '--:--'}`;
                        const proposedTimeLabel = first.proposedStartTime && first.proposedEndTime ? `${first.proposedStartTime}–${first.proposedEndTime}` : null;
                        const showProposedTime = Boolean(proposedTimeLabel && proposedTimeLabel !== originalTimeLabel);

                        return (
                          <div key={group.taskId} className="rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-4">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <p className="break-words text-sm font-semibold text-[#171321]">{group.task?.property || 'Limpieza'}</p>
                                <p className="text-xs text-[#6b627a]">{group.task?.date || 'Sin fecha'} · tarea {originalTimeLabel} · {minutesToHoursLabel(first.durationMinutes)}{isTeam ? ' por persona' : ''}</p>
                                {showProposedTime && (
                                  <p className="mt-1 text-xs font-semibold text-[#310984]">Horario propuesto: {proposedTimeLabel} dentro de checkout–checkin</p>
                                )}
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
                </TabsContent>

                <TabsContent value="conflicts" className="mt-0 space-y-4">
                  {draftWarnings.length === 0 && proposal.conflicts.length === 0 ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      No hay conflictos visibles en el borrador actual.
                    </div>
                  ) : (
                    <>
                      {draftWarnings.length > 0 && (
                        <div className="space-y-3 rounded-3xl border border-amber-200 bg-amber-50/70 p-4 md:p-5">
                          <div className="flex items-center gap-2 text-base font-semibold text-[#171321]">
                            <AlertTriangle className="h-5 w-5 text-amber-600" /> Avisos del calendario editable
                          </div>
                          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                            {draftWarnings.map((warning) => (
                              <div key={warning.id} className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
                                <Badge variant="outline" className={warning.severity === 'blocking' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                                  {warning.severity === 'blocking' ? 'Bloquea' : 'Aviso'}
                                </Badge>
                                <p className="mt-2 text-sm font-semibold text-[#171321]">{warning.title}</p>
                                <p className="mt-1 text-xs leading-5 text-[#6b627a]">{warning.message}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {proposal.conflicts.length > 0 && (
                        <div className="space-y-4 rounded-3xl border border-red-200 bg-red-50/70 p-4 md:p-5">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div className="flex items-center gap-2 text-base font-semibold text-[#171321]">
                              <XCircle className="h-5 w-5 text-red-600" /> Necesitan decisión manual
                            </div>
                            <Badge variant="outline" className="w-fit border-red-200 bg-white text-red-700">
                              {proposal.conflicts.length} pendiente{proposal.conflicts.length === 1 ? '' : 's'}
                            </Badge>
                          </div>
                          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                            {proposal.conflicts.map((conflict) => {
                              const task = tasks.find((item) => item.id === conflict.taskId);
                              return (
                                <div key={`${conflict.taskId}-${conflict.code}`} className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
                                  <p className="break-words text-sm font-semibold text-[#171321]">{task?.property || 'Limpieza'}</p>
                                  <p className="mt-1 text-xs text-[#6b627a]">{task?.date || 'Sin fecha'} · {task?.displayStartTime || '--:--'}–{task?.displayEndTime || '--:--'}</p>
                                  <p className="mt-3 flex gap-2 text-sm leading-5 text-red-700">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {conflict.message}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-start gap-2 text-sm text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>Si el reparto del calendario es correcto, confirma. Se guardarán asignaciones sobre tareas existentes; no se crean tareas nuevas.</p>
                </div>
                <Button
                  className="mt-3 w-full bg-emerald-600 text-white hover:bg-emerald-500"
                  disabled={!canApply}
                  onClick={() => setIsConfirmOpen(true)}
                >
                  {isApplying ? 'Aplicando plan…' : `Revisar y confirmar ${proposalGroups.length} limpieza${proposalGroups.length === 1 ? '' : 's'}`}
                </Button>
              </div>
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
              Se actualizarán tareas existentes con el borrador revisado en calendario y después se crearán los eventos de notificación correspondientes. No se crearán tareas nuevas.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {proposalGroups.map((group) => {
              const cleanerNames = group.proposals.map((item) => item.cleanerName).join(', ');
              const first = group.proposals[0];
              const originalTimeLabel = `${group.task?.displayStartTime || '--:--'}–${group.task?.displayEndTime || '--:--'}`;
              const proposedTimeLabel = first.proposedStartTime && first.proposedEndTime ? `${first.proposedStartTime}–${first.proposedEndTime}` : null;
              const showProposedTime = Boolean(proposedTimeLabel && proposedTimeLabel !== originalTimeLabel);
              return (
                <div key={group.taskId} className="rounded-xl border bg-muted/30 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 break-words">
                      <p className="font-medium">{group.task?.property || 'Limpieza'}</p>
                      <p className="text-muted-foreground">{group.task?.date} · tarea {originalTimeLabel}</p>
                      {showProposedTime && <p className="mt-1 text-xs font-semibold text-[#310984]">Horario propuesto: {proposedTimeLabel}</p>}
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

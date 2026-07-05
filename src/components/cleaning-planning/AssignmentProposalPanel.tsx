import { useState } from 'react';
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
import { AssignmentProposalResult, CleaningPlanningTask } from '@/types/cleaningPlanning';
import { minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { AlertTriangle, CheckCircle2, Lightbulb, Sparkles, XCircle } from 'lucide-react';

interface AssignmentProposalPanelProps {
  proposal: AssignmentProposalResult | null;
  tasks: CleaningPlanningTask[];
  isLoading?: boolean;
  isApplying?: boolean;
  isStale?: boolean;
  onGenerate: () => void;
  onApply: () => Promise<void>;
  onClear: () => void;
}

const proposalTone = (confidence: number): string => {
  if (confidence >= 85) return 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100';
  if (confidence >= 65) return 'border-sky-300/30 bg-sky-400/10 text-sky-100';
  return 'border-amber-300/30 bg-amber-400/10 text-amber-100';
};

export const AssignmentProposalPanel = ({
  proposal,
  tasks,
  isLoading,
  isApplying,
  isStale = false,
  onGenerate,
  onApply,
  onClear,
}: AssignmentProposalPanelProps) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const canApply = Boolean(proposal && proposal.proposals.length > 0 && !isApplying && !isStale);

  const handleConfirmApply = async () => {
    if (!canApply) return;
    await onApply();
    setIsConfirmOpen(false);
  };

  return (
    <>
      <Card className="border-[#8b5cf6]/30 bg-gradient-to-b from-[#1f1633] to-[#10091f] text-white shadow-2xl shadow-[#310984]/25">
        <CardHeader className="space-y-3 border-b border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg tracking-tight">
                <Sparkles className="h-5 w-5 text-[#c7b8ff]" /> Propuesta asistida de planificación
              </CardTitle>
              <p className="mt-1 text-xs text-white/55">
                Borrador validado contra disponibilidad por fecha, buffer operativo, límites diarios y solapes. Requiere revisión humana antes de guardar.
              </p>
            </div>
            {proposal && (
              <Button size="sm" variant="ghost" className="text-white/60 hover:bg-white/10 hover:text-white" onClick={onClear}>
                Limpiar
              </Button>
            )}
          </div>
          <Button
            className="w-full bg-[#310984] text-white shadow-lg shadow-[#310984]/30 hover:bg-[#4c1bb0]"
            disabled={isLoading || tasks.length === 0}
            onClick={onGenerate}
          >
            <Lightbulb className="mr-2 h-4 w-4" /> Proponer asignación
          </Button>
        </CardHeader>

        <CardContent className="space-y-4 p-4">
          {!proposal ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4 text-sm text-white/60">
              Selecciona rango/filtros y pulsa “Proponer asignación”. Verás asignaciones sugeridas con explicación y conflictos separados.
            </div>
          ) : (
            <>
              {isStale && (
                <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs text-amber-50">
                  La propuesta quedó obsoleta porque cambiaron fecha, sede, filtros o datos. Regenera antes de confirmar.
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-lg font-semibold">{proposal.summary.proposedCount}</p>
                  <p className="text-[11px] text-white/50">propuestas</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-lg font-semibold">{proposal.summary.conflictCount}</p>
                  <p className="text-[11px] text-white/50">conflictos</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-lg font-semibold">{minutesToHoursLabel(proposal.summary.proposedMinutes)}</p>
                  <p className="text-[11px] text-white/50">repartidas</p>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3">
                <div className="flex items-start gap-2 text-xs text-emerald-50/85">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                  <p>
                    Revisa la lista antes de confirmar. Al aplicar, se guardan estas asignaciones en tareas y se disparan las notificaciones actuales del sistema.
                  </p>
                </div>
                <Button
                  className="mt-3 w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                  disabled={!canApply}
                  onClick={() => setIsConfirmOpen(true)}
                >
                  {isApplying ? 'Aplicando propuesta…' : `Revisar y confirmar ${proposal.proposals.length} asignación${proposal.proposals.length === 1 ? '' : 'es'}`}
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" /> Asignaciones propuestas
                </div>
                {proposal.proposals.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/55">
                    No se pudo proponer ninguna asignación segura con los datos actuales.
                  </div>
                ) : (
                  <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                    {proposal.proposals.map((item) => {
                      const task = taskById.get(item.taskId);
                      return (
                        <div key={`${item.taskId}-${item.cleanerId}-${item.assignmentIndex || 1}`} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">{task?.property || 'Tarea'}</p>
                              <p className="text-xs text-white/55">{task?.date || 'Sin fecha'} · {task?.displayStartTime || '--:--'}–{task?.displayEndTime || '--:--'} · {minutesToHoursLabel(item.durationMinutes)}</p>
                              <p className="text-xs text-white/55">
                                → {item.cleanerName} · {item.propertyGroupName || 'Edificio'}
                                {item.requiredCleaners && item.requiredCleaners > 1 ? ` · persona ${item.assignmentIndex || 1}/${item.requiredCleaners}` : ''}
                              </p>
                              {task?.cleaner && <p className="text-[11px] text-white/45">Actual: {task.cleaner}</p>}
                            </div>
                            <Badge variant="outline" className={proposalTone(item.confidence)}>{item.confidence}%</Badge>
                          </div>
                          <ul className="mt-2 space-y-1 text-xs text-white/55">
                            {item.reasons.slice(0, 3).map((reason) => <li key={reason}>• {reason}</li>)}
                            {item.warnings.map((warning) => <li key={warning} className="text-amber-100">• {warning}</li>)}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {proposal.conflicts.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <XCircle className="h-4 w-4 text-red-300" /> Revisión manual
                  </div>
                  <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                    {proposal.conflicts.map((conflict) => {
                      const task = taskById.get(conflict.taskId);
                      return (
                        <div key={`${conflict.taskId}-${conflict.code}`} className="rounded-2xl border border-red-300/20 bg-red-500/10 p-3">
                          <p className="text-sm font-medium text-white">{task?.property || 'Tarea'}</p>
                          <p className="text-xs text-white/55">{task?.date || 'Sin fecha'} · {task?.displayStartTime || '--:--'}–{task?.displayEndTime || '--:--'}</p>
                          <p className="mt-1 flex gap-2 text-xs text-red-100">
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
            <DialogTitle>Confirmar propuesta de planificación</DialogTitle>
            <DialogDescription>
              Se actualizarán tareas existentes y se dispararán las notificaciones actuales del sistema. No se crearán tareas nuevas.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {proposal?.proposals.map((item) => {
              const task = taskById.get(item.taskId);
              return (
                <div key={`${item.taskId}-${item.cleanerId}-${item.assignmentIndex || 1}`} className="rounded-xl border bg-muted/30 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 break-words">
                      <p className="font-medium">{task?.property || 'Tarea'}</p>
                      <p className="text-muted-foreground">{task?.date} · {task?.displayStartTime}–{task?.displayEndTime}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {item.cleanerName}{item.requiredCleaners && item.requiredCleaners > 1 ? ` · ${item.assignmentIndex || 1}/${item.requiredCleaners}` : ''}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.propertyGroupName || 'Edificio'} · {minutesToHoursLabel(item.durationMinutes)} · confianza {item.confidence}%
                  </p>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={isApplying} onClick={() => setIsConfirmOpen(false)}>Cancelar</Button>
            <Button className="bg-[#310984] text-white hover:bg-[#4c1bb0]" disabled={!canApply} onClick={handleConfirmApply}>
              {isApplying ? 'Guardando…' : 'Confirmar y guardar asignaciones'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

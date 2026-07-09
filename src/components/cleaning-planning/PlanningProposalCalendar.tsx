import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, RotateCcw, ShieldAlert, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Cleaner } from '@/types/calendar';
import { AssignmentProposal, CleaningPlanningTask } from '@/types/cleaningPlanning';
import { CleanerGroupAssignment } from '@/types/propertyGroups';
import { minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { isTaskAssignedToCleaner } from '@/utils/taskAssignments';

export type PlanningProposalDraftWarningSeverity = 'blocking' | 'warning';

export interface PlanningProposalDraftWarning {
  id: string;
  severity: PlanningProposalDraftWarningSeverity;
  title: string;
  message: string;
  taskId?: string;
  cleanerId?: string;
}

interface PlanningProposalCalendarProps {
  originalProposals: AssignmentProposal[];
  draftProposals: AssignmentProposal[];
  tasks: CleaningPlanningTask[];
  calendarTasks: CleaningPlanningTask[];
  cleaners: Cleaner[];
  activeCleanerAssignments?: CleanerGroupAssignment[];
  excludedCleanerAssignments?: CleanerGroupAssignment[];
  isStale?: boolean;
  onDraftProposalsChange: (proposals: AssignmentProposal[]) => void;
  onDraftWarningsChange: (warnings: PlanningProposalDraftWarning[]) => void;
}

interface CalendarItem {
  id: string;
  taskId: string;
  proposalIndex?: number;
  source: 'existing' | 'hermes' | 'manual';
  task: CleaningPlanningTask;
  cleanerId: string;
  cleanerName: string;
  startMinute: number;
  endMinute: number;
  editable: boolean;
  isManualChange: boolean;
}

const PIXELS_PER_MINUTE = 1.15;
const MIN_CARD_HEIGHT = 52;

const toMinutes = (value?: string): number => {
  const match = value?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 9 * 60;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return Math.max(0, Math.min(23 * 60 + 59, hours * 60 + minutes));
};

const fromMinutes = (value: number): string => {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, value));
  const hours = Math.floor(clamped / 60).toString().padStart(2, '0');
  const minutes = (clamped % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const getTaskStart = (task: CleaningPlanningTask, proposal?: AssignmentProposal): number => toMinutes(
  proposal?.proposedStartTime || task.displayStartTime || task.startTime,
);

const getTaskEnd = (task: CleaningPlanningTask, proposal?: AssignmentProposal): number => {
  const explicitEnd = toMinutes(proposal?.proposedEndTime || task.displayEndTime || task.endTime);
  const start = getTaskStart(task, proposal);
  return Math.max(explicitEnd, start + Math.max(proposal?.durationMinutes || task.durationMinutes || 30, 30));
};

const getAssignedCleanerIds = (task: CleaningPlanningTask, cleaners: Cleaner[]): string[] => {
  const assignmentIds = (task.assignments || [])
    .map((assignment) => assignment.cleaner_id)
    .filter(Boolean);
  if (assignmentIds.length > 0) return Array.from(new Set(assignmentIds));
  if (task.cleanerId) return [task.cleanerId];
  if (!task.cleaner) return [];
  const matchedCleaner = cleaners.find((cleaner) => isTaskAssignedToCleaner(task, cleaner.id, cleaner.name));
  return matchedCleaner ? [matchedCleaner.id] : [];
};

const uniqueDates = (tasks: CleaningPlanningTask[], draftProposals: AssignmentProposal[]): string[] => {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const dates = new Set<string>();
  tasks.forEach((task) => dates.add(task.date));
  draftProposals.forEach((proposal) => {
    const task = taskById.get(proposal.taskId);
    if (task?.date) dates.add(task.date);
  });
  return Array.from(dates).sort();
};

const warningKey = (prefix: string, ...parts: Array<string | number | undefined>): string => `${prefix}:${parts.filter(Boolean).join(':')}`;

const getBuildingIdForProposal = (proposal: AssignmentProposal, task?: CleaningPlanningTask): string | undefined => (
  proposal.propertyGroupId || task?.detectedBuilding?.propertyGroupId
);

const buildDraftWarnings = ({
  items,
  draftProposals,
  originalProposals,
  tasks,
  activeCleanerAssignments,
  excludedCleanerAssignments,
}: {
  items: CalendarItem[];
  draftProposals: AssignmentProposal[];
  originalProposals: AssignmentProposal[];
  tasks: CleaningPlanningTask[];
  activeCleanerAssignments: CleanerGroupAssignment[];
  excludedCleanerAssignments: CleanerGroupAssignment[];
}): PlanningProposalDraftWarning[] => {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const warnings: PlanningProposalDraftWarning[] = [];
  const proposalsByTaskCleaner = new Map<string, AssignmentProposal[]>();

  draftProposals.forEach((proposal) => {
    const key = `${proposal.taskId}:${proposal.cleanerId}`;
    const bucket = proposalsByTaskCleaner.get(key) || [];
    bucket.push(proposal);
    proposalsByTaskCleaner.set(key, bucket);
  });

  proposalsByTaskCleaner.forEach((bucket, key) => {
    if (bucket.length <= 1) return;
    const [taskId, cleanerId] = key.split(':');
    const task = taskById.get(taskId);
    warnings.push({
      id: warningKey('duplicate-cleaner', taskId, cleanerId),
      severity: 'blocking',
      title: 'Limpiadora duplicada en la misma tarea',
      message: `${bucket[0].cleanerName} aparece más de una vez en ${task?.property || 'la misma limpieza'}. Cambia una de las posiciones antes de confirmar.`,
      taskId,
      cleanerId,
    });
  });

  draftProposals.forEach((proposal, index) => {
    const task = taskById.get(proposal.taskId);
    const buildingId = getBuildingIdForProposal(proposal, task);
    if (!buildingId) return;

    const excluded = excludedCleanerAssignments.some((assignment) => (
      assignment.propertyGroupId === buildingId
      && assignment.cleanerId === proposal.cleanerId
      && assignment.roleType === 'excluded'
    ));

    if (excluded) {
      warnings.push({
        id: warningKey('excluded', proposal.taskId, proposal.cleanerId, index),
        severity: 'blocking',
        title: 'No apta para este edificio',
        message: `${proposal.cleanerName} está marcada como No apta para ${proposal.propertyGroupName || task?.detectedBuilding?.propertyGroupName || 'este edificio'}. Cambia la responsable o revisa la ficha del edificio.`,
        taskId: proposal.taskId,
        cleanerId: proposal.cleanerId,
      });
      return;
    }

    const activeTeam = activeCleanerAssignments.filter((assignment) => (
      assignment.propertyGroupId === buildingId
      && assignment.roleType !== 'excluded'
      && assignment.isActive
    ));
    const hasActiveTeam = activeTeam.length > 0;
    const isInTeam = activeTeam.some((assignment) => assignment.cleanerId === proposal.cleanerId);
    const originalCleanerId = originalProposals[index]?.cleanerId;

    if (hasActiveTeam && !isInTeam && originalCleanerId !== proposal.cleanerId) {
      warnings.push({
        id: warningKey('outside-team', proposal.taskId, proposal.cleanerId, index),
        severity: 'warning',
        title: 'Fuera del equipo habitual',
        message: `${proposal.cleanerName} no figura como titular, suplente o backup de ${proposal.propertyGroupName || task?.detectedBuilding?.propertyGroupName || 'este edificio'}. Puedes confirmarlo si es una decisión consciente.`,
        taskId: proposal.taskId,
        cleanerId: proposal.cleanerId,
      });
    }
  });

  const itemsByCleanerDate = new Map<string, CalendarItem[]>();
  items.forEach((item) => {
    const key = `${item.cleanerId}:${item.task.date}`;
    const bucket = itemsByCleanerDate.get(key) || [];
    bucket.push(item);
    itemsByCleanerDate.set(key, bucket);
  });

  itemsByCleanerDate.forEach((bucket) => {
    const sorted = [...bucket].sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
    sorted.forEach((item, index) => {
      const next = sorted[index + 1];
      if (!next || item.endMinute <= next.startMinute) return;
      warnings.push({
        id: warningKey('overlap', item.cleanerId, item.taskId, next.taskId),
        severity: 'blocking',
        title: 'Solape de horario',
        message: `${item.cleanerName} tiene solape entre ${item.task.property} (${fromMinutes(item.startMinute)}-${fromMinutes(item.endMinute)}) y ${next.task.property} (${fromMinutes(next.startMinute)}-${fromMinutes(next.endMinute)}).`,
        taskId: item.taskId,
        cleanerId: item.cleanerId,
      });
    });
  });

  return warnings;
};

export const PlanningProposalCalendar = ({
  originalProposals,
  draftProposals,
  tasks,
  calendarTasks,
  cleaners,
  activeCleanerAssignments = [],
  excludedCleanerAssignments = [],
  isStale,
  onDraftProposalsChange,
  onDraftWarningsChange,
}: PlanningProposalCalendarProps) => {
  const dates = useMemo(() => uniqueDates(calendarTasks, draftProposals), [calendarTasks, draftProposals]);
  const [selectedDate, setSelectedDate] = useState(() => dates[0] || '');

  useEffect(() => {
    if (!dates.length) return;
    if (!selectedDate || !dates.includes(selectedDate)) setSelectedDate(dates[0]);
  }, [dates, selectedDate]);

  const taskById = useMemo(() => new Map(calendarTasks.map((task) => [task.id, task])), [calendarTasks]);
  const cleanerById = useMemo(() => new Map(cleaners.map((cleaner) => [cleaner.id, cleaner])), [cleaners]);
  const draftedTaskIds = useMemo(() => new Set(draftProposals.map((proposal) => proposal.taskId)), [draftProposals]);

  const calendarItems = useMemo<CalendarItem[]>(() => {
    const items: CalendarItem[] = [];

    calendarTasks.forEach((task) => {
      if (draftedTaskIds.has(task.id)) return;
      const assignedCleanerIds = getAssignedCleanerIds(task, cleaners);
      assignedCleanerIds.forEach((cleanerId) => {
        const cleaner = cleanerById.get(cleanerId);
        items.push({
          id: `existing:${task.id}:${cleanerId}`,
          taskId: task.id,
          source: 'existing',
          task,
          cleanerId,
          cleanerName: cleaner?.name || task.cleaner || 'Sin nombre',
          startMinute: getTaskStart(task),
          endMinute: getTaskEnd(task),
          editable: false,
          isManualChange: false,
        });
      });
    });

    draftProposals.forEach((proposal, proposalIndex) => {
      const task = taskById.get(proposal.taskId);
      if (!task) return;
      const original = originalProposals[proposalIndex];
      const isManualChange = Boolean(original && original.cleanerId !== proposal.cleanerId);
      items.push({
        id: `draft:${proposal.taskId}:${proposalIndex}`,
        taskId: proposal.taskId,
        proposalIndex,
        source: isManualChange ? 'manual' : 'hermes',
        task,
        cleanerId: proposal.cleanerId,
        cleanerName: proposal.cleanerName,
        startMinute: getTaskStart(task, proposal),
        endMinute: getTaskEnd(task, proposal),
        editable: true,
        isManualChange,
      });
    });

    return items;
  }, [calendarTasks, cleanerById, cleaners, draftedTaskIds, draftProposals, originalProposals, taskById]);

  const warnings = useMemo(() => buildDraftWarnings({
    items: calendarItems,
    draftProposals,
    originalProposals,
    tasks: calendarTasks,
    activeCleanerAssignments,
    excludedCleanerAssignments,
  }), [activeCleanerAssignments, calendarItems, calendarTasks, draftProposals, excludedCleanerAssignments, originalProposals]);

  useEffect(() => {
    onDraftWarningsChange(warnings);
  }, [onDraftWarningsChange, warnings]);

  const manualChangeCount = useMemo(() => draftProposals.filter((proposal, index) => (
    originalProposals[index]?.cleanerId && originalProposals[index].cleanerId !== proposal.cleanerId
  )).length, [draftProposals, originalProposals]);

  const dayItems = useMemo(() => calendarItems.filter((item) => item.task.date === selectedDate), [calendarItems, selectedDate]);
  const visibleCleanerIds = useMemo(() => {
    const ids = new Set(dayItems.map((item) => item.cleanerId));
    draftProposals.forEach((proposal) => {
      const task = taskById.get(proposal.taskId);
      if (task?.date === selectedDate) ids.add(proposal.cleanerId);
    });
    return ids;
  }, [dayItems, draftProposals, selectedDate, taskById]);
  const visibleCleaners = useMemo(() => cleaners.filter((cleaner) => visibleCleanerIds.has(cleaner.id)), [cleaners, visibleCleanerIds]);
  const unassignedTasks = useMemo(() => calendarTasks
    .filter((task) => task.date === selectedDate)
    .filter((task) => !draftedTaskIds.has(task.id))
    .filter((task) => getAssignedCleanerIds(task, cleaners).length === 0), [calendarTasks, cleaners, draftedTaskIds, selectedDate]);

  const bounds = useMemo(() => {
    const starts = dayItems.map((item) => item.startMinute);
    const ends = dayItems.map((item) => item.endMinute);
    const minStart = starts.length ? Math.min(...starts, 8 * 60) : 8 * 60;
    const maxEnd = ends.length ? Math.max(...ends, 18 * 60) : 18 * 60;
    return {
      start: Math.max(0, Math.floor(minStart / 60) * 60),
      end: Math.min(23 * 60 + 59, Math.ceil(maxEnd / 60) * 60),
    };
  }, [dayItems]);

  const timelineHeight = Math.max(520, (bounds.end - bounds.start) * PIXELS_PER_MINUTE);
  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    for (let minute = bounds.start; minute <= bounds.end; minute += 60) markers.push(minute);
    return markers;
  }, [bounds.end, bounds.start]);

  const resetDraft = () => onDraftProposalsChange(originalProposals.map((proposal) => ({ ...proposal })));

  const handleCleanerChange = (proposalIndex: number, cleanerId: string) => {
    const cleaner = cleanerById.get(cleanerId);
    if (!cleaner) return;
    onDraftProposalsChange(draftProposals.map((proposal, index) => (
      index === proposalIndex
        ? { ...proposal, cleanerId: cleaner.id, cleanerName: cleaner.name }
        : proposal
    )));
  };

  const dayBlockingWarnings = warnings.filter((warning) => warning.severity === 'blocking');
  const daySoftWarnings = warnings.filter((warning) => warning.severity === 'warning');

  return (
    <Card className="border-[#310984]/12 bg-[#fbfaff] shadow-sm">
      <CardHeader className="space-y-4 border-b border-[#310984]/10 pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg text-[#171321]">
              <CalendarDays className="h-5 w-5 text-[#310984]" /> Plan calendario editable
            </CardTitle>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#6b627a]">
              Sandbox visual: mueve responsables en el borrador, revisa solapes y confirma solo cuando el reparto encaje. No guarda nada hasta confirmar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-[#310984]/20 bg-white text-[#310984]">
              Cambios pendientes: {manualChangeCount}
            </Badge>
            <Button type="button" variant="outline" size="sm" className="border-[#310984]/15 bg-white text-[#310984]" onClick={resetDraft}>
              <RotateCcw className="mr-2 h-4 w-4" /> Restablecer propuesta
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {dates.map((date) => (
            <Button
              key={date}
              type="button"
              variant={date === selectedDate ? 'default' : 'outline'}
              size="sm"
              className={date === selectedDate ? 'bg-[#310984] text-white hover:bg-[#23066a]' : 'border-[#310984]/15 bg-white text-[#310984]'}
              onClick={() => setSelectedDate(date)}
            >
              {date}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 md:p-5">
        {isStale && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Este calendario pertenece a un plan desactualizado. Regenera antes de guardar.
          </div>
        )}

        {(dayBlockingWarnings.length > 0 || daySoftWarnings.length > 0) && (
          <div className="grid gap-3 lg:grid-cols-2">
            {dayBlockingWarnings.length > 0 && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
                  <ShieldAlert className="h-4 w-4" /> Bloqueos antes de confirmar
                </div>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-red-700">
                  {dayBlockingWarnings.slice(0, 5).map((warning) => <li key={warning.id}>• {warning.title}: {warning.message}</li>)}
                </ul>
              </div>
            )}
            {daySoftWarnings.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <AlertTriangle className="h-4 w-4" /> Avisos operativos
                </div>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-800">
                  {daySoftWarnings.slice(0, 5).map((warning) => <li key={warning.id}>• {warning.title}: {warning.message}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="overflow-x-auto rounded-3xl border border-[#310984]/10 bg-white scrollbar-gutter-stable" aria-label="Calendario editable del plan recomendado">
          <div className="flex min-w-max">
            <div className="sticky left-0 z-20 w-20 shrink-0 border-r border-[#310984]/10 bg-[#f7f5fb]">
              <div className="sticky top-0 z-10 flex h-12 items-center justify-center border-b border-[#310984]/10 text-[11px] font-bold uppercase tracking-widest text-[#6b627a]">
                Hora
              </div>
              <div className="relative" style={{ height: timelineHeight }}>
                {timeMarkers.map((minute) => (
                  <div
                    key={minute}
                    className="absolute left-0 right-0 border-t border-[#310984]/10 px-2 pt-1 text-[11px] font-medium text-[#6b627a]"
                    style={{ top: (minute - bounds.start) * PIXELS_PER_MINUTE }}
                  >
                    {fromMinutes(minute)}
                  </div>
                ))}
              </div>
            </div>

            {visibleCleaners.length === 0 ? (
              <div className="flex min-h-[260px] w-[640px] items-center justify-center p-8 text-center text-sm text-[#6b627a]">
                No hay tareas asignadas ni propuestas para este día. Revisa filtros o conflictos manuales.
              </div>
            ) : visibleCleaners.map((cleaner) => {
              const cleanerItems = dayItems
                .filter((item) => item.cleanerId === cleaner.id)
                .sort((a, b) => a.startMinute - b.startMinute || a.task.property.localeCompare(b.task.property));

              return (
                <div key={cleaner.id} className="w-[250px] shrink-0 border-r border-[#310984]/10 last:border-r-0">
                  <div className="sticky top-0 z-10 flex h-12 items-center justify-between gap-2 border-b border-[#310984]/10 bg-white px-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#171321]">{cleaner.name}</p>
                      <p className="text-[11px] text-[#6b627a]">{cleanerItems.length} bloque{cleanerItems.length === 1 ? '' : 's'}</p>
                    </div>
                    <Users className="h-4 w-4 text-[#310984]" />
                  </div>

                  <div className="relative bg-[linear-gradient(to_bottom,rgba(49,9,132,0.08)_1px,transparent_1px)]" style={{ height: timelineHeight, backgroundSize: `100% ${60 * PIXELS_PER_MINUTE}px` }}>
                    {cleanerItems.map((item) => {
                      const top = Math.max(0, (item.startMinute - bounds.start) * PIXELS_PER_MINUTE);
                      const height = Math.max(MIN_CARD_HEIGHT, (item.endMinute - item.startMinute) * PIXELS_PER_MINUTE - 4);
                      const sourceLabel = item.source === 'existing' ? 'Ya asignada' : item.source === 'manual' ? 'Cambio manual' : 'Hermes';
                      const tone = item.source === 'existing'
                        ? 'border-[#310984]/15 bg-slate-50 text-slate-700'
                        : item.source === 'manual'
                          ? 'border-amber-300 bg-amber-50 text-amber-900'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-900';

                      return (
                        <div
                          key={item.id}
                          className={`absolute left-2 right-2 overflow-hidden rounded-2xl border p-3 shadow-sm ${tone}`}
                          style={{ top, minHeight: height }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="break-words text-xs font-semibold leading-4">{item.task.property}</p>
                              <p className="mt-1 flex items-center gap-1 text-[11px] opacity-80">
                                <Clock className="h-3 w-3" /> {fromMinutes(item.startMinute)}-{fromMinutes(item.endMinute)} · {minutesToHoursLabel(item.endMinute - item.startMinute)}
                              </p>
                            </div>
                            <Badge variant="outline" className="shrink-0 bg-white/80 text-[10px]">{sourceLabel}</Badge>
                          </div>

                          {item.editable && item.proposalIndex !== undefined && (
                            <div className="mt-2 space-y-1">
                              <label className="text-[11px] font-semibold text-[#171321]">Cambiar responsable</label>
                              <Select value={item.cleanerId} onValueChange={(cleanerId) => handleCleanerChange(item.proposalIndex!, cleanerId)}>
                                <SelectTrigger className="h-9 min-h-[44px] border-[#310984]/15 bg-white text-xs">
                                  <SelectValue placeholder="Responsable" />
                                </SelectTrigger>
                                <SelectContent>
                                  {cleaners.map((option) => (
                                    <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {unassignedTasks.length > 0 && (
          <div className="rounded-2xl border border-dashed border-[#310984]/15 bg-white p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#171321]">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Sin colocar en el calendario
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {unassignedTasks.slice(0, 9).map((task) => (
                <div key={task.id} className="rounded-xl bg-[#faf8ff] p-3 text-xs text-[#6b627a]">
                  <p className="font-semibold text-[#171321]">{task.property}</p>
                  <p>{task.displayStartTime}-{task.displayEndTime} · {task.detectedBuilding?.propertyGroupName || 'sin edificio'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {warnings.length === 0 && manualChangeCount === 0 && (
          <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> El calendario recomendado no muestra solapes ni bloqueos con los datos disponibles.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

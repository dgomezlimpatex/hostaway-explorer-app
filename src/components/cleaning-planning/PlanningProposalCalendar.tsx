import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  GripVertical,
  MapPin,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Cleaner } from '@/types/calendar';
import {
  AssignmentProposal,
  CleaningPlanningTask,
  EffectiveWorkerAvailability,
} from '@/types/cleaningPlanning';
import { CleanerGroupAssignment } from '@/types/propertyGroups';
import { minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { isTaskAssignedToCleaner } from '@/utils/taskAssignments';
import {
  getTaskWorkerCount,
  getTaskWorkerPlannedDurationMinutes,
} from '@/utils/cleaning-planning/capacity';
import {
  validateDraftAssignmentMove,
  type DraftAssignmentMoveValidation,
} from '@/utils/cleaning-planning/proposalEngine';

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
  effectiveAvailability: EffectiveWorkerAvailability[];
  activeCleanerAssignments?: CleanerGroupAssignment[];
  excludedCleanerAssignments?: CleanerGroupAssignment[];
  isStale?: boolean;
  onDraftProposalsChange: (proposals: AssignmentProposal[]) => void;
  onDraftWarningsChange: (warnings: PlanningProposalDraftWarning[]) => void;
}

type DragPayload = {
  taskId: string;
  proposalIndex?: number;
  sourceCleanerId?: string;
};
type SelectedTask = { taskId: string; proposalIndex?: number };

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
  assignmentRole?: AssignmentProposal['assignmentRole'];
}

const PIXELS_PER_MINUTE = 1.4;
const MIN_CARD_WIDTH = 112;
const SNAP_MINUTES = 15;
const QUARTER_HOUR_GRID_SIZE = SNAP_MINUTES * PIXELS_PER_MINUTE;
const UNASSIGNED_PLACEMENT_ID = '__unassigned__';

const DraggableHandle = ({
  id,
  payload,
  disabled,
}: {
  id: string;
  payload: DragPayload;
  disabled?: boolean;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: payload,
    disabled,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-label="Arrastrar para cambiar responsable u horario"
      data-dnd-handle
      className={`min-h-[36px] min-w-[32px] touch-none rounded-lg p-1 text-[#310984] hover:bg-[#efe9fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#310984] ${isDragging ? 'opacity-40' : ''}`}
      onClick={(event) => event.stopPropagation()}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="mx-auto h-4 w-4" />
    </button>
  );
};

const CleanerDropZone = ({
  cleanerId,
  feedback,
  className,
  dropId,
  children,
}: {
  cleanerId: string;
  feedback?: DraftAssignmentMoveValidation;
  className?: string;
  dropId?: string;
  children: ReactNode;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: dropId || `cleaner:${cleanerId}`,
  });
  const tone =
    isOver && feedback
      ? feedback.valid
        ? 'ring-2 ring-inset ring-emerald-500 bg-emerald-50/50'
        : 'ring-2 ring-inset ring-amber-400 bg-amber-50/50'
      : '';
  return (
    <div
      ref={setNodeRef}
      data-dnd-drop-worker={cleanerId}
      className={`${className || ''} ${tone}`}
    >
      {children}
    </div>
  );
};

const getActivatorClientX = (event: Event): number | undefined => {
  if ('clientX' in event && typeof event.clientX === 'number')
    return event.clientX;
  if ('touches' in event) {
    const touchEvent = event as TouchEvent;
    return (
      touchEvent.touches[0]?.clientX ?? touchEvent.changedTouches[0]?.clientX
    );
  }
  return undefined;
};

const getDropStartMinute = (
  finalPointerX: number | undefined,
  dropZoneLeft: number,
  timelineStartMinute: number,
  timelineEndMinute: number,
  fallbackMinute: number,
): number => {
  if (finalPointerX === undefined) return fallbackMinute;
  const timelineOffset = Math.max(0, finalPointerX - dropZoneLeft);
  const rawMinute = timelineStartMinute + timelineOffset / PIXELS_PER_MINUTE;
  const snappedMinute = Math.round(rawMinute / SNAP_MINUTES) * SNAP_MINUTES;
  return Math.max(
    timelineStartMinute,
    Math.min(timelineEndMinute, snappedMinute),
  );
};

const toMinutes = (value?: string): number => {
  const match = value?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 9 * 60;
  return Math.max(
    0,
    Math.min(23 * 60 + 59, Number(match[1]) * 60 + Number(match[2])),
  );
};

const fromMinutes = (value: number): string => {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, value));
  return `${Math.floor(clamped / 60)
    .toString()
    .padStart(2, '0')}:${(clamped % 60).toString().padStart(2, '0')}`;
};

const getTaskStart = (
  task: CleaningPlanningTask,
  proposal?: AssignmentProposal,
): number =>
  toMinutes(
    proposal?.proposedStartTime || task.displayStartTime || task.startTime,
  );

const getTaskEnd = (
  task: CleaningPlanningTask,
  proposal?: AssignmentProposal,
): number => {
  const start = getTaskStart(task, proposal);
  if (!proposal && getTaskWorkerCount(task) > 1) {
    const workerDurationMinutes = getTaskWorkerPlannedDurationMinutes(task);
    if (workerDurationMinutes > 0) return start + workerDurationMinutes;
  }
  const explicitEnd = toMinutes(
    proposal?.proposedEndTime || task.displayEndTime || task.endTime,
  );
  return Math.max(
    explicitEnd,
    start +
      Math.max(proposal?.durationMinutes || task.durationMinutes || 30, 30),
  );
};

const getAssignedCleanerIds = (
  task: CleaningPlanningTask,
  cleaners: Cleaner[],
): string[] => {
  const assignmentIds = (task.assignments || [])
    .map((assignment) => assignment.cleaner_id)
    .filter(Boolean);
  if (assignmentIds.length > 0) return Array.from(new Set(assignmentIds));
  if (task.cleanerId) return [task.cleanerId];
  if (!task.cleaner) return [];
  const matchedCleaner = cleaners.find((cleaner) =>
    isTaskAssignedToCleaner(task, cleaner.id, cleaner.name),
  );
  return matchedCleaner ? [matchedCleaner.id] : [];
};

const uniqueDates = (
  tasks: CleaningPlanningTask[],
  draftProposals: AssignmentProposal[],
): string[] => {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const dates = new Set(tasks.map((task) => task.date));
  draftProposals.forEach((proposal) => {
    const task = taskById.get(proposal.taskId);
    if (task?.date) dates.add(task.date);
  });
  return Array.from(dates).sort();
};

const warningKey = (
  prefix: string,
  ...parts: Array<string | number | undefined>
): string => `${prefix}:${parts.filter(Boolean).join(':')}`;

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
    proposalsByTaskCleaner.set(key, [
      ...(proposalsByTaskCleaner.get(key) || []),
      proposal,
    ]);
  });
  proposalsByTaskCleaner.forEach((bucket, key) => {
    if (bucket.length <= 1) return;
    const [taskId, cleanerId] = key.split(':');
    warnings.push({
      id: warningKey('duplicate-cleaner', taskId, cleanerId),
      severity: 'blocking',
      title: 'Trabajadora duplicada',
      message: `${bucket[0].cleanerName} aparece más de una vez en ${taskById.get(taskId)?.property || 'la misma limpieza'}.`,
      taskId,
      cleanerId,
    });
  });

  draftProposals.forEach((proposal, index) => {
    const task = taskById.get(proposal.taskId);
    const buildingId =
      proposal.propertyGroupId || task?.detectedBuilding?.propertyGroupId;
    if (!buildingId) return;
    const excluded = excludedCleanerAssignments.some(
      (assignment) =>
        assignment.propertyGroupId === buildingId &&
        assignment.cleanerId === proposal.cleanerId &&
        assignment.roleType === 'excluded',
    );
    if (excluded) {
      warnings.push({
        id: warningKey('excluded', proposal.taskId, proposal.cleanerId, index),
        severity: 'blocking',
        title: 'No apta para este edificio',
        message: `${proposal.cleanerName} está marcada como no apta para ${proposal.propertyGroupName || task?.detectedBuilding?.propertyGroupName || 'este edificio'}.`,
        taskId: proposal.taskId,
        cleanerId: proposal.cleanerId,
      });
      return;
    }
    const activeTeam = activeCleanerAssignments.filter(
      (assignment) =>
        assignment.propertyGroupId === buildingId &&
        assignment.roleType !== 'excluded' &&
        assignment.isActive,
    );
    const isInTeam = activeTeam.some(
      (assignment) => assignment.cleanerId === proposal.cleanerId,
    );
    if (
      activeTeam.length > 0 &&
      !isInTeam &&
      originalProposals[index]?.cleanerId !== proposal.cleanerId
    ) {
      warnings.push({
        id: warningKey(
          'outside-team',
          proposal.taskId,
          proposal.cleanerId,
          index,
        ),
        severity: 'warning',
        title: 'Fuera del equipo habitual',
        message: `${proposal.cleanerName} no figura en el equipo habitual de ${proposal.propertyGroupName || task?.detectedBuilding?.propertyGroupName || 'este edificio'}.`,
        taskId: proposal.taskId,
        cleanerId: proposal.cleanerId,
      });
    }
    proposal.manualOverrideWarnings?.forEach((message, warningIndex) =>
      warnings.push({
        id: warningKey(
          'manual-override',
          proposal.taskId,
          proposal.cleanerId,
          index,
          warningIndex,
        ),
        severity: 'warning',
        title: 'Excepción manual',
        message,
        taskId: proposal.taskId,
        cleanerId: proposal.cleanerId,
      }),
    );
  });

  const itemsByCleanerDate = new Map<string, CalendarItem[]>();
  items.forEach((item) => {
    const key = `${item.cleanerId}:${item.task.date}`;
    itemsByCleanerDate.set(key, [...(itemsByCleanerDate.get(key) || []), item]);
  });
  itemsByCleanerDate.forEach((bucket) => {
    const sorted = [...bucket].sort(
      (left, right) =>
        left.startMinute - right.startMinute ||
        left.endMinute - right.endMinute,
    );
    sorted.forEach((item, index) => {
      const next = sorted[index + 1];
      if (!next || item.endMinute <= next.startMinute) return;
      warnings.push({
        id: warningKey('overlap', item.cleanerId, item.taskId, next.taskId),
        severity: 'warning',
        title: 'Solape de horario',
        message: `${item.cleanerName} tiene un solape entre ${item.task.property} y ${next.task.property}.`,
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
  calendarTasks,
  cleaners,
  effectiveAvailability,
  activeCleanerAssignments = [],
  excludedCleanerAssignments = [],
  isStale,
  onDraftProposalsChange,
  onDraftWarningsChange,
}: PlanningProposalCalendarProps) => {
  const dates = useMemo(
    () => uniqueDates(calendarTasks, draftProposals),
    [calendarTasks, draftProposals],
  );
  const [selectedDate, setSelectedDate] = useState(() => dates[0] || '');
  const [reassignment, setReassignment] = useState<SelectedTask | null>(null);
  const [selectedTask, setSelectedTask] = useState<SelectedTask | null>(null);
  const [placementCleanerId, setPlacementCleanerId] = useState('');
  const [placementStartTime, setPlacementStartTime] = useState('09:00');
  const [activeDrag, setActiveDrag] = useState<DragPayload | null>(null);
  const [dragHover, setDragHover] = useState<{
    cleanerId: string;
    startMinute: number;
  } | null>(null);
  const [moveNotice, setMoveNotice] = useState<{
    message: string;
    previous?: AssignmentProposal[];
    error?: boolean;
  } | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    if (dates.length && (!selectedDate || !dates.includes(selectedDate)))
      setSelectedDate(dates[0]);
  }, [dates, selectedDate]);

  const taskById = useMemo(
    () => new Map(calendarTasks.map((task) => [task.id, task])),
    [calendarTasks],
  );
  const cleanerById = useMemo(
    () => new Map(cleaners.map((cleaner) => [cleaner.id, cleaner])),
    [cleaners],
  );
  const draftedTaskIds = useMemo(() => {
    const proposalCountByTask = new Map<string, number>();
    draftProposals.forEach((proposal) =>
      proposalCountByTask.set(
        proposal.taskId,
        (proposalCountByTask.get(proposal.taskId) || 0) + 1,
      ),
    );
    return new Set(
      calendarTasks
        .filter(
          (task) =>
            (proposalCountByTask.get(task.id) || 0) >=
            Math.max(1, task.requiredCleaners || 1),
        )
        .map((task) => task.id),
    );
  }, [calendarTasks, draftProposals]);

  const calendarItems = useMemo<CalendarItem[]>(() => {
    const items: CalendarItem[] = [];
    calendarTasks.forEach((task) => {
      if (draftedTaskIds.has(task.id)) return;
      getAssignedCleanerIds(task, cleaners).forEach((cleanerId) => {
        items.push({
          id: `existing:${task.id}:${cleanerId}`,
          taskId: task.id,
          source: 'existing',
          task,
          cleanerId,
          cleanerName:
            cleanerById.get(cleanerId)?.name || task.cleaner || 'Sin nombre',
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
      const isManualChange = Boolean(
        originalProposals[proposalIndex] &&
        originalProposals[proposalIndex].cleanerId !== proposal.cleanerId,
      );
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
        assignmentRole: proposal.assignmentRole,
      });
    });
    return items;
  }, [
    calendarTasks,
    cleanerById,
    cleaners,
    draftedTaskIds,
    draftProposals,
    originalProposals,
    taskById,
  ]);

  const warnings = useMemo(
    () =>
      buildDraftWarnings({
        items: calendarItems,
        draftProposals,
        originalProposals,
        tasks: calendarTasks,
        activeCleanerAssignments,
        excludedCleanerAssignments,
      }),
    [
      activeCleanerAssignments,
      calendarItems,
      calendarTasks,
      draftProposals,
      excludedCleanerAssignments,
      originalProposals,
    ],
  );
  useEffect(
    () => onDraftWarningsChange(warnings),
    [onDraftWarningsChange, warnings],
  );

  const manualChangeCount = useMemo(
    () =>
      draftProposals.filter(
        (proposal, index) =>
          originalProposals[index]?.cleanerId &&
          originalProposals[index].cleanerId !== proposal.cleanerId,
      ).length,
    [draftProposals, originalProposals],
  );
  const dayItems = useMemo(
    () => calendarItems.filter((item) => item.task.date === selectedDate),
    [calendarItems, selectedDate],
  );
  const availableCleanerIds = useMemo(
    () =>
      new Set(
        effectiveAvailability
          .filter(
            (availability) =>
              availability.date === selectedDate &&
              availability.isAvailable &&
              availability.remainingMinutes > 0,
          )
          .map((availability) => availability.cleanerId),
      ),
    [effectiveAvailability, selectedDate],
  );
  const visibleCleanerIds = useMemo(() => {
    const ids = new Set(dayItems.map((item) => item.cleanerId));
    availableCleanerIds.forEach((id) => ids.add(id));
    return ids;
  }, [availableCleanerIds, dayItems]);
  const visibleCleaners = useMemo(
    () => cleaners.filter((cleaner) => visibleCleanerIds.has(cleaner.id)),
    [cleaners, visibleCleanerIds],
  );
  const unassignedTasks = useMemo(
    () =>
      calendarTasks
        .filter(
          (task) =>
            task.date === selectedDate &&
            !draftedTaskIds.has(task.id) &&
            getAssignedCleanerIds(task, cleaners).length === 0,
        )
        .sort((left, right) =>
          (left.propertyCode || left.property).localeCompare(
            right.propertyCode || right.property,
            'es',
            { numeric: true, sensitivity: 'base' },
          ),
        ),
    [calendarTasks, cleaners, draftedTaskIds, selectedDate],
  );

  const bounds = useMemo(() => {
    const starts = dayItems.map((item) => item.startMinute);
    const ends = dayItems.map((item) => item.endMinute);
    return {
      start: Math.max(
        0,
        Math.floor(
          Math.min(...(starts.length ? starts : [8 * 60]), 8 * 60) / 60,
        ) * 60,
      ),
      end: Math.min(
        23 * 60 + 59,
        Math.ceil(Math.max(...(ends.length ? ends : [18 * 60]), 18 * 60) / 60) *
          60,
      ),
    };
  }, [dayItems]);
  const timelineWidth = Math.max(
    760,
    (bounds.end - bounds.start) * PIXELS_PER_MINUTE,
  );
  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    for (let minute = bounds.start; minute <= bounds.end; minute += 60)
      markers.push(minute);
    return markers;
  }, [bounds.end, bounds.start]);

  const validateMove = (
    payload: DragPayload,
    cleanerId: string,
  ): DraftAssignmentMoveValidation => {
    const task = taskById.get(payload.taskId);
    if (!task)
      return {
        valid: false,
        conflict: {
          taskId: payload.taskId,
          code: 'invalid_time_window',
          message: 'La limpieza ya no está disponible.',
        },
      };
    return validateDraftAssignmentMove({
      task,
      cleanerId,
      cleaners,
      availability: effectiveAvailability,
      cleanerGroupAssignments: activeCleanerAssignments,
      draftProposals,
      calendarTasks,
      excludeProposalIndex: payload.proposalIndex,
    });
  };

  const dragFeedback = useMemo(() => {
    if (!activeDrag || isStale)
      return new Map<string, DraftAssignmentMoveValidation>();
    return new Map(
      cleaners.map((cleaner) => [
        cleaner.id,
        validateMove(activeDrag, cleaner.id),
      ]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeCleanerAssignments,
    activeDrag,
    calendarTasks,
    cleaners,
    draftProposals,
    effectiveAvailability,
    isStale,
    taskById,
  ]);

  const handleDragStart = ({ active }: DragStartEvent) => {
    if (isStale) return;
    setMoveNotice(null);
    setActiveDrag(active.data.current as DragPayload);
  };
  const handleDragMove = ({
    active,
    over,
    activatorEvent,
    delta,
  }: DragMoveEvent) => {
    if (!over || !String(over.id).startsWith('cleaner:'))
      return setDragHover(null);
    const payload = active.data.current as DragPayload;
    const task = taskById.get(payload.taskId);
    if (!task) return;
    const pointerX = getActivatorClientX(activatorEvent);
    const fallbackMinute = getTaskStart(
      task,
      payload.proposalIndex === undefined
        ? undefined
        : draftProposals[payload.proposalIndex],
    );
    setDragHover({
      cleanerId: String(over.id).slice('cleaner:'.length),
      startMinute: getDropStartMinute(
        pointerX === undefined ? undefined : pointerX + delta.x,
        over.rect.left,
        bounds.start,
        bounds.end,
        fallbackMinute,
      ),
    });
  };
  const handleDragEnd = ({
    active,
    over,
    activatorEvent,
    delta,
  }: DragEndEvent) => {
    setActiveDrag(null);
    setDragHover(null);
    if (!over) return;
    const destinationId = String(over.id);
    const cleanerPrefix = destinationId.startsWith('cleaner:')
      ? 'cleaner:'
      : destinationId.startsWith('mobile-cleaner:')
        ? 'mobile-cleaner:'
        : '';
    if (!cleanerPrefix) return;
    const payload = active.data.current as DragPayload;
    const task = taskById.get(payload.taskId);
    if (!task) return;
    const fallbackMinute = getTaskStart(
      task,
      payload.proposalIndex === undefined
        ? undefined
        : draftProposals[payload.proposalIndex],
    );
    const pointerX = getActivatorClientX(activatorEvent);
    const dropMinute =
      cleanerPrefix === 'mobile-cleaner:'
        ? fallbackMinute
        : getDropStartMinute(
            pointerX === undefined ? undefined : pointerX + delta.x,
            over.rect.left,
            bounds.start,
            bounds.end,
            fallbackMinute,
          );
    applyPlacement(
      { taskId: payload.taskId, proposalIndex: payload.proposalIndex },
      destinationId.slice(cleanerPrefix.length),
      fromMinutes(dropMinute),
    );
  };

  const resetDraft = () =>
    onDraftProposalsChange(
      originalProposals.map((proposal) => ({ ...proposal })),
    );
  const openReassignment = (taskId: string, proposalIndex?: number) => {
    if (isStale) return;
    const task = taskById.get(taskId);
    if (!task) return;
    const proposal =
      proposalIndex === undefined ? undefined : draftProposals[proposalIndex];
    setPlacementCleanerId(proposal?.cleanerId || '');
    setPlacementStartTime(fromMinutes(getTaskStart(task, proposal)));
    setReassignment({ taskId, proposalIndex });
  };

  const reassignmentTask = reassignment
    ? taskById.get(reassignment.taskId)
    : undefined;
  const candidateListFor = (selection: SelectedTask | null) => {
    const task = selection ? taskById.get(selection.taskId) : undefined;
    if (!selection || !task || isStale) return [];
    const currentCleanerId =
      selection.proposalIndex === undefined
        ? undefined
        : draftProposals[selection.proposalIndex]?.cleanerId;
    const payload: DragPayload = {
      taskId: selection.taskId,
      proposalIndex: selection.proposalIndex,
      sourceCleanerId: currentCleanerId,
    };
    const roleOrder = { primary: 0, secondary: 1, backup: 2 } as const;
    return cleaners
      .filter((cleaner) => cleaner.isActive && cleaner.id !== currentCleanerId)
      .map((cleaner) => ({
        cleaner,
        validation: validateMove(payload, cleaner.id),
      }))
      .sort((left, right) => {
        if (left.validation.valid !== right.validation.valid)
          return left.validation.valid ? -1 : 1;
        const leftOrder = left.validation.assignmentRole
          ? roleOrder[left.validation.assignmentRole]
          : 3;
        const rightOrder = right.validation.assignmentRole
          ? roleOrder[right.validation.assignmentRole]
          : 3;
        return (
          leftOrder - rightOrder ||
          left.cleaner.name.localeCompare(right.cleaner.name, 'es')
        );
      });
  };
  const reassignmentCandidates = useMemo(
    () => candidateListFor(reassignment),
    [
      reassignment,
      cleaners,
      draftProposals,
      effectiveAvailability,
      activeCleanerAssignments,
      calendarTasks,
      isStale,
    ],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const selectedAlternatives = useMemo(
    () => candidateListFor(selectedTask).slice(0, 3),
    [
      selectedTask,
      cleaners,
      draftProposals,
      effectiveAvailability,
      activeCleanerAssignments,
      calendarTasks,
      isStale,
    ],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const stillVisible =
      selectedTask &&
      (dayItems.some(
        (item) =>
          item.taskId === selectedTask.taskId &&
          item.proposalIndex === selectedTask.proposalIndex,
      ) ||
        unassignedTasks.some((task) => task.id === selectedTask.taskId));
    if (stillVisible) return;
    const first = dayItems.find((item) => item.editable);
    setSelectedTask(
      first
        ? { taskId: first.taskId, proposalIndex: first.proposalIndex }
        : unassignedTasks[0]
          ? { taskId: unassignedTasks[0].id }
          : null,
    );
  }, [dayItems, selectedTask, unassignedTasks]);

  const applyPlacement = (
    directPlacement = reassignment,
    cleanerId = placementCleanerId,
    startTime = placementStartTime,
  ) => {
    if (isStale)
      return setMoveNotice({
        message: 'El plan cambió. Regenera antes de mover limpiezas.',
        error: true,
      });
    const task = directPlacement
      ? taskById.get(directPlacement.taskId)
      : undefined;
    if (!directPlacement || !task || !cleanerId) return;
    const previous = draftProposals.map((proposal) => ({ ...proposal }));
    if (cleanerId === UNASSIGNED_PLACEMENT_ID) {
      onDraftProposalsChange(
        draftProposals.filter(
          (proposal) => proposal.taskId !== directPlacement.taskId,
        ),
      );
      setMoveNotice({
        message: `${task.property} queda sin cubrir.`,
        previous,
      });
      setReassignment(null);
      return;
    }
    const cleaner = cleanerById.get(cleanerId);
    if (!cleaner?.isActive || !/^\d{2}:\d{2}$/.test(startTime)) return;
    const buildingId =
      task.detectedBuilding?.status === 'detected'
        ? task.detectedBuilding.propertyGroupId
        : undefined;
    if (
      buildingId &&
      excludedCleanerAssignments.some(
        (assignment) =>
          assignment.propertyGroupId === buildingId &&
          assignment.cleanerId === cleanerId &&
          assignment.roleType === 'excluded',
      )
    )
      return setMoveNotice({
        message: `${cleaner.name} está marcada como no apta para este edificio.`,
        error: true,
      });
    const validation = validateMove(
      {
        taskId: directPlacement.taskId,
        proposalIndex: directPlacement.proposalIndex,
        sourceCleanerId:
          directPlacement.proposalIndex === undefined
            ? undefined
            : draftProposals[directPlacement.proposalIndex]?.cleanerId,
      },
      cleanerId,
    );
    const durationMinutes = Math.max(
      30,
      validation.durationMinutes ?? task.durationMinutes ?? 30,
    );
    const manualOverrideWarnings =
      validation.valid || !validation.conflict
        ? []
        : [validation.conflict.message];
    const activeAssignment = activeCleanerAssignments.find(
      (assignment) =>
        assignment.propertyGroupId === buildingId &&
        assignment.cleanerId === cleanerId &&
        assignment.isActive &&
        assignment.roleType !== 'excluded',
    );
    const fields = {
      cleanerId: cleaner.id,
      cleanerName: cleaner.name,
      assignmentRole: (validation.assignmentRole ||
        activeAssignment?.roleType) as AssignmentProposal['assignmentRole'],
      proposedStartTime: startTime,
      proposedEndTime: fromMinutes(toMinutes(startTime) + durationMinutes),
      durationMinutes,
      manualOverrideWarnings,
      warnings: manualOverrideWarnings,
      capacityAfterAssignment: validation.capacityAfterAssignment || {
        assignedMinutes: 0,
        remainingMinutes: 0,
      },
    };
    const next =
      directPlacement.proposalIndex !== undefined
        ? draftProposals.map((proposal, index) =>
            index === directPlacement.proposalIndex
              ? { ...proposal, ...fields }
              : proposal,
          )
        : [
            ...draftProposals,
            {
              taskId: task.id,
              ...fields,
              propertyGroupId: buildingId,
              propertyGroupName:
                task.detectedBuilding?.status === 'detected'
                  ? task.detectedBuilding.propertyGroupName
                  : undefined,
              requiredCleaners: Math.max(1, task.requiredCleaners || 1),
              assignmentIndex: draftProposals.filter(
                (proposal) => proposal.taskId === task.id,
              ).length,
              confidence: 0,
              reasons: ['Asignación manual durante la revisión'],
            },
          ];
    onDraftProposalsChange(next);
    setSelectedTask({
      taskId: task.id,
      proposalIndex: directPlacement.proposalIndex ?? next.length - 1,
    });
    setMoveNotice({
      message: `${task.property} colocada con ${cleaner.name} a las ${startTime}.`,
      previous,
    });
    setReassignment(null);
  };

  const selectedItem = dayItems.find(
    (item) =>
      item.taskId === selectedTask?.taskId &&
      item.proposalIndex === selectedTask?.proposalIndex,
  );
  const selectedPlanningTask = selectedTask
    ? taskById.get(selectedTask.taskId)
    : undefined;
  const selectedProposal =
    selectedTask?.proposalIndex === undefined
      ? undefined
      : draftProposals[selectedTask.proposalIndex];
  const dayBlockingWarnings = warnings.filter(
    (warning) => warning.severity === 'blocking',
  );
  const daySoftWarnings = warnings.filter(
    (warning) => warning.severity === 'warning',
  );

  return (
    <DndContext
      sensors={sensors}
      autoScroll={false}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragCancel={() => {
        setActiveDrag(null);
        setDragHover(null);
      }}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-[#310984]/10 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#310984]/10 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#310984] text-white">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#7a6d91]">
                  Reparto del día
                </p>
                <h2 className="text-lg font-bold text-[#171321]">
                  Planificación diaria
                </h2>
                <p className="text-xs text-[#6b627a]">
                  No se guarda nada hasta guardar el reparto.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 px-3 text-emerald-800"
              >
                {dayItems.filter((item) => item.source !== 'existing').length}{' '}
                propuestas
              </Badge>
              <Badge
                variant="outline"
                className="border-red-200 bg-red-50 px-3 text-red-800"
              >
                {unassignedTasks.length} sin cubrir
              </Badge>
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 px-3 text-amber-800"
              >
                {dayBlockingWarnings.length + daySoftWarnings.length} avisos
              </Badge>
              <Badge
                variant="outline"
                className="border-[#310984]/15 bg-[#faf8ff] px-3 text-[#310984]"
              >
                Cambios pendientes: {manualChangeCount}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-[#310984]/15 text-[#310984]"
                onClick={resetDraft}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Restablecer
              </Button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 py-3">
            {dates.map((date) => (
              <Button
                key={date}
                type="button"
                size="sm"
                variant={date === selectedDate ? 'default' : 'outline'}
                className={`shrink-0 rounded-full ${date === selectedDate ? 'bg-[#310984] text-white hover:bg-[#23066a]' : 'border-[#310984]/15 text-[#310984]'}`}
                onClick={() => setSelectedDate(date)}
              >
                {date}
              </Button>
            ))}
          </div>
        </section>

        {isStale && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Este plan está desactualizado. Regenera antes de guardar.
          </div>
        )}
        {moveNotice && (
          <div
            role="alert"
            aria-live="assertive"
            data-dnd-notice
            className={`flex items-center justify-between gap-3 rounded-2xl border p-3 text-sm ${moveNotice.error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}
          >
            <span>{moveNotice.message}</span>
            {moveNotice.previous && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onDraftProposalsChange(moveNotice.previous!);
                  setMoveNotice(null);
                }}
              >
                Deshacer
              </Button>
            )}
          </div>
        )}

        {activeDrag && (
          <div
            data-dnd-mobile-destinations
            className="max-[400px]:block rounded-2xl border border-[#310984]/15 bg-white p-3 lg:hidden"
          >
            <p className="mb-2 text-xs font-semibold text-[#310984]">
              Suelta en una trabajadora
            </p>
            <div className="space-y-2">
              {cleaners.map((cleaner) => (
                <CleanerDropZone
                  key={cleaner.id}
                  cleanerId={cleaner.id}
                  dropId={`mobile-cleaner:${cleaner.id}`}
                  feedback={dragFeedback.get(cleaner.id)}
                  className="min-h-[48px] rounded-xl border p-3 text-sm font-semibold"
                >
                  {cleaner.name}
                </CleanerDropZone>
              ))}
            </div>
          </div>
        )}

        {(dayBlockingWarnings.length > 0 || daySoftWarnings.length > 0) && (
          <div className="grid gap-3 lg:grid-cols-2">
            {dayBlockingWarnings.length > 0 && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
                  <ShieldAlert className="h-4 w-4" />{' '}
                  {dayBlockingWarnings.length} bloqueos antes de confirmar
                </p>
                <ul className="mt-2 space-y-1 text-xs text-red-700">
                  {dayBlockingWarnings.slice(0, 4).map((warning) => (
                    <li key={warning.id}>• {warning.message}</li>
                  ))}
                </ul>
              </div>
            )}
            {daySoftWarnings.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <AlertTriangle className="h-4 w-4" /> {daySoftWarnings.length}{' '}
                  avisos operativos
                </p>
                <ul className="mt-2 space-y-1 text-xs text-amber-800">
                  {daySoftWarnings.slice(0, 4).map((warning) => (
                    <li key={warning.id}>• {warning.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div
          className="space-y-2 lg:hidden"
          aria-label="Lista del reparto propuesto"
        >
          {dayItems
            .sort((left, right) => left.startMinute - right.startMinute)
            .map((item) => (
              <div
                key={item.id}
                className="flex min-h-[72px] items-center rounded-2xl border border-[#310984]/10 bg-white p-2 shadow-sm"
              >
                <button
                  type="button"
                  disabled={!item.editable || isStale}
                  className="min-w-0 flex-1 p-2 text-left"
                  onClick={() =>
                    item.editable &&
                    openReassignment(item.taskId, item.proposalIndex)
                  }
                >
                  <span
                    className={`text-xs font-semibold ${item.source === 'hermes' ? 'text-emerald-700' : item.source === 'manual' ? 'text-amber-700' : 'text-slate-600'}`}
                  >
                    ●{' '}
                    {item.source === 'hermes'
                      ? 'Propuesta Hermes'
                      : item.source === 'manual'
                        ? 'Revisada'
                        : 'Ya asignada'}
                  </span>
                  <span className="mt-1 block font-bold text-[#171321]">
                    {item.task.property}
                  </span>
                  <span className="mt-1 block text-xs text-[#6b627a]">
                    {fromMinutes(item.startMinute)}-
                    {fromMinutes(item.endMinute)} · {item.cleanerName}
                  </span>
                </button>
                {item.editable && (
                  <DraggableHandle
                    id={`mobile:${item.proposalIndex}`}
                    payload={{
                      taskId: item.taskId,
                      proposalIndex: item.proposalIndex,
                      sourceCleanerId: item.cleanerId,
                    }}
                    disabled={isStale}
                  />
                )}
              </div>
            ))}
        </div>

        <div className="hidden min-h-[620px] gap-3 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] 2xl:grid-cols-[220px_minmax(0,1fr)_280px]">
          <aside className="self-start rounded-2xl border border-red-200 bg-[#fffafa] shadow-sm 2xl:sticky 2xl:top-4">
            <div className="flex items-center justify-between border-b border-red-100 px-4 py-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-red-600">
                  Sin cubrir
                </p>
                <p className="text-sm font-semibold text-[#171321]">
                  Arrastra al horario
                </p>
              </div>
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-red-600 px-2 text-xs font-bold text-white">
                {unassignedTasks.length}
              </span>
            </div>
            <div className="max-h-[560px] space-y-2 overflow-y-auto p-3">
              {unassignedTasks.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-800">
                  <CheckCircle2 className="mx-auto mb-2 h-5 w-5" /> Todo
                  cubierto este día.
                </div>
              ) : (
                unassignedTasks.map((task) => (
                  <div
                    key={task.id}
                    data-dnd-unassigned-tray-item
                    className={`rounded-xl border bg-white p-2 shadow-sm ${selectedTask?.taskId === task.id && selectedTask.proposalIndex === undefined ? 'border-[#310984] ring-2 ring-[#310984]/10' : 'border-red-200'}`}
                  >
                    <div className="flex items-start gap-1">
                      <button
                        type="button"
                        className="min-w-0 flex-1 p-1 text-left"
                        onClick={() => setSelectedTask({ taskId: task.id })}
                      >
                        <p className="truncate text-sm font-bold text-[#171321]">
                          {task.propertyCode || task.property}
                        </p>
                        <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-[#6b627a]">
                          <Building2 className="h-3 w-3" />{' '}
                          {task.detectedBuilding?.propertyGroupName ||
                            'Edificio sin configurar'}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-700">
                          <Clock className="h-3 w-3" /> {task.displayStartTime}-
                          {task.displayEndTime}
                        </p>
                      </button>
                      <DraggableHandle
                        id={`unassigned:${task.id}`}
                        payload={{ taskId: task.id }}
                        disabled={isStale}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>

          <section
            aria-label="Ver calendario por horas"
            className="min-w-0 overflow-hidden rounded-2xl border border-[#310984]/10 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-[#310984]/10 px-4 py-3">
              <div>
                <h3 className="font-bold text-[#171321]">Equipo y horario</h3>
                <p className="text-xs text-[#6b627a]">
                  Mueve horizontalmente para ajustar la hora o cambia de fila
                  para reasignar.
                </p>
              </div>
              <p className="text-xs font-semibold text-[#6b627a]">15 min</p>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-max">
                <div className="flex h-11 border-b border-[#310984]/10 bg-[#faf9fd]">
                  <div className="sticky left-0 z-20 flex w-[170px] shrink-0 items-center border-r border-[#310984]/10 bg-[#faf9fd] px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b627a]">
                    Trabajadora
                  </div>
                  <div className="relative" style={{ width: timelineWidth }}>
                    {timeMarkers.map((minute) => (
                      <span
                        key={minute}
                        className="absolute top-3 -translate-x-1/2 text-[11px] font-semibold text-[#6b627a]"
                        style={{
                          left: (minute - bounds.start) * PIXELS_PER_MINUTE,
                        }}
                      >
                        {fromMinutes(minute)}
                      </span>
                    ))}
                  </div>
                </div>
                {visibleCleaners.length === 0 ? (
                  <div className="flex min-h-[300px] items-center justify-center text-sm text-[#6b627a]">
                    No hay trabajadoras disponibles.
                  </div>
                ) : (
                  visibleCleaners.map((cleaner) => {
                    const cleanerItems = dayItems
                      .filter((item) => item.cleanerId === cleaner.id)
                      .sort(
                        (left, right) => left.startMinute - right.startMinute,
                      );
                    const availability = effectiveAvailability.find(
                      (item) =>
                        item.date === selectedDate &&
                        item.cleanerId === cleaner.id,
                    );
                    const usedMinutes = cleanerItems.reduce(
                      (sum, item) => sum + item.endMinute - item.startMinute,
                      0,
                    );
                    const capacityPercent = Math.min(
                      100,
                      Math.round(
                        (usedMinutes /
                          Math.max(1, availability?.availableMinutes || 480)) *
                          100,
                      ),
                    );
                    return (
                      <div
                        key={cleaner.id}
                        className="flex min-h-[92px] border-b border-[#310984]/8 last:border-b-0"
                      >
                        <div className="sticky left-0 z-10 flex w-[170px] shrink-0 items-center gap-2 border-r border-[#310984]/10 bg-white px-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#efe9fb] text-xs font-bold text-[#310984]">
                            {cleaner.name
                              .split(' ')
                              .slice(0, 2)
                              .map((part) => part[0])
                              .join('')}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-[#171321]">
                              {cleaner.name}
                            </p>
                            <p
                              className={`text-[11px] font-semibold ${availability?.isAvailable === false ? 'text-red-600' : 'text-emerald-700'}`}
                            >
                              {availability?.isAvailable === false
                                ? 'No disponible'
                                : `${minutesToHoursLabel(usedMinutes)} planificadas`}
                            </p>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#eeeaf5]">
                              <div
                                className={`h-full rounded-full ${capacityPercent > 90 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${capacityPercent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <CleanerDropZone
                          cleanerId={cleaner.id}
                          feedback={dragFeedback.get(cleaner.id)}
                          className="relative"
                        >
                          <div
                            data-quarter-hour-grid
                            className="relative h-[92px]"
                            style={{
                              width: timelineWidth,
                              backgroundImage:
                                'linear-gradient(to right, rgba(49,9,132,0.045) 1px, transparent 1px), linear-gradient(to right, rgba(49,9,132,0.12) 1px, transparent 1px)',
                              backgroundSize: `${QUARTER_HOUR_GRID_SIZE}px 100%, ${60 * PIXELS_PER_MINUTE}px 100%`,
                            }}
                          >
                            {dragHover?.cleanerId === cleaner.id && (
                              <div
                                data-dnd-quarter-hover
                                className={`pointer-events-none absolute inset-y-0 z-[5] border-x-2 ${dragFeedback.get(cleaner.id)?.valid ? 'border-emerald-500 bg-emerald-300/30' : 'border-amber-500 bg-amber-300/30'}`}
                                style={{
                                  left:
                                    (dragHover.startMinute - bounds.start) *
                                    PIXELS_PER_MINUTE,
                                  width: QUARTER_HOUR_GRID_SIZE,
                                }}
                              />
                            )}
                            {cleanerItems.map((item) => {
                              const left = Math.max(
                                0,
                                (item.startMinute - bounds.start) *
                                  PIXELS_PER_MINUTE,
                              );
                              const width = Math.max(
                                MIN_CARD_WIDTH,
                                (item.endMinute - item.startMinute) *
                                  PIXELS_PER_MINUTE -
                                  5,
                              );
                              const selected =
                                selectedTask?.taskId === item.taskId &&
                                selectedTask.proposalIndex ===
                                  item.proposalIndex;
                              const tone =
                                item.source === 'existing'
                                  ? 'border-slate-200 bg-slate-100 text-slate-700'
                                  : item.source === 'manual'
                                    ? 'border-amber-300 bg-amber-50 text-amber-950'
                                    : 'border-emerald-300 bg-emerald-50 text-emerald-950';
                              return (
                                <div
                                  key={item.id}
                                  className={`absolute top-2 flex h-[76px] overflow-hidden rounded-xl border shadow-sm ${tone} ${selected ? 'ring-2 ring-[#310984] ring-offset-1' : ''}`}
                                  style={{ left, width }}
                                >
                                  <button
                                    type="button"
                                    className="min-w-0 flex-1 p-2 text-left"
                                    onClick={() =>
                                      setSelectedTask({
                                        taskId: item.taskId,
                                        proposalIndex: item.proposalIndex,
                                      })
                                    }
                                  >
                                    <p className="truncate text-xs font-black">
                                      {item.task.propertyCode ||
                                        item.task.property}
                                    </p>
                                    <p className="mt-1 truncate text-[10px] opacity-75">
                                      {item.task.detectedBuilding
                                        ?.propertyGroupName ||
                                        item.task.property}
                                    </p>
                                    <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold">
                                      <Clock className="h-3 w-3" />{' '}
                                      {fromMinutes(item.startMinute)}-
                                      {fromMinutes(item.endMinute)}
                                    </p>
                                  </button>
                                  {item.editable && (
                                    <DraggableHandle
                                      id={`desktop:${item.proposalIndex}`}
                                      payload={{
                                        taskId: item.taskId,
                                        proposalIndex: item.proposalIndex,
                                        sourceCleanerId: item.cleanerId,
                                      }}
                                      disabled={isStale}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </CleanerDropZone>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          <aside className="hidden self-start overflow-hidden rounded-2xl border border-[#310984]/10 bg-white shadow-sm 2xl:sticky 2xl:top-4 2xl:block">
            <div className="bg-[#16042f] px-4 py-4 text-white">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200">
                <Sparkles className="h-4 w-4" /> Decisión de Hermes
              </p>
              <h3 className="mt-1 truncate text-base font-bold">
                {selectedPlanningTask
                  ? selectedPlanningTask.propertyCode ||
                    selectedPlanningTask.property
                  : 'Selecciona una tarea'}
              </h3>
            </div>
            {!selectedPlanningTask ? (
              <div className="p-5 text-sm text-[#6b627a]">
                Pulsa una limpieza para revisar la decisión.
              </div>
            ) : (
              <div className="space-y-4 p-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7a6d91]">
                    Asignación actual
                  </p>
                  <p className="mt-1 font-bold text-[#171321]">
                    {selectedItem?.cleanerName || 'Sin cubrir'}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-[#6b627a]">
                    <Clock className="h-3.5 w-3.5" />{' '}
                    {selectedItem
                      ? `${fromMinutes(selectedItem.startMinute)}-${fromMinutes(selectedItem.endMinute)}`
                      : `${selectedPlanningTask.displayStartTime}-${selectedPlanningTask.displayEndTime}`}
                  </p>
                </div>
                <div className="rounded-xl border border-[#310984]/10 bg-[#faf8ff] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#310984]">
                    Por qué
                  </p>
                  <ul className="mt-2 space-y-2 text-xs leading-5 text-[#554b65]">
                    {(selectedProposal?.reasons?.length
                      ? selectedProposal.reasons
                      : ['Necesita una decisión manual antes de guardar.']
                    )
                      .slice(0, 4)
                      .map((reason) => (
                        <li key={reason} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{' '}
                          {reason}
                        </li>
                      ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7a6d91]">
                    Alternativas
                  </p>
                  <div className="mt-2 space-y-2">
                    {selectedAlternatives.length === 0 ? (
                      <p className="text-xs text-[#6b627a]">
                        No hay alternativas disponibles.
                      </p>
                    ) : (
                      selectedAlternatives.map(({ cleaner, validation }) => (
                        <button
                          key={cleaner.id}
                          type="button"
                          className="flex w-full items-center justify-between rounded-xl border border-[#310984]/10 p-3 text-left hover:border-[#310984]/30 hover:bg-[#faf8ff]"
                          onClick={() =>
                            applyPlacement(
                              selectedTask,
                              cleaner.id,
                              fromMinutes(
                                selectedItem?.startMinute ||
                                  getTaskStart(selectedPlanningTask),
                              ),
                            )
                          }
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-bold text-[#171321]">
                              {cleaner.name}
                            </span>
                            <span className="text-[10px] text-[#6b627a]">
                              {validation.assignmentRole === 'primary'
                                ? 'Titular'
                                : validation.assignmentRole === 'secondary'
                                  ? 'Suplente'
                                  : validation.assignmentRole === 'backup'
                                    ? 'Backup'
                                    : 'Apoyo'}
                            </span>
                          </span>
                          <span
                            className={`text-[10px] font-bold ${validation.valid ? 'text-emerald-700' : 'text-amber-700'}`}
                          >
                            {validation.valid ? 'Recomendada' : 'Con aviso'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-[#310984]/20 text-[#310984]"
                  onClick={() =>
                    openReassignment(
                      selectedTask!.taskId,
                      selectedTask!.proposalIndex,
                    )
                  }
                >
                  Editar hora o responsable
                </Button>
                {selectedPlanningTask.address && (
                  <p className="flex items-start gap-2 border-t border-[#310984]/10 pt-3 text-xs text-[#6b627a]">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{' '}
                    {selectedPlanningTask.address}
                  </p>
                )}
              </div>
            )}
          </aside>
        </div>

        {unassignedTasks.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 lg:hidden">
            <p className="flex items-center gap-2 text-sm font-semibold text-red-900">
              <AlertTriangle className="h-4 w-4" /> Sin cubrir
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {unassignedTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="rounded-xl border border-red-200 bg-white p-3 text-left text-xs text-red-800"
                  onClick={() => openReassignment(task.id)}
                >
                  <span className="font-semibold text-red-900">
                    {task.property}
                  </span>
                  <span className="mt-1 block">
                    {task.displayStartTime}-{task.displayEndTime} ·{' '}
                    {task.detectedBuilding?.propertyGroupName || 'sin edificio'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {warnings.length === 0 && manualChangeCount === 0 && (
          <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> El reparto no
            muestra solapes ni bloqueos con los datos disponibles.
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(reassignment)}
        onOpenChange={(open) => !open && setReassignment(null)}
      >
        <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md overflow-hidden p-0">
          <DialogHeader className="border-b border-[#310984]/10 p-5 pb-4 text-left">
            <DialogTitle>Colocar tarea</DialogTitle>
            <DialogDescription>
              {reassignmentTask
                ? `${reassignmentTask.property} · ${reassignmentTask.displayStartTime}-${reassignmentTask.displayEndTime}`
                : 'Selecciona una responsable.'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60dvh] space-y-4 overflow-y-auto p-4">
            <div>
              <label
                htmlFor="placement-start-time"
                className="mb-1 block text-sm font-semibold text-[#171321]"
              >
                Hora de inicio
              </label>
              <input
                id="placement-start-time"
                type="time"
                value={placementStartTime}
                onChange={(event) => setPlacementStartTime(event.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-[#310984]/20 bg-white px-3 text-sm"
              />
              <p className="mt-1 text-xs text-[#6b627a]">
                El final se calcula con la duración prevista.
              </p>
            </div>
            <p className="text-sm font-semibold text-[#171321]">
              Elegir responsable
            </p>
            {reassignment?.proposalIndex !== undefined && (
              <button
                type="button"
                className={`flex min-h-[52px] w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${placementCleanerId === UNASSIGNED_PLACEMENT_ID ? 'border-red-500 bg-red-50' : 'border-red-200 bg-white'}`}
                onClick={() => setPlacementCleanerId(UNASSIGNED_PLACEMENT_ID)}
              >
                <span className="font-semibold text-red-900">Sin asignar</span>
                <span className="text-xs font-semibold text-red-700">
                  Dejar sin responsable
                </span>
              </button>
            )}
            {reassignmentCandidates.map(({ cleaner, validation }) => (
              <button
                key={cleaner.id}
                type="button"
                className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left ${placementCleanerId === cleaner.id ? 'border-[#310984] bg-[#f4efff]' : 'border-[#310984]/10 bg-white'}`}
                onClick={() => setPlacementCleanerId(cleaner.id)}
              >
                <span className="font-semibold text-[#171321]">
                  {cleaner.name}
                </span>
                <span
                  className={`text-xs font-semibold ${validation.valid ? 'text-emerald-700' : 'text-amber-700'}`}
                >
                  {validation.valid ? 'Recomendada' : 'Con aviso'}
                </span>
              </button>
            ))}
            {placementCleanerId &&
              (() => {
                const selected = reassignmentCandidates.find(
                  (item) => item.cleaner.id === placementCleanerId,
                );
                return selected && !selected.validation.valid ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <strong>Advertencia:</strong>{' '}
                    {selected.validation.conflict?.message}
                  </div>
                ) : null;
              })()}
            <Button
              type="button"
              className="min-h-[44px] w-full bg-[#310984] text-white hover:bg-[#23066a]"
              disabled={
                !placementCleanerId ||
                (placementCleanerId !== UNASSIGNED_PLACEMENT_ID &&
                  !placementStartTime)
              }
              onClick={() => applyPlacement()}
            >
              {placementCleanerId === UNASSIGNED_PLACEMENT_ID
                ? 'Dejar sin cubrir'
                : 'Aplicar cambio'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
};

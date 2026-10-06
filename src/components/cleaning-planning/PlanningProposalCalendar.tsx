import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEventHandler, type MouseEventHandler, type ReactElement, type ReactNode, type TouchEventHandler } from 'react';
import { usePlanningCalendarWeek } from '@/hooks/usePlanningCalendarWeek';
import { planningCalendarWeeklyHours } from '@/utils/planningCalendarWeeklyHours';
import { PLANNING_CARD_HEIGHT, PLANNING_LANE_STEP, planningTaskLanes } from '@/utils/planningTaskLanes';
import { planningPixelsPerMinute, planningDropMinute } from '@/utils/planningViewport';
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
  CheckCircle2,
  Clock,
  PencilLine,
  Sparkles,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
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
  BlockedAvailabilityWindow,
  CleaningPlanningTask,
  EffectiveWorkerAvailability,
} from '@/types/cleaningPlanning';
import { CleanerGroupAssignment } from '@/types/propertyGroups';
import { isTaskAssignedToCleaner } from '@/utils/taskAssignments';
import {
  getTaskWorkerCount,
  getTaskWorkerPlannedDurationMinutes,
} from '@/utils/cleaning-planning/capacity';
import {
  validateDraftAssignmentMove,
  type DraftAssignmentMoveValidation,
} from '@/utils/cleaning-planning/proposalEngine';
import { TaskQuickActionsDialog } from './TaskQuickActionsDialog';

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
  selectedDay?: string;
  originalProposals: AssignmentProposal[];
  draftProposals: AssignmentProposal[];
  tasks: CleaningPlanningTask[];
  calendarTasks: CleaningPlanningTask[];
  cleaners: Cleaner[];
  effectiveAvailability: EffectiveWorkerAvailability[];
  activeCleanerAssignments?: CleanerGroupAssignment[];
  excludedCleanerAssignments?: CleanerGroupAssignment[];
  isStale?: boolean;
  savedTaskIds?: string[];
  onTaskSaved?: (taskId: string) => void;
  onDraftProposalsChange: (proposals: AssignmentProposal[]) => void;
  onDraftWarningsChange: (warnings: PlanningProposalDraftWarning[]) => void;
}

type DragPayload = {
  taskId: string;
  proposalIndex?: number;
  sourceCleanerId?: string;
};
type SelectedTask = { taskId: string; proposalIndex?: number; sourceCleanerId?: string };

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

const WORKER_COLUMN_WIDTH = 240;
const SNAP_MINUTES = 15;
const UNASSIGNED_PLACEMENT_ID = '__unassigned__';

type PlannerTaskCardStatus = 'conflict' | 'saved' | 'assigned' | 'manual' | 'proposal' | 'unassigned';
type PlannerTaskCardTone = {
  status: PlannerTaskCardStatus;
  surface: string;
  foreground: string;
  iconSurface: string;
  iconForeground: string;
};

const PLANNER_TASK_CARD_TONES: Record<PlannerTaskCardStatus, PlannerTaskCardTone> = {
  conflict: { status: 'conflict', surface: 'bg-danger', foreground: 'text-white', iconSurface: 'bg-black/15', iconForeground: 'text-white' },
  saved: { status: 'saved', surface: 'bg-success', foreground: 'text-white', iconSurface: 'bg-black/15', iconForeground: 'text-white' },
  assigned: { status: 'assigned', surface: 'bg-info', foreground: 'text-white', iconSurface: 'bg-black/15', iconForeground: 'text-white' },
  manual: { status: 'manual', surface: 'bg-warning', foreground: 'text-white', iconSurface: 'bg-black/15', iconForeground: 'text-white' },
  proposal: { status: 'proposal', surface: 'bg-success', foreground: 'text-white', iconSurface: 'bg-black/15', iconForeground: 'text-white' },
  unassigned: { status: 'unassigned', surface: 'bg-warning', foreground: 'text-white', iconSurface: 'bg-black/15', iconForeground: 'text-white' },
};

const getPlannerTaskCardTone = (
  source: CalendarItem['source'],
  { conflict = false, saved = false }: { conflict?: boolean; saved?: boolean } = {},
): PlannerTaskCardTone => {
  if (conflict) return PLANNER_TASK_CARD_TONES.conflict;
  if (saved) return PLANNER_TASK_CARD_TONES.saved;
  if (source === 'existing') return PLANNER_TASK_CARD_TONES.assigned;
  if (source === 'manual') return PLANNER_TASK_CARD_TONES.manual;
  return PLANNER_TASK_CARD_TONES.proposal;
};

type PlannerDraggableBindings = Omit<ReturnType<typeof useDraggable>, 'listeners'> & {
  onMouseDown?: MouseEventHandler<HTMLElement>;
  onTouchStart?: TouchEventHandler<HTMLElement>;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
};

const PlannerDraggable = ({
  id,
  payload,
  disabled,
  children,
}: {
  id: string;
  payload: DragPayload;
  disabled?: boolean;
  children: (bindings: PlannerDraggableBindings) => ReactElement;
}) => {
  const { listeners, ...bindings } = useDraggable({
    id,
    data: payload,
    disabled,
  });
  return children({
    ...bindings,
    onMouseDown: listeners?.onMouseDown as MouseEventHandler<HTMLElement> | undefined,
    onTouchStart: listeners?.onTouchStart as TouchEventHandler<HTMLElement> | undefined,
    onKeyDown: listeners?.onKeyDown as KeyboardEventHandler<HTMLElement> | undefined,
  });
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

const toMinutes = (value?: string): number => {
  const match = value?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 9 * 60;
  return Math.max(
    0,
    Math.min(24 * 60, Number(match[1]) * 60 + Number(match[2])),
  );
};

const fromMinutes = (value: number): string => {
  const clamped = Math.max(0, Math.min(24 * 60, value));
  return `${Math.floor(clamped / 60)
    .toString()
    .padStart(2, '0')}:${(clamped % 60).toString().padStart(2, '0')}`;
};

type AvailabilityBandKind =
  | 'available'
  | 'estimated'
  | 'absence'
  | 'fixed_day_off'
  | 'weekly_unavailability'
  | 'unavailability'
  | 'maintenance'
  | 'no_availability';

interface AvailabilityBand {
  key: string;
  kind: AvailabilityBandKind;
  label: string;
  reason: string;
  startMinute?: number;
  endMinute?: number;
}

const parseAvailabilityTime = (time?: string): number | undefined => {
  const match = time?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59 || (hours === 24 && minutes > 0)) return undefined;
  return hours * 60 + minutes;
};

const getBlockedAvailabilityKind = (
  window: BlockedAvailabilityWindow,
): AvailabilityBandKind => {
  if (window.kind && window.kind !== 'assigned_task' && window.kind !== 'extraordinary') return window.kind;
  const reason = window.reason.toLocaleLowerCase('es-ES');
  if (reason.includes('mantenimiento')) return 'maintenance';
  if (reason.includes('ausencia')) return 'absence';
  if (reason.includes('día libre')) return 'fixed_day_off';
  if (reason.includes('horario semanal')) return 'weekly_unavailability';
  return 'unavailability';
};

const getAvailabilityBands = (
  availability?: EffectiveWorkerAvailability,
): AvailabilityBand[] => {
  if (!availability) return [];
  const bands: AvailabilityBand[] = availability.availableWindows.flatMap((window, index) => {
    const startMinute = parseAvailabilityTime(window.startTime);
    const endMinute = parseAvailabilityTime(window.endTime);
    if (startMinute === undefined || endMinute === undefined || endMinute <= startMinute) return [];
    const estimated = availability.source === 'contract_fallback';
    return [{
      key: 'available-' + index,
      kind: estimated ? 'estimated' : 'available',
      label: estimated ? 'Estimado' : 'Disponible',
      reason: (estimated ? 'Horario estimado ' : 'Horario disponible ') + window.startTime + '–' + window.endTime,
      startMinute,
      endMinute,
    }];
  });
  const labels: Record<AvailabilityBandKind, string> = {
    available: 'Disponible',
    estimated: 'Estimado',
    absence: 'Ausencia',
    fixed_day_off: 'Día libre',
    weekly_unavailability: 'No disponible',
    unavailability: 'No disponible',
    maintenance: 'Mantenimiento',
    no_availability: 'Sin horario',
  };
  const blockedBands: AvailabilityBand[] = availability.blockedWindows
    .filter((window) => window.kind !== 'assigned_task' && window.kind !== 'extraordinary')
    .map((window, index) => {
      const kind = getBlockedAvailabilityKind(window);
      return {
        key: 'blocked-' + index,
        kind,
        label: labels[kind],
        reason: window.reason,
        startMinute: parseAvailabilityTime(window.startTime),
        endMinute: parseAvailabilityTime(window.endTime),
      };
    });

  const hasFullDayBlock = blockedBands.some((band) => band.startMinute === undefined || band.endMinute === undefined);
  if (!availability.isAvailable && availability.availableWindows.length === 0 && !hasFullDayBlock) {
    const reason = availability.source === 'weekly'
      ? 'No disponible según horario semanal'
      : availability.source === 'contract_fallback'
        ? 'No hay disponibilidad estimada para hoy'
        : 'Sin disponibilidad para hoy';
    blockedBands.unshift({
      key: 'no-availability',
      kind: 'no_availability',
      label: labels.no_availability,
      reason,
    });
  }
  const allDayBlocks = blockedBands.filter((band) => band.startMinute === undefined || band.endMinute === undefined);
  const timedBlocks = blockedBands.filter((band) => band.startMinute !== undefined && band.endMinute !== undefined);
  return [...bands, ...allDayBlocks, ...timedBlocks];
};

const getAvailabilitySummary = (
  availability?: EffectiveWorkerAvailability,
): string => {
  if (!availability) return 'Disponibilidad no cargada';
  const bands = getAvailabilityBands(availability);
  const windows = bands
    .filter((band) => band.kind === 'available' || band.kind === 'estimated')
    .map((band) => fromMinutes(band.startMinute!) + '–' + fromMinutes(band.endMinute!));
  const blocks = bands.filter((band) => band.kind !== 'available' && band.kind !== 'estimated');
  if (availability.source === 'fixed_day_off') return 'Día libre fijo';
  if (availability.source === 'absence' && !availability.isAvailable) return 'Ausencia · no disponible';
  if (windows.length === 0) return blocks[0]?.label || 'Sin disponibilidad hoy';
  const prefix = availability.source === 'contract_fallback' ? 'Horario estimado ' : 'Horario ';
  const blockSummary = blocks.map((band) => {
    const timeRange = band.startMinute !== undefined && band.endMinute !== undefined
      ? ' ' + fromMinutes(band.startMinute) + '–' + fromMinutes(band.endMinute)
      : '';
    return band.label + timeRange;
  });
  return prefix + windows.join(', ') + (blockSummary.length ? ' · ' + blockSummary.join(', ') : '');
};

const WorkerAvailabilityBands = ({
  availability,
  bounds,
  compact = false,
}: {
  availability?: EffectiveWorkerAvailability;
  bounds: { start: number; end: number };
  compact?: boolean;
}) => {
  const bands = getAvailabilityBands(availability);
  const span = Math.max(1, bounds.end - bounds.start);
  const accessibleSummary = availability
    ? getAvailabilitySummary(availability)
    : 'Disponibilidad no cargada';
  const colors: Record<AvailabilityBandKind, string> = {
    available: 'border-emerald-600/50 bg-emerald-200/65 text-emerald-950',
    estimated: 'border-violet-500/60 bg-violet-200/60 text-violet-950',
    absence: 'border-rose-600/70 bg-rose-200/75 text-rose-950',
    fixed_day_off: 'border-slate-500/70 bg-slate-300/80 text-slate-900',
    weekly_unavailability: 'border-slate-500/70 bg-slate-300/80 text-slate-900',
    unavailability: 'border-slate-500/70 bg-slate-300/80 text-slate-900',
    maintenance: 'border-amber-600/70 bg-amber-200/80 text-amber-950',
    no_availability: 'border-slate-500/70 bg-slate-300/80 text-slate-900',
  };
  const patterns: Partial<Record<AvailabilityBandKind, string>> = {
    estimated: 'repeating-linear-gradient(135deg, rgba(139,92,246,.16) 0 3px, transparent 3px 8px)',
    absence: 'repeating-linear-gradient(135deg, rgba(225,29,72,.18) 0 3px, transparent 3px 8px)',
    fixed_day_off: 'repeating-linear-gradient(135deg, rgba(71,85,105,.16) 0 3px, transparent 3px 8px)',
    weekly_unavailability: 'repeating-linear-gradient(135deg, rgba(71,85,105,.16) 0 3px, transparent 3px 8px)',
    unavailability: 'repeating-linear-gradient(135deg, rgba(71,85,105,.16) 0 3px, transparent 3px 8px)',
    no_availability: 'repeating-linear-gradient(135deg, rgba(71,85,105,.16) 0 3px, transparent 3px 8px)',
  };
  return (
    <div
      role="img"
      aria-label={accessibleSummary}
      data-worker-availability
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {availability && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-slate-50/35"
          style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(100,116,139,.12) 0 2px, transparent 2px 8px)' }}
        />
      )}
      {bands.map((band) => {
        const start = band.startMinute === undefined ? bounds.start : Math.max(bounds.start, band.startMinute);
        const end = band.endMinute === undefined ? bounds.end : Math.min(bounds.end, band.endMinute);
        if (end <= start) return null;
        const leftPercent = Math.max(0, ((start - bounds.start) / span) * 100);
        const widthPercent = Math.min(100 - leftPercent, ((end - start) / span) * 100);
        const labelText = band.startMinute !== undefined && band.endMinute !== undefined
          ? band.label + ' ' + fromMinutes(band.startMinute) + '–' + fromMinutes(band.endMinute)
          : band.label;
        return (
          <div
            key={band.key}
            aria-hidden="true"
            title={band.reason}
            className={'absolute inset-y-0 overflow-hidden border-x ' + colors[band.kind]}
            style={{
              left: leftPercent + '%',
              width: widthPercent + '%',
              backgroundImage: patterns[band.kind],
            }}
          >
            {!compact && widthPercent >= 6 && (
              <span className="absolute left-1 top-1 max-w-[calc(100%-0.5rem)] truncate text-[10px] font-bold leading-tight">
                {labelText}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
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
  selectedDay,
  originalProposals,
  draftProposals,
  calendarTasks,
  cleaners,
  effectiveAvailability,
  activeCleanerAssignments = [],
  excludedCleanerAssignments = [],
  isStale,
  savedTaskIds = [],
  onTaskSaved,
  onDraftProposalsChange,
  onDraftWarningsChange,
}: PlanningProposalCalendarProps) => {
  const savedTaskIdSet = useMemo(() => new Set(savedTaskIds), [savedTaskIds]);
  const dates = useMemo(
    () => selectedDay ? [selectedDay] : uniqueDates(calendarTasks, draftProposals),
    [calendarTasks, draftProposals, selectedDay],
  );
  const [selectedDate, setSelectedDate] = useState(() => dates[0] || '');
  const weeklyQuery = usePlanningCalendarWeek(selectedDate);
  const hoursScrollRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);
  useEffect(() => {
    const viewport = timelineScrollRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => setTimelineViewportWidth(viewport.clientWidth));
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  const mobileTrayRef = useRef<HTMLDivElement>(null);
  const [reassignment, setReassignment] = useState<SelectedTask | null>(null);
  const [reassignmentOrigin, setReassignmentOrigin] = useState<{ x: number; y: number; scale: number } | null>(null);
  const pendingEditSnapshotRef = useRef<{ taskId: string; proposals: AssignmentProposal[]; wasEdited: boolean } | null>(null);
  const reassignmentTriggerRef = useRef<HTMLElement | null>(null);
  const reassignmentTriggerTaskIdRef = useRef('');
  const [selectedTask, setSelectedTask] = useState<SelectedTask | null>(null);
  const [placementCleanerId, setPlacementCleanerId] = useState('');
  const [placementStartTime, setPlacementStartTime] = useState('09:00');
  const [editedExistingTaskIds, setEditedExistingTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
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
  const [quickActionsTaskId, setQuickActionsTaskId] = useState<string | null>(null);
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
      if (draftedTaskIds.has(task.id) || editedExistingTaskIds.has(task.id)) return;
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
          editable: true,
          isManualChange: false,
        });
      });
    });
    draftProposals.forEach((proposal, proposalIndex) => {
      const task = taskById.get(proposal.taskId);
      if (!task) return;
      const isExistingAssignmentDraft = proposal.reasons.includes('Asignación existente editable durante la revisión');
      const originalProposal = originalProposals.find((candidate) => (
        candidate.taskId === proposal.taskId
        && candidate.assignmentIndex === proposal.assignmentIndex
      ));
      const unchangedExistingAssignment = isExistingAssignmentDraft
        && getAssignedCleanerIds(task, cleaners).includes(proposal.cleanerId)
        && proposal.proposedStartTime === task.startTime
        && proposal.proposedEndTime === task.endTime;
      const isManualChange = isExistingAssignmentDraft
        ? !unchangedExistingAssignment
        : proposal.reasons.includes('Asignación manual durante la revisión') || Boolean(originalProposal && (
          originalProposal.cleanerId !== proposal.cleanerId
          || originalProposal.proposedStartTime !== proposal.proposedStartTime
          || originalProposal.proposedEndTime !== proposal.proposedEndTime
        ));
      const source = isExistingAssignmentDraft
        ? unchangedExistingAssignment ? 'existing' : 'manual'
        : isManualChange ? 'manual' : 'hermes';
      items.push({
        id: `draft:${proposal.taskId}:${proposalIndex}`,
        taskId: proposal.taskId,
        proposalIndex,
        source,
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
    editedExistingTaskIds,
  ]);

  const weeklyHours = useMemo(() => planningCalendarWeeklyHours(
    weeklyQuery.data ?? [], cleaners, new Set(calendarTasks.map(task => task.id)), calendarItems,
    weeklyQuery.startDate, weeklyQuery.endDate,
  ), [weeklyQuery.data, weeklyQuery.startDate, weeklyQuery.endDate, cleaners, calendarTasks, calendarItems]);

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

  // Clic derecho sobre una limpieza asignada: ajuste rápido de hora y responsable.
  const quickActionsTask = quickActionsTaskId
    ? taskById.get(quickActionsTaskId) || null
    : null;
  const quickActionsBusyCleanerIds = useMemo(() => {
    const busy = new Set<string>();
    if (!quickActionsTask) return busy;
    const taskStart = toMinutes(quickActionsTask.startTime);
    const taskEnd = toMinutes(quickActionsTask.endTime);
    calendarItems.forEach((item) => {
      if (item.taskId === quickActionsTask.id) return;
      if (item.task.date !== quickActionsTask.date) return;
      const overlaps =
        taskStart !== null && taskEnd !== null
          ? item.startMinute < taskEnd && item.endMinute > taskStart
          : true;
      if (overlaps) busy.add(item.cleanerId);
    });
    return busy;
  }, [calendarItems, quickActionsTask]);

  const bounds = useMemo(() => {
    const availabilityWindows = effectiveAvailability
      .filter((item) => item.date === selectedDate && visibleCleaners.some((cleaner) => cleaner.id === item.cleanerId))
      .flatMap((item) => [...item.availableWindows, ...item.blockedWindows]);
    const availabilityStarts = availabilityWindows
      .map((window) => parseAvailabilityTime(window.startTime))
      .filter((minute): minute is number => minute !== undefined);
    const availabilityEnds = availabilityWindows
      .map((window) => parseAvailabilityTime(window.endTime))
      .filter((minute): minute is number => minute !== undefined);
    const starts = [...dayItems.map((item) => item.startMinute), ...availabilityStarts];
    const ends = [...dayItems.map((item) => item.endMinute), ...availabilityEnds];
    return {
      start: Math.max(
        0,
        Math.floor(
          Math.min(...(starts.length ? starts : [8 * 60]), 8 * 60) / 60,
        ) * 60,
      ),
      end: Math.min(
        23 * 60 + 59,
        Math.ceil(Math.max(...(ends.length ? ends : [24 * 60]), 24 * 60) / 60) *
          60,
      ),
    };
  }, [dayItems, effectiveAvailability, selectedDate, visibleCleaners]);
  const pixelsPerMinute = planningPixelsPerMinute(
    Math.max(0, timelineViewportWidth - WORKER_COLUMN_WIDTH), bounds.end - bounds.start,
  );
  const quarterHourGridSize = SNAP_MINUTES * pixelsPerMinute;
  const timelineWidth = (bounds.end - bounds.start) * pixelsPerMinute;
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
      startMinute: planningDropMinute(
        pointerX === undefined ? undefined : pointerX + delta.x,
        over.rect.left,
        bounds.start,
        bounds.end,
        fallbackMinute,
        pixelsPerMinute,
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
        : planningDropMinute(
            pointerX === undefined ? undefined : pointerX + delta.x,
            over.rect.left,
            bounds.start,
            bounds.end,
            fallbackMinute,
            pixelsPerMinute,
          );
    applyPlacement(
      { taskId: payload.taskId, proposalIndex: payload.proposalIndex, sourceCleanerId: payload.sourceCleanerId },
      destinationId.slice(cleanerPrefix.length),
      fromMinutes(dropMinute),
    );
  };

  const resetDraft = () => {
    setEditedExistingTaskIds(new Set());
    onDraftProposalsChange(
      originalProposals.map((proposal) => ({ ...proposal })),
    );
  };
  const makeExistingProposal = (
    task: CleaningPlanningTask,
    cleanerId: string,
    assignmentIndex: number,
  ): AssignmentProposal => {
    const cleaner = cleanerById.get(cleanerId);
    const durationMinutes = getTaskWorkerPlannedDurationMinutes(task);
    return {
      taskId: task.id,
      cleanerId,
      cleanerName: cleaner?.name || task.cleaner || 'Sin nombre',
      propertyGroupId:
        task.detectedBuilding?.status === 'detected'
          ? task.detectedBuilding.propertyGroupId
          : undefined,
      propertyGroupName:
        task.detectedBuilding?.status === 'detected'
          ? task.detectedBuilding.propertyGroupName
          : undefined,
      assignmentRole: assignmentIndex === 0 ? 'primary' : 'secondary',
      durationMinutes,
      proposedStartTime: task.startTime,
      proposedEndTime: task.endTime,
      requiredCleaners: Math.max(1, task.requiredCleaners || 1),
      assignmentIndex,
      confidence: 1,
      reasons: ['Asignación existente editable durante la revisión'],
      warnings: [],
      capacityAfterAssignment: {
        assignedMinutes: 0,
        remainingMinutes: 0,
      },
    };
  };
  const openReassignment = (taskId: string, proposalIndex?: number, sourceCleanerId?: string, sourceElement?: HTMLElement) => {
    if (isStale) return;
    const task = taskById.get(taskId);
    if (!task) return;
    reassignmentTriggerRef.current = sourceElement ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    reassignmentTriggerTaskIdRef.current = taskId;
    const card = sourceElement?.closest<HTMLElement>('[data-planner-task-card]') ?? sourceElement;
    const rect = card?.getBoundingClientRect();
    setReassignmentOrigin(rect?.width && rect.height ? {
      x: Math.max(-window.innerWidth * 0.6, Math.min(window.innerWidth * 0.6, rect.left + rect.width / 2 - window.innerWidth / 2)),
      y: Math.max(-window.innerHeight * 0.6, Math.min(window.innerHeight * 0.6, rect.top + rect.height / 2 - window.innerHeight / 2)),
      scale: Math.max(0.28, Math.min(0.9, rect.width / Math.min(window.innerWidth - 32, 448))),
    } : null);
    pendingEditSnapshotRef.current = null;
    let nextProposalIndex = proposalIndex;
    if (proposalIndex === undefined) {
      const existingCleanerIds = getAssignedCleanerIds(task, cleaners);
      const existingProposals = existingCleanerIds.map((cleanerId, assignmentIndex) =>
        makeExistingProposal(task, cleanerId, assignmentIndex),
      );
      const next = [
        ...draftProposals,
        ...existingProposals.filter(
          (candidate) =>
            !draftProposals.some(
              (proposal) =>
                proposal.taskId === candidate.taskId &&
                proposal.cleanerId === candidate.cleanerId,
            ),
        ),
      ];
      const foundProposalIndex = next.findIndex(
        (proposal) =>
          proposal.taskId === taskId &&
          proposal.cleanerId === (sourceCleanerId || existingCleanerIds[0] || task.cleanerId),
      );
      nextProposalIndex = foundProposalIndex >= 0 ? foundProposalIndex : undefined;
      pendingEditSnapshotRef.current = { taskId, proposals: draftProposals, wasEdited: editedExistingTaskIds.has(taskId) };
      setEditedExistingTaskIds((current) => new Set(current).add(taskId));
      onDraftProposalsChange(next);
    }
    const proposal =
      nextProposalIndex === undefined ? undefined :
        (draftProposals[nextProposalIndex] ||
          makeExistingProposal(task, sourceCleanerId || getAssignedCleanerIds(task, cleaners)[0] || task.cleanerId || '', 0));
    setPlacementCleanerId(proposal?.cleanerId || '');
    setPlacementStartTime(fromMinutes(getTaskStart(task, proposal)));
    setSelectedTask({ taskId, proposalIndex: nextProposalIndex });
    setReassignment({ taskId, proposalIndex: nextProposalIndex });
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
    if (cleanerId === UNASSIGNED_PLACEMENT_ID && getAssignedCleanerIds(task, cleaners).length > 0) {
      // A saved assignment must actually be removed, not merely hidden in the draft.
      const snapshot = pendingEditSnapshotRef.current;
      if (snapshot) {
        onDraftProposalsChange(snapshot.proposals);
        if (!snapshot.wasEdited) setEditedExistingTaskIds(current => {
          const next = new Set(current); next.delete(task.id); return next;
        });
      }
      pendingEditSnapshotRef.current = null;
      setReassignment(null);
      setQuickActionsTaskId(task.id);
      return;
    }
    if (cleanerId === UNASSIGNED_PLACEMENT_ID) {
      onDraftProposalsChange(
        draftProposals.filter(
          (proposal) => proposal.taskId !== directPlacement.taskId,
        ),
      );
      setMoveNotice({
        message: `${task.property} queda sin asignar.`,
        previous,
      });
      pendingEditSnapshotRef.current = null;
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
    // Dragging a saved assignment must preserve its coworkers in the replacement batch.
    const base = [...draftProposals];
    let targetIndex = directPlacement.proposalIndex;
    if (targetIndex === undefined && directPlacement.sourceCleanerId) {
      getAssignedCleanerIds(task, cleaners).forEach((id, index) => {
        if (!base.some(proposal => proposal.taskId === task.id && proposal.cleanerId === id)) {
          base.push(makeExistingProposal(task, id, index));
        }
      });
      const found = base.findIndex(proposal => proposal.taskId === task.id && proposal.cleanerId === directPlacement.sourceCleanerId);
      if (found >= 0) targetIndex = found;
    }
    const next =
      targetIndex !== undefined
        ? base.map((proposal, index) =>
            index === targetIndex
              ? { ...proposal, ...fields }
              : proposal.taskId === task.id
                ? { ...proposal, proposedStartTime: fields.proposedStartTime,
                    proposedEndTime: fields.proposedEndTime, durationMinutes }
                : proposal,
          )
        : [
            ...base,
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
      proposalIndex: targetIndex ?? next.length - 1,
    });
    setMoveNotice({
      message: `${task.property} colocada con ${cleaner.name} a las ${startTime}.`,
      previous,
    });
    pendingEditSnapshotRef.current = null;
    setReassignment(null);
  };

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
      <div className="space-y-3">
        {isStale && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Este plan está desactualizado. Regenera antes de guardar.
          </div>
        )}
        {moveNotice && (
          <div
            role="alert"
            aria-live="assertive"
            data-dnd-notice
            className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm ${moveNotice.error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}
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
            className="max-[400px]:block rounded-lg border border-line bg-white p-3 lg:hidden"
          >
            <p className="mb-2 text-xs font-semibold text-brand">
              Suelta en una trabajadora
            </p>
            <div className="space-y-2">
              {cleaners.map((cleaner) => (
                <CleanerDropZone
                  key={cleaner.id}
                  cleanerId={cleaner.id}
                  dropId={`mobile-cleaner:${cleaner.id}`}
                  feedback={dragFeedback.get(cleaner.id)}
                  className="min-h-[48px] rounded-md border p-3 text-sm font-semibold"
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
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
                  <ShieldAlert className="h-4 w-4" />{' '}
                  {dayBlockingWarnings.length} problemas que impiden guardar
                </p>
                <ul className="mt-2 space-y-1 text-xs text-red-700">
                  {dayBlockingWarnings.slice(0, 4).map((warning) => (
                    <li key={warning.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>• {warning.message}</span>
                      {warning.taskId && (
                        <button
                          type="button"
                          data-planning-warning-action
                          className="shrink-0 rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-100"
                          onClick={() => openReassignment(warning.taskId as string)}
                        >
                          Ver esta limpieza
                        </button>
                      )}
                    </li>
                  ))}
                  {dayBlockingWarnings.length > 4 && (
                    <li className="font-semibold">y {dayBlockingWarnings.length - 4} más</li>
                  )}
                </ul>
              </div>
            )}
            {daySoftWarnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <AlertTriangle className="h-4 w-4" /> {daySoftWarnings.length}{' '}
                  avisos operativos
                </p>
                <ul className="mt-2 space-y-1 text-xs text-amber-800">
                  {daySoftWarnings.slice(0, 4).map((warning) => (
                    <li key={warning.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>• {warning.message}</span>
                      {warning.taskId && (
                        <button
                          type="button"
                          data-planning-warning-action
                          className="shrink-0 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                          onClick={() => openReassignment(warning.taskId as string)}
                        >
                          Ver esta limpieza
                        </button>
                      )}
                    </li>
                  ))}
                  {daySoftWarnings.length > 4 && (
                    <li className="font-semibold">y {daySoftWarnings.length - 4} más</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* El contador permanece visible; las pendientes se muestran antes de la lista móvil. */}
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 rounded-lg border border-line bg-paper/95 px-3 py-2 text-sm shadow-sm backdrop-blur lg:hidden">
          <span className={unassignedTasks.length > 0 ? 'font-semibold text-ink' : 'font-semibold text-emerald-700'}>
            {unassignedTasks.length > 0
              ? `${unassignedTasks.length} limpieza${unassignedTasks.length === 1 ? '' : 's'} sin asignar`
              : 'Todo asignado este día'}
          </span>
          {unassignedTasks.length > 0 && (
            <button
              type="button"
              className="min-h-11 shrink-0 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-brand transition-colors hover:bg-line-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none"
              onClick={() => mobileTrayRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })}
            >
              Ver sin asignar
            </button>
          )}
        </div>

        {unassignedTasks.length > 0 && (
          <section ref={mobileTrayRef} aria-label="Limpiezas sin asignar" className="scroll-mt-20 rounded-xl border border-line bg-paper p-3 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><AlertTriangle aria-hidden="true" className="h-4 w-4" /> Por resolver ({unassignedTasks.length})</h3>
              <span className="text-xs font-medium text-ink-3">Antes de guardar</span>
            </div>
            <div id="planning-mobile-unassigned" className="mt-3 grid gap-2 sm:grid-cols-2">
              {unassignedTasks.map((task) => (
                <PlannerDraggable
                  key={task.id}
                  id={`unassigned-mobile:${task.id}`}
                  payload={{ taskId: task.id }}
                  disabled={isStale}
                >
                  {({ attributes, onMouseDown, onTouchStart, onKeyDown, setNodeRef, setActivatorNodeRef, isDragging }) => (
                    <article
                      ref={setNodeRef}
                      data-planner-task-card
                      data-planner-task-id={task.id}
                      data-planner-status="unassigned"
                      onMouseDown={onMouseDown}
                      onTouchStart={onTouchStart}
                      className={`${!isStale ? 'touch-none cursor-grab' : ''} rounded-xl border border-white/45 bg-warning p-3 text-white shadow-sober transition-[background-color,border-color,box-shadow] duration-200 hover:shadow-md motion-reduce:transition-none ${isDragging ? 'opacity-40' : ''} ${selectedTask?.taskId === task.id && selectedTask.proposalIndex === undefined ? 'ring-2 ring-brand ring-offset-1' : ''}`}
                    >
                      <button
                        ref={setActivatorNodeRef}
                        {...attributes}
                        type="button"
                        data-planner-primary-action
                        className="min-h-[44px] min-w-0 w-full py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        onKeyDown={(event) => {
                          if (event.code !== 'Enter') onKeyDown?.(event);
                        }}
                        onClick={(event) => openReassignment(task.id, undefined, undefined, event.currentTarget)}
                      >
                        <p className="truncate text-sm font-bold text-white">{task.propertyCode || task.property}</p>
                        <p className="mt-1 flex items-center gap-1 truncate text-xs text-white"><Building2 aria-hidden="true" className="h-3 w-3 shrink-0" />{task.detectedBuilding?.propertyGroupName || 'Edificio sin configurar'}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-white"><Clock aria-hidden="true" className="h-3 w-3" />{task.displayStartTime}-{task.displayEndTime}</p>
                      </button>
                    </article>
                  )}
                </PlannerDraggable>
              ))}
            </div>
          </section>
        )}

        <details open className="rounded-xl border border-line bg-paper p-3 lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <span>Disponibilidad del equipo</span>
            <span className="text-xs font-medium text-ink-3">{fromMinutes(bounds.start)}–{fromMinutes(bounds.end)}</span>
          </summary>
          <p className="mt-1 text-xs text-ink-3">El tramado gris marca las horas fuera de horario. Los colores señalan ausencias y mantenimientos.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {visibleCleaners.map((cleaner) => {
              const availability = effectiveAvailability.find((item) => item.date === selectedDate && item.cleanerId === cleaner.id);
              const summary = getAvailabilitySummary(availability);
              return (
                <div key={cleaner.id} className="min-w-0 rounded-lg border border-line bg-white p-2">
                  <p className="truncate text-xs font-bold text-ink">{cleaner.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-ink-3" title={summary}>{summary}</p>
                  <div className="relative mt-2 h-7 overflow-hidden rounded-md border border-line bg-white">
                    <WorkerAvailabilityBands availability={availability} bounds={bounds} compact />
                  </div>
                </div>
              );
            })}
          </div>
        </details>

        <div
          className="space-y-2 lg:hidden"
          aria-label="Lista del reparto propuesto"
        >
          {dayItems
            .sort((left, right) => left.startMinute - right.startMinute)
            .map((item) => {
              const tone = getPlannerTaskCardTone(item.source, {
                conflict: dayBlockingWarnings.some((warning) => warning.taskId === item.taskId),
                saved: savedTaskIdSet.has(item.taskId),
              });
              return (
              <PlannerDraggable
                key={item.id}
                id={`mobile:${item.id}`}
                payload={{ taskId: item.taskId, proposalIndex: item.proposalIndex, sourceCleanerId: item.cleanerId }}
                disabled={!item.editable || isStale}
              >
                {({ attributes, onMouseDown, onTouchStart, onKeyDown, setNodeRef, setActivatorNodeRef, isDragging }) => (
                  <article
                    ref={setNodeRef}
                    data-planner-task-card
                    data-planner-task-id={item.taskId}
                    data-planner-status={tone.status}
                    onMouseDown={onMouseDown}
                    onTouchStart={onTouchStart}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setQuickActionsTaskId(item.taskId);
                    }}
                    className={`${item.editable && !isStale ? 'touch-none cursor-grab' : ''} flex min-h-[86px] items-center rounded-xl border border-white/45 p-2 ${tone.surface} ${tone.foreground} shadow-sober transition-[background-color,border-color,box-shadow] duration-150 hover:shadow-md motion-reduce:transition-none ${isDragging ? 'opacity-40' : ''}`}
                  >
                    <button
                      ref={setActivatorNodeRef}
                      {...attributes}
                      type="button"
                      data-planner-primary-action
                      disabled={!item.editable || isStale}
                      className="min-h-[60px] min-w-0 flex-1 rounded-lg p-2 text-left text-white transition-colors duration-150 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none"
                      onKeyDown={(event) => {
                        if (event.code !== 'Enter') onKeyDown?.(event);
                      }}
                      onClick={(event) =>
                        item.editable &&
                        openReassignment(item.taskId, item.proposalIndex, item.cleanerId, event.currentTarget)
                      }
                    >
                      <span
                        className={`flex items-center gap-1 text-xs font-semibold ${tone.foreground}`}
                      >
                        {savedTaskIdSet.has(item.taskId)
                          ? <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                          : <span aria-hidden="true">●</span>}
                        {savedTaskIdSet.has(item.taskId)
                          ? 'Reparto guardado'
                          : item.source === 'hermes'
                            ? 'Propuesta de la app'
                            : item.source === 'manual'
                              ? 'Revisada'
                              : 'Ya asignada'}
                      </span>
                      <span className={`mt-1 block font-bold ${tone.foreground}`}>
                        {item.task.property}
                      </span>
                      <span className={`mt-1 block text-xs ${tone.foreground}`}>
                        {fromMinutes(item.startMinute)}-
                        {fromMinutes(item.endMinute)} · {item.cleanerName}
                      </span>
                    </button>
                  </article>
                )}
              </PlannerDraggable>
              );
            })}
        </div>

        {/* Leyenda y ayuda: sin esto, los colores y las dos formas de mover una limpieza no se entienden. */}
        <div
          aria-label="Cómo leer el tablero"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink-3"
        >
          <span className="font-semibold text-ink">Cómo leer el tablero</span>
          <span className="inline-flex items-center gap-2">
            <i aria-hidden="true" className="h-3 w-4 rounded border border-white/40 bg-success" />
            Verde: propuesta de la app o guardado
          </span>
          <span className="inline-flex items-center gap-2">
            <i aria-hidden="true" className="h-3 w-4 rounded border border-white/40 bg-warning" />
            Ámbar: cambio manual o sin asignar
          </span>
          <span className="inline-flex items-center gap-2">
            <i aria-hidden="true" className="h-3 w-4 rounded border border-white/40 bg-info" />
            Azul: ya estaba asignada
          </span>
          <span className="inline-flex items-center gap-2">
            <i aria-hidden="true" className="h-3 w-4 rounded border border-white/40 bg-danger" />
            Rojo: conflicto de horario
          </span>
          <span className="hidden md:ml-auto md:inline">
            Toca o arrastra una limpieza para moverla. Con el botón derecho cambias la hora, la persona o la dejas sin asignar.
          </span>
        </div>

        <div data-planning-board className="hidden min-h-0 min-w-0 items-start gap-3 lg:grid lg:grid-cols-[200px_minmax(0,1fr)]">
          <aside aria-label="Tareas sin asignar" data-planning-unassigned className="sticky top-4 flex min-w-0 max-h-[calc(100dvh-12rem)] min-h-0 flex-col self-start rounded-xl border border-line bg-paper shadow-sm lg:col-start-1 lg:row-start-1">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">
                  Sin asignar
                </p>
                <p className="text-sm font-semibold text-ink">
                  Arrastra al horario
                </p>
              </div>
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-warning px-2 text-xs font-bold text-white">
                {unassignedTasks.length}
              </span>
            </div>
            <div data-planning-unassigned-list className="grid min-h-0 min-w-0 gap-2 overflow-x-hidden overflow-y-auto overscroll-contain p-3">
              {unassignedTasks.length === 0 ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-800">
                  <CheckCircle2 className="mx-auto mb-2 h-5 w-5" /> Todo
                  cubierto este día.
                </div>
              ) : (
                unassignedTasks.map((task) => (
                  <PlannerDraggable
                    key={task.id}
                    id={`unassigned:${task.id}`}
                    payload={{ taskId: task.id }}
                    disabled={isStale}
                  >
                    {({ attributes, onMouseDown, onTouchStart, onKeyDown, setNodeRef, setActivatorNodeRef, isDragging }) => (
                      <article
                        ref={setNodeRef}
                        data-planner-task-card
                        data-planner-task-id={task.id}
                        data-dnd-unassigned-tray-item
                        data-planner-status="unassigned"
                        onMouseDown={onMouseDown}
                        onTouchStart={onTouchStart}
                        className={`${!isStale ? 'touch-none cursor-grab' : ''} w-full min-w-0 rounded-xl border border-white/45 bg-warning p-3 text-white shadow-sober transition-[background-color,border-color,box-shadow] duration-200 hover:shadow-md motion-reduce:transition-none ${isDragging ? 'opacity-40' : ''} ${selectedTask?.taskId === task.id && selectedTask.proposalIndex === undefined ? 'ring-2 ring-brand ring-offset-1' : ''}`}
                      >
                        <div className="flex min-w-0 items-start gap-2">
                          <button
                            ref={setActivatorNodeRef}
                            {...attributes}
                            type="button"
                            data-planner-primary-action
                            className="min-h-[44px] min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                            onKeyDown={(event) => {
                              if (event.code !== 'Enter') onKeyDown?.(event);
                            }}
                            onClick={(event) => openReassignment(task.id, undefined, undefined, event.currentTarget)}
                          >
                            <span className="block truncate text-sm font-bold text-white">
                              {task.propertyCode || task.property}
                            </span>
                            <span className="mt-1 flex items-center gap-1 truncate text-xs text-white">
                              <Building2 aria-hidden="true" className="h-3 w-3 shrink-0" />
                              {task.detectedBuilding?.propertyGroupName || 'Edificio sin configurar'}
                            </span>
                            <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-white">
                              <Clock aria-hidden="true" className="h-3 w-3" /> {task.displayStartTime}-{task.displayEndTime}
                            </span>
                          </button>
                        </div>
                      </article>
                    )}
                  </PlannerDraggable>
                ))
              )}
            </div>
          </aside>

          <section
            aria-label="Ver calendario por horas"
            className="flex max-h-[calc(100dvh-19rem)] min-h-[320px] min-w-0 flex-col rounded-lg border border-line bg-white shadow-sm lg:col-start-2 lg:row-start-1"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <h3 className="font-bold text-ink">Equipo y horario</h3>
                <p className="text-xs text-ink-3">
                  Mueve horizontalmente para ajustar la hora o cambia de fila para reasignar.
                </p>
                <div aria-label="Leyenda de disponibilidad" className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-ink-3">
                  <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-3 w-4 rounded border border-emerald-600/50 bg-emerald-200/70" />Horario disponible</span>
                  <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-3 w-4 rounded border border-slate-400 bg-slate-100" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(100,116,139,.24) 0 2px, transparent 2px 6px)' }} />Fuera de horario</span>
                  <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-3 w-4 rounded border border-amber-600/70 bg-amber-200/80" />Mantenimiento</span>
                  <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-3 w-4 rounded border border-rose-600/70 bg-rose-200/75" />Ausencia o bloqueo</span>
                  <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-3 w-4 rounded border border-violet-500/60 bg-violet-200/60" />Horario estimado</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xs font-semibold text-ink-3">15 min</p>
                {manualChangeCount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-line text-brand"
                    onClick={resetDraft}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" /> Restablecer cambios
                  </Button>
                )}
              </div>
            </div>
            <div data-planning-hours-sticky className="sticky top-0 z-30 shrink-0 bg-paper shadow-sm">
              <div
                ref={hoursScrollRef}
                data-planning-hours-scroll
                className="overflow-x-hidden"
                onScroll={(event) => {
                  if (timelineScrollRef.current) timelineScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
                }}
              >
              <div className="min-w-max">
                <div className="flex h-11 border-b border-line bg-paper">
                  <div className="sticky left-0 z-20 flex w-[240px] shrink-0 items-center border-r border-line bg-paper px-3 text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                    Trabajadora
                  </div>
                  <div className="relative" style={{ width: timelineWidth }}>
                    {timeMarkers.map((minute) => (
                      <span
                        key={minute}
                        className={`absolute top-3 text-xs font-semibold text-ink-3 ${minute === bounds.start ? '' : '-translate-x-1/2'}`}
                        style={{
                          left: (minute - bounds.start) * pixelsPerMinute,
                        }}
                      >
                        {fromMinutes(minute)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              </div>
            </div>
            <div
              ref={timelineScrollRef}
              data-planning-timeline-scroll
              className="min-h-0 overflow-auto rounded-b-2xl"
              onScroll={(event) => {
                if (hoursScrollRef.current) hoursScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
              }}
            >
              <div className="min-w-max">
                {visibleCleaners.length === 0 ? (
                  <div className="flex min-h-[300px] items-center justify-center text-sm text-ink-3">
                    No hay trabajadoras disponibles.
                  </div>
                ) : (
                  visibleCleaners.map((cleaner) => {
                    const cleanerItems = dayItems
                      .filter((item) => item.cleanerId === cleaner.id)
                      .sort(
                        (left, right) => left.startMinute - right.startMinute,
                      );
                    const layout = planningTaskLanes(cleanerItems, bounds.start, pixelsPerMinute);
                    const availability = effectiveAvailability.find(
                      (item) =>
                        item.date === selectedDate &&
                        item.cleanerId === cleaner.id,
                    );
                    const assignedHours = weeklyHours.get(cleaner.id) ?? 0;
                    const contractHours = Math.max(0, Number(cleaner.contractHoursPerWeek) || 0);
                    const capacityPercent = contractHours > 0 ? Math.min(100, assignedHours / contractHours * 100) : 0;
                    const weeklyReady = !weeklyQuery.isPending && !weeklyQuery.isError;
                    const hoursLabel = (hours:number) => hours.toLocaleString('es-ES',{maximumFractionDigits:2});
                    return (
                      <div
                        key={cleaner.id}
                        className="flex min-h-[80px] border-b border-[#310984]/8 last:border-b-0"
                      >
                        <div className="sticky left-0 z-10 flex w-[240px] shrink-0 items-center gap-2 border-r border-line bg-white px-3 py-2">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-line-soft text-xs font-bold text-brand">
                            {cleaner.name
                              .split(' ')
                              .slice(0, 2)
                              .map((part) => part[0])
                              .join('')}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-bold leading-tight text-ink">
                              {cleaner.name}
                            </p>
                            <p
                              title={`Semana ${weeklyQuery.startDate} — ${weeklyQuery.endDate}. Horas asignadas, incluida esta propuesta, / horas de contrato de la ficha.`}
                              className={`text-xs font-semibold ${availability?.isAvailable === false ? 'text-red-600' : 'text-emerald-700'}`}
                            >
                              {weeklyQuery.isError ? 'No se pudo cargar la semana' : !weeklyReady ? 'Cargando semana…'
                                : `${hoursLabel(assignedHours)} / ${contractHours > 0 ? hoursLabel(contractHours) : '—'} h · semana`}
                            </p>
                            {weeklyReady && contractHours === 0 && <p className="text-xs text-ink-3">Sin horas de contrato</p>}
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#eeeaf5]">
                              <div
                                className={`h-full rounded-full ${assignedHours > contractHours && contractHours > 0 ? 'bg-red-500' : capacityPercent >= 85 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${weeklyReady ? capacityPercent : 0}%` }}
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
                            className="relative"
                            style={{
                              height: layout.height,
                              width: timelineWidth,
                              backgroundColor: availability ? '#f8fafc' : '#ffffff',
                              backgroundImage:
                                'linear-gradient(to right, rgba(49,9,132,0.045) 1px, transparent 1px), linear-gradient(to right, rgba(49,9,132,0.12) 1px, transparent 1px)',
                              backgroundSize: `${quarterHourGridSize}px 100%, ${60 * pixelsPerMinute}px 100%`,
                            }}
                          >
                            <WorkerAvailabilityBands availability={availability} bounds={bounds} />
                            {dragHover?.cleanerId === cleaner.id && (
                              <div
                                data-dnd-quarter-hover
                                className={`pointer-events-none absolute inset-y-0 z-[5] border-x-2 ${dragFeedback.get(cleaner.id)?.valid ? 'border-emerald-500 bg-emerald-300/30' : 'border-amber-500 bg-amber-300/30'}`}
                                style={{
                                  left:
                                    (dragHover.startMinute - bounds.start) *
                                    pixelsPerMinute,
                                  width: quarterHourGridSize,
                                }}
                              />
                            )}
                            {layout.cards.map(({ item, left, width, lane, overlaps }) => {
                              const selected =
                                selectedTask?.taskId === item.taskId &&
                                selectedTask.proposalIndex ===
                                  item.proposalIndex;
                              // Rojo para conflictos; al guardar, la tarjeta propuesta vira a verde con check.
                              const isSaved = savedTaskIdSet.has(item.taskId);
                              const statusTone = getPlannerTaskCardTone(item.source, { conflict: overlaps, saved: isSaved });
                              const StatusIcon = overlaps
                                ? AlertTriangle
                                : isSaved
                                  ? CheckCircle2
                                  : item.source === 'existing'
                                    ? CheckCircle2
                                    : item.source === 'manual'
                                      ? PencilLine
                                      : Sparkles;
                              return (
                                <PlannerDraggable
                                  key={item.id}
                                  id={`desktop:${item.id}`}
                                  payload={{ taskId: item.taskId, proposalIndex: item.proposalIndex, sourceCleanerId: item.cleanerId }}
                                  disabled={!item.editable || isStale}
                                >
                                  {({ attributes, onMouseDown, onTouchStart, onKeyDown, setNodeRef, setActivatorNodeRef, isDragging }) => (
                                    <div
                                      ref={setNodeRef}
                                      data-planner-task-card
                                      data-planner-task-id={item.taskId}
                                      data-planner-status={statusTone.status}
                                      title={`${item.task.propertyCode || item.task.property} · ${fromMinutes(item.startMinute)}-${fromMinutes(item.endMinute)}${overlaps ? ' · Coincide en horario con otra tarea de este trabajador' : ''}`}
                                      onMouseDown={onMouseDown}
                                      onTouchStart={onTouchStart}
                                      className={`absolute flex ${width < 180 ? 'flex-col' : ''} ${item.editable && !isStale ? 'touch-none cursor-grab' : ''} overflow-hidden rounded-lg border border-white/45 border-l-[6px] border-l-white/90 ${statusTone.surface} ${statusTone.foreground} shadow-md transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transition-none ${isDragging ? 'opacity-40' : ''} ${selected ? 'ring-2 ring-brand ring-offset-1' : ''}`}
                                      style={{ left, width, height: PLANNING_CARD_HEIGHT, top: 8 + lane * PLANNING_LANE_STEP }}
                                      onContextMenu={(event) => {
                                        event.preventDefault();
                                        setQuickActionsTaskId(item.taskId);
                                      }}
                                    >
                                      <button
                                        ref={setActivatorNodeRef}
                                        {...attributes}
                                        type="button"
                                        data-planner-primary-action
                                        className={`min-h-0 min-w-0 flex-1 overflow-hidden text-left text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none ${width < 180 ? 'px-1 pb-1 pt-6' : 'p-1'}`}
                                        onKeyDown={(event) => {
                                          if (event.code !== 'Enter') onKeyDown?.(event);
                                        }}
                                        onClick={(event) =>
                                          openReassignment(
                                            item.taskId,
                                            item.proposalIndex,
                                            item.cleanerId,
                                            event.currentTarget,
                                          )
                                        }
                                      >
                                        <p className={`flex items-center gap-1.5 text-sm font-bold leading-tight ${statusTone.foreground}`}>
                                          <span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center rounded-md ${statusTone.iconSurface} ${statusTone.iconForeground} ${width < 180 ? 'absolute left-1 top-1' : ''}`}>
                                            <StatusIcon className="h-3.5 w-3.5" />
                                          </span>
                                          <span className="truncate" title={item.task.propertyCode || item.task.property}>
                                            {item.task.propertyCode || item.task.property}
                                          </span>
                                        </p>
                                        <p className={`${width < 150 ? 'hidden' : ''} mt-0.5 truncate text-xs ${statusTone.foreground}`}>
                                          {item.task.detectedBuilding?.propertyGroupName || item.task.property}
                                        </p>
                                        <span className={`mt-0.5 inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-md bg-black/15 ${width < 130 ? 'px-1' : 'px-1.5'} py-0.5 ${width < 150 ? 'text-[10px]' : 'text-xs'} font-semibold text-white ${width < 180 ? 'mt-0' : ''}`} title={`${fromMinutes(item.startMinute)}–${fromMinutes(item.endMinute)}`}>
                                          <Clock aria-hidden="true" className={`h-3 w-3 shrink-0 ${width < 150 ? 'hidden' : ''}`} />
                                          {fromMinutes(item.startMinute)}–{fromMinutes(item.endMinute)}
                                        </span>
                                      </button>
                                    </div>
                                  )}
                                </PlannerDraggable>
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

        </div>

        {warnings.length === 0 && manualChangeCount === 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> El reparto no
            muestra solapes ni problemas con los datos disponibles.
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(reassignment)}
        onOpenChange={(open) => {
          if (open) return;
          // Cerrar sin confirmar no convierte una asignación existente en borrador.
          const snapshot = pendingEditSnapshotRef.current;
          if (snapshot) {
            pendingEditSnapshotRef.current = null;
            onDraftProposalsChange(snapshot.proposals);
            if (!snapshot.wasEdited) {
              setEditedExistingTaskIds((current) => {
                const next = new Set(current);
                next.delete(snapshot.taskId);
                return next;
              });
            }
          }
          setReassignment(null);
        }}
      >
        <DialogContent
          data-planner-placement-dialog
          overlayClassName="planner-placement-overlay bg-black/60 backdrop-blur-[2px]"
          onCloseAutoFocus={(event) => {
            // La tarjeta puede remontarse al cancelar un borrador: recupera su acción equivalente.
            const replacementCard = Array.from(document.querySelectorAll<HTMLElement>('[data-planner-task-card]'))
              .find((card) => card.dataset.plannerTaskId === reassignmentTriggerTaskIdRef.current && card.getClientRects().length > 0);
            const focusTarget = reassignmentTriggerRef.current?.isConnected
              ? reassignmentTriggerRef.current
              : replacementCard?.querySelector<HTMLElement>('[data-planner-primary-action]');
            if (focusTarget) {
              event.preventDefault();
              focusTarget.focus({ preventScroll: true });
            }
          }}
          className={`planner-placement-dialog flex max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden p-0 ${reassignmentOrigin ? 'planner-placement-from-card' : ''}`}
          style={reassignmentOrigin ? {
            '--planner-origin-x': `${reassignmentOrigin.x}px`,
            '--planner-origin-y': `${reassignmentOrigin.y}px`,
            '--planner-origin-scale': reassignmentOrigin.scale,
          } as CSSProperties : undefined}
        >
          <DialogHeader className="shrink-0 border-b border-line bg-paper p-5 pb-4 text-left">
            <DialogTitle>Colocar tarea</DialogTitle>
            <DialogDescription>
              {reassignmentTask
                ? `${reassignmentTask.property} · ${reassignmentTask.displayStartTime}-${reassignmentTask.displayEndTime}`
                : 'Selecciona una responsable.'}
              <span className="mt-1 block font-medium text-brand">Se guardará al pulsar «Guardar reparto».</span>
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
            <div>
              <label
                htmlFor="placement-start-time"
                className="mb-1 block text-sm font-semibold text-ink"
              >
                Hora de inicio
              </label>
              <input
                id="placement-start-time"
                type="time"
                value={placementStartTime}
                onChange={(event) => setPlacementStartTime(event.target.value)}
                className="min-h-[44px] w-full rounded-md border border-[#310984]/20 bg-white px-3 text-sm"
              />
              <p className="mt-1 text-xs text-ink-3">
                El final se calcula con la duración prevista.
              </p>
            </div>
            <p className="text-sm font-semibold text-ink">
              Elegir responsable
            </p>
            {reassignment?.proposalIndex !== undefined && (
              <button
                type="button"
                aria-pressed={placementCleanerId === UNASSIGNED_PLACEMENT_ID}
                className={`flex min-h-[52px] w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-[background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none ${placementCleanerId === UNASSIGNED_PLACEMENT_ID ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'border-red-200 bg-white hover:bg-red-50'}`}
                onClick={() => setPlacementCleanerId(UNASSIGNED_PLACEMENT_ID)}
              >
                <span className="font-semibold text-red-900">Sin asignar</span>
                <span className="text-xs font-semibold text-red-700">
                  Dejar sin asignar
                </span>
              </button>
            )}
            {reassignmentCandidates.map(({ cleaner, validation }) => (
              <button
                key={cleaner.id}
                type="button"
                aria-pressed={placementCleanerId === cleaner.id}
                className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-[background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none ${placementCleanerId === cleaner.id ? 'border-brand bg-line-soft ring-1 ring-brand' : 'border-line bg-white hover:border-brand/40 hover:bg-paper'}`}
                onClick={() => setPlacementCleanerId(cleaner.id)}
              >
                <span className="font-semibold text-ink">
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
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <strong>Advertencia:</strong>{' '}
                    {selected.validation.conflict?.message}
                  </div>
                ) : null;
              })()}
          </div>
          <div className="shrink-0 border-t border-line bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.05)]">
            <Button
              type="button"
              className="min-h-[48px] w-full bg-brand text-white hover:bg-ink"
              disabled={
                !placementCleanerId ||
                (placementCleanerId !== UNASSIGNED_PLACEMENT_ID &&
                  !placementStartTime)
              }
              onClick={() => applyPlacement()}
            >
              {placementCleanerId === UNASSIGNED_PLACEMENT_ID
                ? 'Dejar sin asignar'
                : 'Aplicar al borrador'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ajuste rápido sobre una limpieza ya asignada (clic derecho) */}
      <TaskQuickActionsDialog
        open={Boolean(quickActionsTask)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setQuickActionsTaskId(null);
        }}
        task={quickActionsTask}
        cleaners={cleaners}
        busyCleanerIds={quickActionsBusyCleanerIds}
        availableCleanerIds={availableCleanerIds}
        hasOpenProposal
        onSaved={(taskId) => {
          // El cambio ya está guardado en la tarea real: el borrador deja de representar
          // esa limpieza para que el tablero muestre el estado real (o la bandeja Sin asignar).
          onDraftProposalsChange(
            draftProposals.filter((proposal) => proposal.taskId !== taskId),
          );
          setEditedExistingTaskIds((current) => {
            const next = new Set(current);
            next.delete(taskId);
            return next;
          });
          setQuickActionsTaskId(null);
          onTaskSaved?.(taskId);
        }}
      />
    </DndContext>
  );
};

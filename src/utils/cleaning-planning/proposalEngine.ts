import { Cleaner } from '../../types/calendar';
import {
  AssignmentConflict,
  AssignmentProposal,
  AssignmentProposalResult,
  AvailabilityWindow,
  BlockedAvailabilityWindow,
  BuildingDetectionRule,
  CleaningPlanningTask,
  EffectiveWorkerAvailability,
} from '../../types/cleaningPlanning';
import { CleanerGroupAssignment } from '../../types/propertyGroups';
import { isPlannableTaskStatus } from '../cleaningPlanning';
import { detectBuildingFromCode } from './buildingDetection';
import { buildPlanningBundleId, getPlanningBundleTaskSortKey } from './planningBundles';
import { buildGlobalPlanQualitySummary, type PlanQualityBundleInput } from './planScoring';

interface ProposalInput {
  tasks: CleaningPlanningTask[];
  cleaners: Cleaner[];
  availability: EffectiveWorkerAvailability[];
  buildingRules?: BuildingDetectionRule[];
  cleanerGroupAssignments?: CleanerGroupAssignment[];
}

const SAME_BUILDING_BUFFER_MINUTES = 10;
const DIFFERENT_BUILDING_BUFFER_MINUTES = 30;
const EARLY_CHECK_IN_MINUTES = 14 * 60;
const LARGE_HOUSE_THRESHOLD_MINUTES = 6 * 60;
const LARGE_HOUSE_CLEANERS = 3;

const getCleanerName = (cleaners: Cleaner[], cleanerId: string): string => cleaners.find((cleaner) => cleaner.id === cleanerId)?.name || 'Trabajadora';

const buildConflict = (taskId: string, code: AssignmentConflict['code'], message: string, details?: Record<string, unknown>): AssignmentConflict => ({
  taskId,
  code,
  message,
  details,
});

const availabilityKey = (cleanerId: string, date: string): string => `${cleanerId}:${date}`;
const taskCountKey = (cleanerId: string, date: string, propertyGroupId?: string): string => `${cleanerId}:${date}:${propertyGroupId || 'sin-edificio'}`;

type ScheduledWindow = {
  taskId: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  propertyGroupId?: string;
};

type Candidate = {
  assignment: CleanerGroupAssignment;
  availability: EffectiveWorkerAvailability;
  proposedWindow: ScheduledWindow;
  score: number;
  reasons: string[];
  warnings: string[];
};

type AssignmentRole = NonNullable<CleanerGroupAssignment['roleType']>;

type AvailabilityFitResult = {
  fits: boolean;
  blockedCode?: AssignmentConflict['code'];
  blockedReason?: string;
};

type MinuteWindow = { startMinutes: number; endMinutes: number };

type ProposedWindowConflict = {
  window: ScheduledWindow;
  code: AssignmentConflict['code'];
  bufferMinutes?: number;
};

const timeToMinutes = (time?: string | null): number | null => {
  if (!time) return null;
  const [rawHours, rawMinutes = '0'] = time.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const minutesToTime = (minutes: number): string => {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const hours = Math.floor(normalized / 60).toString().padStart(2, '0');
  const mins = (normalized % 60).toString().padStart(2, '0');
  return `${hours}:${mins}`;
};

const getTaskWindow = (task: CleaningPlanningTask, propertyGroupId?: string): ScheduledWindow | null => {
  const startMinutes = timeToMinutes(task.startTime);
  const endMinutes = timeToMinutes(task.endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return null;
  return {
    taskId: task.id,
    date: task.date,
    startMinutes,
    endMinutes,
    propertyGroupId,
  };
};

const getOperationalWindow = (task: CleaningPlanningTask, propertyGroupId?: string): ScheduledWindow | null => {
  const checkOutMinutes = timeToMinutes(task.checkOut);
  const checkInMinutes = timeToMinutes(task.checkIn);
  if (checkOutMinutes === null || checkInMinutes === null || checkInMinutes <= checkOutMinutes) {
    return getTaskWindow(task, propertyGroupId);
  }

  return {
    taskId: task.id,
    date: task.date,
    startMinutes: checkOutMinutes,
    endMinutes: checkInMinutes,
    propertyGroupId,
  };
};

const availabilityWindowToMinutes = (window: AvailabilityWindow): { startMinutes: number; endMinutes: number } | null => {
  const startMinutes = timeToMinutes(window.startTime);
  const endMinutes = timeToMinutes(window.endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return null;
  return { startMinutes, endMinutes };
};

const blockedWindowToMinutes = (window: BlockedAvailabilityWindow): { startMinutes: number; endMinutes: number; reason: string } | null => {
  const startMinutes = timeToMinutes(window.startTime);
  const endMinutes = timeToMinutes(window.endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return null;
  return { startMinutes, endMinutes, reason: window.reason };
};

const minuteWindowsOverlap = (
  a: { startMinutes: number; endMinutes: number },
  b: { startMinutes: number; endMinutes: number },
): boolean => a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;

const overlapMinutes = (a: MinuteWindow, b: MinuteWindow): number => Math.max(
  0,
  Math.min(a.endMinutes, b.endMinutes) - Math.max(a.startMinutes, b.startMinutes),
);

const subtractWindow = (windows: MinuteWindow[], blocked: MinuteWindow): MinuteWindow[] => windows.flatMap((window) => {
  if (!minuteWindowsOverlap(window, blocked)) return [window];
  const parts: MinuteWindow[] = [];
  if (blocked.startMinutes > window.startMinutes) {
    parts.push({ startMinutes: window.startMinutes, endMinutes: Math.min(blocked.startMinutes, window.endMinutes) });
  }
  if (blocked.endMinutes < window.endMinutes) {
    parts.push({ startMinutes: Math.max(blocked.endMinutes, window.startMinutes), endMinutes: window.endMinutes });
  }
  return parts.filter((part) => part.endMinutes > part.startMinutes);
});

const windowsOverlap = (a: ScheduledWindow, b: ScheduledWindow): boolean => (
  a.date === b.date && minuteWindowsOverlap(a, b)
);

const getBufferBetweenWindows = (a: ScheduledWindow, b: ScheduledWindow): number => (
  a.propertyGroupId && b.propertyGroupId && a.propertyGroupId === b.propertyGroupId
    ? SAME_BUILDING_BUFFER_MINUTES
    : DIFFERENT_BUILDING_BUFFER_MINUTES
);

const findProposedWindowConflict = (
  proposedWindowsByCleaner: Map<string, ScheduledWindow[]>,
  cleanerId: string,
  taskWindow: ScheduledWindow,
): ProposedWindowConflict | null => {
  const windows = proposedWindowsByCleaner.get(cleanerId) || [];

  for (const window of windows) {
    if (windowsOverlap(window, taskWindow)) {
      return { window, code: 'time_overlap' };
    }

    if (window.date !== taskWindow.date) continue;
    const bufferMinutes = getBufferBetweenWindows(window, taskWindow);
    const gapMinutes = taskWindow.startMinutes >= window.endMinutes
      ? taskWindow.startMinutes - window.endMinutes
      : window.startMinutes - taskWindow.endMinutes;

    if (gapMinutes >= 0 && gapMinutes < bufferMinutes) {
      return { window, code: 'time_buffer_overlap', bufferMinutes };
    }
  }

  return null;
};

const buildProposedWorkWindow = (
  proposedWindowsByCleaner: Map<string, ScheduledWindow[]>,
  cleanerId: string,
  operationalWindow: ScheduledWindow,
  workMinutes: number,
  availability: EffectiveWorkerAvailability,
): ScheduledWindow | null => {
  const availableWindows = availability.availableWindows
    .map(availabilityWindowToMinutes)
    .filter((window): window is NonNullable<typeof window> => Boolean(window));
  const blockedWindows = availability.blockedWindows
    .map(blockedWindowToMinutes)
    .filter((window): window is NonNullable<typeof window> => Boolean(window));

  for (let startMinutes = operationalWindow.startMinutes; startMinutes + workMinutes <= operationalWindow.endMinutes; startMinutes += 1) {
    const proposedWindow: ScheduledWindow = {
      taskId: operationalWindow.taskId,
      date: operationalWindow.date,
      startMinutes,
      endMinutes: startMinutes + workMinutes,
      propertyGroupId: operationalWindow.propertyGroupId,
    };
    const insideAvailability = availableWindows.some((window) => (
      proposedWindow.startMinutes >= window.startMinutes && proposedWindow.endMinutes <= window.endMinutes
    ));
    if (!insideAvailability) continue;
    if (blockedWindows.some((window) => minuteWindowsOverlap(window, proposedWindow))) continue;
    if (findProposedWindowConflict(proposedWindowsByCleaner, cleanerId, proposedWindow)) continue;
    return proposedWindow;
  }

  return null;
};

const checkAvailabilityWindowFit = (
  availability: EffectiveWorkerAvailability,
  taskWindow: ScheduledWindow,
  requiredWorkMinutes?: number,
): AvailabilityFitResult => {
  const overlappingBlockedWindows = availability.blockedWindows
    .map(blockedWindowToMinutes)
    .filter((window): window is NonNullable<typeof window> => Boolean(window))
    .filter((window) => minuteWindowsOverlap(window, taskWindow));

  const fullWindowMode = !requiredWorkMinutes || requiredWorkMinutes >= (taskWindow.endMinutes - taskWindow.startMinutes);

  if (fullWindowMode && overlappingBlockedWindows.length > 0) {
    const blockedWindow = overlappingBlockedWindows[0];
    const lowerReason = blockedWindow.reason.toLowerCase();
    if (lowerReason.includes('mantenimiento') || lowerReason.includes('maintenance')) {
      return { fits: false, blockedCode: 'blocked_by_maintenance', blockedReason: blockedWindow.reason };
    }
    if (lowerReason.includes('ausencia') || lowerReason.includes('absence')) {
      return { fits: false, blockedCode: 'blocked_by_partial_absence', blockedReason: blockedWindow.reason };
    }
    return { fits: false, blockedCode: 'availability_window_mismatch', blockedReason: blockedWindow.reason };
  }

  const validAvailableWindows = availability.availableWindows
    .map(availabilityWindowToMinutes)
    .filter((window): window is NonNullable<typeof window> => Boolean(window));

  if (!fullWindowMode) {
    const taskAvailableSegments = validAvailableWindows
      .map((window) => ({
        startMinutes: Math.max(window.startMinutes, taskWindow.startMinutes),
        endMinutes: Math.min(window.endMinutes, taskWindow.endMinutes),
      }))
      .filter((window) => window.endMinutes > window.startMinutes);

    const unblockedSegments = overlappingBlockedWindows.reduce<MinuteWindow[]>(
      (segments, blockedWindow) => subtractWindow(segments, blockedWindow),
      taskAvailableSegments,
    );

    const availableInsideTaskWindow = unblockedSegments.reduce((total, window) => total + overlapMinutes(window, taskWindow), 0);
    const fits = availableInsideTaskWindow >= requiredWorkMinutes;

    if (!fits && overlappingBlockedWindows.length > 0) {
      const blockedWindow = overlappingBlockedWindows[0];
      const lowerReason = blockedWindow.reason.toLowerCase();
      if (lowerReason.includes('mantenimiento') || lowerReason.includes('maintenance')) {
        return { fits: false, blockedCode: 'blocked_by_maintenance', blockedReason: blockedWindow.reason };
      }
      if (lowerReason.includes('ausencia') || lowerReason.includes('absence')) {
        return { fits: false, blockedCode: 'blocked_by_partial_absence', blockedReason: blockedWindow.reason };
      }
    }

    return { fits, blockedCode: fits ? undefined : 'availability_window_mismatch' };
  }

  const fits = validAvailableWindows.some((window) => (
    taskWindow.startMinutes >= window.startMinutes && taskWindow.endMinutes <= window.endMinutes
  ));

  return { fits, blockedCode: fits ? undefined : 'availability_window_mismatch' };
};

const isEarlyCheckInTask = (task: CleaningPlanningTask): boolean => {
  const checkInMinutes = timeToMinutes(task.checkIn);
  return checkInMinutes !== null && checkInMinutes <= EARLY_CHECK_IN_MINUTES;
};

const getRequiredCleanerCount = (task: CleaningPlanningTask): number => {
  const explicitRequiredCleaners = Number(task.requiredCleaners || 0);
  if (Number.isFinite(explicitRequiredCleaners) && explicitRequiredCleaners > 0) {
    return Math.min(LARGE_HOUSE_CLEANERS, Math.max(1, Math.ceil(explicitRequiredCleaners)));
  }

  return task.durationMinutes > LARGE_HOUSE_THRESHOLD_MINUTES ? LARGE_HOUSE_CLEANERS : 1;
};

const getWorkerLoadMinutes = (task: CleaningPlanningTask, requiredCleaners: number): number => (
  Math.ceil(task.durationMinutes / Math.max(requiredCleaners, 1))
);

const getAssignmentRole = (assignment: CleanerGroupAssignment): Exclude<AssignmentRole, 'excluded'> => {
  if (assignment.roleType === 'primary' || assignment.roleType === 'secondary' || assignment.roleType === 'backup') {
    return assignment.roleType;
  }

  if (assignment.priority <= 1) return 'primary';
  if (assignment.priority === 2) return 'secondary';
  return 'backup';
};

const getAssignmentRoleRank = (assignment: CleanerGroupAssignment): number => {
  const role = getAssignmentRole(assignment);
  if (role === 'primary') return 1;
  if (role === 'secondary') return 2;
  return 3;
};

const scoreCandidate = ({
  assignment,
  availability,
  requiredMinutes,
}: {
  assignment: CleanerGroupAssignment;
  availability: EffectiveWorkerAvailability;
  requiredMinutes: number;
}): { score: number; reasons: string[]; warnings: string[] } => {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 50;
  const role = getAssignmentRole(assignment);

  if (role === 'primary') {
    score += 40;
    reasons.push('Es la trabajadora titular/preferente del edificio.');
  } else if (role === 'secondary') {
    score += 22;
    reasons.push('Es suplente configurada para este edificio.');
    warnings.push('Se propone suplente porque la titular no está disponible o no encaja.');
  } else {
    score += 8;
    reasons.push('Es backup configurada para este edificio.');
    warnings.push('Se propone backup porque titular y suplentes no están disponibles o no encajan.');
  }

  if (availability.remainingMinutes >= requiredMinutes) {
    score += 20;
    reasons.push(`Tiene capacidad suficiente (${Math.round(availability.remainingMinutes / 60 * 10) / 10} h libres).`);
  }

  if (assignment.maxTasksPerDay > 0) {
    reasons.push(`Límite operativo del edificio: ${assignment.maxTasksPerDay} tareas/día.`);
  }

  if (availability.source === 'contract_fallback') {
    warnings.push('La disponibilidad se estimó por fallback; conviene revisar disponibilidad real.');
    score -= 10;
  }

  const remainingAfter = availability.remainingMinutes - requiredMinutes;
  if (remainingAfter < SAME_BUILDING_BUFFER_MINUTES) {
    warnings.push('La asignación deja menos de 10 min de margen operativo.');
    score -= 8;
  }

  return { score, reasons, warnings };
};

const sortTasksForPlanning = (tasks: CleaningPlanningTask[]): CleaningPlanningTask[] => tasks
  .filter((task) => !task.cleanerId && isPlannableTaskStatus(task.status))
  .sort((a, b) => {
    const earlyDiff = Number(isEarlyCheckInTask(b)) - Number(isEarlyCheckInTask(a));
    if (earlyDiff !== 0) return earlyDiff;
    if (b.riskFlags.length !== a.riskFlags.length) return b.riskFlags.length - a.riskFlags.length;
    return `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`);
  });

type PreparedPlanningTask = {
  task: CleaningPlanningTask;
  detectedBuilding: {
    propertyGroupId: string;
    propertyGroupName: string;
  };
  displayTaskWindow: ScheduledWindow;
  taskWindow: ScheduledWindow;
  buildingAssignments: CleanerGroupAssignment[];
  requiredCleaners: number;
  workerLoadMinutes: number;
  requiredMinutes: number;
  bundleId: string;
};

type FullBundleCandidate = {
  assignment: CleanerGroupAssignment;
  role: Exclude<AssignmentRole, 'excluded'>;
  score: number;
  preparedWindows: Array<{
    prepared: PreparedPlanningTask;
    proposedWindow: ScheduledWindow;
    score: number;
    reasons: string[];
    warnings: string[];
  }>;
};

type MinimalCrewBundleCandidate = {
  crewSize: number;
  score: number;
  preparedWindows: Array<{
    prepared: PreparedPlanningTask;
    assignment: CleanerGroupAssignment;
    proposedWindow: ScheduledWindow;
    score: number;
    reasons: string[];
    warnings: string[];
  }>;
};

type PlanningBundleState = PlanQualityBundleInput & {
  date: string;
  tasks: PreparedPlanningTask[];
  hadFullBundleCandidate: boolean;
  hadNonBackupFullCandidate: boolean;
};

export interface ValidateDraftAssignmentMoveInput extends Omit<ProposalInput, 'tasks'> {
  task: CleaningPlanningTask;
  cleanerId: string;
  draftProposals: AssignmentProposal[];
  calendarTasks: CleaningPlanningTask[];
  excludeProposalIndex?: number;
}

export interface DraftAssignmentMoveValidation {
  valid: boolean;
  conflict?: AssignmentConflict;
  assignmentRole?: AssignmentProposal['assignmentRole'];
  proposedStartTime?: string;
  proposedEndTime?: string;
  durationMinutes?: number;
  capacityAfterAssignment?: AssignmentProposal['capacityAfterAssignment'];
}

export const validateDraftAssignmentMove = ({
  task,
  cleanerId,
  cleaners,
  availability,
  buildingRules = [],
  cleanerGroupAssignments = [],
  draftProposals,
  calendarTasks,
  excludeProposalIndex,
}: ValidateDraftAssignmentMoveInput): DraftAssignmentMoveValidation => {
  const invalid = (
    code: AssignmentConflict['code'],
    message: string,
    details?: Record<string, unknown>,
  ): DraftAssignmentMoveValidation => ({ valid: false, conflict: buildConflict(task.id, code, message, details) });
  const cleaner = cleaners.find((item) => item.id === cleanerId && item.isActive);
  if (!cleaner) return invalid('no_available_worker', 'La trabajadora no está activa o no existe.');

  const detectedBuilding = task.detectedBuilding || detectBuildingFromCode(task.propertyCode, buildingRules);
  if (detectedBuilding.status === 'not_detected') return invalid('building_not_detected', detectedBuilding.reason);
  if (detectedBuilding.status === 'ambiguous') return invalid('building_ambiguous', detectedBuilding.reason);
  if (task.durationMinutes <= 0 || task.durationSource === 'missing') {
    return invalid('missing_duration', 'La tarea no tiene duración predeterminada válida.');
  }

  const displayTaskWindow = getTaskWindow(task, detectedBuilding.propertyGroupId);
  if (!displayTaskWindow) return invalid('invalid_time_window', 'La tarea no tiene una ventana horaria válida.');
  const operationalWindow = getOperationalWindow(task, detectedBuilding.propertyGroupId) || displayTaskWindow;
  const requiredCleaners = getRequiredCleanerCount(task);
  const workerLoadMinutes = getWorkerLoadMinutes(task, requiredCleaners);
  const requiredMinutes = workerLoadMinutes + SAME_BUILDING_BUFFER_MINUTES;

  const assignment = cleanerGroupAssignments.find((item) => (
    item.isActive
    && item.roleType !== 'excluded'
    && item.propertyGroupId === detectedBuilding.propertyGroupId
    && item.cleanerId === cleanerId
  ));
  if (!assignment) {
    return invalid('no_building_team', `${cleaner.name} no forma parte del equipo válido de este edificio.`);
  }

  const workerAvailability = availability.find((item) => item.cleanerId === cleanerId && item.date === task.date);
  if (!workerAvailability?.isAvailable) {
    return invalid('no_available_worker', `${cleaner.name} no está disponible ese día.`);
  }

  const otherProposals = draftProposals.filter((_, index) => index !== excludeProposalIndex);
  if (otherProposals.some((proposal) => proposal.taskId === task.id && proposal.cleanerId === cleanerId)) {
    return invalid('no_available_worker', `${cleaner.name} ya ocupa otra posición de esta limpieza.`);
  }

  const proposedWindowsByCleaner = new Map<string, ScheduledWindow[]>();
  otherProposals.filter((proposal) => proposal.cleanerId === cleanerId).forEach((proposal) => {
    const proposalTask = calendarTasks.find((item) => item.id === proposal.taskId);
    if (!proposalTask) return;
    const propertyGroupId = proposal.propertyGroupId || proposalTask.detectedBuilding?.propertyGroupId;
    const startMinutes = timeToMinutes(proposal.proposedStartTime || proposalTask.startTime);
    const endMinutes = timeToMinutes(proposal.proposedEndTime || proposalTask.endTime);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return;
    const windows = proposedWindowsByCleaner.get(cleanerId) || [];
    windows.push({ taskId: proposal.taskId, date: proposalTask.date, startMinutes, endMinutes, propertyGroupId });
    proposedWindowsByCleaner.set(cleanerId, windows);
  });

  calendarTasks.filter((item) => item.id !== task.id && item.date === task.date).forEach((item) => {
    const assignedIds = new Set([
      ...(item.assignments || []).map((entry) => entry.cleaner_id),
      ...(item.cleanerId ? [item.cleanerId] : []),
    ].filter(Boolean));
    if (!assignedIds.has(cleanerId)) return;
    const existingWindow = getTaskWindow(item, item.detectedBuilding?.propertyGroupId);
    if (!existingWindow) return;
    const windows = proposedWindowsByCleaner.get(cleanerId) || [];
    windows.push(existingWindow);
    proposedWindowsByCleaner.set(cleanerId, windows);
  });

  const usedDraftMinutes = otherProposals
    .filter((proposal) => proposal.cleanerId === cleanerId)
    .reduce((total, proposal) => total + proposal.durationMinutes + SAME_BUILDING_BUFFER_MINUTES, 0);
  const simulatedAvailability = {
    ...workerAvailability,
    assignedMinutes: workerAvailability.assignedMinutes + usedDraftMinutes,
    remainingMinutes: Math.max(0, workerAvailability.remainingMinutes - usedDraftMinutes),
  };
  if (simulatedAvailability.remainingMinutes < requiredMinutes) {
    return invalid('no_available_worker', `${cleaner.name} no tiene capacidad restante suficiente.`);
  }

  const sameBuildingTaskCount = otherProposals.filter((proposal) => {
    if (proposal.cleanerId !== cleanerId) return false;
    const proposalTask = calendarTasks.find((item) => item.id === proposal.taskId);
    return proposalTask?.date === task.date
      && (proposal.propertyGroupId || proposalTask.detectedBuilding?.propertyGroupId) === detectedBuilding.propertyGroupId;
  }).length;
  if (assignment.maxTasksPerDay > 0 && sameBuildingTaskCount >= assignment.maxTasksPerDay) {
    return invalid('max_tasks_per_day', `${cleaner.name} ya alcanzó el límite diario configurado para este edificio.`);
  }

  const windowFit = checkAvailabilityWindowFit(simulatedAvailability, operationalWindow, workerLoadMinutes);
  if (!windowFit.fits) {
    return invalid(windowFit.blockedCode || 'availability_window_mismatch', 'La limpieza no encaja en la disponibilidad real de la trabajadora.');
  }
  const proposedWindow = buildProposedWorkWindow(proposedWindowsByCleaner, cleanerId, operationalWindow, workerLoadMinutes, simulatedAvailability);
  if (!proposedWindow) return invalid('availability_window_mismatch', 'No queda una franja suficiente dentro de la ventana operativa.');
  const proposedWindowFit = checkAvailabilityWindowFit(simulatedAvailability, proposedWindow, workerLoadMinutes);
  if (!proposedWindowFit.fits) {
    return invalid(proposedWindowFit.blockedCode || 'availability_window_mismatch', 'La franja propuesta no encaja en la disponibilidad real.');
  }
  const proposedWindowConflict = findProposedWindowConflict(proposedWindowsByCleaner, cleanerId, proposedWindow);
  if (proposedWindowConflict) {
    return invalid(
      proposedWindowConflict.code,
      proposedWindowConflict.code === 'time_buffer_overlap'
        ? `No se respeta el buffer mínimo de ${proposedWindowConflict.bufferMinutes || SAME_BUILDING_BUFFER_MINUTES} min.`
        : 'La limpieza se solapa con otra tarea de la trabajadora.',
      { overlapsWithTaskId: proposedWindowConflict.window.taskId },
    );
  }

  return {
    valid: true,
    assignmentRole: getAssignmentRole(assignment),
    proposedStartTime: minutesToTime(proposedWindow.startMinutes),
    proposedEndTime: minutesToTime(proposedWindow.endMinutes),
    durationMinutes: workerLoadMinutes,
    capacityAfterAssignment: {
      assignedMinutes: simulatedAvailability.assignedMinutes + requiredMinutes,
      remainingMinutes: simulatedAvailability.remainingMinutes - requiredMinutes,
    },
  };
};

export const buildAssignmentProposal = ({
  tasks,
  cleaners,
  availability,
  buildingRules = [],
  cleanerGroupAssignments = [],
}: ProposalInput): AssignmentProposalResult => {
  const proposals: AssignmentProposal[] = [];
  const conflicts: AssignmentConflict[] = [];
  const additionalQualityWarnings: string[] = [];
  const availabilityByCleanerDate = new Map(availability.map((item) => [availabilityKey(item.cleanerId, item.date), { ...item }]));
  const activeCleanerIds = new Set(cleaners.filter((cleaner) => cleaner.isActive).map((cleaner) => cleaner.id));
  const proposedWindowsByCleaner = new Map<string, ScheduledWindow[]>();
  const proposedTaskCounts = new Map<string, number>();

  const orderedTasks = sortTasksForPlanning(tasks);
  const taskOrder = new Map(orderedTasks.map((task, index) => [task.id, index]));
  const preparedTasks: PreparedPlanningTask[] = [];

  orderedTasks.forEach((task) => {
    const detectedBuilding = task.detectedBuilding || detectBuildingFromCode(task.propertyCode, buildingRules);

    if (detectedBuilding.status === 'not_detected') {
      conflicts.push(buildConflict(task.id, 'building_not_detected', detectedBuilding.reason, { propertyCode: task.propertyCode }));
      return;
    }

    if (detectedBuilding.status === 'ambiguous') {
      conflicts.push(buildConflict(task.id, 'building_ambiguous', detectedBuilding.reason, { propertyCode: task.propertyCode }));
      return;
    }

    if (task.durationMinutes <= 0 || task.durationSource === 'missing') {
      conflicts.push(buildConflict(task.id, 'missing_duration', 'La tarea no tiene duración predeterminada válida.', { propertyCode: task.propertyCode }));
      return;
    }

    const displayTaskWindow = getTaskWindow(task, detectedBuilding.propertyGroupId);
    if (!displayTaskWindow) {
      conflicts.push(buildConflict(task.id, 'invalid_time_window', 'La tarea no tiene una ventana horaria válida para proponer asignación.', {
        startTime: task.startTime,
        endTime: task.endTime,
      }));
      return;
    }

    const taskWindow = getOperationalWindow(task, detectedBuilding.propertyGroupId) || displayTaskWindow;

    const buildingAssignments = cleanerGroupAssignments
      .filter((assignment) => assignment.isActive)
      .filter((assignment) => assignment.roleType !== 'excluded')
      .filter((assignment) => assignment.propertyGroupId === detectedBuilding.propertyGroupId)
      .filter((assignment) => activeCleanerIds.has(assignment.cleanerId))
      .sort((a, b) => getAssignmentRoleRank(a) - getAssignmentRoleRank(b) || a.priority - b.priority);

    if (buildingAssignments.length === 0) {
      conflicts.push(buildConflict(task.id, 'no_building_team', 'El edificio no tiene equipo preferente, suplente o backup configurado.', {
        propertyGroupId: detectedBuilding.propertyGroupId,
        propertyGroupName: detectedBuilding.propertyGroupName,
      }));
      return;
    }

    const requiredCleaners = getRequiredCleanerCount(task);
    const workerLoadMinutes = getWorkerLoadMinutes(task, requiredCleaners);
    const requiredMinutes = workerLoadMinutes + SAME_BUILDING_BUFFER_MINUTES;
    const bundleId = buildPlanningBundleId(task.date, detectedBuilding.propertyGroupId);

    preparedTasks.push({
      task,
      detectedBuilding: {
        propertyGroupId: detectedBuilding.propertyGroupId,
        propertyGroupName: detectedBuilding.propertyGroupName,
      },
      displayTaskWindow,
      taskWindow,
      buildingAssignments,
      requiredCleaners,
      workerLoadMinutes,
      requiredMinutes,
      bundleId,
    });
  });

  const bundleMap = new Map<string, PlanningBundleState>();
  preparedTasks.forEach((prepared) => {
    const current = bundleMap.get(prepared.bundleId) || {
      bundleId: prepared.bundleId,
      date: prepared.task.date,
      propertyGroupName: prepared.detectedBuilding.propertyGroupName,
      taskIds: [],
      tasks: [],
      hadFullBundleCandidate: false,
      hadNonBackupFullCandidate: false,
    };
    current.tasks.push(prepared);
    current.taskIds.push(prepared.task.id);
    const latestFinish = minutesToTime(Math.min(...current.tasks.map((item) => item.taskWindow.endMinutes)));
    current.latestFinishTime = latestFinish;
    bundleMap.set(prepared.bundleId, current);
  });

  const sortPreparedTasksInsideBundle = (a: PreparedPlanningTask, b: PreparedPlanningTask): number => {
    const earlyDiff = Number(isEarlyCheckInTask(b.task)) - Number(isEarlyCheckInTask(a.task));
    if (earlyDiff !== 0) return earlyDiff;
    if (b.task.riskFlags.length !== a.task.riskFlags.length) return b.task.riskFlags.length - a.task.riskFlags.length;
    return getPlanningBundleTaskSortKey(a.task).localeCompare(getPlanningBundleTaskSortKey(b.task), 'es', { numeric: true });
  };

  const bundleStates = Array.from(bundleMap.values()).map((bundle) => {
    const sortedTasks = [...bundle.tasks].sort(sortPreparedTasksInsideBundle);
    return {
      ...bundle,
      tasks: sortedTasks,
      taskIds: sortedTasks.map((item) => item.task.id),
    };
  });

  const getAvailableAssignmentCount = (bundle: PlanningBundleState): number => {
    const cleanerIds = new Set<string>();
    bundle.tasks.forEach((prepared) => {
      prepared.buildingAssignments.forEach((assignment) => {
        const workerAvailability = availabilityByCleanerDate.get(availabilityKey(assignment.cleanerId, prepared.task.date));
        if (workerAvailability?.isAvailable && workerAvailability.remainingMinutes > 0) {
          cleanerIds.add(assignment.cleanerId);
        }
      });
    });
    return cleanerIds.size;
  };

  const orderedBundles = [...bundleStates].sort((a, b) => {
    const aScarcity = getAvailableAssignmentCount(a);
    const bScarcity = getAvailableAssignmentCount(b);
    if (aScarcity !== bScarcity) return aScarcity - bScarcity;
    const aEarly = Number(a.tasks.some((item) => isEarlyCheckInTask(item.task)));
    const bEarly = Number(b.tasks.some((item) => isEarlyCheckInTask(item.task)));
    if (aEarly !== bEarly) return bEarly - aEarly;
    if (a.tasks.length !== b.tasks.length) return b.tasks.length - a.tasks.length;
    return getPlanningBundleTaskSortKey(a.tasks[0].task).localeCompare(getPlanningBundleTaskSortKey(b.tasks[0].task), 'es', { numeric: true });
  });

  const getExistingBundleNamesForCleaner = (cleanerId: string, date: string, excludeBundleId: string): string[] => Array.from(new Set(proposals
    .filter((proposal) => proposal.cleanerId === cleanerId)
    .filter((proposal) => proposal.bundleId !== excludeBundleId)
    .filter((proposal) => {
      const prepared = preparedTasks.find((item) => item.task.id === proposal.taskId);
      return prepared?.task.date === date;
    })
    .map((proposal) => proposal.propertyGroupName || 'otro centro')));

  const pushProposal = (
    prepared: PreparedPlanningTask,
    candidate: Candidate,
    assignmentIndex: number,
    extraReasons: string[] = [],
    extraWarnings: string[] = [],
  ) => {
    candidate.availability.assignedMinutes += prepared.requiredMinutes;
    candidate.availability.remainingMinutes = Math.max(0, candidate.availability.remainingMinutes - prepared.requiredMinutes);
    availabilityByCleanerDate.set(availabilityKey(candidate.assignment.cleanerId, prepared.task.date), candidate.availability);

    const cleanerWindows = proposedWindowsByCleaner.get(candidate.assignment.cleanerId) || [];
    proposedWindowsByCleaner.set(candidate.assignment.cleanerId, [...cleanerWindows, candidate.proposedWindow]);
    const countKey = taskCountKey(candidate.assignment.cleanerId, prepared.task.date, prepared.detectedBuilding.propertyGroupId);
    proposedTaskCounts.set(countKey, (proposedTaskCounts.get(countKey) || 0) + 1);

    proposals.push({
      taskId: prepared.task.id,
      cleanerId: candidate.assignment.cleanerId,
      cleanerName: getCleanerName(cleaners, candidate.assignment.cleanerId),
      propertyGroupId: prepared.detectedBuilding.propertyGroupId,
      propertyGroupName: prepared.detectedBuilding.propertyGroupName,
      bundleId: prepared.bundleId,
      assignmentRole: getAssignmentRole(candidate.assignment),
      durationMinutes: prepared.workerLoadMinutes,
      proposedStartTime: minutesToTime(candidate.proposedWindow.startMinutes),
      proposedEndTime: minutesToTime(candidate.proposedWindow.endMinutes),
      requiredCleaners: prepared.requiredCleaners,
      assignmentIndex,
      confidence: Math.max(0, Math.min(100, candidate.score)),
      reasons: [
        ...candidate.reasons,
        ...extraReasons,
        ...(isEarlyCheckInTask(prepared.task) ? ['Check-in temprano a las 14:00 o antes: prioridad crítica.'] : []),
        ...(prepared.requiredCleaners > 1 ? [`Casa grande: ${Math.round(prepared.task.durationMinutes / 60 * 10) / 10} h repartidas entre ${prepared.requiredCleaners} personas.`] : []),
      ],
      warnings: [...candidate.warnings, ...extraWarnings],
      capacityAfterAssignment: {
        assignedMinutes: candidate.availability.assignedMinutes,
        remainingMinutes: candidate.availability.remainingMinutes,
      },
    });
  };

  const pushWindowForSimulation = (
    windowsByCleaner: Map<string, ScheduledWindow[]>,
    cleanerId: string,
    proposedWindow: ScheduledWindow,
  ) => {
    const cleanerWindows = windowsByCleaner.get(cleanerId) || [];
    windowsByCleaner.set(cleanerId, [...cleanerWindows, proposedWindow]);
  };

  const evaluateFullBundleCandidate = (bundle: PlanningBundleState, assignment: CleanerGroupAssignment): FullBundleCandidate | null => {
    if (bundle.tasks.length <= 1) return null;
    if (bundle.tasks.some((prepared) => prepared.requiredCleaners !== 1)) return null;

    const firstTask = bundle.tasks[0];
    const workerAvailability = availabilityByCleanerDate.get(availabilityKey(assignment.cleanerId, firstTask.task.date));
    if (!workerAvailability || !workerAvailability.isAvailable) return null;

    const currentCount = proposedTaskCounts.get(taskCountKey(assignment.cleanerId, firstTask.task.date, firstTask.detectedBuilding.propertyGroupId)) || 0;
    if (assignment.maxTasksPerDay > 0 && currentCount + bundle.tasks.length > assignment.maxTasksPerDay) return null;

    const simulatedAvailability: EffectiveWorkerAvailability = { ...workerAvailability };
    const simulatedWindowsByCleaner = new Map(Array.from(proposedWindowsByCleaner.entries()).map(([key, value]) => [key, [...value]]));
    const preparedWindows: FullBundleCandidate['preparedWindows'] = [];
    let score = 0;

    for (const prepared of bundle.tasks) {
      if (simulatedAvailability.remainingMinutes < prepared.requiredMinutes) return null;
      const windowFit = checkAvailabilityWindowFit(simulatedAvailability, prepared.taskWindow, prepared.workerLoadMinutes);
      if (!windowFit.fits) return null;
      const proposedWindow = buildProposedWorkWindow(simulatedWindowsByCleaner, assignment.cleanerId, prepared.taskWindow, prepared.workerLoadMinutes, simulatedAvailability);
      if (!proposedWindow) return null;
      const proposedWindowFit = checkAvailabilityWindowFit(simulatedAvailability, proposedWindow, prepared.workerLoadMinutes);
      if (!proposedWindowFit.fits) return null;
      const proposedWindowConflict = findProposedWindowConflict(simulatedWindowsByCleaner, assignment.cleanerId, proposedWindow);
      if (proposedWindowConflict) return null;

      const candidateScore = scoreCandidate({ assignment, availability: simulatedAvailability, requiredMinutes: prepared.requiredMinutes });
      score += candidateScore.score;
      preparedWindows.push({ prepared, proposedWindow, ...candidateScore });
      simulatedAvailability.assignedMinutes += prepared.requiredMinutes;
      simulatedAvailability.remainingMinutes = Math.max(0, simulatedAvailability.remainingMinutes - prepared.requiredMinutes);
      pushWindowForSimulation(simulatedWindowsByCleaner, assignment.cleanerId, proposedWindow);
    }

    return {
      assignment,
      role: getAssignmentRole(assignment),
      score: score + 150 + bundle.tasks.length * 25 - getAssignmentRoleRank(assignment) * 5,
      preparedWindows,
    };
  };

  const buildAssignmentCombinations = (assignments: CleanerGroupAssignment[], size: number): CleanerGroupAssignment[][] => {
    const results: CleanerGroupAssignment[][] = [];

    const visit = (startIndex: number, current: CleanerGroupAssignment[]) => {
      if (current.length === size) {
        results.push(current);
        return;
      }

      for (let index = startIndex; index < assignments.length; index += 1) {
        visit(index + 1, [...current, assignments[index]]);
      }
    };

    visit(0, []);
    return results;
  };

  const evaluateMinimalCrewBundleCandidate = (
    bundle: PlanningBundleState,
    assignments: CleanerGroupAssignment[],
  ): MinimalCrewBundleCandidate | null => {
    if (bundle.tasks.length <= 1) return null;
    if (bundle.tasks.some((prepared) => prepared.requiredCleaners !== 1)) return null;

    const maxCrewSize = Math.min(assignments.length, bundle.tasks.length);

    for (let crewSize = 2; crewSize <= maxCrewSize; crewSize += 1) {
      const candidatesForCrewSize = buildAssignmentCombinations(assignments, crewSize)
        .map((crew) => {
          const initialAvailability = new Map<string, EffectiveWorkerAvailability>();
          for (const assignment of crew) {
            const workerAvailability = availabilityByCleanerDate.get(availabilityKey(assignment.cleanerId, bundle.date));
            if (!workerAvailability || !workerAvailability.isAvailable) return null;
            initialAvailability.set(assignment.cleanerId, { ...workerAvailability });
          }

          const initialWindowsByCleaner = new Map(Array.from(proposedWindowsByCleaner.entries()).map(([key, value]) => [key, [...value]]));
          const initialTaskCounts = new Map(proposedTaskCounts);

          type SimulationState = {
            availabilityByCleaner: Map<string, EffectiveWorkerAvailability>;
            windowsByCleaner: Map<string, ScheduledWindow[]>;
            taskCounts: Map<string, number>;
            preparedWindows: MinimalCrewBundleCandidate['preparedWindows'];
            score: number;
          };

          const assignTaskAt = (taskIndex: number, state: SimulationState): SimulationState | null => {
            if (taskIndex >= bundle.tasks.length) return state;

            const prepared = bundle.tasks[taskIndex];
            const orderedCrew = [...crew].sort((a, b) => {
              const aCount = state.preparedWindows.filter((item) => item.assignment.cleanerId === a.cleanerId).length;
              const bCount = state.preparedWindows.filter((item) => item.assignment.cleanerId === b.cleanerId).length;
              if (aCount !== bCount) return bCount - aCount;
              return getAssignmentRoleRank(a) - getAssignmentRoleRank(b) || a.priority - b.priority;
            });

            for (const assignment of orderedCrew) {
              const workerAvailability = state.availabilityByCleaner.get(assignment.cleanerId);
              if (!workerAvailability || workerAvailability.remainingMinutes < prepared.requiredMinutes) continue;

              const countKey = taskCountKey(assignment.cleanerId, prepared.task.date, prepared.detectedBuilding.propertyGroupId);
              const currentCount = state.taskCounts.get(countKey) || 0;
              if (assignment.maxTasksPerDay > 0 && currentCount >= assignment.maxTasksPerDay) continue;

              const windowFit = checkAvailabilityWindowFit(workerAvailability, prepared.taskWindow, prepared.workerLoadMinutes);
              if (!windowFit.fits) continue;

              const proposedWindow = buildProposedWorkWindow(state.windowsByCleaner, assignment.cleanerId, prepared.taskWindow, prepared.workerLoadMinutes, workerAvailability);
              if (!proposedWindow) continue;

              const proposedWindowFit = checkAvailabilityWindowFit(workerAvailability, proposedWindow, prepared.workerLoadMinutes);
              if (!proposedWindowFit.fits) continue;

              const proposedWindowConflict = findProposedWindowConflict(state.windowsByCleaner, assignment.cleanerId, proposedWindow);
              if (proposedWindowConflict) continue;

              const candidateScore = scoreCandidate({ assignment, availability: workerAvailability, requiredMinutes: prepared.requiredMinutes });
              const nextAvailability: EffectiveWorkerAvailability = {
                ...workerAvailability,
                assignedMinutes: workerAvailability.assignedMinutes + prepared.requiredMinutes,
                remainingMinutes: Math.max(0, workerAvailability.remainingMinutes - prepared.requiredMinutes),
              };
              const nextAvailabilityByCleaner = new Map(state.availabilityByCleaner);
              nextAvailabilityByCleaner.set(assignment.cleanerId, nextAvailability);
              const nextWindowsByCleaner = new Map(Array.from(state.windowsByCleaner.entries()).map(([key, value]) => [key, [...value]]));
              pushWindowForSimulation(nextWindowsByCleaner, assignment.cleanerId, proposedWindow);
              const nextTaskCounts = new Map(state.taskCounts);
              nextTaskCounts.set(countKey, currentCount + 1);

              const result = assignTaskAt(taskIndex + 1, {
                availabilityByCleaner: nextAvailabilityByCleaner,
                windowsByCleaner: nextWindowsByCleaner,
                taskCounts: nextTaskCounts,
                preparedWindows: [
                  ...state.preparedWindows,
                  { prepared, assignment, proposedWindow, ...candidateScore },
                ],
                score: state.score + candidateScore.score,
              });
              if (result) return result;
            }

            return null;
          };

          const result = assignTaskAt(0, {
            availabilityByCleaner: initialAvailability,
            windowsByCleaner: initialWindowsByCleaner,
            taskCounts: initialTaskCounts,
            preparedWindows: [],
            score: 0,
          });

          if (!result) return null;
          return {
            crewSize,
            score: result.score + 100 - crewSize * 30,
            preparedWindows: result.preparedWindows,
          };
        })
        .filter((candidate): candidate is MinimalCrewBundleCandidate => Boolean(candidate))
        .sort((a, b) => b.score - a.score);

      if (candidatesForCrewSize.length > 0) return candidatesForCrewSize[0];
    }

    return null;
  };

  const buildSingleTaskCandidates = (prepared: PreparedPlanningTask, blockedWindowCodes: Set<AssignmentConflict['code']>, proposedWindowConflicts: ProposedWindowConflict[]): Candidate[] => prepared.buildingAssignments
    .map((assignment) => {
      const workerAvailability = availabilityByCleanerDate.get(availabilityKey(assignment.cleanerId, prepared.task.date));
      if (!workerAvailability || !workerAvailability.isAvailable) return null;
      if (workerAvailability.remainingMinutes < prepared.requiredMinutes) return null;
      const windowFit = checkAvailabilityWindowFit(workerAvailability, prepared.taskWindow, prepared.workerLoadMinutes);
      if (!windowFit.fits) {
        if (windowFit.blockedCode) blockedWindowCodes.add(windowFit.blockedCode);
        return null;
      }
      const countKey = taskCountKey(assignment.cleanerId, prepared.task.date, prepared.detectedBuilding.propertyGroupId);
      const currentCount = proposedTaskCounts.get(countKey) || 0;
      if (assignment.maxTasksPerDay > 0 && currentCount >= assignment.maxTasksPerDay) return null;
      const proposedWindow = buildProposedWorkWindow(proposedWindowsByCleaner, assignment.cleanerId, prepared.taskWindow, prepared.workerLoadMinutes, workerAvailability);
      if (!proposedWindow) return null;
      const proposedWindowFit = checkAvailabilityWindowFit(workerAvailability, proposedWindow, prepared.workerLoadMinutes);
      if (!proposedWindowFit.fits) {
        if (proposedWindowFit.blockedCode) blockedWindowCodes.add(proposedWindowFit.blockedCode);
        return null;
      }
      const proposedWindowConflict = findProposedWindowConflict(proposedWindowsByCleaner, assignment.cleanerId, proposedWindow);
      if (proposedWindowConflict) {
        proposedWindowConflicts.push(proposedWindowConflict);
        return null;
      }
      const score = scoreCandidate({ assignment, availability: workerAvailability, requiredMinutes: prepared.requiredMinutes });
      return { assignment, availability: workerAvailability, proposedWindow, ...score };
    })
    .filter((candidate): candidate is Candidate => Boolean(candidate))
    .sort((a, b) => b.score - a.score || getAssignmentRoleRank(a.assignment) - getAssignmentRoleRank(b.assignment) || a.assignment.priority - b.assignment.priority || b.availability.remainingMinutes - a.availability.remainingMinutes);

  const addNoCandidateConflict = (
    prepared: PreparedPlanningTask,
    candidates: Candidate[],
    blockedWindowCodes: Set<AssignmentConflict['code']>,
    proposedWindowConflicts: ProposedWindowConflict[],
  ) => {
    const blockedByMaxTasks = prepared.buildingAssignments.some((assignment) => {
      const countKey = taskCountKey(assignment.cleanerId, prepared.task.date, prepared.detectedBuilding.propertyGroupId);
      return assignment.maxTasksPerDay > 0 && (proposedTaskCounts.get(countKey) || 0) >= assignment.maxTasksPerDay;
    });
    if (blockedByMaxTasks) {
      conflicts.push(buildConflict(prepared.task.id, 'max_tasks_per_day', 'El equipo del edificio ya alcanzó el límite de tareas por día configurado.', {
        propertyGroupId: prepared.detectedBuilding.propertyGroupId,
        propertyGroupName: prepared.detectedBuilding.propertyGroupName,
        date: prepared.task.date,
        requiredCleaners: prepared.requiredCleaners,
      }));
      return;
    }

    const blockedWindowCode = Array.from(blockedWindowCodes)[0];
    if (blockedWindowCode) {
      conflicts.push(buildConflict(prepared.task.id, blockedWindowCode, 'La tarea no encaja dentro de una ventana real disponible o está bloqueada por ausencia/mantenimiento.', {
        propertyGroupId: prepared.detectedBuilding.propertyGroupId,
        date: prepared.task.date,
        startTime: prepared.task.startTime,
        endTime: prepared.task.endTime,
        requiredCleaners: prepared.requiredCleaners,
      }));
      return;
    }

    const proposedWindowConflict = proposedWindowConflicts[0];
    if (proposedWindowConflict) {
      conflicts.push(buildConflict(
        prepared.task.id,
        proposedWindowConflict.code,
        proposedWindowConflict.code === 'time_buffer_overlap'
          ? `La propuesta no respeta el buffer mínimo de ${proposedWindowConflict.bufferMinutes || SAME_BUILDING_BUFFER_MINUTES} min entre tareas.`
          : 'La propuesta generaría un solape horario para la trabajadora del equipo.',
        {
          overlapsWithTaskId: proposedWindowConflict.window.taskId,
          date: prepared.task.date,
          startTime: prepared.task.startTime,
          endTime: prepared.task.endTime,
          requiredCleaners: prepared.requiredCleaners,
        },
      ));
      return;
    }

    conflicts.push(buildConflict(prepared.task.id, 'no_available_worker', 'No hay suficientes trabajadoras del equipo con disponibilidad real para cubrir la tarea.', {
      propertyGroupId: prepared.detectedBuilding.propertyGroupId,
      requiredMinutes: prepared.requiredMinutes,
      requiredCleaners: prepared.requiredCleaners,
      availableCandidates: candidates.length,
      date: prepared.task.date,
    }));
  };

  const processPreparedTaskIndividually = (prepared: PreparedPlanningTask): boolean => {
    const blockedWindowCodes = new Set<AssignmentConflict['code']>();
    const proposedWindowConflicts: ProposedWindowConflict[] = [];
    const candidates = buildSingleTaskCandidates(prepared, blockedWindowCodes, proposedWindowConflicts);
    const selectedCandidates = candidates.slice(0, prepared.requiredCleaners);

    if (selectedCandidates.length < prepared.requiredCleaners) {
      addNoCandidateConflict(prepared, candidates, blockedWindowCodes, proposedWindowConflicts);
      return false;
    }

    selectedCandidates.forEach((candidate, index) => {
      const selectedRole = getAssignmentRole(candidate.assignment);
      const primaryAssignment = prepared.buildingAssignments.find((assignment) => getAssignmentRole(assignment) === 'primary');
      const primaryExistingBundles = primaryAssignment
        ? getExistingBundleNamesForCleaner(primaryAssignment.cleanerId, prepared.task.date, prepared.bundleId)
        : [];
      const reservedWarning = selectedRole !== 'primary' && primaryAssignment && primaryExistingBundles.length > 0
        ? `${prepared.detectedBuilding.propertyGroupName} usa ${selectedRole === 'secondary' ? 'suplente' : 'backup'} porque ${getCleanerName(cleaners, primaryAssignment.cleanerId)} queda reservada en ${primaryExistingBundles.join(', ')}.`
        : undefined;
      if (reservedWarning) additionalQualityWarnings.push(reservedWarning);
      pushProposal(prepared, candidate, index + 1, [], reservedWarning ? [reservedWarning] : []);
    });
    return true;
  };

  orderedBundles.forEach((bundle) => {
    const uniqueAssignments = Array.from(new Map(
      bundle.tasks.flatMap((prepared) => prepared.buildingAssignments).map((assignment) => [assignment.cleanerId, assignment]),
    ).values()).sort((a, b) => getAssignmentRoleRank(a) - getAssignmentRoleRank(b) || a.priority - b.priority);

    const fullBundleCandidates = uniqueAssignments
      .map((assignment) => evaluateFullBundleCandidate(bundle, assignment))
      .filter((candidate): candidate is FullBundleCandidate => Boolean(candidate))
      .sort((a, b) => b.score - a.score || getAssignmentRoleRank(a.assignment) - getAssignmentRoleRank(b.assignment));

    bundle.hadFullBundleCandidate = fullBundleCandidates.length > 0;
    bundle.hadNonBackupFullCandidate = fullBundleCandidates.some((candidate) => candidate.role !== 'backup');

    const selectedFullBundleCandidate = fullBundleCandidates[0];
    if (selectedFullBundleCandidate) {
      const selectedRole = getAssignmentRole(selectedFullBundleCandidate.assignment);
      const primaryAssignment = uniqueAssignments.find((assignment) => getAssignmentRole(assignment) === 'primary');
      const primaryExistingBundles = primaryAssignment
        ? getExistingBundleNamesForCleaner(primaryAssignment.cleanerId, bundle.date, bundle.bundleId)
        : [];
      const reservedWarning = selectedRole !== 'primary' && primaryAssignment && primaryExistingBundles.length > 0
        ? `${bundle.propertyGroupName} usa ${selectedRole === 'secondary' ? 'suplente' : 'backup'} porque ${getCleanerName(cleaners, primaryAssignment.cleanerId)} queda reservada en ${primaryExistingBundles.join(', ')}.`
        : undefined;
      if (reservedWarning) additionalQualityWarnings.push(reservedWarning);

      selectedFullBundleCandidate.preparedWindows.forEach((item, index) => {
        const workerAvailability = availabilityByCleanerDate.get(availabilityKey(selectedFullBundleCandidate.assignment.cleanerId, item.prepared.task.date));
        if (!workerAvailability) return;
        pushProposal(
          item.prepared,
          {
            assignment: selectedFullBundleCandidate.assignment,
            availability: workerAvailability,
            proposedWindow: item.proposedWindow,
            score: item.score,
            reasons: item.reasons,
            warnings: item.warnings,
          },
          1,
          bundle.tasks.length > 1 ? [`Mantiene ${bundle.propertyGroupName} con una sola trabajadora dentro de checkout–checkin.`] : [],
          reservedWarning ? [reservedWarning] : [],
        );
      });
      return;
    }

    const minimalCrewBundleCandidate = evaluateMinimalCrewBundleCandidate(bundle, uniqueAssignments);
    if (minimalCrewBundleCandidate) {
      bundle.splitReason = `${bundle.propertyGroupName} se divide en ${minimalCrewBundleCandidate.crewSize} trabajadoras porque ninguna puede cubrir el centro completo sola, pero el edificio sí cabe con el equipo mínimo viable.`;
      minimalCrewBundleCandidate.preparedWindows.forEach((item) => {
        const workerAvailability = availabilityByCleanerDate.get(availabilityKey(item.assignment.cleanerId, item.prepared.task.date));
        if (!workerAvailability) return;
        pushProposal(
          item.prepared,
          {
            assignment: item.assignment,
            availability: workerAvailability,
            proposedWindow: item.proposedWindow,
            score: item.score,
            reasons: item.reasons,
            warnings: item.warnings,
          },
          1,
          [`Mantiene ${bundle.propertyGroupName} compacto con el mínimo equipo viable (${minimalCrewBundleCandidate.crewSize} trabajadoras).`],
        );
      });
      return;
    }

    let coveredTasks = 0;
    bundle.tasks.forEach((prepared) => {
      if (processPreparedTaskIndividually(prepared)) coveredTasks += 1;
    });

    const bundleProposals = proposals.filter((proposal) => proposal.bundleId === bundle.bundleId);
    const uniqueCleaners = new Set(bundleProposals.map((proposal) => proposal.cleanerId));
    if (coveredTasks === bundle.tasks.length && uniqueCleaners.size > 1) {
      bundle.splitReason = `${bundle.propertyGroupName} se divide porque ninguna trabajadora puede cubrir el centro completo dentro de disponibilidad y checkout–checkin.`;
    }
  });

  proposals.sort((a, b) => {
    const taskDiff = (taskOrder.get(a.taskId) ?? 9999) - (taskOrder.get(b.taskId) ?? 9999);
    if (taskDiff !== 0) return taskDiff;
    return (a.assignmentIndex || 1) - (b.assignmentIndex || 1);
  });

  const remainingCapacityMinutes = Array.from(availabilityByCleanerDate.values())
    .reduce((total, item) => total + Math.max(0, item.remainingMinutes), 0);
  const proposedMinutes = proposals.reduce((total, proposal) => total + proposal.durationMinutes, 0);
  const conflictMinutes = orderedTasks
    .filter((task) => conflicts.some((conflict) => conflict.taskId === task.id))
    .reduce((total, task) => total + Math.max(0, task.durationMinutes), 0);
  const globalQuality = buildGlobalPlanQualitySummary({
    bundles: bundleStates,
    proposals,
    conflicts,
    additionalWarnings: additionalQualityWarnings,
  });

  return {
    proposals,
    conflicts,
    summary: {
      totalUnassignedTasks: orderedTasks.length,
      proposedCount: proposals.length,
      conflictCount: conflicts.length,
      proposedMinutes,
      remainingCapacityMinutes,
      missingCapacityMinutes: Math.max(0, conflictMinutes - remainingCapacityMinutes),
      globalQuality,
    },
  };
};

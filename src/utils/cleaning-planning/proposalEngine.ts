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
): ScheduledWindow | null => {
  const sameBuildingWindows = (proposedWindowsByCleaner.get(cleanerId) || [])
    .filter((window) => window.date === operationalWindow.date)
    .filter((window) => window.propertyGroupId && window.propertyGroupId === operationalWindow.propertyGroupId)
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);

  let startMinutes = operationalWindow.startMinutes;

  for (const window of sameBuildingWindows) {
    const latestEndBeforeWindow = window.startMinutes - SAME_BUILDING_BUFFER_MINUTES;
    if (startMinutes + workMinutes <= latestEndBeforeWindow) break;
    startMinutes = Math.max(startMinutes, window.endMinutes + SAME_BUILDING_BUFFER_MINUTES);
  }

  const endMinutes = startMinutes + workMinutes;
  if (endMinutes > operationalWindow.endMinutes) return null;

  return {
    taskId: operationalWindow.taskId,
    date: operationalWindow.date,
    startMinutes,
    endMinutes,
    propertyGroupId: operationalWindow.propertyGroupId,
  };
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

export const buildAssignmentProposal = ({
  tasks,
  cleaners,
  availability,
  buildingRules = [],
  cleanerGroupAssignments = [],
}: ProposalInput): AssignmentProposalResult => {
  const proposals: AssignmentProposal[] = [];
  const conflicts: AssignmentConflict[] = [];
  const availabilityByCleanerDate = new Map(availability.map((item) => [availabilityKey(item.cleanerId, item.date), { ...item }]));
  const activeCleanerIds = new Set(cleaners.filter((cleaner) => cleaner.isActive).map((cleaner) => cleaner.id));
  const proposedWindowsByCleaner = new Map<string, ScheduledWindow[]>();
  const proposedTaskCounts = new Map<string, number>();

  const orderedTasks = sortTasksForPlanning(tasks);

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
    const blockedWindowCodes = new Set<AssignmentConflict['code']>();
    const proposedWindowConflicts: ProposedWindowConflict[] = [];

    const candidates: Candidate[] = buildingAssignments
      .map((assignment) => {
        const workerAvailability = availabilityByCleanerDate.get(availabilityKey(assignment.cleanerId, task.date));
        if (!workerAvailability || !workerAvailability.isAvailable) return null;
        if (workerAvailability.remainingMinutes < requiredMinutes) return null;
        const windowFit = checkAvailabilityWindowFit(workerAvailability, taskWindow, workerLoadMinutes);
        if (!windowFit.fits) {
          if (windowFit.blockedCode) blockedWindowCodes.add(windowFit.blockedCode);
          return null;
        }
        const countKey = taskCountKey(assignment.cleanerId, task.date, detectedBuilding.propertyGroupId);
        const currentCount = proposedTaskCounts.get(countKey) || 0;
        if (assignment.maxTasksPerDay > 0 && currentCount >= assignment.maxTasksPerDay) return null;
        const proposedWindow = buildProposedWorkWindow(proposedWindowsByCleaner, assignment.cleanerId, taskWindow, workerLoadMinutes);
        if (!proposedWindow) return null;
        const proposedWindowFit = checkAvailabilityWindowFit(workerAvailability, proposedWindow, workerLoadMinutes);
        if (!proposedWindowFit.fits) {
          if (proposedWindowFit.blockedCode) blockedWindowCodes.add(proposedWindowFit.blockedCode);
          return null;
        }
        const proposedWindowConflict = findProposedWindowConflict(proposedWindowsByCleaner, assignment.cleanerId, proposedWindow);
        if (proposedWindowConflict) {
          proposedWindowConflicts.push(proposedWindowConflict);
          return null;
        }
        const score = scoreCandidate({ assignment, availability: workerAvailability, requiredMinutes });
        return { assignment, availability: workerAvailability, proposedWindow, ...score };
      })
      .filter((candidate): candidate is Candidate => Boolean(candidate))
      .sort((a, b) => b.score - a.score || getAssignmentRoleRank(a.assignment) - getAssignmentRoleRank(b.assignment) || a.assignment.priority - b.assignment.priority || b.availability.remainingMinutes - a.availability.remainingMinutes);

    const selectedCandidates = candidates.slice(0, requiredCleaners);
    if (selectedCandidates.length < requiredCleaners) {
      const blockedByMaxTasks = buildingAssignments.some((assignment) => {
        const countKey = taskCountKey(assignment.cleanerId, task.date, detectedBuilding.propertyGroupId);
        return assignment.maxTasksPerDay > 0 && (proposedTaskCounts.get(countKey) || 0) >= assignment.maxTasksPerDay;
      });
      if (blockedByMaxTasks) {
        conflicts.push(buildConflict(task.id, 'max_tasks_per_day', 'El equipo del edificio ya alcanzó el límite de tareas por día configurado.', {
          propertyGroupId: detectedBuilding.propertyGroupId,
          propertyGroupName: detectedBuilding.propertyGroupName,
          date: task.date,
          requiredCleaners,
        }));
        return;
      }

      const blockedWindowCode = Array.from(blockedWindowCodes)[0];
      if (blockedWindowCode) {
        conflicts.push(buildConflict(task.id, blockedWindowCode, 'La tarea no encaja dentro de una ventana real disponible o está bloqueada por ausencia/mantenimiento.', {
          propertyGroupId: detectedBuilding.propertyGroupId,
          date: task.date,
          startTime: task.startTime,
          endTime: task.endTime,
          requiredCleaners,
        }));
        return;
      }

      const proposedWindowConflict = proposedWindowConflicts[0];
      if (proposedWindowConflict) {
        conflicts.push(buildConflict(
          task.id,
          proposedWindowConflict.code,
          proposedWindowConflict.code === 'time_buffer_overlap'
            ? `La propuesta no respeta el buffer mínimo de ${proposedWindowConflict.bufferMinutes || SAME_BUILDING_BUFFER_MINUTES} min entre tareas.`
            : 'La propuesta generaría un solape horario para la trabajadora del equipo.',
          {
            overlapsWithTaskId: proposedWindowConflict.window.taskId,
            date: task.date,
            startTime: task.startTime,
            endTime: task.endTime,
            requiredCleaners,
          },
        ));
        return;
      }

      conflicts.push(buildConflict(task.id, 'no_available_worker', 'No hay suficientes trabajadoras del equipo con disponibilidad real para cubrir la tarea.', {
        propertyGroupId: detectedBuilding.propertyGroupId,
        requiredMinutes,
        requiredCleaners,
        availableCandidates: candidates.length,
        date: task.date,
      }));
      return;
    }

    selectedCandidates.forEach((candidate, index) => {
      candidate.availability.assignedMinutes += requiredMinutes;
      candidate.availability.remainingMinutes = Math.max(0, candidate.availability.remainingMinutes - requiredMinutes);
      availabilityByCleanerDate.set(availabilityKey(candidate.assignment.cleanerId, task.date), candidate.availability);

      const cleanerWindows = proposedWindowsByCleaner.get(candidate.assignment.cleanerId) || [];
      proposedWindowsByCleaner.set(candidate.assignment.cleanerId, [...cleanerWindows, candidate.proposedWindow]);
      const countKey = taskCountKey(candidate.assignment.cleanerId, task.date, detectedBuilding.propertyGroupId);
      proposedTaskCounts.set(countKey, (proposedTaskCounts.get(countKey) || 0) + 1);

      proposals.push({
        taskId: task.id,
        cleanerId: candidate.assignment.cleanerId,
        cleanerName: getCleanerName(cleaners, candidate.assignment.cleanerId),
        propertyGroupId: detectedBuilding.propertyGroupId,
        propertyGroupName: detectedBuilding.propertyGroupName,
        durationMinutes: workerLoadMinutes,
        proposedStartTime: minutesToTime(candidate.proposedWindow.startMinutes),
        proposedEndTime: minutesToTime(candidate.proposedWindow.endMinutes),
        requiredCleaners,
        assignmentIndex: index + 1,
        confidence: Math.max(0, Math.min(100, candidate.score)),
        reasons: [
          ...candidate.reasons,
          ...(isEarlyCheckInTask(task) ? ['Check-in temprano a las 14:00 o antes: prioridad crítica.'] : []),
          ...(requiredCleaners > 1 ? [`Casa grande: ${Math.round(task.durationMinutes / 60 * 10) / 10} h repartidas entre ${requiredCleaners} personas.`] : []),
        ],
        warnings: candidate.warnings,
        capacityAfterAssignment: {
          assignedMinutes: candidate.availability.assignedMinutes,
          remainingMinutes: candidate.availability.remainingMinutes,
        },
      });
    });
  });

  const remainingCapacityMinutes = Array.from(availabilityByCleanerDate.values())
    .reduce((total, item) => total + Math.max(0, item.remainingMinutes), 0);
  const proposedMinutes = proposals.reduce((total, proposal) => total + proposal.durationMinutes, 0);
  const conflictMinutes = orderedTasks
    .filter((task) => conflicts.some((conflict) => conflict.taskId === task.id))
    .reduce((total, task) => total + Math.max(0, task.durationMinutes), 0);

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
    },
  };
};

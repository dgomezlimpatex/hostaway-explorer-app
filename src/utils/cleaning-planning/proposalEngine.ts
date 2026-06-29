import { Cleaner } from '../../types/calendar';
import {
  AssignmentConflict,
  AssignmentProposal,
  AssignmentProposalResult,
  BuildingDetectionRule,
  CleaningPlanningTask,
  EffectiveWorkerAvailability,
} from '../../types/cleaningPlanning';
import { CleanerGroupAssignment } from '../../types/propertyGroups';
import { detectBuildingFromCode } from './buildingDetection';

interface ProposalInput {
  tasks: CleaningPlanningTask[];
  cleaners: Cleaner[];
  availability: EffectiveWorkerAvailability[];
  buildingRules?: BuildingDetectionRule[];
  cleanerGroupAssignments?: CleanerGroupAssignment[];
}

const getCleanerName = (cleaners: Cleaner[], cleanerId: string): string => cleaners.find((cleaner) => cleaner.id === cleanerId)?.name || 'Trabajadora';

const buildConflict = (taskId: string, code: AssignmentConflict['code'], message: string, details?: Record<string, unknown>): AssignmentConflict => ({
  taskId,
  code,
  message,
  details,
});

const scoreCandidate = ({
  assignment,
  availability,
  durationMinutes,
}: {
  assignment: CleanerGroupAssignment;
  availability: EffectiveWorkerAvailability;
  durationMinutes: number;
}): { score: number; reasons: string[]; warnings: string[] } => {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 50;

  if (assignment.priority <= 1) {
    score += 35;
    reasons.push('Pertenece al equipo preferente del edificio.');
  } else {
    score += 20;
    reasons.push('Es suplente configurada para este edificio.');
  }

  if (availability.remainingMinutes >= durationMinutes) {
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

  const remainingAfter = availability.remainingMinutes - durationMinutes;
  if (remainingAfter < 30) {
    warnings.push('La asignación deja menos de 30 min de margen.');
    score -= 8;
  }

  return { score, reasons, warnings };
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
  const availabilityByCleaner = new Map(availability.map((item) => [item.cleanerId, { ...item }]));
  const activeCleanerIds = new Set(cleaners.filter((cleaner) => cleaner.isActive).map((cleaner) => cleaner.id));

  const orderedTasks = tasks
    .filter((task) => !task.cleanerId && task.status !== 'completed')
    .sort((a, b) => {
      if (b.riskFlags.length !== a.riskFlags.length) return b.riskFlags.length - a.riskFlags.length;
      return `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`);
    });

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

    const buildingAssignments = cleanerGroupAssignments
      .filter((assignment) => assignment.isActive)
      .filter((assignment) => assignment.propertyGroupId === detectedBuilding.propertyGroupId)
      .filter((assignment) => activeCleanerIds.has(assignment.cleanerId))
      .sort((a, b) => a.priority - b.priority);

    if (buildingAssignments.length === 0) {
      conflicts.push(buildConflict(task.id, 'no_building_team', 'El edificio no tiene equipo preferente o suplente configurado.', {
        propertyGroupId: detectedBuilding.propertyGroupId,
        propertyGroupName: detectedBuilding.propertyGroupName,
      }));
      return;
    }

    const candidates = buildingAssignments
      .map((assignment) => {
        const workerAvailability = availabilityByCleaner.get(assignment.cleanerId);
        if (!workerAvailability || !workerAvailability.isAvailable) return null;
        if (workerAvailability.remainingMinutes < task.durationMinutes) return null;
        const score = scoreCandidate({ assignment, availability: workerAvailability, durationMinutes: task.durationMinutes });
        return { assignment, availability: workerAvailability, ...score };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
      .sort((a, b) => b.score - a.score || b.availability.remainingMinutes - a.availability.remainingMinutes);

    const bestCandidate = candidates[0];
    if (!bestCandidate) {
      conflicts.push(buildConflict(task.id, 'no_available_worker', 'No hay trabajadora del equipo con disponibilidad real suficiente.', {
        propertyGroupId: detectedBuilding.propertyGroupId,
        requiredMinutes: task.durationMinutes,
      }));
      return;
    }

    bestCandidate.availability.assignedMinutes += task.durationMinutes;
    bestCandidate.availability.remainingMinutes = Math.max(0, bestCandidate.availability.remainingMinutes - task.durationMinutes);
    availabilityByCleaner.set(bestCandidate.assignment.cleanerId, bestCandidate.availability);

    proposals.push({
      taskId: task.id,
      cleanerId: bestCandidate.assignment.cleanerId,
      cleanerName: getCleanerName(cleaners, bestCandidate.assignment.cleanerId),
      propertyGroupId: detectedBuilding.propertyGroupId,
      propertyGroupName: detectedBuilding.propertyGroupName,
      durationMinutes: task.durationMinutes,
      confidence: Math.max(0, Math.min(100, bestCandidate.score)),
      reasons: bestCandidate.reasons,
      warnings: bestCandidate.warnings,
      capacityAfterAssignment: {
        assignedMinutes: bestCandidate.availability.assignedMinutes,
        remainingMinutes: bestCandidate.availability.remainingMinutes,
      },
    });
  });

  const remainingCapacityMinutes = Array.from(availabilityByCleaner.values())
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

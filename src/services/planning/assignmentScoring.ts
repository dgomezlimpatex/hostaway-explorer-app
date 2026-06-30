import type {
  AssignmentCandidate,
  AssignmentScoringInput,
  CandidateRejectionCode,
  CleanerAvailabilityWindow,
  CleanerLoad,
  PlanningV2CleanerRef,
  PlanningV2TaskRef,
  TeamAssignmentCandidate,
} from '../../types/planningV2';
import { groupPropertyByCode } from './propertyCodeGrouping';
import { projectCleanerLoad, requiredCleanerCountForProperty, DEFAULT_CLEANER_DAY_CAPACITY_MINUTES } from './cleanerCapacity';

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function windowContains(containerStart: Date, containerEnd: Date, childStart: Date, childEnd: Date): boolean {
  return containerStart <= childStart && containerEnd >= childEnd;
}

function hasAvailability(
  cleaner: PlanningV2CleanerRef,
  input: AssignmentScoringInput,
): boolean {
  if (!input.availabilityWindows?.length || !input.window.startsAt || !input.window.endsAt) return true;

  const cleanerWindows = input.availabilityWindows.filter((window) => window.cleanerId === cleaner.id);
  if (cleanerWindows.length === 0) return false;

  return cleanerWindows.some((window: CleanerAvailabilityWindow) =>
    windowContains(toDate(window.startsAt), toDate(window.endsAt), input.window.startsAt as Date, input.window.endsAt as Date),
  );
}

function hasTimeOverlap(cleanerId: string, input: AssignmentScoringInput): boolean {
  if (!input.existingAssignments?.length || !input.window.startsAt || !input.window.endsAt) return false;

  return input.existingAssignments.some((task: PlanningV2TaskRef) =>
    task.cleanerIds.includes(cleanerId)
      && intervalsOverlap(toDate(task.startsAt), toDate(task.endsAt), input.window.startsAt as Date, input.window.endsAt as Date),
  );
}

function emptyLoad(cleanerId: string): CleanerLoad {
  return {
    cleanerId,
    taskIds: [],
    assignedMinutes: 0,
    assignedTaskCount: 0,
    multiPersonTaskCount: 0,
    capacityMinutes: DEFAULT_CLEANER_DAY_CAPACITY_MINUTES,
    remainingMinutes: DEFAULT_CLEANER_DAY_CAPACITY_MINUTES,
    utilization: 0,
  };
}

export function scoreCleanerCandidate(cleaner: PlanningV2CleanerRef, input: AssignmentScoringInput): AssignmentCandidate {
  const durationMinutes = input.window.durationMinutes ?? input.property.estimatedCleaningMinutes ?? 0;
  const requiredCleaners = input.requiredCleaners ?? requiredCleanerCountForProperty(input.property);
  const isMultiPersonTask = requiredCleaners > 1;
  const baseLoad = input.loads[cleaner.id] ?? emptyLoad(cleaner.id);
  const projectedLoad = projectCleanerLoad(baseLoad, input.taskId, durationMinutes, isMultiPersonTask);
  const grouping = groupPropertyByCode(input.property);

  const reasons: string[] = [];
  const warnings: string[] = [];
  const rejectionCodes: CandidateRejectionCode[] = [];
  let score = 100;

  if (cleaner.sedeId !== input.property.sedeId) {
    rejectionCodes.push('different_sede');
    score -= 1_000;
    reasons.push(`Descartada: sede ${cleaner.sedeId} distinta de propiedad ${input.property.sedeId}.`);
  } else {
    reasons.push('Misma sede que la propiedad; no se intercambian sedes.');
    score += 50;
  }

  if (input.window.status !== 'ready' || !input.window.startsAt || !input.window.endsAt || durationMinutes <= 0) {
    rejectionCodes.push('no_cleaning_window');
    score -= 500;
    reasons.push(`Ventana no asignable: ${input.window.status}.`);
  } else {
    reasons.push(`Ventana de limpieza disponible (${durationMinutes} min requeridos).`);
    score += 30;
  }

  if (!hasAvailability(cleaner, input)) {
    rejectionCodes.push('availability_mismatch');
    score -= 300;
    reasons.push('No hay disponibilidad declarada que cubra toda la ventana.');
  } else {
    score += 20;
  }

  if (hasTimeOverlap(cleaner.id, input)) {
    rejectionCodes.push('time_overlap');
    score -= 350;
    reasons.push('Solapa con otra tarea ya asignada a la limpiadora.');
  }

  if (projectedLoad.remainingMinutes < 0) {
    rejectionCodes.push('over_capacity');
    score -= 250;
    reasons.push(`Supera capacidad diaria por ${Math.abs(projectedLoad.remainingMinutes)} min.`);
  } else {
    const capacityBonus = Math.min(80, Math.max(0, projectedLoad.remainingMinutes / 6));
    score += capacityBonus;
    reasons.push(`Quedarían ${projectedLoad.remainingMinutes} min de capacidad tras asignar.`);
  }

  if (cleaner.preferredPropertyIds?.includes(input.property.id)) {
    score += 120;
    reasons.push('Preferencia directa para esta propiedad.');
  }

  if (cleaner.homeBuildingGroupIds?.includes(grouping.buildingGroupId)) {
    score += 80;
    reasons.push(`Afinidad con edificio/grupo ${grouping.buildingCode}.`);
  }

  if (isMultiPersonTask) {
    warnings.push(`Tarea multi-persona: requiere ${requiredCleaners} limpiadoras.`);
  }

  return {
    cleanerId: cleaner.id,
    cleanerName: cleaner.name,
    score: Math.round(score),
    canAssign: rejectionCodes.length === 0,
    reasons,
    warnings,
    rejectionCodes,
    projectedLoad,
  };
}

export function rankCleanerCandidates(input: AssignmentScoringInput): AssignmentCandidate[] {
  return input.cleaners
    .map((cleaner) => scoreCleanerCandidate(cleaner, input))
    .sort((a, b) => {
      if (a.canAssign !== b.canAssign) return a.canAssign ? -1 : 1;
      if (b.score !== a.score) return b.score - a.score;
      return a.cleanerName.localeCompare(b.cleanerName);
    });
}

export function rankTeamCandidates(input: AssignmentScoringInput): TeamAssignmentCandidate[] {
  const requiredCleaners = input.requiredCleaners ?? requiredCleanerCountForProperty(input.property);
  const ranked = rankCleanerCandidates(input);
  const assignable = ranked.filter((candidate) => candidate.canAssign);

  if (requiredCleaners <= 1) {
    return ranked.map((candidate) => ({
      cleanerIds: [candidate.cleanerId],
      cleanerNames: [candidate.cleanerName],
      score: candidate.score,
      canAssign: candidate.canAssign,
      reasons: candidate.reasons,
      warnings: candidate.warnings,
      candidates: [candidate],
    }));
  }

  const teams: TeamAssignmentCandidate[] = [];
  for (let i = 0; i <= assignable.length - requiredCleaners; i += 1) {
    const team = assignable.slice(i, i + requiredCleaners);
    teams.push({
      cleanerIds: team.map((candidate) => candidate.cleanerId),
      cleanerNames: team.map((candidate) => candidate.cleanerName),
      score: Math.round(team.reduce((sum, candidate) => sum + candidate.score, 0) / team.length),
      canAssign: true,
      reasons: [`Equipo de ${requiredCleaners} limpiadoras para casa grande/tarea multi-persona.`],
      warnings: team.flatMap((candidate) => candidate.warnings),
      candidates: team,
    });
  }

  if (teams.length === 0) {
    return [{
      cleanerIds: [],
      cleanerNames: [],
      score: 0,
      canAssign: false,
      reasons: [`No hay ${requiredCleaners} limpiadoras asignables en la sede/capacidad/ventana.`],
      warnings: [],
      candidates: ranked,
    }];
  }

  return teams.sort((a, b) => b.score - a.score);
}

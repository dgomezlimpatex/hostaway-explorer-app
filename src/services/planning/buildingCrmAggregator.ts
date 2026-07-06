import type { Cleaner } from '@/types/calendar';
import type { AssignmentConflict, AssignmentProposal, AssignmentProposalResult, GlobalPlanQualitySummary } from '@/types/cleaningPlanning';
import type {
  PlanningBuildingCrmDay,
  PlanningBuildingCrmDecision,
  PlanningBuildingCrmProfile,
  PlanningBuildingCrmProperty,
  PlanningBuildingCrmStatus,
  PlanningBuildingCrmTask,
  PlanningBuildingCrmTeamMember,
} from '@/types/operationalPlanning';
import type { Property } from '@/types/property';
import type { CleanerGroupAssignment, PropertyGroup } from '@/types/propertyGroups';

export type BuildingCrmForecastSource = 'task' | 'hostaway' | 'avantio' | 'client' | 'little-hotelier' | 'avirato';

export type BuildingCrmServiceKind = 'checkout' | 'stay';

export interface BuildingCrmForecastItem {
  id: string;
  source: BuildingCrmForecastSource;
  propertyId: string;
  date: string;
  serviceKind?: BuildingCrmServiceKind;
  durationMinutes: number;
  requiredCleaners: number;
}

export interface BuildingCrmRawTask {
  id: string;
  property: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  status: string;
  type: string;
  propiedad_id?: string | null;
  cleaner_id?: string | null;
  cleaner?: string | null;
  task_assignments?: Array<{ cleaner_id: string; cleaner_name: string }> | null;
}

export interface BuildingCrmTeamAvailability {
  cleanerId: string;
  date: string;
  availableMinutes: number;
  isAvailable: boolean;
}

export interface BuildPlanningBuildingCrmProfileInput {
  propertyGroupId: string;
  dateFrom: string;
  dateTo: string;
  fallbackDailyCapacityMinutes: number;
  propertyGroups: PropertyGroup[];
  propertyGroupAssignments: Array<{ property_group_id: string; property_id: string }>;
  properties: Property[];
  cleaners: Cleaner[];
  cleanerGroupAssignments: CleanerGroupAssignment[];
  tasks: BuildingCrmRawTask[];
  forecastItems?: BuildingCrmForecastItem[];
  teamAvailability?: BuildingCrmTeamAvailability[];
}

const ROLE_ORDER: Record<NonNullable<CleanerGroupAssignment['roleType']>, number> = {
  primary: 1,
  secondary: 2,
  backup: 3,
  excluded: 4,
};

const getDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const enumerateDateStrings = (dateFrom: string, dateTo: string): string[] => {
  const [fromYear, fromMonth, fromDay] = dateFrom.split('-').map(Number);
  const [toYear, toMonth, toDay] = dateTo.split('-').map(Number);
  const cursor = new Date(fromYear, fromMonth - 1, fromDay, 12, 0, 0, 0);
  const end = new Date(toYear, toMonth - 1, toDay, 12, 0, 0, 0);
  const dates: string[] = [];

  while (cursor <= end) {
    dates.push(getDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const isActivePlanningTask = (task: BuildingCrmRawTask): boolean => task.status !== 'completed' && task.status !== 'cancelled';
const isTouristCleaningTask = (task: BuildingCrmRawTask): boolean => task.type === 'limpieza-turistica';
const isWeekend = (date: string): boolean => {
  const [year, month, day] = date.split('-').map(Number);
  const local = new Date(year, month - 1, day, 12, 0, 0, 0);
  return local.getDay() === 0 || local.getDay() === 6;
};

const getTaskCleanerIds = (task: BuildingCrmRawTask): string[] => {
  const assignmentIds = (task.task_assignments || []).map((assignment) => assignment.cleaner_id).filter(Boolean);
  if (assignmentIds.length > 0) return Array.from(new Set(assignmentIds));
  return task.cleaner_id ? [task.cleaner_id] : [];
};

const getTaskCleanerNames = (task: BuildingCrmRawTask): string[] => {
  const assignmentNames = (task.task_assignments || []).map((assignment) => assignment.cleaner_name).filter(Boolean);
  if (assignmentNames.length > 0) return Array.from(new Set(assignmentNames));
  return task.cleaner ? [task.cleaner] : [];
};

const getForecastSourceLabel = (source: BuildingCrmForecastSource): string => {
  switch (source) {
    case 'hostaway':
      return 'Hostaway previsto';
    case 'avantio':
      return 'Avantio previsto';
    case 'client':
      return 'Portal cliente previsto';
    case 'little-hotelier':
      return 'Little Hotelier previsto';
    case 'avirato':
      return 'Avirato previsto';
    case 'task':
    default:
      return 'Tarea confirmada';
  }
};

const unique = <T>(items: T[], getKey: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getRoleType = (assignment: CleanerGroupAssignment): NonNullable<CleanerGroupAssignment['roleType']> => assignment.roleType || 'primary';

const getRequiredCleaners = (property: Property): number => Math.max(1, property.planningRequiredCleaners || 1);

const getPropertyDurationMinutes = (property: Property): number => Number(property.duracionServicio || 0);

const getTeamAvailabilityMinutes = (
  cleaner: Cleaner,
  assignment: CleanerGroupAssignment,
  date: string,
  input: BuildPlanningBuildingCrmProfileInput,
): number => {
  const explicit = input.teamAvailability?.find((entry) => entry.cleanerId === cleaner.id && entry.date === date);
  if (explicit) return explicit.isAvailable ? Math.max(0, explicit.availableMinutes) : 0;
  return assignment.maxDailyMinutesOverride || cleaner.planningMaxDailyMinutes || input.fallbackDailyCapacityMinutes;
};

const buildMissingGroupProfile = (input: BuildPlanningBuildingCrmProfileInput): PlanningBuildingCrmProfile => ({
  building: {
    id: input.propertyGroupId,
    name: 'Edificio no encontrado',
    displayName: 'Edificio no encontrado',
    propertyCount: 0,
    isActive: false,
  },
  properties: [],
  team: [],
  range: { dateFrom: input.dateFrom, dateTo: input.dateTo },
  summary: {
    confirmedCleanings: 0,
    forecastCleanings: 0,
    serviceMinutes: 0,
    personMinutes: 0,
    averageDailyServiceMinutes: 0,
    averageWeeklyServiceMinutes: 0,
    averageMonthlyServiceMinutes: 0,
    peakDailyPersonMinutes: 0,
    recommendedStableStaff: 0,
    assignedPrimaryCount: 0,
    assignedSecondaryCount: 0,
    assignedBackupCount: 0,
    excludedCount: 0,
    pressureDays: 0,
    uncoveredDays: 0,
    missingDurationProperties: 0,
    status: 'critical',
  },
  days: enumerateDateStrings(input.dateFrom, input.dateTo).map((date) => ({
    date,
    confirmedCleanings: 0,
    forecastCleanings: 0,
    serviceMinutes: 0,
    personMinutes: 0,
    assignedPersonMinutes: 0,
    availableAssignedPersonMinutes: 0,
    requiredCleanerSlots: 0,
    status: 'empty',
    tasks: [],
    warnings: [],
  })),
  decisions: [{
    id: `missing-building-${input.propertyGroupId}`,
    severity: 'critical',
    category: 'missing-team',
    title: 'Edificio no encontrado',
    message: 'No se encontró el edificio/centro de trabajo solicitado.',
    actionLabel: 'Volver a ajustes',
    actionTarget: 'settings',
  }],
});

export const buildPlanningBuildingCrmProfile = (input: BuildPlanningBuildingCrmProfileInput): PlanningBuildingCrmProfile => {
  const group = input.propertyGroups.find((entry) => entry.id === input.propertyGroupId);
  if (!group) return buildMissingGroupProfile(input);

  const rangeDates = enumerateDateStrings(input.dateFrom, input.dateTo);
  const groupPropertyIds = new Set(
    input.propertyGroupAssignments
      .filter((assignment) => assignment.property_group_id === group.id)
      .map((assignment) => assignment.property_id),
  );
  const groupProperties = input.properties
    .filter((property) => groupPropertyIds.has(property.id))
    .filter((property) => property.isActive !== false && property.clientIsActive !== false)
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const propertyById = new Map(groupProperties.map((property) => [property.id, property]));
  const propertySummaries: PlanningBuildingCrmProperty[] = groupProperties.map((property) => {
    const durationMinutes = getPropertyDurationMinutes(property);
    const requiredCleaners = getRequiredCleaners(property);
    return {
      propertyId: property.id,
      propertyCode: property.codigo,
      propertyName: property.nombre,
      propertyAddress: property.direccion,
      durationMinutes,
      requiredCleaners,
      personMinutes: durationMinutes * requiredCleaners,
      hasMissingDuration: durationMinutes <= 0,
      isLargeProperty: durationMinutes > 360,
      clientName: property.clientName ?? null,
    };
  });

  const activeTasks = input.tasks
    .filter(isActivePlanningTask)
    .filter(isTouristCleaningTask)
    .filter((task) => Boolean(task.propiedad_id && propertyById.has(task.propiedad_id)))
    .filter((task) => task.date >= input.dateFrom && task.date <= input.dateTo);

  const taskItems: PlanningBuildingCrmTask[] = activeTasks.map((task) => {
    const property = propertyById.get(task.propiedad_id || '');
    const durationMinutes = property ? getPropertyDurationMinutes(property) : 0;
    const requiredCleaners = property ? getRequiredCleaners(property) : 1;
    const warnings: string[] = [];
    if (durationMinutes <= 0) warnings.push('Duración operativa pendiente en la propiedad.');
    if (durationMinutes > 360 && requiredCleaners <= 1) warnings.push('Casa grande: revisa si necesita 2–3 personas.');
    return {
      id: task.id,
      source: 'task',
      sourceLabel: 'Tarea confirmada',
      date: task.date,
      propertyId: property?.id || task.propiedad_id || '',
      propertyCode: property?.codigo || task.property,
      propertyName: property?.nombre || task.property,
      startTime: task.start_time ?? null,
      endTime: task.end_time ?? null,
      status: task.status,
      serviceKind: 'checkout',
      durationMinutes,
      requiredCleaners,
      personMinutes: durationMinutes * requiredCleaners,
      assignedCleanerIds: getTaskCleanerIds(task),
      assignedCleanerNames: getTaskCleanerNames(task),
      isConfirmed: true,
      warnings,
    };
  });

  const forecastItems: PlanningBuildingCrmTask[] = (input.forecastItems || [])
    .filter((item) => propertyById.has(item.propertyId))
    .filter((item) => item.date >= input.dateFrom && item.date <= input.dateTo)
    .map((item) => {
      const property = propertyById.get(item.propertyId);
      const durationMinutes = Math.max(0, item.durationMinutes || getPropertyDurationMinutes(property as Property));
      const requiredCleaners = Math.max(1, item.requiredCleaners || (property ? getRequiredCleaners(property) : 1));
      return {
        id: item.id,
        source: 'forecast',
        sourceLabel: getForecastSourceLabel(item.source),
        date: item.date,
        propertyId: item.propertyId,
        propertyCode: property?.codigo || 'Propiedad',
        propertyName: property?.nombre || 'Propiedad',
        startTime: null,
        endTime: null,
        status: 'forecast',
        serviceKind: item.serviceKind || 'checkout',
        durationMinutes,
        requiredCleaners,
        personMinutes: durationMinutes * requiredCleaners,
        assignedCleanerIds: [],
        assignedCleanerNames: [],
        isConfirmed: false,
        warnings: ['Previsto: todavía no hay tarea confirmada en planificación.'],
      } satisfies PlanningBuildingCrmTask;
    });

  const allItems = [...taskItems, ...forecastItems].sort((a, b) => `${a.date} ${a.startTime || '99:99'} ${a.propertyCode}`.localeCompare(`${b.date} ${b.startTime || '99:99'} ${b.propertyCode}`));
  const cleanerById = new Map(input.cleaners.map((cleaner) => [cleaner.id, cleaner]));
  const teamAssignments = unique(
    input.cleanerGroupAssignments
      .filter((assignment) => assignment.propertyGroupId === group.id)
      .filter((assignment) => assignment.isActive || getRoleType(assignment) === 'excluded')
      .filter((assignment) => cleanerById.has(assignment.cleanerId))
      .sort((a, b) => ROLE_ORDER[getRoleType(a)] - ROLE_ORDER[getRoleType(b)] || a.priority - b.priority),
    (assignment) => assignment.cleanerId,
  );
  const activeAssignableAssignments = teamAssignments.filter((assignment) => assignment.isActive && getRoleType(assignment) !== 'excluded');
  const activeAssignableCleanerIds = new Set(activeAssignableAssignments.map((assignment) => assignment.cleanerId));
  const excludedCleanerIds = new Set(teamAssignments.filter((assignment) => getRoleType(assignment) === 'excluded').map((assignment) => assignment.cleanerId));

  const days: PlanningBuildingCrmDay[] = rangeDates.map((date) => {
    const tasks = allItems.filter((item) => item.date === date);
    const serviceMinutes = tasks.reduce((sum, item) => sum + item.durationMinutes, 0);
    const personMinutes = tasks.reduce((sum, item) => sum + item.personMinutes, 0);
    const assignedPersonMinutes = tasks.reduce((sum, item) => sum + (item.durationMinutes * item.assignedCleanerIds.length), 0);
    const availableAssignedPersonMinutes = activeAssignableAssignments.reduce((sum, assignment) => {
      const cleaner = cleanerById.get(assignment.cleanerId);
      if (!cleaner) return sum;
      return sum + getTeamAvailabilityMinutes(cleaner, assignment, date, input);
    }, 0);
    const requiredCleanerSlots = tasks.reduce((sum, item) => sum + item.requiredCleaners, 0);
    const confirmedCleanings = tasks.filter((item) => item.isConfirmed).length;
    const forecastCleanings = tasks.filter((item) => !item.isConfirmed).length;
    const warnings = unique(tasks.flatMap((item) => item.warnings).map((warning) => ({ warning })), (entry) => entry.warning).map((entry) => entry.warning);
    const hasMissingDuration = tasks.some((item) => item.durationMinutes <= 0);
    const hasExcludedAssignment = tasks.some((item) => item.assignedCleanerIds.some((cleanerId) => excludedCleanerIds.has(cleanerId)));
    const hasUnassignedConfirmed = tasks.some((item) => item.isConfirmed && item.assignedCleanerIds.length < item.requiredCleaners);
    const usesBackupOnly = activeAssignableAssignments.length > 0 && activeAssignableAssignments.every((assignment) => getRoleType(assignment) === 'backup');

    let status: PlanningBuildingCrmStatus = 'empty';
    if (tasks.length > 0) {
      if (hasMissingDuration || hasExcludedAssignment || activeAssignableAssignments.length === 0 || personMinutes > availableAssignedPersonMinutes) {
        status = 'critical';
      } else if (forecastCleanings > 0 || hasUnassignedConfirmed || usesBackupOnly) {
        status = 'watch';
      } else {
        status = 'covered';
      }
    }

    return {
      date,
      confirmedCleanings,
      forecastCleanings,
      serviceMinutes,
      personMinutes,
      assignedPersonMinutes,
      availableAssignedPersonMinutes,
      requiredCleanerSlots,
      status,
      tasks,
      warnings,
    };
  });

  const pressureDays = days.filter((day) => day.status === 'watch' || day.status === 'critical').length;
  const uncoveredDays = days.filter((day) => day.status === 'critical').length;
  const peakDailyPersonMinutes = Math.max(0, ...days.map((day) => day.personMinutes));
  const maxRequiredCleaners = Math.max(0, ...allItems.map((item) => item.requiredCleaners));
  const weekendDemandDays = days.filter((day) => day.personMinutes > 0 && isWeekend(day.date)).length;
  const baseRecommendedStaff = Math.max(maxRequiredCleaners, Math.ceil(peakDailyPersonMinutes / Math.max(1, input.fallbackDailyCapacityMinutes)));
  const recommendedStableStaff = Math.max(baseRecommendedStaff, weekendDemandDays >= 2 ? 2 : 0);
  const missingDurationProperties = propertySummaries.filter((property) => property.hasMissingDuration).length;
  const totalServiceMinutes = days.reduce((sum, day) => sum + day.serviceMinutes, 0);
  const totalPersonMinutes = days.reduce((sum, day) => sum + day.personMinutes, 0);
  const confirmedCleanings = days.reduce((sum, day) => sum + day.confirmedCleanings, 0);
  const forecastCleanings = days.reduce((sum, day) => sum + day.forecastCleanings, 0);
  const rangeDayCount = Math.max(1, rangeDates.length);
  const summaryStatus: PlanningBuildingCrmStatus = confirmedCleanings + forecastCleanings === 0
    ? 'empty'
    : days.some((day) => day.status === 'critical')
      ? 'critical'
      : days.some((day) => day.status === 'watch')
        ? 'watch'
        : 'covered';

  const team: PlanningBuildingCrmTeamMember[] = teamAssignments.map((assignment) => {
    const cleaner = cleanerById.get(assignment.cleanerId);
    const futureAssignedMinutes = allItems.reduce((sum, item) => item.assignedCleanerIds.includes(assignment.cleanerId) ? sum + item.durationMinutes : sum, 0);
    const availableDaysInRange = rangeDates.filter((date) => {
      if (!assignment.isActive || getRoleType(assignment) === 'excluded' || !cleaner) return false;
      return getTeamAvailabilityMinutes(cleaner, assignment, date, input) > 0;
    }).length;
    return {
      cleanerId: assignment.cleanerId,
      cleanerName: cleaner?.name || 'Trabajadora no encontrada',
      roleType: getRoleType(assignment),
      knowledgeLevel: assignment.knowledgeLevel,
      maxTasksPerDay: assignment.maxTasksPerDay,
      maxDailyMinutesOverride: assignment.maxDailyMinutesOverride ?? null,
      futureAssignedMinutes,
      availableDaysInRange,
      pressureConflicts: days.filter((day) => day.status === 'critical' && day.tasks.some((item) => item.assignedCleanerIds.includes(assignment.cleanerId))).length,
      notes: assignment.notes ?? null,
      isActive: assignment.isActive,
    };
  });

  const decisions: PlanningBuildingCrmDecision[] = [];
  if (activeAssignableAssignments.length === 0 && groupProperties.length > 0) {
    decisions.push({
      id: `missing-team-${group.id}`,
      severity: 'critical',
      category: 'missing-team',
      title: 'Sin equipo activo para el edificio',
      message: `${group.displayName || group.name} no tiene titulares, suplentes o backups activos para cubrir la demanda.`,
      actionLabel: 'Configurar equipo',
      actionTarget: 'team',
    });
  }

  propertySummaries.filter((property) => property.hasMissingDuration).forEach((property) => {
    decisions.push({
      id: `missing-duration-${property.propertyId}`,
      severity: 'critical',
      category: 'missing-duration',
      title: `${property.propertyCode} sin duración operativa`,
      message: 'No se puede calcular capacidad fiable sin duración de servicio en la propiedad.',
      propertyId: property.propertyId,
      propertyCode: property.propertyCode,
      actionLabel: 'Editar propiedad',
      actionTarget: 'property',
    });
  });

  propertySummaries.filter((property) => property.isLargeProperty && property.requiredCleaners <= 1).forEach((property) => {
    decisions.push({
      id: `large-property-${property.propertyId}`,
      severity: 'warning',
      category: 'large-property',
      title: `${property.propertyCode} parece casa grande`,
      message: 'La duración supera 6 h; revisa si debe requerir 2–3 limpiadoras en la planificación.',
      propertyId: property.propertyId,
      propertyCode: property.propertyCode,
      actionLabel: 'Revisar propiedad',
      actionTarget: 'property',
    });
  });

  days.filter((day) => day.tasks.length > 0 && day.personMinutes > day.availableAssignedPersonMinutes).forEach((day) => {
    decisions.push({
      id: `capacity-${group.id}-${day.date}`,
      severity: 'critical',
      category: 'capacity',
      title: `${day.date} necesita refuerzo`,
      message: `Demanda: ${Math.round(day.personMinutes / 60)} h-persona; equipo disponible: ${Math.round(day.availableAssignedPersonMinutes / 60)} h.`,
      date: day.date,
      actionLabel: 'Planificar día',
      actionTarget: 'planning',
    });
  });

  days.filter((day) => day.forecastCleanings > 0).forEach((day) => {
    decisions.push({
      id: `forecast-${group.id}-${day.date}`,
      severity: 'warning',
      category: 'forecast-not-created',
      title: `${day.forecastCleanings} limpieza${day.forecastCleanings === 1 ? '' : 's'} prevista${day.forecastCleanings === 1 ? '' : 's'} sin tarea`,
      message: 'Hay forecast de reservas futuras; todavía no es una tarea confirmada para notificar.',
      date: day.date,
      actionLabel: 'Ver día',
      actionTarget: 'planning',
    });
  });

  days.flatMap((day) => day.tasks.map((item) => ({ day, item }))).forEach(({ day, item }) => {
    const excludedIds = item.assignedCleanerIds.filter((cleanerId) => excludedCleanerIds.has(cleanerId));
    excludedIds.forEach((cleanerId) => {
      const cleaner = cleanerById.get(cleanerId);
      decisions.push({
        id: `excluded-${item.id}-${cleanerId}`,
        severity: 'critical',
        category: 'excluded-worker',
        title: `${cleaner?.name || 'Trabajadora'} figura como No apta en ${item.propertyCode}`,
        message: `La tarea del ${day.date} tiene asignada una trabajadora marcada como No apta para este edificio.`,
        date: day.date,
        propertyId: item.propertyId,
        propertyCode: item.propertyCode,
        cleanerId,
        actionLabel: 'Revisar equipo',
        actionTarget: 'team',
      });
    });
  });

  return {
    building: {
      id: group.id,
      name: group.name,
      displayName: group.displayName ?? null,
      internalCode: group.internalCode ?? null,
      zone: group.zone ?? null,
      clientName: group.clientName ?? null,
      supervisorName: group.supervisorName ?? null,
      planningNotes: group.planningNotes ?? null,
      propertyCount: propertySummaries.length,
      checkOutTime: group.checkOutTime,
      checkInTime: group.checkInTime,
      isActive: group.isActive,
    },
    properties: propertySummaries,
    team,
    range: { dateFrom: input.dateFrom, dateTo: input.dateTo },
    summary: {
      confirmedCleanings,
      forecastCleanings,
      serviceMinutes: totalServiceMinutes,
      personMinutes: totalPersonMinutes,
      averageDailyServiceMinutes: Math.round(totalServiceMinutes / rangeDayCount),
      averageWeeklyServiceMinutes: Math.round((totalServiceMinutes / rangeDayCount) * 7),
      averageMonthlyServiceMinutes: Math.round((totalServiceMinutes / rangeDayCount) * 30),
      peakDailyPersonMinutes,
      recommendedStableStaff,
      assignedPrimaryCount: team.filter((member) => member.roleType === 'primary' && member.isActive).length,
      assignedSecondaryCount: team.filter((member) => member.roleType === 'secondary' && member.isActive).length,
      assignedBackupCount: team.filter((member) => member.roleType === 'backup' && member.isActive).length,
      excludedCount: team.filter((member) => member.roleType === 'excluded').length,
      pressureDays,
      uncoveredDays,
      missingDurationProperties,
      status: summaryStatus,
    },
    days,
    decisions: unique(decisions, (decision) => decision.id),
  };
};

const TEAM_ROLE_ORDER: Record<PlanningBuildingCrmTeamMember['roleType'], number> = {
  primary: 1,
  secondary: 2,
  backup: 3,
  excluded: 4,
};

const EMPTY_GLOBAL_QUALITY: GlobalPlanQualitySummary = {
  fullBundlesCovered: 0,
  splitBundles: 0,
  avoidableSplits: 0,
  backupAssignments: 0,
  avoidableBackupAssignments: 0,
  nearCheckInTasks: 0,
  manualDecisionCount: 0,
  globalScore: 100,
  criticalWarnings: [],
};

const getBuildingProposalTasks = (profile: PlanningBuildingCrmProfile): PlanningBuildingCrmTask[] => profile.days
  .flatMap((day) => day.tasks)
  .filter((task) => task.isConfirmed)
  .filter((task) => task.assignedCleanerIds.length < task.requiredCleaners)
  .sort((a, b) => `${a.date} ${a.startTime || '99:99'} ${a.propertyCode}`.localeCompare(`${b.date} ${b.startTime || '99:99'} ${b.propertyCode}`, 'es', { numeric: true }));

const getAssignableBuildingTeam = (profile: PlanningBuildingCrmProfile): PlanningBuildingCrmTeamMember[] => profile.team
  .filter((member) => member.isActive)
  .filter((member) => member.roleType !== 'excluded')
  .sort((a, b) => (
    TEAM_ROLE_ORDER[a.roleType] - TEAM_ROLE_ORDER[b.roleType]
    || (b.knowledgeLevel || 0) - (a.knowledgeLevel || 0)
    || a.futureAssignedMinutes - b.futureAssignedMinutes
    || a.cleanerName.localeCompare(b.cleanerName, 'es', { numeric: true })
  ));

const getTaskConflict = (task: PlanningBuildingCrmTask, code: AssignmentConflict['code'], message: string): AssignmentConflict => ({
  taskId: task.id,
  code,
  message,
  details: {
    propertyId: task.propertyId,
    propertyCode: task.propertyCode,
    date: task.date,
  },
});

interface BuildingProposalWorkerDayState {
  proposedMinutes: number;
  cursorMinutes: number;
}

const parseClockMinutes = (value?: string | null): number | null => {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const formatClockMinutes = (minutes: number): string => {
  const normalized = Math.max(0, Math.round(minutes));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const getBuildingWindow = (profile: PlanningBuildingCrmProfile): { startMinutes: number; endMinutes: number; durationMinutes: number } | null => {
  const startMinutes = parseClockMinutes(profile.building.checkOutTime);
  const endMinutes = parseClockMinutes(profile.building.checkInTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return null;
  return {
    startMinutes,
    endMinutes,
    durationMinutes: endMinutes - startMinutes,
  };
};

const getWorkerDayKey = (cleanerId: string, date: string): string => `${cleanerId}::${date}`;

const getWorkerDayState = (
  stateByWorkerDay: Map<string, BuildingProposalWorkerDayState>,
  cleanerId: string,
  date: string,
  initialCursorMinutes: number,
): BuildingProposalWorkerDayState => {
  const key = getWorkerDayKey(cleanerId, date);
  const current = stateByWorkerDay.get(key);
  if (current) return current;
  const initial = { proposedMinutes: 0, cursorMinutes: initialCursorMinutes };
  stateByWorkerDay.set(key, initial);
  return initial;
};

const cloneWorkerDayState = (stateByWorkerDay: Map<string, BuildingProposalWorkerDayState>): Map<string, BuildingProposalWorkerDayState> => new Map(
  Array.from(stateByWorkerDay.entries()).map(([key, value]) => [key, { ...value }]),
);

const getWorkerDailyCapacityMinutes = (member: PlanningBuildingCrmTeamMember, buildingWindowMinutes?: number): number => {
  const workerLimit = member.maxDailyMinutesOverride || buildingWindowMinutes || 360;
  return typeof buildingWindowMinutes === 'number' ? Math.min(workerLimit, buildingWindowMinutes) : workerLimit;
};

export const buildBuildingCrmAssignmentProposal = (profile: PlanningBuildingCrmProfile): AssignmentProposalResult => {
  const candidateTasks = getBuildingProposalTasks(profile);
  const assignableTeam = getAssignableBuildingTeam(profile);
  const buildingWindow = getBuildingWindow(profile);
  const stateByWorkerDay = new Map<string, BuildingProposalWorkerDayState>();
  const proposals: AssignmentProposal[] = [];
  const conflicts: AssignmentConflict[] = [];
  const criticalWarnings: string[] = [];
  let coveredTaskCount = 0;
  let proposedMinutes = 0;

  candidateTasks.forEach((task) => {
    if (task.durationMinutes <= 0) {
      conflicts.push(getTaskConflict(task, 'missing_duration', `${task.propertyCode} no tiene duración operativa; revisa la propiedad antes de asignar.`));
      return;
    }

    if (assignableTeam.length === 0) {
      conflicts.push(getTaskConflict(task, 'no_building_team', `${profile.building.displayName || profile.building.name} no tiene equipo activo para proponer asignación.`));
      return;
    }

    const requiredSlots = Math.max(1, task.requiredCleaners - task.assignedCleanerIds.length);
    const availableTeam = assignableTeam.filter((member) => !task.assignedCleanerIds.includes(member.cleanerId));
    if (availableTeam.length < requiredSlots) {
      conflicts.push(getTaskConflict(task, 'no_available_worker', `${task.propertyCode} necesita ${requiredSlots} persona${requiredSlots === 1 ? '' : 's'} y solo hay ${availableTeam.length} disponible${availableTeam.length === 1 ? '' : 's'} en el equipo del edificio.`));
      criticalWarnings.push(`${task.date} · ${task.propertyCode}: falta equipo disponible del edificio.`);
      return;
    }

    const taskStartMinutes = parseClockMinutes(task.startTime) ?? buildingWindow?.startMinutes ?? 11 * 60;
    const dayStartMinutes = Math.max(buildingWindow?.startMinutes ?? taskStartMinutes, taskStartMinutes);
    const dayEndMinutes = buildingWindow?.endMinutes;
    const tentativeState = cloneWorkerDayState(stateByWorkerDay);
    const chosen: Array<{ member: PlanningBuildingCrmTeamMember; startMinutes: number; endMinutes: number; assignedMinutes: number; remainingMinutes: number }> = [];

    for (let index = 0; index < requiredSlots; index += 1) {
      const chosenIds = new Set(chosen.map((item) => item.member.cleanerId));
      const eligible = availableTeam
        .filter((member) => !chosenIds.has(member.cleanerId))
        .map((member) => {
          const state = getWorkerDayState(tentativeState, member.cleanerId, task.date, dayStartMinutes);
          const capacityMinutes = getWorkerDailyCapacityMinutes(member, buildingWindow?.durationMinutes);
          const startMinutes = Math.max(state.cursorMinutes, dayStartMinutes);
          const endMinutes = startMinutes + task.durationMinutes;
          const fitsCapacity = state.proposedMinutes + task.durationMinutes <= capacityMinutes;
          const fitsWindow = typeof dayEndMinutes !== 'number' || endMinutes <= dayEndMinutes;
          return { member, state, capacityMinutes, startMinutes, endMinutes, fitsCapacity, fitsWindow };
        })
        .filter((item) => item.fitsCapacity && item.fitsWindow)
        .sort((a, b) => (
          TEAM_ROLE_ORDER[a.member.roleType] - TEAM_ROLE_ORDER[b.member.roleType]
          || a.state.proposedMinutes - b.state.proposedMinutes
          || (b.member.knowledgeLevel || 0) - (a.member.knowledgeLevel || 0)
          || a.member.cleanerName.localeCompare(b.member.cleanerName, 'es', { numeric: true })
        ));

      const selected = eligible[0];
      if (!selected) break;
      selected.state.proposedMinutes += task.durationMinutes;
      selected.state.cursorMinutes = selected.endMinutes;
      chosen.push({
        member: selected.member,
        startMinutes: selected.startMinutes,
        endMinutes: selected.endMinutes,
        assignedMinutes: selected.state.proposedMinutes,
        remainingMinutes: Math.max(0, selected.capacityMinutes - selected.state.proposedMinutes),
      });
    }

    if (chosen.length < requiredSlots) {
      conflicts.push(getTaskConflict(task, 'no_available_worker', `${task.propertyCode} no cabe en la ventana ${profile.building.checkOutTime || 'checkout'}–${profile.building.checkInTime || 'checkin'} con el equipo disponible del edificio.`));
      criticalWarnings.push(`${task.date} · ${task.propertyCode}: no cabe respetando checkout/checkin y carga diaria por trabajadora.`);
      return;
    }

    tentativeState.forEach((value, key) => stateByWorkerDay.set(key, value));
    coveredTaskCount += 1;

    chosen.forEach(({ member, startMinutes, endMinutes, assignedMinutes, remainingMinutes }, index) => {
      const usesBackup = member.roleType === 'backup';
      if (usesBackup) criticalWarnings.push(`${task.date} · ${task.propertyCode}: se usa backup porque titulares/suplentes no alcanzan.`);
      proposedMinutes += task.durationMinutes;
      proposals.push({
        taskId: task.id,
        cleanerId: member.cleanerId,
        cleanerName: member.cleanerName,
        propertyGroupId: profile.building.id,
        propertyGroupName: profile.building.displayName || profile.building.name,
        bundleId: `${profile.building.id}-${task.date}`,
        assignmentRole: member.roleType === 'backup' ? 'backup' : index === 0 ? 'primary' : 'secondary',
        durationMinutes: task.durationMinutes,
        proposedStartTime: formatClockMinutes(startMinutes),
        proposedEndTime: formatClockMinutes(endMinutes),
        requiredCleaners: task.requiredCleaners,
        assignmentIndex: task.assignedCleanerIds.length + index + 1,
        confidence: usesBackup ? 72 : member.roleType === 'secondary' ? 82 : 90,
        reasons: [
          `Forma parte del equipo del edificio ${profile.building.displayName || profile.building.name}.`,
          `Cabe en la ventana operativa ${profile.building.checkOutTime || formatClockMinutes(dayStartMinutes)}–${profile.building.checkInTime || 'fin de jornada'}.`,
          member.roleType === 'primary' ? 'Es titular del edificio.' : member.roleType === 'secondary' ? 'Es suplente del edificio.' : 'Es backup operativo del edificio.',
        ],
        warnings: usesBackup ? ['Usa backup: revisar si conviene reforzar titulares/suplentes.'] : [],
        capacityAfterAssignment: {
          assignedMinutes,
          remainingMinutes,
        },
      });
    });
  });

  const backupAssignments = proposals.filter((proposal) => proposal.assignmentRole === 'backup').length;
  const globalQuality: GlobalPlanQualitySummary = {
    ...EMPTY_GLOBAL_QUALITY,
    fullBundlesCovered: coveredTaskCount,
    backupAssignments,
    avoidableBackupAssignments: backupAssignments > 0 ? 1 : 0,
    manualDecisionCount: conflicts.length,
    globalScore: Math.max(35, 100 - conflicts.length * 18 - backupAssignments * 5),
    criticalWarnings: Array.from(new Set(criticalWarnings)),
  };

  return {
    proposals,
    conflicts,
    summary: {
      totalUnassignedTasks: candidateTasks.length,
      proposedCount: coveredTaskCount,
      conflictCount: conflicts.length,
      proposedMinutes,
      remainingCapacityMinutes: 0,
      missingCapacityMinutes: conflicts.length > 0 ? conflicts.length * 60 : 0,
      globalQuality,
    },
  };
};

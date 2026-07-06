import type { Cleaner } from '@/types/calendar';
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

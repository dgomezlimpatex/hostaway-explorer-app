/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/integrations/supabase/client';
import { fromUntypedTable, rpcUntyped } from '@/lib/supabaseUntyped';
import { mapCleanerFromDB } from '@/services/storage/mappers/cleanerMappers';
import { mapPropertyFromDB } from '@/services/storage/mappers/propertyMappers';
import { Cleaner, Task } from '@/types/calendar';
import { Property } from '@/types/property';
import { CleanerGroupAssignment, PropertyGroup } from '@/types/propertyGroups';
import {
  PlanningApprovalResult,
  PlanningAbsenceReplacement,
  PlanningAbsenceReplacementTask,
  PlanningBuildingSummary,
  PlanningConflict,
  PlanningConflictCode,
  PlanningGenerateInput,
  PlanningMonthlyForecastMonth,
  PlanningMonthlyForecastProperty,
  PlanningMonthlyForecastResponse,
  PlanningNotificationBatch,
  PlanningOverview,
  PlanningOverviewDay,
  PlanningOverviewResponse,
  PlanningPerformanceOverview,
  PlanningPredictiveAlert,
  PlanningPreviewData,
  PlanningReplacementApplyResult,
  PlanningProposalCleaner,
  PlanningRoleType,
  PlanningRun,
  PlanningRunItem,
  PlanningRunItemProposal,
  PlanningRunSummary,
  PlanningSettings,
  PlanningWorkerSummary,
} from '@/types/operationalPlanning';
import { buildEffectiveAvailabilityForDate, WeeklyAvailabilityRow } from '@/utils/cleaning-planning/availability';
import { formatMadridDate } from '@/utils/date';
import { WorkerAbsence, WorkerFixedDayOff, WorkerMaintenanceCleaning } from '@/types/workerAbsence';

type VacationRequestRow = {
  cleaner_id: string;
  start_date: string;
  end_date: string;
  status: string;
  request_type: string;
  notes?: string | null;
};

type RawPlanningTask = {
  id: string;
  property: string;
  address: string;
  date: string;
  start_time: string;
  end_time: string;
  check_in: string;
  check_out: string;
  type: string;
  status: string;
  cleaner_id?: string | null;
  cleaner?: string | null;
  duracion?: number | null;
  propiedad_id?: string | null;
  cliente_id?: string | null;
  coste?: number | null;
  notes?: string | null;
  task_assignments?: Array<{ cleaner_id: string; cleaner_name: string }> | null;
  properties?: any;
};

type PlanningDataset = {
  settings: PlanningSettings;
  tasks: RawPlanningTask[];
  properties: Property[];
  cleaners: Cleaner[];
  propertyGroups: PropertyGroup[];
  propertyGroupAssignments: Array<{ property_group_id: string; property_id: string }>;
  cleanerGroupAssignments: CleanerGroupAssignment[];
  propertyPreferredCleaners: Array<{ property_id: string; cleaner_id: string; priority: number; notes?: string | null }>;
  weeklyAvailability: WeeklyAvailabilityRow[];
  absences: WorkerAbsence[];
  fixedDaysOff: WorkerFixedDayOff[];
  maintenanceCleanings: WorkerMaintenanceCleaning[];
};

type AvailabilityState = {
  cleaner: Cleaner;
  date: string;
  availableMinutes: number;
  assignedMinutes: number;
  remainingMinutes: number;
  isAvailable: boolean;
  availableStart?: string;
  availableEnd?: string;
};

type PlannerCandidate = {
  cleaner: Cleaner;
  cleanerId: string;
  cleanerName: string;
  roleType: PlanningRoleType;
  score: number;
  reasons: string[];
  warnings: string[];
  assignedMinutes: number;
  remainingMinutes: number;
};

type PlanningScenario = {
  items: Omit<PlanningRunItem, 'id' | 'runId' | 'createdAt' | 'updatedAt'>[];
  conflicts: Omit<PlanningConflict, 'id' | 'runId' | 'createdAt'>[];
  summary: PlanningRunSummary;
  unassignedTasks: RawPlanningTask[];
};

const DEFAULT_SETTINGS: PlanningSettings = {
  horizonDays: 14,
  bufferMinutes: 30,
  allowBackups: true,
  excludeExtraordinary: true,
  approvalRequired: true,
  fallbackDailyCapacityMinutes: 480,
  weeklyTolerancePercent: 10,
};

const PRIMARY_ROLE_WEIGHT: Record<PlanningRoleType, number> = {
  'property-preferred': 500,
  'building-primary': 420,
  'building-secondary': 310,
  'building-backup': 210,
  'same-zone': 140,
  'manual-review': 0,
};

const ESTIMATED_MANUAL_PLANNING_MINUTES_PER_TASK = 4;

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  year: 'numeric',
});

const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function toMinutes(time?: string | null): number | null {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function fromMinutes(totalMinutes: number): string {
  const safe = Math.max(0, totalMinutes);
  const hours = Math.floor(safe / 60).toString().padStart(2, '0');
  const minutes = (safe % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function hoursLabel(minutes: number) {
  return `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)} h`;
}

function formatPlanningDateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

function isActivePlanningTask(task: RawPlanningTask) {
  return task.status !== 'completed' && task.status !== 'cancelled';
}

function isTouristCleaningTask(task: RawPlanningTask) {
  return task.type === 'limpieza-turistica';
}

function isStayCleaningTask(task: RawPlanningTask, property?: Property | null) {
  const text = `${task.type || ''} ${task.notes || ''} ${task.property || ''}`.toLowerCase();
  if (text.includes('stay') || text.includes('estancia') || text.includes('huésped') || text.includes('huesped') || text.includes('diaria')) {
    return true;
  }

  const duration = Number(task.duracion || 0);
  return Boolean(
    property?.planningEstimatedStayMinutes
    && duration > 0
    && duration === property.planningEstimatedStayMinutes
    && property.planningEstimatedStayMinutes !== property.planningEstimatedCheckoutMinutes
  );
}

function getTaskCleanerIds(task: RawPlanningTask): string[] {
  const assignmentIds = (task.task_assignments || []).map((assignment) => assignment.cleaner_id).filter(Boolean);
  if (assignmentIds.length > 0) return Array.from(new Set(assignmentIds));
  return task.cleaner_id ? [task.cleaner_id] : [];
}

function mapTaskForAvailability(task: RawPlanningTask): Task {
  return {
    id: task.id,
    property: task.property,
    propertyCode: task.properties?.codigo,
    propertyDurationMinutes: task.properties?.duracion_servicio,
    propertyName: task.properties?.nombre,
    propertyAddress: task.properties?.direccion,
    address: task.address,
    date: task.date,
    startTime: task.start_time,
    endTime: task.end_time,
    duration: task.duracion || undefined,
    checkIn: task.check_in,
    checkOut: task.check_out,
    type: task.type,
    status: task.status as Task['status'],
    cleaner: task.cleaner || undefined,
    cleanerId: task.cleaner_id || undefined,
    clienteId: task.cliente_id || undefined,
    propertyId: task.propiedad_id || undefined,
    notes: task.notes || undefined,
    created_at: '',
    updated_at: '',
  };
}

function mapPropertyGroup(row: any): PropertyGroup {
  return {
    id: row.id,
    name: row.name,
    internalCode: row.internal_code ?? undefined,
    displayName: row.display_name ?? undefined,
    zone: row.zone ?? undefined,
    clientName: row.client_name ?? undefined,
    supervisorName: row.supervisor_name ?? undefined,
    generalInstructions: row.general_instructions ?? undefined,
    difficultyLevel: row.difficulty_level ?? 1,
    recommendedCapacity: row.recommended_capacity ?? 1,
    planningNotes: row.planning_notes ?? undefined,
    description: row.description ?? undefined,
    checkOutTime: row.check_out_time,
    checkInTime: row.check_in_time,
    isActive: row.is_active,
    autoAssignEnabled: row.auto_assign_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCleanerGroupAssignment(row: any): CleanerGroupAssignment {
  return {
    id: row.id,
    propertyGroupId: row.property_group_id,
    cleanerId: row.cleaner_id,
    priority: row.priority,
    roleType: row.role_type ?? (row.priority <= 19 ? 'primary' : row.priority <= 29 ? 'secondary' : 'backup'),
    knowledgeLevel: row.knowledge_level ?? 3,
    maxTasksPerDay: row.max_tasks_per_day ?? 8,
    maxDailyMinutesOverride: row.max_daily_minutes_override ?? null,
    estimatedTravelTimeMinutes: row.estimated_travel_time_minutes ?? 15,
    notes: row.notes ?? null,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAbsence(row: any): WorkerAbsence {
  return {
    id: row.id,
    cleanerId: row.cleaner_id,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    absenceType: row.absence_type,
    locationName: row.location_name,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFixedDayOff(row: any): WorkerFixedDayOff {
  return {
    id: row.id,
    cleanerId: row.cleaner_id,
    dayOfWeek: row.day_of_week,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMaintenance(row: any): WorkerMaintenanceCleaning {
  return {
    id: row.id,
    cleanerId: row.cleaner_id,
    daysOfWeek: row.days_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    locationName: row.location_name,
    notes: row.notes,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSettings(row?: any | null): PlanningSettings {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    id: row.id,
    sedeId: row.sede_id,
    horizonDays: row.horizon_days ?? DEFAULT_SETTINGS.horizonDays,
    bufferMinutes: row.buffer_minutes ?? DEFAULT_SETTINGS.bufferMinutes,
    allowBackups: row.allow_backups ?? DEFAULT_SETTINGS.allowBackups,
    excludeExtraordinary: row.exclude_extraordinary ?? DEFAULT_SETTINGS.excludeExtraordinary,
    approvalRequired: row.approval_required ?? DEFAULT_SETTINGS.approvalRequired,
    fallbackDailyCapacityMinutes: row.fallback_daily_capacity_minutes ?? DEFAULT_SETTINGS.fallbackDailyCapacityMinutes,
    weeklyTolerancePercent: Number(row.weekly_tolerance_percent ?? DEFAULT_SETTINGS.weeklyTolerancePercent),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeRunSummary(summary: any): PlanningRunSummary {
  return {
    totalTasks: Number(summary?.totalTasks ?? 0),
    proposedTasks: Number(summary?.proposedTasks ?? 0),
    proposedAssignments: Number(summary?.proposedAssignments ?? 0),
    requiredMinutes: Number(summary?.requiredMinutes ?? 0),
    proposedMinutes: Number(summary?.proposedMinutes ?? 0),
    conflictCount: Number(summary?.conflictCount ?? 0),
    deficitMinutes: Number(summary?.deficitMinutes ?? 0),
    criticalTasks: Number(summary?.criticalTasks ?? 0),
  };
}

function mapRun(row: any): PlanningRun {
  return {
    id: row.id,
    sedeId: row.sede_id,
    dateFrom: row.date_from,
    dateTo: row.date_to,
    status: row.status,
    summary: normalizeRunSummary(row.summary),
    generatedBy: row.generated_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    discardedAt: row.discarded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRunItem(row: any): PlanningRunItem {
  return {
    id: row.id,
    runId: row.run_id,
    taskId: row.task_id,
    propertyId: row.property_id,
    propertyGroupId: row.property_group_id,
    proposedCleanerIds: row.proposed_cleaner_ids || [],
    proposedCleanerNames: row.proposed_cleaner_names || [],
    roleSource: row.role_source,
    explanation: row.explanation,
    warnings: row.warnings || [],
    score: Number(row.score ?? 0),
    proposal: row.proposal as PlanningRunItemProposal,
    status: row.status,
    appliedAt: row.applied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapConflict(row: any): PlanningConflict {
  return {
    id: row.id,
    runId: row.run_id,
    taskId: row.task_id,
    code: row.code,
    message: row.message,
    details: (row.details || {}) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

function mapNotificationBatch(row: any): PlanningNotificationBatch {
  return {
    id: row.id,
    runId: row.run_id,
    cleanerId: row.cleaner_id,
    cleanerEmail: row.cleaner_email,
    cleanerName: row.cleaner_name,
    taskDate: row.task_date,
    taskIds: row.task_ids || [],
    notificationKey: row.notification_key,
    payload: row.payload || {},
    status: row.status,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sameWeek(dateA: string, dateB: string) {
  const a = new Date(`${dateA}T12:00:00`);
  const b = new Date(`${dateB}T12:00:00`);
  const dayA = (a.getDay() + 6) % 7;
  const dayB = (b.getDay() + 6) % 7;
  const mondayA = new Date(a);
  const mondayB = new Date(b);
  mondayA.setDate(a.getDate() - dayA);
  mondayB.setDate(b.getDate() - dayB);
  return mondayA.toISOString().slice(0, 10) === mondayB.toISOString().slice(0, 10);
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

function getMonthLabel(monthKey: string) {
  const date = new Date(`${monthKey}-01T12:00:00`);
  const label = MONTH_LABEL_FORMATTER.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function isWeekendDate(date: string) {
  const day = new Date(`${date}T12:00:00`).getDay();
  return day === 0 || day === 6;
}

function overlapsTime(taskA: { date: string; startTime: string; endTime: string }, taskB: { date: string; startTime: string; endTime: string }) {
  if (taskA.date !== taskB.date) return false;
  const startA = toMinutes(taskA.startTime);
  const endA = toMinutes(taskA.endTime);
  const startB = toMinutes(taskB.startTime);
  const endB = toMinutes(taskB.endTime);
  if (startA == null || endA == null || startB == null || endB == null) return false;
  return startA < endB && startB < endA;
}

function roleLabel(roleType: PlanningRoleType) {
  switch (roleType) {
    case 'property-preferred': return 'preferente de propiedad';
    case 'building-primary': return 'titular del edificio';
    case 'building-secondary': return 'suplente del edificio';
    case 'building-backup': return 'backup del edificio';
    case 'same-zone': return 'equipo de la misma zona';
    default: return 'revisión manual';
  }
}

function buildCriticality(task: RawPlanningTask, durationMinutes: number, bufferMinutes: number) {
  const start = toMinutes(task.start_time);
  const end = toMinutes(task.end_time);
  const checkOut = toMinutes(task.check_out);
  const checkIn = toMinutes(task.check_in);
  if (start == null || end == null || checkOut == null || checkIn == null) return true;
  const marginBefore = start - checkOut;
  const marginAfter = checkIn - end;
  return marginBefore <= bufferMinutes || marginAfter <= bufferMinutes || (end - start) <= durationMinutes;
}

class OperationalPlanningService {
  private async getSettingsForSede(sedeId: string): Promise<PlanningSettings> {
    const { data, error } = await fromUntypedTable('planning_settings')
      .select('*')
      .eq('sede_id', sedeId)
      .maybeSingle();

    if (error) throw error;
    return mapSettings(data);
  }

  async saveSettings(sedeId: string, updates: Partial<PlanningSettings>): Promise<PlanningSettings> {
    const existing = await this.getSettingsForSede(sedeId);
    const payload = {
      sede_id: sedeId,
      horizon_days: updates.horizonDays ?? existing.horizonDays,
      buffer_minutes: updates.bufferMinutes ?? existing.bufferMinutes,
      allow_backups: updates.allowBackups ?? existing.allowBackups,
      exclude_extraordinary: updates.excludeExtraordinary ?? existing.excludeExtraordinary,
      approval_required: updates.approvalRequired ?? existing.approvalRequired,
      fallback_daily_capacity_minutes: updates.fallbackDailyCapacityMinutes ?? existing.fallbackDailyCapacityMinutes,
      weekly_tolerance_percent: updates.weeklyTolerancePercent ?? existing.weeklyTolerancePercent,
    };

    const query = existing.id
      ? fromUntypedTable('planning_settings').update(payload).eq('id', existing.id)
      : fromUntypedTable('planning_settings').insert(payload);

    const { data, error } = await query.select('*').single();
    if (error) throw error;
    return mapSettings(data);
  }

  async listRuns(sedeId: string, limit = 8): Promise<PlanningRun[]> {
    const { data, error } = await fromUntypedTable('planning_runs')
      .select('*')
      .eq('sede_id', sedeId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return ((data as any[]) || []).map(mapRun);
  }

  async getPreview(runId: string): Promise<PlanningPreviewData> {
    const [{ data: runData, error: runError }, { data: itemsData, error: itemsError }, { data: conflictsData, error: conflictsError }] = await Promise.all([
      fromUntypedTable('planning_runs').select('*').eq('id', runId).single(),
      fromUntypedTable('planning_run_items').select('*').eq('run_id', runId).order('created_at'),
      fromUntypedTable('planning_conflicts').select('*').eq('run_id', runId).order('created_at'),
    ]);

    if (runError) throw runError;
    if (itemsError) throw itemsError;
    if (conflictsError) throw conflictsError;

    return {
      run: mapRun(runData),
      items: ((itemsData as any[]) || []).map(mapRunItem),
      conflicts: ((conflictsData as any[]) || []).map(mapConflict),
    };
  }

  async getOverview(sedeId: string): Promise<PlanningOverviewResponse> {
    const settings = await this.getSettingsForSede(sedeId);
    const startDate = formatMadridDate(new Date());
    const endDate = formatMadridDate(new Date(Date.now() + (settings.horizonDays - 1) * 86400000));
    const dataset = await this.loadDataset({ sedeId, dateFrom: startDate, dateTo: endDate }, settings);

    const tasks = dataset.tasks.filter((task) => isActivePlanningTask(task) && (!settings.excludeExtraordinary || isTouristCleaningTask(task)));
    const dates = uniqueBy(tasks.map((task) => ({ date: task.date })), (entry) => entry.date).map((entry) => entry.date).sort();
    const daySummaries: PlanningOverviewDay[] = dates.map((date) => {
      const dayTasks = tasks.filter((task) => task.date === date);
      const requiredMinutes = dayTasks.reduce((sum, task) => sum + this.getTaskDurationMinutes(task, dataset.properties), 0);
      const availableMinutes = dataset.cleaners.reduce((sum, cleaner) => {
        const availability = this.buildAvailabilityState({
          cleaner,
          date,
          dataset,
          settings,
          scheduledTasks: dataset.tasks,
        });
        return sum + availability.availableMinutes;
      }, 0);
      return {
        date,
        tasks: dayTasks.length,
        unassigned: dayTasks.filter((task) => getTaskCleanerIds(task).length === 0).length,
        requiredMinutes,
        availableMinutes,
        deficitMinutes: Math.max(0, requiredMinutes - availableMinutes),
        criticalTasks: dayTasks.filter((task) => buildCriticality(task, this.getTaskDurationMinutes(task, dataset.properties), settings.bufferMinutes)).length,
      };
    });

    const activeAbsences = dataset.absences.filter((absence) => absence.startDate <= endDate && absence.endDate >= startDate).length;
    const unassignedTasks = tasks.filter((task) => getTaskCleanerIds(task).length === 0);
    const substitutions = this.buildAbsenceReplacements({
      dataset,
      settings,
      dateFrom: startDate,
      dateTo: endDate,
    });
    const alerts = this.buildPredictiveAlerts({
      dataset,
      settings,
      overviewDays: daySummaries,
      unassignedTasks,
      substitutions,
      dateFrom: startDate,
      dateTo: endDate,
    });
    const [latestRun, performance] = await Promise.all([
      this.listRuns(sedeId, 1).then((runs) => runs[0] || null),
      this.buildPerformanceOverview({
        sedeId,
        dataset,
        settings,
        daySummaries,
      }).catch((error) => {
        console.warn('Operational planning performance overview failed:', error);
        return this.buildFallbackPerformanceOverview(daySummaries);
      }),
    ]);

    return {
      settings,
      latestRun,
      overview: {
        startDate,
        endDate,
        totalTasks: tasks.length,
        unassignedTasks: unassignedTasks.length,
        requiredMinutes: daySummaries.reduce((sum, day) => sum + day.requiredMinutes, 0),
        availableMinutes: daySummaries.reduce((sum, day) => sum + day.availableMinutes, 0),
        activeAbsences,
        criticalTasks: daySummaries.reduce((sum, day) => sum + day.criticalTasks, 0),
        deficitDays: daySummaries.filter((day) => day.deficitMinutes > 0).length,
        days: daySummaries,
      },
      alerts,
      substitutions,
      performance,
    };
  }

  async getMonthlyPropertyForecast(input: PlanningGenerateInput): Promise<PlanningMonthlyForecastResponse> {
    const settings = await this.getSettingsForSede(input.sedeId);
    const dataset = await this.loadDataset(input, settings);
    const dateRange = enumerateDates(input.dateFrom, input.dateTo);
    const monthKeys = Array.from(new Set(dateRange.map(getMonthKey))).sort();
    const activeProperties = dataset.properties.filter((property) => property.isActive !== false && property.clientIsActive !== false);
    const activePropertyIds = new Set(activeProperties.map((property) => property.id));
    const activeTasks = dataset.tasks
      .filter((task) => isActivePlanningTask(task))
      .filter((task) => isTouristCleaningTask(task))
      .filter((task) => !!task.propiedad_id && activePropertyIds.has(task.propiedad_id));

    const tasksByDate = activeTasks.reduce<Map<string, RawPlanningTask[]>>((map, task) => {
      const current = map.get(task.date) || [];
      current.push(task);
      map.set(task.date, current);
      return map;
    }, new Map());

    const monthCapacity = monthKeys.reduce<Map<string, { availableMinutes: number; requiredMinutes: number; pressureDays: number }>>((map, monthKey) => {
      const monthDates = dateRange.filter((date) => getMonthKey(date) === monthKey);
      let availableMinutes = 0;
      let requiredMinutes = 0;
      let pressureDays = 0;

      monthDates.forEach((date) => {
        const dayRequired = (tasksByDate.get(date) || []).reduce((sum, task) => {
          const property = dataset.properties.find((entry) => entry.id === task.propiedad_id);
          const requiredCleaners = property?.planningRequiredCleaners || 1;
          return sum + (this.getTaskDurationMinutes(task, dataset.properties) * requiredCleaners);
        }, 0);
        const dayAvailable = dataset.cleaners.reduce((sum, cleaner) => {
          const availability = this.buildAvailabilityState({
            cleaner,
            date,
            dataset,
            settings,
            scheduledTasks: dataset.tasks,
          });
          return sum + availability.availableMinutes;
        }, 0);

        requiredMinutes += dayRequired;
        availableMinutes += dayAvailable;
        if (dayRequired > dayAvailable * 0.85) pressureDays += 1;
      });

      map.set(monthKey, { availableMinutes, requiredMinutes, pressureDays });
      return map;
    }, new Map());

    const propertiesByMonth = new Map<string, PlanningMonthlyForecastProperty & {
      dailyDemand: Map<string, { cleanings: number; minutes: number; slots: number }>;
    }>();

    activeProperties.forEach((property) => {
      monthKeys.forEach((monthKey) => {
        const group = this.resolvePropertyGroup(property.id, dataset.propertyGroupAssignments, dataset.propertyGroups);
        propertiesByMonth.set(`${property.id}::${monthKey}`, {
          propertyId: property.id,
          propertyCode: property.codigo,
          propertyName: property.nombre,
          clientName: property.clientName,
          propertyGroupId: group?.id || null,
          propertyGroupName: group ? (group.displayName || group.name) : null,
          monthKey,
          monthLabel: getMonthLabel(monthKey),
          cleanings: 0,
          checkoutCleanings: 0,
          stayCleanings: 0,
          totalRevenue: 0,
          totalMinutes: 0,
          totalHours: 0,
          requiredCleanerSlots: 0,
          recommendedStaff: property.planningRequiredCleaners || 1,
          peakDailyCleanings: 0,
          peakDailyMinutes: 0,
          cleaningDays: 0,
          weekendCleanings: 0,
          tightWindowCleanings: 0,
          averageRevenuePerCleaning: 0,
          riskLevel: 'low',
          riskReasons: [],
          dailyDemand: new Map(),
        });
      });
    });

    activeTasks.forEach((task) => {
      if (!task.propiedad_id) return;
      const property = activeProperties.find((entry) => entry.id === task.propiedad_id);
      if (!property) return;
      const monthKey = getMonthKey(task.date);
      const entry = propertiesByMonth.get(`${property.id}::${monthKey}`);
      if (!entry) return;
      const durationMinutes = this.getTaskDurationMinutes(task, dataset.properties);
      const requiredCleaners = property.planningRequiredCleaners || 1;
      const revenue = Number(task.coste ?? property.costeServicio ?? 0);
      const daily = entry.dailyDemand.get(task.date) || { cleanings: 0, minutes: 0, slots: 0 };

      entry.cleanings += 1;
      const isStay = isStayCleaningTask(task, property);
      entry.checkoutCleanings += isStay ? 0 : 1;
      entry.stayCleanings += isStay ? 1 : 0;
      entry.totalRevenue += revenue;
      entry.totalMinutes += durationMinutes;
      entry.requiredCleanerSlots += requiredCleaners;
      if (isWeekendDate(task.date)) entry.weekendCleanings += 1;
      if (!this.validateTaskWindow(task, durationMinutes, settings.bufferMinutes).ok) entry.tightWindowCleanings += 1;

      daily.cleanings += 1;
      daily.minutes += durationMinutes * requiredCleaners;
      daily.slots += requiredCleaners;
      entry.dailyDemand.set(task.date, daily);
    });

    const properties = Array.from(propertiesByMonth.values()).map((entry) => {
      const dailyDemand = Array.from(entry.dailyDemand.values());
      const peakDay = dailyDemand.sort((a, b) => b.minutes - a.minutes || b.cleanings - a.cleanings)[0];
      const cleaningDays = entry.dailyDemand.size;
      const baseStaff = Math.max(1, entry.recommendedStaff);
      const staffByPeakMinutes = peakDay ? Math.max(baseStaff, Math.ceil(peakDay.minutes / Math.max(240, settings.fallbackDailyCapacityMinutes * 0.75))) : baseStaff;
      const staffByDaysOff = cleaningDays >= 18 || entry.weekendCleanings >= 6 ? Math.max(staffByPeakMinutes, 2) : staffByPeakMinutes;
      const recommendedStaff = Math.max(staffByDaysOff, peakDay?.slots || 1);
      const riskReasons: string[] = [];

      if (entry.tightWindowCleanings > 0) riskReasons.push(`${entry.tightWindowCleanings} limpieza${entry.tightWindowCleanings === 1 ? '' : 's'} con ventana ajustada.`);
      if (entry.weekendCleanings >= 6) riskReasons.push('Carga frecuente en fines de semana; conviene no depender de una sola persona.');
      if (recommendedStaff >= 3) riskReasons.push('Pico mensual alto: prepara equipo amplio o refuerzo.');
      if (entry.cleanings === 0) riskReasons.push('Sin limpiezas previstas en este mes.');

      const riskLevel: PlanningMonthlyForecastProperty['riskLevel'] =
        entry.cleanings === 0 || riskReasons.length === 0
          ? 'low'
          : recommendedStaff >= 3 || entry.tightWindowCleanings >= 3
            ? 'high'
            : 'medium';
      const publicEntry = { ...entry };
      delete (publicEntry as Partial<typeof publicEntry>).dailyDemand;

      return {
        ...publicEntry,
        totalHours: Number((entry.totalMinutes / 60).toFixed(2)),
        peakDailyCleanings: peakDay?.cleanings || 0,
        peakDailyMinutes: peakDay?.minutes || 0,
        cleaningDays,
        recommendedStaff,
        averageRevenuePerCleaning: entry.cleanings > 0 ? entry.totalRevenue / entry.cleanings : 0,
        riskLevel,
        riskReasons,
      } as PlanningMonthlyForecastProperty;
    });

    const months: PlanningMonthlyForecastMonth[] = monthKeys.map((monthKey) => {
      const monthProperties = properties.filter((property) => property.monthKey === monthKey);
      const monthDates = dateRange.filter((date) => getMonthKey(date) === monthKey);
      const capacity = monthCapacity.get(monthKey);

      return {
        monthKey,
        label: getMonthLabel(monthKey),
        dateFrom: monthDates[0],
        dateTo: monthDates[monthDates.length - 1],
        cleanings: monthProperties.reduce((sum, property) => sum + property.cleanings, 0),
        totalRevenue: monthProperties.reduce((sum, property) => sum + property.totalRevenue, 0),
        totalMinutes: monthProperties.reduce((sum, property) => sum + property.totalMinutes, 0),
        requiredCleanerSlots: monthProperties.reduce((sum, property) => sum + property.requiredCleanerSlots, 0),
        recommendedStaff: Math.max(0, ...monthProperties.map((property) => property.recommendedStaff)),
        activeProperties: monthProperties.filter((property) => property.cleanings > 0).length,
        pressureDays: capacity?.pressureDays || 0,
      };
    });

    return {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      generatedAt: new Date().toISOString(),
      months,
      properties,
      summary: {
        cleanings: months.reduce((sum, month) => sum + month.cleanings, 0),
        totalRevenue: months.reduce((sum, month) => sum + month.totalRevenue, 0),
        totalMinutes: months.reduce((sum, month) => sum + month.totalMinutes, 0),
        totalHours: Number((months.reduce((sum, month) => sum + month.totalMinutes, 0) / 60).toFixed(2)),
        requiredCleanerSlots: months.reduce((sum, month) => sum + month.requiredCleanerSlots, 0),
        recommendedStaffPeak: Math.max(0, ...months.map((month) => month.recommendedStaff)),
        pressureDays: months.reduce((sum, month) => sum + month.pressureDays, 0),
        activeProperties: activeProperties.length,
      },
    };
  }

  async generateRun(input: PlanningGenerateInput): Promise<PlanningPreviewData> {
    const settings = await this.getSettingsForSede(input.sedeId);
    const dataset = await this.loadDataset(input, settings);
    const unassignedTasks = dataset.tasks
      .filter((task) => isActivePlanningTask(task))
      .filter((task) => !settings.excludeExtraordinary || isTouristCleaningTask(task))
      .filter((task) => getTaskCleanerIds(task).length === 0)
      .sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`));

    const proposedIntervals = new Map<string, Array<{ taskId: string; date: string; startTime: string; endTime: string }>>();
    const items: Omit<PlanningRunItem, 'id' | 'runId' | 'createdAt' | 'updatedAt'>[] = [];
    const conflicts: Omit<PlanningConflict, 'id' | 'runId' | 'createdAt'>[] = [];

    for (const task of unassignedTasks) {
      const property = dataset.properties.find((entry) => entry.id === task.propiedad_id);
      if (!property) {
        conflicts.push(this.buildConflict('missing-property', 'La tarea no tiene propiedad vinculada; requiere revisión.', task));
        continue;
      }

      const propertyGroup = this.resolvePropertyGroup(property.id, dataset.propertyGroupAssignments, dataset.propertyGroups);
      if (!propertyGroup) {
        conflicts.push(this.buildConflict('missing-building', `La propiedad ${property.codigo} no está vinculada a un edificio/grupo operativo.`, task, { propertyId: property.id }));
        continue;
      }

      const durationMinutes = this.getTaskDurationMinutes(task, dataset.properties);
      if (durationMinutes <= 0) {
        conflicts.push(this.buildConflict('missing-duration', `La tarea ${property.codigo} no tiene duración operativa válida.`, task, { propertyId: property.id }));
        continue;
      }

      const windowCheck = this.validateTaskWindow(task, durationMinutes, settings.bufferMinutes);
      if (!windowCheck.ok) {
        conflicts.push(this.buildConflict(windowCheck.code, windowCheck.message, task, { propertyId: property.id, propertyCode: property.codigo }));
        continue;
      }

      const requiredCleaners = property.planningRequiredCleaners || 1;
      const candidates = this.buildCandidates({
        task,
        property,
        propertyGroup,
        dataset,
        settings,
        requiredCleaners,
        proposedIntervals,
      });

      const assignable = candidates.filter((candidate) => candidate.score > 0);
      if (assignable.length === 0) {
        conflicts.push(this.buildConflict('no-candidate', `No hay candidatura segura para ${property.codigo}.`, task, {
          propertyId: property.id,
          propertyGroupId: propertyGroup.id,
        }));
        continue;
      }

      if (assignable.length < requiredCleaners) {
        conflicts.push(this.buildConflict('insufficient-team', `La tarea ${property.codigo} requiere ${requiredCleaners} personas y solo hay ${assignable.length} con capacidad segura.`, task, {
          propertyId: property.id,
          propertyGroupId: propertyGroup.id,
          requiredCleaners,
        }));
        continue;
      }

      const selected = assignable.slice(0, requiredCleaners);
      selected.forEach((candidate) => {
        const current = proposedIntervals.get(candidate.cleanerId) || [];
        current.push({
          taskId: task.id,
          date: task.date,
          startTime: task.start_time,
          endTime: task.end_time,
        });
        proposedIntervals.set(candidate.cleanerId, current);
      });

      const roleSource = selected[0]?.roleType || 'manual-review';
      const explanation = this.buildExplanation(selected, propertyGroup, requiredCleaners, task, property);
      const warnings = uniqueBy(selected.flatMap((candidate) => candidate.warnings), (warning) => warning);
      const proposal: PlanningRunItemProposal = {
        taskId: task.id,
        taskDate: task.date,
        propertyId: property.id,
        propertyCode: property.codigo,
        propertyName: property.nombre,
        propertyAddress: property.direccion,
        propertyGroupId: propertyGroup.id,
        propertyGroupName: propertyGroup.displayName || propertyGroup.name,
        startTime: task.start_time,
        endTime: task.end_time,
        durationMinutes,
        checkOut: task.check_out,
        checkIn: task.check_in,
        requiredCleaners,
        explanation,
        warnings,
        roleSource,
        proposedCleaners: selected.map((candidate) => ({
          cleanerId: candidate.cleanerId,
          cleanerName: candidate.cleanerName,
          roleType: candidate.roleType,
          score: candidate.score,
          reasons: candidate.reasons,
          warnings: candidate.warnings,
          projectedAssignedMinutes: candidate.assignedMinutes,
          projectedRemainingMinutes: candidate.remainingMinutes,
        })),
      };

      items.push({
        taskId: task.id,
        propertyId: property.id,
        propertyGroupId: propertyGroup.id,
        proposedCleanerIds: selected.map((candidate) => candidate.cleanerId),
        proposedCleanerNames: selected.map((candidate) => candidate.cleanerName),
        roleSource,
        explanation,
        warnings,
        score: selected.reduce((sum, candidate) => sum + candidate.score, 0) / selected.length,
        proposal,
        status: 'draft',
        appliedAt: null,
      });
    }

    const summary: PlanningRunSummary = {
      totalTasks: unassignedTasks.length,
      proposedTasks: items.length,
      proposedAssignments: items.reduce((sum, item) => sum + item.proposedCleanerIds.length, 0),
      requiredMinutes: unassignedTasks.reduce((sum, task) => sum + this.getTaskDurationMinutes(task, dataset.properties), 0),
      proposedMinutes: items.reduce((sum, item) => sum + item.proposal.durationMinutes, 0),
      conflictCount: conflicts.length,
      deficitMinutes: Math.max(0, unassignedTasks.reduce((sum, task) => sum + this.getTaskDurationMinutes(task, dataset.properties), 0) - items.reduce((sum, item) => sum + item.proposal.durationMinutes, 0)),
      criticalTasks: unassignedTasks.filter((task) => buildCriticality(task, this.getTaskDurationMinutes(task, dataset.properties), settings.bufferMinutes)).length,
    };

    const currentUserId = (await supabase.auth.getUser()).data.user?.id || null;
    const { data: runData, error: runError } = await fromUntypedTable('planning_runs')
      .insert({
        sede_id: input.sedeId,
        date_from: input.dateFrom,
        date_to: input.dateTo,
        status: 'draft',
        summary,
        generated_by: currentUserId,
      })
      .select('*')
      .single();

    if (runError) throw runError;
    const run = mapRun(runData);

    if (items.length > 0) {
      const { error: itemsError } = await fromUntypedTable('planning_run_items').insert(
        items.map((item) => ({
          run_id: run.id,
          task_id: item.taskId,
          property_id: item.propertyId,
          property_group_id: item.propertyGroupId,
          proposed_cleaner_ids: item.proposedCleanerIds,
          proposed_cleaner_names: item.proposedCleanerNames,
          role_source: item.roleSource,
          explanation: item.explanation,
          warnings: item.warnings,
          score: item.score,
          proposal: item.proposal,
          status: item.status,
        })),
      );
      if (itemsError) throw itemsError;
    }

    if (conflicts.length > 0) {
      const { error: conflictsError } = await fromUntypedTable('planning_conflicts').insert(
        conflicts.map((conflict) => ({
          run_id: run.id,
          task_id: conflict.taskId,
          code: conflict.code,
          message: conflict.message,
          details: conflict.details,
        })),
      );
      if (conflictsError) throw conflictsError;
    }

    return this.getPreview(run.id);
  }

  async approveRun(runId: string): Promise<PlanningApprovalResult> {
    const preview = await this.getPreview(runId);
    if (preview.run.status !== 'draft') {
      throw new Error('Solo se pueden aprobar borradores de planificación.');
    }

    const userId = (await supabase.auth.getUser()).data.user?.id || null;
    const cleanerIds = uniqueBy(preview.items.flatMap((item) => item.proposedCleanerIds).map((id) => ({ id })), (entry) => entry.id).map((entry) => entry.id);
    const { data: cleanerRows, error: cleanerError } = await supabase
      .from('cleaners')
      .select('id, name, email')
      .in('id', cleanerIds);
    if (cleanerError) throw cleanerError;
    const cleanersById = new Map((cleanerRows || []).map((row: any) => [row.id, row]));

    for (const item of preview.items) {
      await rpcUntyped('set_task_assignments', {
        _task_id: item.taskId,
        _cleaner_ids: item.proposedCleanerIds,
      });
    }

    const batchesMap = new Map<string, Omit<PlanningNotificationBatch, 'id' | 'runId' | 'createdAt' | 'updatedAt'>>();
    for (const item of preview.items) {
      for (const cleanerId of item.proposedCleanerIds) {
        const cleaner = cleanersById.get(cleanerId);
        if (!cleaner?.email) continue;
        const key = `${preview.run.id}:${cleanerId}:${item.proposal.taskDate}`;
        const existing = batchesMap.get(key);
        const taskPayload = {
          taskId: item.taskId,
          propertyCode: item.proposal.propertyCode,
          propertyName: item.proposal.propertyName,
          address: item.proposal.propertyAddress,
          startTime: item.proposal.startTime,
          endTime: item.proposal.endTime,
          durationMinutes: item.proposal.durationMinutes,
        };
        if (existing) {
          existing.taskIds = uniqueBy([...existing.taskIds, item.taskId].map((taskId) => ({ taskId })), (entry) => entry.taskId).map((entry) => entry.taskId);
          const tasks = ((existing.payload.tasks as any[]) || []).concat(taskPayload);
          existing.payload.tasks = tasks.sort((a, b) => `${a.startTime}`.localeCompare(`${b.startTime}`));
        } else {
          batchesMap.set(key, {
            cleanerId,
            cleanerEmail: cleaner.email,
            cleanerName: cleaner.name,
            taskDate: item.proposal.taskDate,
            taskIds: [item.taskId],
            notificationKey: key,
            payload: {
              cleanerName: cleaner.name,
              taskDate: item.proposal.taskDate,
              tasks: [taskPayload],
            },
            status: 'pending',
            sentAt: null,
          });
        }
      }
    }

    let notificationBatches = 0;
    if (batchesMap.size > 0) {
      const insertRows = Array.from(batchesMap.values()).map((batch) => ({
        run_id: preview.run.id,
        cleaner_id: batch.cleanerId,
        cleaner_email: batch.cleanerEmail,
        cleaner_name: batch.cleanerName,
        task_date: batch.taskDate,
        task_ids: batch.taskIds,
        notification_key: batch.notificationKey,
        payload: batch.payload,
        status: batch.status,
      }));
      const { data: insertedBatches, error: batchError } = await fromUntypedTable('planning_notification_batches')
        .insert(insertRows)
        .select('*');
      if (batchError) throw batchError;
      notificationBatches = (insertedBatches as any[])?.length || 0;

      await Promise.allSettled(((insertedBatches as any[]) || []).map(async (row) => {
        try {
          await supabase.functions.invoke('send-planning-batch-email', {
            body: {
              cleanerEmail: row.cleaner_email,
              cleanerName: row.cleaner_name,
              taskDate: row.task_date,
              tasks: row.payload?.tasks || [],
            },
          });
          await fromUntypedTable('planning_notification_batches')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', row.id);
        } catch (error) {
          await fromUntypedTable('planning_notification_batches')
            .update({ status: 'failed' })
            .eq('id', row.id);
        }
      }));
    }

    const nowIso = new Date().toISOString();
    await fromUntypedTable('planning_run_items')
      .update({ status: 'applied', applied_at: nowIso })
      .eq('run_id', preview.run.id);

    const { data: updatedRun, error: runError } = await fromUntypedTable('planning_runs')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: nowIso,
      })
      .eq('id', preview.run.id)
      .select('*')
      .single();

    if (runError) throw runError;

    return {
      run: mapRun(updatedRun),
      appliedTasks: preview.items.length,
      notificationBatches,
    };
  }

  async discardRun(runId: string): Promise<PlanningRun> {
    const { data, error } = await fromUntypedTable('planning_runs')
      .update({
        status: 'discarded',
        discarded_at: new Date().toISOString(),
      })
      .eq('id', runId)
      .select('*')
      .single();
    if (error) throw error;

    await fromUntypedTable('planning_run_items')
      .update({ status: 'discarded' })
      .eq('run_id', runId)
      .eq('status', 'draft');

    return mapRun(data);
  }

  async applyReplacementToTask(input: {
    taskId: string;
    replacementCleanerIds: string[];
    replacedCleanerIds: string[];
    keepCleanerIds?: string[];
  }): Promise<PlanningReplacementApplyResult> {
    const currentTask = await supabase
      .from('tasks')
      .select('id, cleaner_id, cleaner, task_assignments(cleaner_id, cleaner_name)')
      .eq('id', input.taskId)
      .single();

    if (currentTask.error) throw currentTask.error;

    const currentCleanerIds = getTaskCleanerIds(currentTask.data as RawPlanningTask);
    const baseCleanerIds = (input.keepCleanerIds && input.keepCleanerIds.length > 0
      ? input.keepCleanerIds
      : currentCleanerIds.filter((cleanerId) => !input.replacedCleanerIds.includes(cleanerId)));
    const nextCleanerIds = uniqueBy(
      [...baseCleanerIds, ...input.replacementCleanerIds].map((cleanerId) => ({ cleanerId })),
      (entry) => entry.cleanerId,
    ).map((entry) => entry.cleanerId);

    await rpcUntyped('set_task_assignments', {
      _task_id: input.taskId,
      _cleaner_ids: nextCleanerIds,
    });

    const { data: cleanerRows, error: cleanerError } = await supabase
      .from('cleaners')
      .select('id, name')
      .in('id', nextCleanerIds);
    if (cleanerError) throw cleanerError;

    return {
      taskId: input.taskId,
      assignedCleanerIds: nextCleanerIds,
      assignedCleanerNames: ((cleanerRows as any[]) || []).map((row) => row.name),
      replacedCleanerIds: input.replacedCleanerIds,
    };
  }

  async getPlanningWorkers(sedeId: string): Promise<PlanningWorkerSummary[]> {
    const settings = await this.getSettingsForSede(sedeId);
    const dataset = await this.loadDataset({
      sedeId,
      dateFrom: formatMadridDate(new Date()),
      dateTo: formatMadridDate(new Date(Date.now() + 13 * 86400000)),
    }, settings);

    return dataset.cleaners.map((cleaner) => {
      const buildingAssignments = dataset.cleanerGroupAssignments.filter(
        (assignment) => assignment.cleanerId === cleaner.id && assignment.isActive,
      );
      const assignedBuildingNames = uniqueBy(
        buildingAssignments
          .map((assignment) =>
            dataset.propertyGroups.find((group) => group.id === assignment.propertyGroupId),
          )
          .filter(Boolean)
          .map((group) => group?.displayName || group?.name || ''),
        (name) => name,
      ).filter(Boolean);

      return {
        id: cleaner.id,
        name: cleaner.name,
        email: cleaner.email,
        zone: cleaner.planningZone ?? null,
        contractHoursPerWeek: cleaner.contractHoursPerWeek ?? null,
        maxDailyMinutes: cleaner.planningMaxDailyMinutes ?? settings.fallbackDailyCapacityMinutes,
        activeAbsenceCount: dataset.absences.filter((absence) => absence.cleanerId === cleaner.id).length,
        fixedDaysOffCount: dataset.fixedDaysOff.filter((entry) => entry.cleanerId === cleaner.id && entry.isActive).length,
        maintenanceCount: dataset.maintenanceCleanings.filter((entry) => entry.cleanerId === cleaner.id && entry.isActive).length,
        primaryBuildingCount: buildingAssignments.filter((entry) => (entry.roleType || 'primary') === 'primary').length,
        secondaryBuildingCount: buildingAssignments.filter((entry) => entry.roleType === 'secondary').length,
        backupBuildingCount: buildingAssignments.filter((entry) => entry.roleType === 'backup').length,
        assignedBuildingNames,
        planningCanHandleLinenLoad: cleaner.planningCanHandleLinenLoad ?? true,
        planningCanHandleComplexCleanings: cleaner.planningCanHandleComplexCleanings ?? true,
        planningOperationalRestrictions: cleaner.planningOperationalRestrictions ?? null,
      };
    });
  }

  async getPlanningBuildings(sedeId: string): Promise<PlanningBuildingSummary[]> {
    const [groups, assignments, cleaners] = await Promise.all([
      fromUntypedTable('property_groups').select('*').eq('is_active', true).order('name'),
      fromUntypedTable('property_group_assignments').select('property_group_id, property_id, properties(sede_id)'),
      fromUntypedTable('cleaner_group_assignments').select('*').eq('is_active', true),
    ]);

    if (groups.error) throw groups.error;
    if (assignments.error) throw assignments.error;
    if (cleaners.error) throw cleaners.error;

    const allowedAssignments = ((assignments.data as any[]) || []).filter((row) => row.properties?.sede_id === sedeId);
    const cleanerAssignments = ((cleaners.data as any[]) || []).map(mapCleanerGroupAssignment);

    return ((groups.data as any[]) || [])
      .map(mapPropertyGroup)
      .filter((group) => {
        const hasSedeProperty = allowedAssignments.some((row) => row.property_group_id === group.id);
        return hasSedeProperty || !sedeId;
      })
      .map((group) => {
        const groupAssignments = cleanerAssignments.filter((entry) => entry.propertyGroupId === group.id);
        return {
          id: group.id,
          name: group.name,
          displayName: group.displayName ?? null,
          internalCode: group.internalCode ?? null,
          zone: group.zone ?? null,
          propertyCount: allowedAssignments.filter((row) => row.property_group_id === group.id).length,
          titularCount: groupAssignments.filter((entry) => (entry.roleType ?? 'primary') === 'primary').length,
          substituteCount: groupAssignments.filter((entry) => entry.roleType === 'secondary').length,
          backupCount: groupAssignments.filter((entry) => entry.roleType === 'backup').length,
          isActive: group.isActive,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async updateWorkerPlanningProfile(cleanerId: string, updates: Partial<Cleaner>): Promise<Cleaner> {
    const payload: Record<string, unknown> = {};
    if (updates.contractHoursPerWeek !== undefined) payload.contract_hours_per_week = updates.contractHoursPerWeek;
    if (updates.planningMaxDailyMinutes !== undefined) payload.planning_max_daily_minutes = updates.planningMaxDailyMinutes;
    if (updates.planningZone !== undefined) payload.planning_zone = updates.planningZone;
    if (updates.planningOperationalRestrictions !== undefined) payload.planning_operational_restrictions = updates.planningOperationalRestrictions;
    if (updates.planningCanHandleLinenLoad !== undefined) payload.planning_can_handle_linen_load = updates.planningCanHandleLinenLoad;
    if (updates.planningCanHandleComplexCleanings !== undefined) payload.planning_can_handle_complex_cleanings = updates.planningCanHandleComplexCleanings;

    const { data, error } = await supabase
      .from('cleaners')
      .update(payload)
      .eq('id', cleanerId)
      .select('*')
      .single();
    if (error) throw error;
    return mapCleanerFromDB(data);
  }

  async updatePropertyPlanningProfile(propertyId: string, updates: Partial<Property>): Promise<Property> {
    const payload: Record<string, unknown> = {};
    if (updates.planningEstimatedCheckoutMinutes !== undefined) payload.planning_estimated_checkout_minutes = updates.planningEstimatedCheckoutMinutes;
    if (updates.planningEstimatedStayMinutes !== undefined) payload.planning_estimated_stay_minutes = updates.planningEstimatedStayMinutes;
    if (updates.planningRequiredCleaners !== undefined) payload.planning_required_cleaners = updates.planningRequiredCleaners;
    if (updates.planningComplexity !== undefined) payload.planning_complexity = updates.planningComplexity;
    if (updates.planningRequiresLinenLoad !== undefined) payload.planning_requires_linen_load = updates.planningRequiresLinenLoad;
    if (updates.planningRequiresAmenitiesLoad !== undefined) payload.planning_requires_amenities_load = updates.planningRequiresAmenitiesLoad;
    if (updates.planningSpecialInstructions !== undefined) payload.planning_special_instructions = updates.planningSpecialInstructions;

    const { data, error } = await supabase
      .from('properties')
      .update(payload)
      .eq('id', propertyId)
      .select('*')
      .single();
    if (error) throw error;
    return mapPropertyFromDB(data);
  }

  private async loadDataset(input: PlanningGenerateInput, settings: PlanningSettings): Promise<PlanningDataset> {
    const [{ data: tasksData, error: tasksError }, { data: propertiesData, error: propertiesError }, { data: cleanersData, error: cleanersError }, { data: groupsData, error: groupsError }, { data: groupAssignmentsData, error: groupAssignmentsError }, { data: cleanerAssignmentsData, error: cleanerAssignmentsError }, { data: propertyPreferredData, error: propertyPreferredError }, { data: weeklyAvailabilityData, error: weeklyAvailabilityError }, { data: absencesData, error: absencesError }, { data: fixedDaysData, error: fixedDaysError }, { data: maintenanceData, error: maintenanceError }, { data: vacationRequestsData, error: vacationRequestsError }] = await Promise.all([
      supabase
        .from('tasks')
        .select(`
          id, property, address, date, start_time, end_time, check_in, check_out, type, status, cleaner_id, cleaner, duracion, propiedad_id, cliente_id, coste, notes,
          task_assignments(cleaner_id, cleaner_name),
          properties(*)
        `)
        .eq('sede_id', input.sedeId)
        .gte('date', input.dateFrom)
        .lte('date', input.dateTo)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true }),
      supabase
        .from('properties')
        .select(`
          *,
          clients:cliente_id (
            nombre,
            is_active
          )
        `)
        .eq('sede_id', input.sedeId)
        .order('codigo'),
      supabase.from('cleaners').select('*').eq('sede_id', input.sedeId).eq('is_active', true).order('sort_order', { nullsFirst: false }).order('name'),
      fromUntypedTable('property_groups').select('*').eq('is_active', true).order('name'),
      fromUntypedTable('property_group_assignments').select('property_group_id, property_id, properties(sede_id)'),
      fromUntypedTable('cleaner_group_assignments').select('*').eq('is_active', true).order('priority'),
      fromUntypedTable('property_preferred_cleaners').select('*'),
      supabase.from('cleaner_availability').select('cleaner_id, day_of_week, is_available, start_time, end_time'),
      supabase.from('worker_absences').select('*').lte('start_date', input.dateTo).gte('end_date', input.dateFrom),
      supabase.from('worker_fixed_days_off').select('*').eq('is_active', true),
      supabase.from('worker_maintenance_cleanings').select('*').eq('is_active', true),
      fromUntypedTable('vacation_requests').select('cleaner_id, start_date, end_date, status, request_type, notes').eq('status', 'approved').lte('start_date', input.dateTo).gte('end_date', input.dateFrom),
    ]);

    if (tasksError) throw tasksError;
    if (propertiesError) throw propertiesError;
    if (cleanersError) throw cleanersError;
    if (groupsError) throw groupsError;
    if (groupAssignmentsError) throw groupAssignmentsError;
    if (cleanerAssignmentsError) throw cleanerAssignmentsError;
    if (propertyPreferredError) throw propertyPreferredError;
    if (weeklyAvailabilityError) throw weeklyAvailabilityError;
    if (absencesError) throw absencesError;
    if (fixedDaysError) throw fixedDaysError;
    if (maintenanceError) throw maintenanceError;
    if (vacationRequestsError) throw vacationRequestsError;

    const extraAbsences = ((vacationRequestsData as VacationRequestRow[]) || []).map((request) => ({
      id: `vac-${request.cleaner_id}-${request.start_date}-${request.end_date}`,
      cleanerId: request.cleaner_id,
      startDate: request.start_date,
      endDate: request.end_date,
      startTime: null,
      endTime: null,
      absenceType: request.request_type === 'sick' ? 'sick' : 'vacation',
      locationName: null,
      notes: request.notes || 'Vacación aprobada',
      createdBy: null,
      createdAt: '',
      updatedAt: '',
    } as WorkerAbsence));

    return {
      settings,
      tasks: (tasksData as RawPlanningTask[]) || [],
      properties: ((propertiesData as any[]) || []).map(mapPropertyFromDB),
      cleaners: ((cleanersData as any[]) || []).map(mapCleanerFromDB),
      propertyGroups: ((groupsData as any[]) || []).map(mapPropertyGroup),
      propertyGroupAssignments: ((groupAssignmentsData as any[]) || [])
        .filter((row) => row.properties?.sede_id === input.sedeId)
        .map((row) => ({ property_group_id: row.property_group_id, property_id: row.property_id })),
      cleanerGroupAssignments: ((cleanerAssignmentsData as any[]) || []).map(mapCleanerGroupAssignment),
      propertyPreferredCleaners: ((propertyPreferredData as any[]) || []).map((row) => ({
        property_id: row.property_id,
        cleaner_id: row.cleaner_id,
        priority: row.priority,
        notes: row.notes,
      })),
      weeklyAvailability: (weeklyAvailabilityData as WeeklyAvailabilityRow[]) || [],
      absences: [ ...(((absencesData as any[]) || []).map(mapAbsence)), ...extraAbsences ],
      fixedDaysOff: ((fixedDaysData as any[]) || []).map(mapFixedDayOff),
      maintenanceCleanings: ((maintenanceData as any[]) || []).map(mapMaintenance),
    };
  }

  private resolvePropertyGroup(propertyId: string, assignments: Array<{ property_group_id: string; property_id: string }>, groups: PropertyGroup[]) {
    const groupId = assignments.find((assignment) => assignment.property_id === propertyId)?.property_group_id;
    if (!groupId) return null;
    return groups.find((group) => group.id === groupId) || null;
  }

  private buildAbsenceReplacements(args: {
    dataset: PlanningDataset;
    settings: PlanningSettings;
    dateFrom: string;
    dateTo: string;
  }): PlanningAbsenceReplacement[] {
    const relevantAbsences = args.dataset.absences
      .filter((absence) => absence.startDate <= args.dateTo && absence.endDate >= args.dateFrom)
      .sort((a, b) => `${a.startDate}-${a.cleanerId}`.localeCompare(`${b.startDate}-${b.cleanerId}`));

    return relevantAbsences.map((absence) => {
      const absentCleaner = args.dataset.cleaners.find((cleaner) => cleaner.id === absence.cleanerId);
      const affectedTasks = args.dataset.tasks
        .filter((task) => isActivePlanningTask(task))
        .filter((task) => task.date >= args.dateFrom && task.date <= args.dateTo)
        .filter((task) => getTaskCleanerIds(task).includes(absence.cleanerId))
        .filter((task) => this.doesAbsenceAffectTask(absence, task))
        .sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`));

      const items: PlanningAbsenceReplacementTask[] = affectedTasks.flatMap((task) => {
        const property = args.dataset.properties.find((entry) => entry.id === task.propiedad_id);
        const propertyGroup = property
          ? this.resolvePropertyGroup(property.id, args.dataset.propertyGroupAssignments, args.dataset.propertyGroups)
          : null;
        if (!property || !propertyGroup) return [];

        const requiredCleaners = property.planningRequiredCleaners || 1;
        const assignedCleanerIds = getTaskCleanerIds(task);
        const availableAssignedCleanerIds = assignedCleanerIds.filter((cleanerId) => {
          if (cleanerId === absence.cleanerId) return false;
          const cleanerAbsence = args.dataset.absences.find((entry) => entry.cleanerId === cleanerId && this.doesAbsenceAffectTask(entry, task));
          return !cleanerAbsence;
        });
        const missingCleaners = Math.max(0, requiredCleaners - availableAssignedCleanerIds.length);
        if (missingCleaners === 0) return [];

        const candidates = this.buildCandidates({
          task,
          property,
          propertyGroup,
          dataset: args.dataset,
          settings: args.settings,
          requiredCleaners: missingCleaners,
          proposedIntervals: new Map(),
        }).filter((candidate) => !assignedCleanerIds.includes(candidate.cleanerId) && candidate.cleanerId !== absence.cleanerId);

        const recommendedCleaners = candidates.slice(0, missingCleaners).map((candidate) => ({
          cleanerId: candidate.cleanerId,
          cleanerName: candidate.cleanerName,
          roleType: candidate.roleType,
          score: candidate.score,
          reasons: candidate.reasons,
          warnings: candidate.warnings,
          projectedAssignedMinutes: candidate.assignedMinutes,
          projectedRemainingMinutes: candidate.remainingMinutes,
        }));

        const warningSet = new Set<string>();
        if (recommendedCleaners.length < missingCleaners) {
          warningSet.add('No hay sustitución completa; requiere revisión manual.');
        }
        recommendedCleaners.forEach((candidate) => candidate.warnings.forEach((warning) => warningSet.add(warning)));
        if (recommendedCleaners.some((candidate) => candidate.roleType === 'building-backup')) {
          warningSet.add('La propuesta usa backup para mantener cobertura.');
        }
        if (recommendedCleaners.some((candidate) => candidate.roleType === 'same-zone')) {
          warningSet.add('Parte de la cobertura sale de la misma zona, no del equipo titular.');
        }

        const availableAssignedCleanerNames = availableAssignedCleanerIds
          .map((cleanerId) => args.dataset.cleaners.find((cleaner) => cleaner.id === cleanerId)?.name || null)
          .filter(Boolean) as string[];

        return [{
          taskId: task.id,
          taskDate: task.date,
          propertyId: property.id,
          propertyCode: property.codigo,
          propertyName: property.nombre,
          propertyGroupId: propertyGroup.id,
          propertyGroupName: propertyGroup.displayName || propertyGroup.name,
          startTime: task.start_time,
          endTime: task.end_time,
          requiredCleaners,
          assignedCleanerIds,
          assignedCleanerNames: assignedCleanerIds
            .map((cleanerId) => args.dataset.cleaners.find((cleaner) => cleaner.id === cleanerId)?.name || null)
            .filter(Boolean) as string[],
          availableAssignedCleanerIds,
          availableAssignedCleanerNames,
          missingCleaners,
          explanation: recommendedCleaners.length > 0
            ? `Sustitución sugerida para ${property.codigo}: ${recommendedCleaners.map((candidate) => candidate.cleanerName).join(', ')} por cobertura, disponibilidad y ajuste con el edificio.`
            : `No hay sustituta segura para ${property.codigo}; la tarea queda en revisión manual.`,
          warnings: Array.from(warningSet),
          recommendedCleaners,
        }];
      });

      return {
        absenceId: absence.id,
        cleanerId: absence.cleanerId,
        cleanerName: absentCleaner?.name || 'Trabajadora no encontrada',
        absenceType: absence.absenceType,
        startDate: absence.startDate,
        endDate: absence.endDate,
        affectedTasks: items.length,
        affectedBuildings: uniqueBy(items.map((item) => ({ name: item.propertyGroupName || item.propertyCode })), (entry) => entry.name).map((entry) => entry.name),
        items,
      };
    }).filter((absence) => absence.items.length > 0);
  }

  private buildPredictiveAlerts(args: {
    dataset: PlanningDataset;
    settings: PlanningSettings;
    overviewDays: PlanningOverviewDay[];
    unassignedTasks: RawPlanningTask[];
    substitutions: PlanningAbsenceReplacement[];
    dateFrom: string;
    dateTo: string;
  }): PlanningPredictiveAlert[] {
    const alerts: PlanningPredictiveAlert[] = [];

    args.overviewDays
      .filter((day) => day.deficitMinutes > 0 || day.unassigned > 0)
      .sort((a, b) => b.deficitMinutes - a.deficitMinutes || b.unassigned - a.unassigned)
      .slice(0, 3)
      .forEach((day) => {
        alerts.push({
          id: `capacity-${day.date}`,
          severity: day.deficitMinutes > 60 || day.unassigned > 2 ? 'critical' : 'warning',
          category: 'capacity',
          title: `${formatPlanningDateLabel(day.date)} faltará capacidad`,
          message: `${hoursLabel(day.requiredMinutes)} necesarias frente a ${hoursLabel(day.availableMinutes)} disponibles. Quedan ${day.unassigned} tareas sin cubrir.`,
          date: day.date,
          count: day.unassigned,
        });
      });

    args.dataset.propertyGroups.forEach((group) => {
      const groupAssignments = args.dataset.cleanerGroupAssignments.filter((entry) => entry.propertyGroupId === group.id && entry.isActive);
      const propertyCount = args.dataset.propertyGroupAssignments.filter((entry) => entry.property_group_id === group.id).length;
      if (propertyCount === 0) return;

      const titulares = groupAssignments.filter((entry) => (entry.roleType || 'primary') === 'primary');
      const suplentes = groupAssignments.filter((entry) => entry.roleType === 'secondary');
      const backups = groupAssignments.filter((entry) => entry.roleType === 'backup');

      if (titulares.length === 1) {
        const titular = args.dataset.cleaners.find((cleaner) => cleaner.id === titulares[0].cleanerId);
        alerts.push({
          id: `dependency-${group.id}`,
          severity: 'warning',
          category: 'building-dependency',
          title: `${group.displayName || group.name} depende demasiado de una sola trabajadora`,
          message: `Solo ${titular?.name || 'una titular'} sostiene la cobertura principal. Conviene reforzar suplentes o backups.`,
          propertyGroupId: group.id,
          propertyGroupName: group.displayName || group.name,
          cleanerId: titular?.id,
          cleanerName: titular?.name,
        });
      }

      if (titulares.length > 0 && suplentes.length === 0 && backups.length === 0) {
        alerts.push({
          id: `coverage-${group.id}`,
          severity: 'critical',
          category: 'building-coverage',
          title: `${group.displayName || group.name} quedará descubierto si falla una titular`,
          message: 'No hay suplentes ni backups activos para este edificio en la configuración actual.',
          propertyGroupId: group.id,
          propertyGroupName: group.displayName || group.name,
        });
      }
    });

    const criticalUnassignedTasks = args.unassignedTasks.filter((task) => {
      const duration = this.getTaskDurationMinutes(task, args.dataset.properties);
      return buildCriticality(task, duration, args.settings.bufferMinutes);
    });

    if (criticalUnassignedTasks.length > 0) {
      alerts.push({
        id: 'critical-no-candidate',
        severity: 'critical',
        category: 'critical-task',
        title: `Hay ${criticalUnassignedTasks.length} tareas críticas aún sin cubrir`,
        message: 'Hay tareas con margen operativo ajustado que necesitan revisión prioritaria en la planificación.',
        count: criticalUnassignedTasks.length,
      });
    }

    const urgentSubstitutions = args.substitutions.reduce((sum, absence) => sum + absence.items.length, 0);
    if (urgentSubstitutions > 0) {
      alerts.push({
        id: 'absence-substitutions',
        severity: urgentSubstitutions >= 3 ? 'critical' : 'warning',
        category: 'absence',
        title: `Hay ${urgentSubstitutions} tareas sin cubrir por ausencias`,
        message: 'Revisa la pestaña de Cobertura para cubrir esos huecos antes de que lleguen al calendario.',
        count: urgentSubstitutions,
      });
    }

    return alerts.sort((a, b) => {
      const severityWeight = { critical: 3, warning: 2, info: 1 };
      return severityWeight[b.severity] - severityWeight[a.severity] || (b.count || 0) - (a.count || 0);
    }).slice(0, 8);
  }

  private async buildPerformanceOverview(args: {
    sedeId: string;
    dataset: PlanningDataset;
    settings: PlanningSettings;
    daySummaries: PlanningOverviewDay[];
  }): Promise<PlanningPerformanceOverview> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sinceIso = thirtyDaysAgo.toISOString();

    const { data: runsData, error: runsError } = await fromUntypedTable('planning_runs')
      .select('id, status, summary, created_at, approved_at')
      .eq('sede_id', args.sedeId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false });
    if (runsError) throw runsError;

    const runRows = (runsData as any[]) || [];
    const approvedRuns = runRows.filter((row) => row.status === 'approved');
    const approvedRunIds = approvedRuns.map((row) => row.id);

    let conflictRows: any[] = [];
    if (runRows.length > 0) {
      const { data: conflictsData, error: conflictsError } = await fromUntypedTable('planning_conflicts')
        .select('run_id, details')
        .in('run_id', runRows.map((row) => row.id));
      if (conflictsError) throw conflictsError;
      conflictRows = (conflictsData as any[]) || [];
    }

    const plannedTasks = approvedRuns.reduce((sum, row) => sum + Number(row.summary?.proposedTasks || 0), 0);
    const totalApprovedTasks = approvedRuns.reduce((sum, row) => sum + Number(row.summary?.totalTasks || 0), 0);
    const automationRate = totalApprovedTasks > 0 ? Math.round((plannedTasks / totalApprovedTasks) * 100) : 0;

    const buildingNames = new Map(args.dataset.propertyGroups.map((group) => [group.id, group.displayName || group.name]));
    const conflictCountByBuilding = new Map<string, number>();
    conflictRows.forEach((row) => {
      const groupId = row.details?.propertyGroupId || 'unknown';
      conflictCountByBuilding.set(groupId, (conflictCountByBuilding.get(groupId) || 0) + 1);
    });

    const workerLoadMap = new Map<string, { cleanerId: string; cleanerName: string; maxDailyMinutes: number; peakMinutes: number; affectedDays: Set<string> }>();
    args.dataset.tasks
      .filter((task) => isActivePlanningTask(task))
      .forEach((task) => {
        const durationMinutes = this.getTaskDurationMinutes(task, args.dataset.properties);
        getTaskCleanerIds(task).forEach((cleanerId) => {
          const cleaner = args.dataset.cleaners.find((entry) => entry.id === cleanerId);
          if (!cleaner) return;
          const key = `${cleanerId}:${task.date}`;
          const existing = workerLoadMap.get(key) || {
            cleanerId,
            cleanerName: cleaner.name,
            maxDailyMinutes: cleaner.planningMaxDailyMinutes || args.settings.fallbackDailyCapacityMinutes,
            peakMinutes: 0,
            affectedDays: new Set<string>(),
          };
          existing.peakMinutes += durationMinutes;
          existing.affectedDays.add(task.date);
          workerLoadMap.set(key, existing);
        });
      });

    const aggregatedWorkerLoad = new Map<string, { cleanerId: string; cleanerName: string; maxDailyMinutes: number; peakMinutes: number; affectedDays: Set<string> }>();
    workerLoadMap.forEach((entry) => {
      const current = aggregatedWorkerLoad.get(entry.cleanerId) || {
        cleanerId: entry.cleanerId,
        cleanerName: entry.cleanerName,
        maxDailyMinutes: entry.maxDailyMinutes,
        peakMinutes: 0,
        affectedDays: new Set<string>(),
      };
      current.peakMinutes = Math.max(current.peakMinutes, entry.peakMinutes);
      entry.affectedDays.forEach((day) => current.affectedDays.add(day));
      aggregatedWorkerLoad.set(entry.cleanerId, current);
    });

    return {
      automationRate,
      approvedRuns: approvedRuns.length,
      plannedTasks,
      buildingsWithMostConflicts: Array.from(conflictCountByBuilding.entries())
        .map(([groupId, conflictCount]) => ({
          propertyGroupId: groupId === 'unknown' ? null : groupId,
          propertyGroupName: groupId === 'unknown' ? 'Sin edificio identificado' : (buildingNames.get(groupId) || 'Edificio no encontrado'),
          conflictCount,
        }))
        .sort((a, b) => b.conflictCount - a.conflictCount)
        .slice(0, 5),
      overloadedWorkers: Array.from(aggregatedWorkerLoad.values())
        .map((entry) => ({
          cleanerId: entry.cleanerId,
          cleanerName: entry.cleanerName,
          assignedMinutes: entry.peakMinutes,
          maxDailyMinutes: entry.maxDailyMinutes,
          utilizationPercent: entry.maxDailyMinutes > 0 ? Math.round((entry.peakMinutes / entry.maxDailyMinutes) * 100) : 0,
          affectedDays: entry.affectedDays.size,
        }))
        .filter((entry) => entry.utilizationPercent >= 85)
        .sort((a, b) => b.utilizationPercent - a.utilizationPercent || b.assignedMinutes - a.assignedMinutes)
        .slice(0, 5),
      pressureDays: args.daySummaries
        .map((day) => ({
          date: day.date,
          deficitMinutes: day.deficitMinutes,
          unassigned: day.unassigned,
          criticalTasks: day.criticalTasks,
          requiredMinutes: day.requiredMinutes,
          availableMinutes: day.availableMinutes,
          pressureScore: day.deficitMinutes + (day.unassigned * 90) + (day.criticalTasks * 60),
        }))
        .sort((a, b) => b.pressureScore - a.pressureScore)
        .slice(0, 5),
      estimatedTimeSavedMinutes: plannedTasks * ESTIMATED_MANUAL_PLANNING_MINUTES_PER_TASK,
    };
  }

  private buildFallbackPerformanceOverview(daySummaries: PlanningOverviewDay[]): PlanningPerformanceOverview {
    return {
      automationRate: 0,
      approvedRuns: 0,
      plannedTasks: 0,
      buildingsWithMostConflicts: [],
      overloadedWorkers: [],
      pressureDays: daySummaries
        .map((day) => ({
          date: day.date,
          deficitMinutes: day.deficitMinutes,
          unassigned: day.unassigned,
          criticalTasks: day.criticalTasks,
          requiredMinutes: day.requiredMinutes,
          availableMinutes: day.availableMinutes,
          pressureScore: day.deficitMinutes + (day.unassigned * 90) + (day.criticalTasks * 60),
        }))
        .sort((a, b) => b.pressureScore - a.pressureScore)
        .slice(0, 5),
      estimatedTimeSavedMinutes: 0,
    };
  }

  private getTaskDurationMinutes(task: RawPlanningTask, properties: Property[]) {
    const property = properties.find((entry) => entry.id === task.propiedad_id);
    return task.duracion
      || property?.planningEstimatedCheckoutMinutes
      || property?.duracionServicio
      || 0;
  }

  private buildScenario(args: {
    tasks: RawPlanningTask[];
    dataset: PlanningDataset;
    settings: PlanningSettings;
  }): PlanningScenario {
    const unassignedTasks = [...args.tasks].sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`));
    const proposedIntervals = new Map<string, Array<{ taskId: string; date: string; startTime: string; endTime: string }>>();
    const items: Omit<PlanningRunItem, 'id' | 'runId' | 'createdAt' | 'updatedAt'>[] = [];
    const conflicts: Omit<PlanningConflict, 'id' | 'runId' | 'createdAt'>[] = [];

    for (const task of unassignedTasks) {
      const property = args.dataset.properties.find((entry) => entry.id === task.propiedad_id);
      if (!property) {
        conflicts.push(this.buildConflict('missing-property', 'La tarea no tiene propiedad vinculada; requiere revisión.', task));
        continue;
      }

      const propertyGroup = this.resolvePropertyGroup(property.id, args.dataset.propertyGroupAssignments, args.dataset.propertyGroups);
      if (!propertyGroup) {
        conflicts.push(this.buildConflict('missing-building', `La propiedad ${property.codigo} no está vinculada a un edificio/grupo operativo.`, task, { propertyId: property.id }));
        continue;
      }

      const durationMinutes = this.getTaskDurationMinutes(task, args.dataset.properties);
      if (durationMinutes <= 0) {
        conflicts.push(this.buildConflict('missing-duration', `La tarea ${property.codigo} no tiene duración operativa válida.`, task, { propertyId: property.id }));
        continue;
      }

      const windowCheck = this.validateTaskWindow(task, durationMinutes, args.settings.bufferMinutes);
      if (!windowCheck.ok) {
        conflicts.push(this.buildConflict(windowCheck.code, windowCheck.message, task, { propertyId: property.id, propertyCode: property.codigo }));
        continue;
      }

      const requiredCleaners = property.planningRequiredCleaners || 1;
      const candidates = this.buildCandidates({
        task,
        property,
        propertyGroup,
        dataset: args.dataset,
        settings: args.settings,
        requiredCleaners,
        proposedIntervals,
      });

      const assignable = candidates.filter((candidate) => candidate.score > 0);
      if (assignable.length === 0) {
        conflicts.push(this.buildConflict('no-candidate', `No hay candidatura segura para ${property.codigo}.`, task, {
          propertyId: property.id,
          propertyGroupId: propertyGroup.id,
        }));
        continue;
      }

      if (assignable.length < requiredCleaners) {
        conflicts.push(this.buildConflict('insufficient-team', `La tarea ${property.codigo} requiere ${requiredCleaners} personas y solo hay ${assignable.length} con capacidad segura.`, task, {
          propertyId: property.id,
          propertyGroupId: propertyGroup.id,
          requiredCleaners,
        }));
        continue;
      }

      const selected = assignable.slice(0, requiredCleaners);
      selected.forEach((candidate) => {
        const current = proposedIntervals.get(candidate.cleanerId) || [];
        current.push({
          taskId: task.id,
          date: task.date,
          startTime: task.start_time,
          endTime: task.end_time,
        });
        proposedIntervals.set(candidate.cleanerId, current);
      });

      const roleSource = selected[0]?.roleType || 'manual-review';
      const explanation = this.buildExplanation(selected, propertyGroup, requiredCleaners, task, property);
      const warnings = uniqueBy(selected.flatMap((candidate) => candidate.warnings), (warning) => warning);
      const proposal: PlanningRunItemProposal = {
        taskId: task.id,
        taskDate: task.date,
        propertyId: property.id,
        propertyCode: property.codigo,
        propertyName: property.nombre,
        propertyAddress: property.direccion,
        propertyGroupId: propertyGroup.id,
        propertyGroupName: propertyGroup.displayName || propertyGroup.name,
        startTime: task.start_time,
        endTime: task.end_time,
        durationMinutes,
        checkOut: task.check_out,
        checkIn: task.check_in,
        requiredCleaners,
        explanation,
        warnings,
        roleSource,
        proposedCleaners: selected.map((candidate) => ({
          cleanerId: candidate.cleanerId,
          cleanerName: candidate.cleanerName,
          roleType: candidate.roleType,
          score: candidate.score,
          reasons: candidate.reasons,
          warnings: candidate.warnings,
          projectedAssignedMinutes: candidate.assignedMinutes,
          projectedRemainingMinutes: candidate.remainingMinutes,
        })),
      };

      items.push({
        taskId: task.id,
        propertyId: property.id,
        propertyGroupId: propertyGroup.id,
        proposedCleanerIds: selected.map((candidate) => candidate.cleanerId),
        proposedCleanerNames: selected.map((candidate) => candidate.cleanerName),
        roleSource,
        explanation,
        warnings,
        score: selected.reduce((sum, candidate) => sum + candidate.score, 0) / selected.length,
        proposal,
        status: 'draft',
        appliedAt: null,
      });
    }

    return {
      items,
      conflicts,
      unassignedTasks,
      summary: {
        totalTasks: unassignedTasks.length,
        proposedTasks: items.length,
        proposedAssignments: items.reduce((sum, item) => sum + item.proposedCleanerIds.length, 0),
        requiredMinutes: unassignedTasks.reduce((sum, task) => sum + this.getTaskDurationMinutes(task, args.dataset.properties), 0),
        proposedMinutes: items.reduce((sum, item) => sum + item.proposal.durationMinutes, 0),
        conflictCount: conflicts.length,
        deficitMinutes: Math.max(0, unassignedTasks.reduce((sum, task) => sum + this.getTaskDurationMinutes(task, args.dataset.properties), 0) - items.reduce((sum, item) => sum + item.proposal.durationMinutes, 0)),
        criticalTasks: unassignedTasks.filter((task) => buildCriticality(task, this.getTaskDurationMinutes(task, args.dataset.properties), args.settings.bufferMinutes)).length,
      },
    };
  }

  private doesAbsenceAffectTask(absence: WorkerAbsence, task: RawPlanningTask) {
    if (task.date < absence.startDate || task.date > absence.endDate) return false;
    if (!absence.startTime || !absence.endTime) return true;
    return overlapsTime(
      { date: task.date, startTime: task.start_time, endTime: task.end_time },
      { date: task.date, startTime: absence.startTime, endTime: absence.endTime },
    );
  }

  private validateTaskWindow(task: RawPlanningTask, durationMinutes: number, bufferMinutes: number): { ok: true } | { ok: false; code: PlanningConflictCode; message: string } {
    const checkOut = toMinutes(task.check_out);
    const checkIn = toMinutes(task.check_in);
    const start = toMinutes(task.start_time);
    const end = toMinutes(task.end_time);

    if (checkOut == null || checkIn == null || start == null || end == null || end <= start) {
      return { ok: false, code: 'invalid-window', message: 'La tarea tiene horario o ventana de check-in/check-out incompleta.' };
    }

    if ((end - start) < durationMinutes) {
      return { ok: false, code: 'invalid-window', message: 'La duración prevista supera el tramo horario actual de la tarea.' };
    }

    if (start < checkOut + bufferMinutes || end > checkIn - bufferMinutes) {
      return { ok: false, code: 'outside-window', message: 'La tarea no cabe dentro de la ventana operativa entre check-out y check-in.' };
    }

    return { ok: true };
  }

  private buildAvailabilityState(args: {
    cleaner: Cleaner;
    date: string;
    dataset: PlanningDataset;
    settings: PlanningSettings;
    scheduledTasks: RawPlanningTask[];
  }): AvailabilityState {
    const assignmentTasks = args.scheduledTasks
      .filter((task) => getTaskCleanerIds(task).includes(args.cleaner.id))
      .map(mapTaskForAvailability);
    const built = buildEffectiveAvailabilityForDate({
      cleaner: args.cleaner,
      date: args.date,
      weeklyAvailability: args.dataset.weeklyAvailability,
      absences: args.dataset.absences,
      fixedDaysOff: args.dataset.fixedDaysOff,
      maintenanceCleanings: args.dataset.maintenanceCleanings,
      assignedTasks: assignmentTasks,
      fallbackCapacityMinutes: args.cleaner.planningMaxDailyMinutes || args.settings.fallbackDailyCapacityMinutes,
    });

    const dailyCap = args.cleaner.planningMaxDailyMinutes || args.settings.fallbackDailyCapacityMinutes;
    return {
      cleaner: args.cleaner,
      date: args.date,
      availableMinutes: Math.min(built.availableMinutes, dailyCap),
      assignedMinutes: built.assignedMinutes,
      remainingMinutes: Math.min(Math.max(0, built.remainingMinutes), dailyCap),
      isAvailable: built.isAvailable,
      availableStart: built.availableWindows[0]?.startTime,
      availableEnd: built.availableWindows[0]?.endTime,
    };
  }

  private buildCandidates(args: {
    task: RawPlanningTask;
    property: Property;
    propertyGroup: PropertyGroup;
    dataset: PlanningDataset;
    settings: PlanningSettings;
    requiredCleaners: number;
    proposedIntervals: Map<string, Array<{ taskId: string; date: string; startTime: string; endTime: string }>>;
  }): PlannerCandidate[] {
    const workerSourceMap = new Map<string, { cleaner: Cleaner; roleType: PlanningRoleType; roleOrder: number; knowledgeLevel: number; notes?: string | null }>();
    const groupAssignments = args.dataset.cleanerGroupAssignments
      .filter((entry) => entry.propertyGroupId === args.propertyGroup.id)
      .filter((entry) => entry.isActive)
      .filter((entry) => args.settings.allowBackups || entry.roleType !== 'backup')
      .sort((a, b) => a.priority - b.priority);

    const propertyPreferred = args.dataset.propertyPreferredCleaners
      .filter((entry) => entry.property_id === args.property.id)
      .sort((a, b) => a.priority - b.priority);

    propertyPreferred.forEach((entry, index) => {
      const cleaner = args.dataset.cleaners.find((candidate) => candidate.id === entry.cleaner_id);
      if (!cleaner) return;
      workerSourceMap.set(cleaner.id, {
        cleaner,
        roleType: 'property-preferred',
        roleOrder: index,
        knowledgeLevel: 5,
        notes: entry.notes,
      });
    });

    groupAssignments.forEach((entry, index) => {
      const cleaner = args.dataset.cleaners.find((candidate) => candidate.id === entry.cleanerId);
      if (!cleaner) return;
      if (workerSourceMap.has(cleaner.id)) return;
      workerSourceMap.set(cleaner.id, {
        cleaner,
        roleType: entry.roleType === 'secondary' ? 'building-secondary' : entry.roleType === 'backup' ? 'building-backup' : 'building-primary',
        roleOrder: index,
        knowledgeLevel: entry.knowledgeLevel ?? 3,
        notes: entry.notes,
      });
    });

    if (args.propertyGroup.zone) {
      args.dataset.cleaners
        .filter((cleaner) => cleaner.planningZone && cleaner.planningZone === args.propertyGroup.zone)
        .forEach((cleaner) => {
          if (workerSourceMap.has(cleaner.id)) return;
          workerSourceMap.set(cleaner.id, {
            cleaner,
            roleType: 'same-zone',
            roleOrder: 999,
            knowledgeLevel: 1,
          });
        });
    }

    const currentWeekTasks = args.dataset.tasks.filter((task) => task.status !== 'completed');
    const durationMinutes = this.getTaskDurationMinutes(args.task, args.dataset.properties);

    return Array.from(workerSourceMap.values())
      .map((source): PlannerCandidate | null => {
        const availability = this.buildAvailabilityState({
          cleaner: source.cleaner,
          date: args.task.date,
          dataset: args.dataset,
          settings: args.settings,
          scheduledTasks: args.dataset.tasks,
        });

        const reasons: string[] = [];
        const warnings: string[] = [];
        let score = PRIMARY_ROLE_WEIGHT[source.roleType] + Math.max(0, 50 - source.roleOrder * 4) + (source.knowledgeLevel * 8);

        if (!availability.isAvailable) {
          return null;
        }

        if (availability.remainingMinutes < durationMinutes) {
          return null;
        }

        const projectedIntervals = args.proposedIntervals.get(source.cleaner.id) || [];
        const hasOverlap = projectedIntervals.some((interval) => overlapsTime(interval, {
          date: args.task.date,
          startTime: args.task.start_time,
          endTime: args.task.end_time,
        })) || args.dataset.tasks.some((task) => {
          if (task.id === args.task.id) return false;
          if (!getTaskCleanerIds(task).includes(source.cleaner.id)) return false;
          return overlapsTime(
            { date: task.date, startTime: task.start_time, endTime: task.end_time },
            { date: args.task.date, startTime: args.task.start_time, endTime: args.task.end_time },
          );
        });

        if (hasOverlap) {
          return null;
        }

        if (args.property.planningRequiresLinenLoad && source.cleaner.planningCanHandleLinenLoad === false) {
          return null;
        }

        if ((args.property.planningComplexity || 1) >= 4 && source.cleaner.planningCanHandleComplexCleanings === false) {
          return null;
        }

        const weeklyMinutes = currentWeekTasks
          .filter((task) => getTaskCleanerIds(task).includes(source.cleaner.id))
          .filter((task) => sameWeek(task.date, args.task.date))
          .reduce((sum, task) => sum + this.getTaskDurationMinutes(task, args.dataset.properties), 0)
          + durationMinutes;

        const weeklyLimit = source.cleaner.contractHoursPerWeek
          ? source.cleaner.contractHoursPerWeek * 60 * (1 + (args.settings.weeklyTolerancePercent / 100))
          : null;

        if (weeklyLimit && weeklyMinutes > weeklyLimit) {
          return null;
        }

        reasons.push(`Es ${roleLabel(source.roleType)} para ${args.propertyGroup.displayName || args.propertyGroup.name}.`);
        reasons.push(`Mantendría ${hoursLabel(availability.remainingMinutes - durationMinutes)} de margen operativo ese día.`);

        if (source.cleaner.planningZone && args.propertyGroup.zone && source.cleaner.planningZone === args.propertyGroup.zone) {
          reasons.push(`Comparte zona operativa ${args.propertyGroup.zone}.`);
          score += 35;
        }

        if (source.notes) warnings.push(source.notes);
        if (source.cleaner.planningOperationalRestrictions) warnings.push(source.cleaner.planningOperationalRestrictions);

        if ((availability.remainingMinutes - durationMinutes) < 45) {
          warnings.push('La asignación deja menos de 45 min libres este día.');
          score -= 15;
        }

        score += Math.min(80, Math.round((availability.remainingMinutes - durationMinutes) / 6));

        return {
          cleaner: source.cleaner,
          cleanerId: source.cleaner.id,
          cleanerName: source.cleaner.name,
          roleType: source.roleType,
          score,
          reasons,
          warnings: uniqueBy(warnings, (warning) => warning),
          assignedMinutes: availability.assignedMinutes + durationMinutes,
          remainingMinutes: Math.max(0, availability.remainingMinutes - durationMinutes),
        };
      })
      .filter((candidate): candidate is PlannerCandidate => Boolean(candidate))
      .sort((a, b) => b.score - a.score || a.cleanerName.localeCompare(b.cleanerName));
  }

  private buildExplanation(
    selected: PlannerCandidate[],
    propertyGroup: PropertyGroup,
    requiredCleaners: number,
    task: RawPlanningTask,
    property: Property,
  ) {
    if (requiredCleaners === 1) {
      const [first] = selected;
      return `Asignada a ${first.cleanerName} porque es ${roleLabel(first.roleType)} de ${propertyGroup.displayName || propertyGroup.name}, conoce el entorno operativo y la tarea cabe con margen dentro del día.`;
    }

    const workerNames = selected.map((entry) => entry.cleanerName).join(', ');
    return `Se propone equipo de ${requiredCleaners} personas (${workerNames}) para ${property.codigo}, priorizando ${propertyGroup.displayName || propertyGroup.name} y manteniendo capacidad diaria suficiente.`;
  }

  private buildConflict(code: PlanningConflictCode, message: string, task: RawPlanningTask, details: Record<string, unknown> = {}): Omit<PlanningConflict, 'id' | 'runId' | 'createdAt'> {
    return {
      taskId: task.id,
      code,
      message,
      details: {
        property: task.property,
        propertyCode: task.properties?.codigo || task.property || null,
        date: task.date,
        startTime: task.start_time,
        endTime: task.end_time,
        ...details,
      },
    };
  }
}

export const operationalPlanningService = new OperationalPlanningService();

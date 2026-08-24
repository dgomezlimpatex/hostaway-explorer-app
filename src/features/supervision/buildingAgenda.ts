export type BuildingAgendaReviewType = 'quick' | 'full' | 'rework' | 'incident';
export type BuildingAgendaStatus = 'pending' | 'in_progress' | 'completed' | 'deferred' | 'blocked' | 'cancelled';

export interface BuildingAgendaPolicy {
  propertyGroupId: string;
  quickReviewEveryDays: number;
  fullReviewEveryDays: number;
  fullReviewRequiresCleaning: boolean;
  reviewOpenIncidents: boolean;
  reviewReturnedWork: boolean;
}

export interface BuildingAgendaWorkItemState {
  id: string;
  generationKey: string;
  propertyGroupId: string;
  propertyId?: string | null;
  taskId?: string | null;
  workType: BuildingAgendaReviewType;
  status: BuildingAgendaStatus;
  deferReason?: string | null;
  blockedReason?: string | null;
}

export interface BuildingAgendaBuilding { id: string; name: string; displayName?: string | null }
export interface BuildingAgendaProperty { id: string; code?: string | null; name: string; buildingId: string; active?: boolean }
export interface BuildingAgendaTask { id: string; propertyId?: string | null; date?: string | null; status?: string | null; propertyName?: string | null; checkIn?: string | null }
export interface BuildingAgendaReview { id: string; propertyId?: string | null; route_stop_id?: string | null; state?: string | null; review_type?: 'quick' | 'full' | null; created_at: string }
export interface BuildingAgendaIncident { id: string; propertyId?: string | null; status?: string | null; priority?: 'low' | 'medium' | 'high' | 'critical' | null; created_at: string }

export interface BuildingAgendaItem {
  key: string;
  buildingId: string;
  buildingName: string;
  propertyId: string;
  propertyCode?: string | null;
  propertyName: string;
  taskId?: string | null;
  type: BuildingAgendaReviewType;
  priority: number;
  status: BuildingAgendaStatus;
  reasons: string[];
  workItemId?: string | null;
}

export interface BuildingAgendaBuildingResult extends BuildingAgendaBuilding {
  properties: BuildingAgendaProperty[];
  items: BuildingAgendaItem[];
  pendingCount: number;
  completedCount: number;
  blockedCount: number;
}

export interface BuildingSupervisionAgenda {
  date: string;
  buildings: BuildingAgendaBuildingResult[];
  pendingCount: number;
  completedCount: number;
  blockedCount: number;
}

const COMPLETED_TASK_STATUSES = new Set(['completed', 'done', 'finished', 'finalized', 'closed']);
const OPEN_INCIDENT_STATUSES = new Set(['open', 'in_progress']);
const datePart = (value?: string | null): string | null => value ? value.slice(0, 10) : null;

const dayDifference = (from: string | null | undefined, to: string): number | null => {
  const fromDate = datePart(from);
  if (!fromDate) return null;
  const fromTime = Date.parse(`${fromDate}T12:00:00Z`);
  const toTime = Date.parse(`${to}T12:00:00Z`);
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) return null;
  return Math.floor((toTime - fromTime) / 86_400_000);
};

const latestByProperty = <T extends { propertyId?: string | null; created_at: string }>(items: T[]): Map<string, T> => {
  const result = new Map<string, T>();
  for (const item of items) {
    if (!item.propertyId) continue;
    const previous = result.get(item.propertyId);
    if (!previous || item.created_at > previous.created_at) result.set(item.propertyId, item);
  }
  return result;
};

const incidentPriority = (priority?: BuildingAgendaIncident['priority']): number => ({ critical: 100, high: 80, medium: 50, low: 20 }[priority || 'low'] || 20);
const defaultPolicy = (buildingId: string): BuildingAgendaPolicy => ({ propertyGroupId: buildingId, quickReviewEveryDays: 1, fullReviewEveryDays: 7, fullReviewRequiresCleaning: false, reviewOpenIncidents: true, reviewReturnedWork: true });

export function buildBuildingSupervisionAgenda(input: {
  date: string;
  buildings: BuildingAgendaBuilding[];
  properties: BuildingAgendaProperty[];
  tasks: BuildingAgendaTask[];
  reviews: BuildingAgendaReview[];
  incidents: BuildingAgendaIncident[];
  policies?: Record<string, BuildingAgendaPolicy>;
  workItems?: BuildingAgendaWorkItemState[];
}): BuildingSupervisionAgenda {
  const latestReviews = latestByProperty(input.reviews);
  const latestIncidents = latestByProperty(input.incidents);
  const tasksByProperty = new Map<string, BuildingAgendaTask[]>();
  for (const task of input.tasks) {
    if (!task.propertyId || datePart(task.date) !== input.date) continue;
    tasksByProperty.set(task.propertyId, [...(tasksByProperty.get(task.propertyId) || []), task]);
  }

  const results = input.buildings.map((building) => {
    const properties = input.properties
      .filter((property) => property.buildingId === building.id && property.active !== false)
      .sort((a, b) => (a.code || a.name).localeCompare(b.code || b.name, 'es', { numeric: true, sensitivity: 'base' }));
    const policy = input.policies?.[building.id] || defaultPolicy(building.id);
    const workItemsByKey = new Map((input.workItems || []).map((workItem) => [workItem.generationKey, workItem]));
    const items: BuildingAgendaItem[] = [];

    const addItem = (item: Omit<BuildingAgendaItem, 'status' | 'workItemId'>) => {
      const workItem = workItemsByKey.get(item.key);
      if (workItem?.status === 'cancelled') return;
      items.push({ ...item, status: workItem?.status || 'pending', workItemId: workItem?.id || null });
    };

    for (const property of properties) {
      const propertyTasks = tasksByProperty.get(property.id) || [];
      const completedTask = propertyTasks.find((task) => COMPLETED_TASK_STATUSES.has(String(task.status || '').toLowerCase()));
      const latestReview = latestReviews.get(property.id);
      const latestIncident = latestIncidents.get(property.id);
      const latestFullReview = input.reviews
        .filter((review) => review.propertyId === property.id && review.review_type === 'full')
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      const fullDue = dayDifference(latestFullReview?.created_at, input.date) === null || (dayDifference(latestFullReview?.created_at, input.date) || 0) >= policy.fullReviewEveryDays;
      const quickDue = dayDifference(latestReview?.created_at, input.date) === null || (dayDifference(latestReview?.created_at, input.date) || 0) >= policy.quickReviewEveryDays;
      const hasOpenIncident = Boolean(policy.reviewOpenIncidents && latestIncident && OPEN_INCIDENT_STATUSES.has(String(latestIncident.status || '').toLowerCase()));
      const returnedForRework = Boolean(policy.reviewReturnedWork && latestReview?.state === 'returned_for_rework');
      const hasReviewableTask = Boolean(completedTask);
      const sameDayEntry = Boolean(completedTask?.checkIn && datePart(completedTask.checkIn) === input.date);
      const label = property.name;
      const buildingName = building.displayName || building.name;

      if (hasOpenIncident) {
        addItem({ key: `${building.id}:${property.id}:incident`, buildingId: building.id, buildingName, propertyId: property.id, propertyCode: property.code, propertyName: label, taskId: completedTask?.id || propertyTasks[0]?.id || null, type: 'incident', priority: incidentPriority(latestIncident?.priority), reasons: [`Incidencia ${latestIncident?.priority === 'critical' ? 'crítica' : latestIncident?.priority === 'high' ? 'alta' : 'abierta'}`] });
        continue;
      }
      if (returnedForRework) {
        addItem({ key: `${building.id}:${property.id}:rework`, buildingId: building.id, buildingName, propertyId: property.id, propertyCode: property.code, propertyName: label, taskId: completedTask?.id || null, type: 'rework', priority: 90, reasons: ['Devuelta para repaso'] });
        continue;
      }
      if (fullDue && (!policy.fullReviewRequiresCleaning || hasReviewableTask)) {
        addItem({ key: `${building.id}:${property.id}:full`, buildingId: building.id, buildingName, propertyId: property.id, propertyCode: property.code, propertyName: label, taskId: completedTask?.id || null, type: 'full', priority: sameDayEntry ? 85 : 60, reasons: [completedTask ? 'Revisión completa programada' : 'Revisión completa periódica', ...(sameDayEntry ? ['Entrada el mismo día'] : [])] });
        continue;
      }
      if (!completedTask || !quickDue) continue;
      addItem({ key: `${building.id}:${property.id}:quick`, buildingId: building.id, buildingName, propertyId: property.id, propertyCode: property.code, propertyName: label, taskId: completedTask.id, type: 'quick', priority: sameDayEntry ? 70 : 40, reasons: ['Limpieza terminada', ...(sameDayEntry ? ['Entrada el mismo día'] : [])] });
    }

    const sortedItems = items.sort((a, b) => b.priority - a.priority || a.propertyName.localeCompare(b.propertyName, 'es', { numeric: true }));
    return {
      ...building,
      properties,
      items: sortedItems,
      pendingCount: sortedItems.filter((item) => !['completed', 'cancelled'].includes(item.status)).length,
      completedCount: sortedItems.filter((item) => item.status === 'completed').length,
      blockedCount: sortedItems.filter((item) => item.status === 'blocked').length,
    };
  });

  return {
    date: input.date,
    buildings: results,
    pendingCount: results.reduce((sum, building) => sum + building.pendingCount, 0),
    completedCount: results.reduce((sum, building) => sum + building.completedCount, 0),
    blockedCount: results.reduce((sum, building) => sum + building.blockedCount, 0),
  };
}

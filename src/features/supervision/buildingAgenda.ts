export type BuildingAgendaReviewType = 'quick' | 'full' | 'rework' | 'incident';
export type BuildingAgendaStatus = 'pending' | 'completed' | 'blocked';

export interface BuildingAgendaBuilding {
  id: string;
  name: string;
  displayName?: string | null;
}

export interface BuildingAgendaProperty {
  id: string;
  code?: string | null;
  name: string;
  buildingId: string;
  active?: boolean;
}

export interface BuildingAgendaTask {
  id: string;
  propertyId?: string | null;
  date?: string | null;
  status?: string | null;
  propertyName?: string | null;
  checkIn?: string | null;
}

export interface BuildingAgendaReview {
  id: string;
  propertyId?: string | null;
  route_stop_id?: string | null;
  state?: string | null;
  review_type?: 'quick' | 'full' | null;
  created_at: string;
}

export interface BuildingAgendaIncident {
  id: string;
  propertyId?: string | null;
  status?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'critical' | null;
  created_at: string;
}

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

const latestByProperty = <T extends { propertyId?: string | null; created_at: string }>(items: T[]): Map<string, T> => {
  const result = new Map<string, T>();
  for (const item of items) {
    if (!item.propertyId) continue;
    const previous = result.get(item.propertyId);
    if (!previous || item.created_at > previous.created_at) result.set(item.propertyId, item);
  }
  return result;
};

const incidentPriority = (priority?: BuildingAgendaIncident['priority']): number => {
  if (priority === 'critical') return 100;
  if (priority === 'high') return 80;
  if (priority === 'medium') return 50;
  return 20;
};

export function buildBuildingSupervisionAgenda(input: {
  date: string;
  buildings: BuildingAgendaBuilding[];
  properties: BuildingAgendaProperty[];
  tasks: BuildingAgendaTask[];
  reviews: BuildingAgendaReview[];
  incidents: BuildingAgendaIncident[];
}): BuildingSupervisionAgenda {
  const latestReviews = latestByProperty(input.reviews);
  const latestIncidents = latestByProperty(input.incidents);
  const tasksByProperty = new Map<string, BuildingAgendaTask[]>();
  for (const task of input.tasks) {
    if (!task.propertyId || datePart(task.date) !== input.date) continue;
    const current = tasksByProperty.get(task.propertyId) || [];
    current.push(task);
    tasksByProperty.set(task.propertyId, current);
  }

  const results = input.buildings.map((building) => {
    const buildingProperties = input.properties
      .filter((property) => property.buildingId === building.id && property.active !== false)
      .sort((a, b) => (a.code || a.name).localeCompare(b.code || b.name, 'es', { numeric: true, sensitivity: 'base' }));
    const items: BuildingAgendaItem[] = [];

    for (const property of buildingProperties) {
      const propertyTasks = tasksByProperty.get(property.id) || [];
      const completedTask = propertyTasks.find((task) => COMPLETED_TASK_STATUSES.has(String(task.status || '').toLowerCase()));
      const latestReview = latestReviews.get(property.id);
      const latestIncident = latestIncidents.get(property.id);
      const hasOpenIncident = Boolean(latestIncident && OPEN_INCIDENT_STATUSES.has(String(latestIncident.status || '').toLowerCase()));
      const returnedForRework = latestReview?.state === 'returned_for_rework';
      const reviewedToday = datePart(latestReview?.created_at) === input.date;
      const hasSameDayTask = propertyTasks.length > 0;

      if (hasOpenIncident) {
        items.push({
          key: `${building.id}:${property.id}:incident`, buildingId: building.id, buildingName: building.displayName || building.name,
          propertyId: property.id, propertyCode: property.code, propertyName: property.name, taskId: completedTask?.id || propertyTasks[0]?.id || null,
          type: 'incident', priority: incidentPriority(latestIncident?.priority), status: 'pending',
          reasons: [`Incidencia ${latestIncident?.priority === 'critical' ? 'crítica' : latestIncident?.priority === 'high' ? 'alta' : 'abierta'}`],
        });
        continue;
      }

      if (returnedForRework) {
        items.push({
          key: `${building.id}:${property.id}:rework`, buildingId: building.id, buildingName: building.displayName || building.name,
          propertyId: property.id, propertyCode: property.code, propertyName: property.name, taskId: completedTask?.id || null,
          type: 'rework', priority: 90, status: 'pending', reasons: ['Devuelta para repaso'],
        });
        continue;
      }

      if (!hasSameDayTask || !completedTask) continue;
      if (reviewedToday) {
        items.push({
          key: `${building.id}:${property.id}:quick`, buildingId: building.id, buildingName: building.displayName || building.name,
          propertyId: property.id, propertyCode: property.code, propertyName: property.name, taskId: completedTask.id,
          type: 'quick', priority: 0, status: 'completed', reasons: ['Revisada hoy'],
        });
        continue;
      }

      const reasons = ['Limpieza terminada'];
      if (completedTask.checkIn && datePart(completedTask.checkIn) === input.date) reasons.push('Entrada el mismo día');
      items.push({
        key: `${building.id}:${property.id}:quick`, buildingId: building.id, buildingName: building.displayName || building.name,
        propertyId: property.id, propertyCode: property.code, propertyName: property.name, taskId: completedTask.id,
        type: 'quick', priority: completedTask.checkIn && datePart(completedTask.checkIn) === input.date ? 70 : 40,
        status: 'pending', reasons,
      });
    }

    const sortedItems = items.sort((a, b) => b.priority - a.priority || a.propertyName.localeCompare(b.propertyName, 'es', { numeric: true }));
    return {
      ...building,
      properties: buildingProperties,
      items: sortedItems,
      pendingCount: sortedItems.filter((item) => item.status === 'pending').length,
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

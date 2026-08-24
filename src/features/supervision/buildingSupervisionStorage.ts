import { supabase } from '@/integrations/supabase/client';
import { taskStorageService } from '@/services/taskStorage';
import type { Task } from '@/types/calendar';
import type { SupervisionIncident, SupervisionReview, SupervisionRoute, SupervisionStop } from './types';
import { buildBuildingSupervisionAgenda, type BuildingAgendaBuildingResult, type BuildingAgendaProperty, type BuildingSupervisionAgenda } from './buildingAgenda';

// New supervision tables are intentionally kept local to this feature until generated types are refreshed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface SupervisionBuildingAssignment {
  id: string;
  property_group_id: string;
  supervisor_user_id: string;
  role_type: 'primary' | 'secondary' | 'backup';
  priority: number;
  starts_on?: string | null;
  ends_on?: string | null;
  notes?: string | null;
  is_active: boolean;
}

export interface BuildingSupervisionWorkspace {
  agenda: BuildingSupervisionAgenda;
  assignments: SupervisionBuildingAssignment[];
  tasks: Task[];
  reviews: SupervisionReview[];
  incidents: SupervisionIncident[];
  storageMode: 'remote' | 'offline';
}

const isActiveAssignment = (assignment: SupervisionBuildingAssignment, date: string) => (
  assignment.is_active
  && (!assignment.starts_on || assignment.starts_on <= date)
  && (!assignment.ends_on || assignment.ends_on >= date)
);

const mapProperty = (row: { id: string; codigo?: string | null; nombre?: string | null; is_active?: boolean | null }, buildingId: string): BuildingAgendaProperty => ({
  id: row.id,
  code: row.codigo || null,
  name: row.nombre || row.codigo || 'Propiedad sin nombre',
  buildingId,
  active: row.is_active !== false,
});

export interface SupervisionUser {
  id: string;
  full_name?: string | null;
  email?: string | null;
}

export async function getSupervisionUsers(): Promise<SupervisionUser[]> {
  const { data: roleRows, error: roleError } = await db
    .from('user_roles')
    .select('user_id')
    .eq('role', 'supervisor');
  if (roleError) throw roleError;
  const userIds = [...new Set((roleRows || []).map((row: { user_id: string }) => row.user_id))];
  if (userIds.length === 0) return [];
  const { data, error } = await db.from('profiles').select('id,full_name,email').in('id', userIds).order('full_name');
  if (error) throw error;
  return (data || []) as SupervisionUser[];
}

export async function getSupervisionBuildingAssignments(propertyGroupId: string): Promise<SupervisionBuildingAssignment[]> {
  const { data, error } = await db
    .from('supervision_building_supervisors')
    .select('id,property_group_id,supervisor_user_id,role_type,priority,starts_on,ends_on,notes,is_active')
    .eq('property_group_id', propertyGroupId)
    .order('priority', { ascending: true });
  if (error) throw error;
  return (data || []) as SupervisionBuildingAssignment[];
}

export async function assignSupervisorToBuilding(input: {
  propertyGroupId: string;
  supervisorUserId: string;
  roleType: SupervisionBuildingAssignment['role_type'];
}): Promise<SupervisionBuildingAssignment> {
  const { data, error } = await db
    .from('supervision_building_supervisors')
    .upsert({ property_group_id: input.propertyGroupId, supervisor_user_id: input.supervisorUserId, role_type: input.roleType, priority: input.roleType === 'primary' ? 10 : input.roleType === 'secondary' ? 20 : 30, is_active: true }, { onConflict: 'property_group_id,supervisor_user_id' })
    .select('id,property_group_id,supervisor_user_id,role_type,priority,starts_on,ends_on,notes,is_active')
    .single();
  if (error) throw error;
  return data as SupervisionBuildingAssignment;
}

export async function removeSupervisorFromBuilding(assignmentId: string): Promise<void> {
  const { error } = await db.from('supervision_building_supervisors').delete().eq('id', assignmentId);
  if (error) throw error;
}

export async function fetchBuildingSupervisionWorkspace(
  sedeId: string,
  userId: string,
  date: string,
): Promise<BuildingSupervisionWorkspace> {
  const { data: assignmentRows, error: assignmentError } = await db
    .from('supervision_building_supervisors')
    .select('id,property_group_id,supervisor_user_id,role_type,priority,starts_on,ends_on,notes,is_active')
    .eq('supervisor_user_id', userId)
    .eq('is_active', true)
    .order('priority', { ascending: true });
  if (assignmentError) throw assignmentError;

  const assignments = (assignmentRows || []) as SupervisionBuildingAssignment[];
  const activeAssignments = assignments.filter((assignment) => isActiveAssignment(assignment, date));
  const buildingIds = [...new Set(activeAssignments.map((assignment) => assignment.property_group_id))];
  if (buildingIds.length === 0) {
    return { agenda: { date, buildings: [], pendingCount: 0, completedCount: 0, blockedCount: 0 }, assignments: activeAssignments, tasks: [], reviews: [], incidents: [], storageMode: 'remote' };
  }

  const [groupsResult, propertyAssignmentsResult] = await Promise.all([
    db.from('property_groups').select('id,name,display_name').in('id', buildingIds).eq('is_active', true).order('name'),
    db.from('property_group_assignments').select('property_group_id,property_id').in('property_group_id', buildingIds),
  ]);
  if (groupsResult.error) throw groupsResult.error;
  if (propertyAssignmentsResult.error) throw propertyAssignmentsResult.error;

  const propertyAssignments = (propertyAssignmentsResult.data || []) as Array<{ property_group_id: string; property_id: string }>;
  const propertyIds = [...new Set(propertyAssignments.map((assignment) => assignment.property_id))];
  const propertiesResult = propertyIds.length > 0
    ? await db.from('properties').select('id,codigo,nombre,is_active').in('id', propertyIds)
    : { data: [], error: null };
  if (propertiesResult.error) throw propertiesResult.error;

  const tasks = await taskStorageService.getTasksForSupervision({ dateFrom: date, dateTo: date, sedeId });
  const [reviewsResult, incidentsResult] = await Promise.all([
    propertyIds.length > 0 ? db.from('supervision_reviews').select('id,property_id,route_stop_id,state,review_type,created_at').in('property_id', propertyIds).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    propertyIds.length > 0 ? db.from('supervision_incidents').select('id,property_id,status,priority,created_at').in('property_id', propertyIds).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (reviewsResult.error) throw reviewsResult.error;
  if (incidentsResult.error) throw incidentsResult.error;

  const propertiesById = new Map<string, { id: string; codigo?: string | null; nombre?: string | null; is_active?: boolean | null }>((propertiesResult.data || []).map((property: { id: string; codigo?: string | null; nombre?: string | null; is_active?: boolean | null }) => [property.id, property]));
  const agendaProperties: BuildingAgendaProperty[] = propertyAssignments.flatMap((assignment) => {
    const property = propertiesById.get(assignment.property_id);
    return property ? [mapProperty(property, assignment.property_group_id)] : [];
  });
  const buildings = (groupsResult.data || []) as Array<{ id: string; name: string; display_name?: string | null }>;

  const agenda = buildBuildingSupervisionAgenda({
    date,
    buildings: buildings.map((building) => ({ id: building.id, name: building.name, displayName: building.display_name })),
    properties: agendaProperties,
    tasks: tasks.map((task) => ({ id: task.id, propertyId: task.propertyId, date: task.date, status: task.status, propertyName: task.propertyName, checkIn: task.checkIn })),
    reviews: (reviewsResult.data || []) as SupervisionReview[],
    incidents: (incidentsResult.data || []) as SupervisionIncident[],
  });

  return {
    agenda,
    assignments: activeAssignments,
    tasks,
    reviews: (reviewsResult.data || []) as SupervisionReview[],
    incidents: (incidentsResult.data || []) as SupervisionIncident[],
    storageMode: 'remote',
  };
}

export async function ensureAutomaticBuildingRoute(input: {
  sedeId: string;
  date: string;
  building: BuildingAgendaBuildingResult;
  tasks: Task[];
}): Promise<{ route: SupervisionRoute; stops: SupervisionStop[] }> {
  const { data: existingRoute, error: existingError } = await db
    .from('supervision_routes')
    .select('*')
    .eq('property_group_id', input.building.id)
    .eq('route_date', input.date)
    .maybeSingle();
  if (existingError) throw existingError;

  let route = existingRoute as SupervisionRoute | null;
  if (!route) {
    const { data: createdRoute, error: routeError } = await db
      .from('supervision_routes')
      .insert({
        sede_id: input.sedeId,
        route_date: input.date,
        property_group_id: input.building.id,
        name: `Supervisión · ${input.building.displayName || input.building.name}`,
        status: 'planned',
      })
      .select('*')
      .single();
    if (routeError) {
      if (!String(routeError.message || '').toLowerCase().includes('duplicate')) throw routeError;
      const retry = await db.from('supervision_routes').select('*').eq('property_group_id', input.building.id).eq('route_date', input.date).single();
      if (retry.error) throw retry.error;
      route = retry.data as SupervisionRoute;
    } else {
      route = createdRoute as SupervisionRoute;
    }
  }

  const { data: existingStops, error: stopsError } = await db
    .from('supervision_route_stops')
    .select('*')
    .eq('route_id', route.id)
    .order('sequence', { ascending: true });
  if (stopsError) throw stopsError;

  const existingPropertyIds = new Set((existingStops || []).map((stop: SupervisionStop) => stop.property_id).filter(Boolean));
  const taskByPropertyId = new Map(input.tasks.filter((task) => task.propertyId).map((task) => [task.propertyId as string, task]));
  const missingStops = input.building.properties
    .filter((property) => !existingPropertyIds.has(property.id))
    .map((property, index) => ({
      route_id: route.id,
      sequence: (existingStops || []).length + index + 1,
      stop_type: 'apartment',
      property_id: property.id,
      property_group_id: input.building.id,
      task_id: taskByPropertyId.get(property.id)?.id || null,
      label: property.name,
      status: 'pending',
    }));

  if (missingStops.length > 0) {
    const { error: insertStopsError } = await db.from('supervision_route_stops').insert(missingStops);
    if (insertStopsError && !String(insertStopsError.message || '').toLowerCase().includes('duplicate')) throw insertStopsError;
  }

  const { data: finalStops, error: finalStopsError } = await db
    .from('supervision_route_stops')
    .select('*')
    .eq('route_id', route.id)
    .order('sequence', { ascending: true });
  if (finalStopsError) throw finalStopsError;
  return { route, stops: (finalStops || []) as SupervisionStop[] };
}

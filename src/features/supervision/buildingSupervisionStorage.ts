import { supabase } from '@/integrations/supabase/client';
import { taskStorageService } from '@/services/taskStorage';
import { formatMadridDateTime } from '@/utils/date';
import type { Task } from '@/types/calendar';
import type { SupervisionIncident, SupervisionReview, SupervisionRoute, SupervisionStop } from './types';
import { buildBuildingSupervisionAgenda, type BuildingAgendaBuildingResult, type BuildingAgendaPolicy, type BuildingAgendaProperty, type BuildingAgendaReservation, type BuildingAgendaWorkItemState, type BuildingSupervisionAgenda } from './buildingAgenda';

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
  reservations: BuildingAgendaReservation[];
  policies: Record<string, BuildingAgendaPolicy>;
  workItems: BuildingAgendaWorkItemState[];
  stockLevels: Record<string, BuildingStockLevel[]>;
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

export interface BuildingStockLevel {
  id: string;
  product_id: string;
  warehouse_id: string;
  current_quantity: number;
  minimum_quantity: number;
  target_quantity: number;
  product?: { id: string; name: string; unit_of_measure?: string | null; category?: { name?: string | null } | null } | null;
  warehouse?: { id: string; name: string; property_group_id?: string | null; location_type?: string | null } | null;
}

export interface SupervisionStockCheckLine {
  id: string;
  check_id: string;
  stock_level_id: string;
  product_id: string;
  expected_quantity: number;
  observed_quantity: number | null;
  difference: number | null;
  notes?: string | null;
  product?: { name: string; unit_of_measure?: string | null } | null;
}

export async function getBuildingStockLevels(propertyGroupId: string): Promise<BuildingStockLevel[]> {
  const { data: warehouse, error: warehouseError } = await db.from('stock_warehouses').select('id,name,property_group_id,location_type').eq('property_group_id', propertyGroupId).eq('location_type', 'building_storage').eq('is_active', true).maybeSingle();
  if (warehouseError) throw warehouseError;
  if (!warehouse) return [];
  const { data, error } = await db.from('stock_levels').select('id,product_id,warehouse_id,current_quantity,minimum_quantity,target_quantity,product:stock_products!inner(id,name,unit_of_measure,category:stock_categories(name)),warehouse:stock_warehouses!inner(id,name,property_group_id,location_type)').eq('warehouse_id', warehouse.id).eq('product.is_active', true).order('product_id');
  if (error) throw error;
  return (data || []) as BuildingStockLevel[];
}

export async function beginBuildingStockCheck(propertyGroupId: string, date: string, checkType: 'restock' | 'inventory' = 'inventory'): Promise<{ id: string; lines: SupervisionStockCheckLine[] }> {
  const { data: warehouse, error: warehouseError } = await db.from('stock_warehouses').select('id').eq('property_group_id', propertyGroupId).eq('location_type', 'building_storage').eq('is_active', true).maybeSingle();
  if (warehouseError) throw warehouseError;
  if (!warehouse) throw new Error('Este edificio todavía no tiene un trastero de stock asignado.');
  const { data: checkId, error } = await db.rpc('begin_supervision_stock_check', { _warehouse_id: warehouse.id, _property_group_id: propertyGroupId, _scheduled_date: date, _check_type: checkType });
  if (error) throw error;
  const { data: lines, error: linesError } = await db.from('supervision_stock_check_lines').select('id,check_id,stock_level_id,product_id,expected_quantity,observed_quantity,difference,notes,product:stock_products!inner(name,unit_of_measure)').eq('check_id', checkId).order('product_id');
  if (linesError) throw linesError;
  return { id: String(checkId), lines: (lines || []) as SupervisionStockCheckLine[] };
}

export async function completeBuildingStockCheck(checkId: string, lines: Array<{ id: string; observed_quantity: number; notes?: string | null }>, notes?: string | null): Promise<void> {
  for (const line of lines) {
    const { error } = await db.from('supervision_stock_check_lines').update({ observed_quantity: Math.max(0, Number(line.observed_quantity) || 0), notes: line.notes || null, updated_at: new Date().toISOString() }).eq('id', line.id).eq('check_id', checkId);
    if (error) throw error;
  }
  const { error } = await db.rpc('complete_supervision_stock_check', { _check_id: checkId, _notes: notes || null });
  if (error) throw error;
}
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

const workTypeByAgendaType: Record<string, string> = {
  quick: 'apartment_quick',
  full: 'apartment_full',
  rework: 'rework',
  incident: 'incident',
};

export async function ensureSupervisionWorkItems(input: {
  date: string;
  agenda: BuildingSupervisionAgenda;
  assignments: SupervisionBuildingAssignment[];
  userId: string;
}): Promise<BuildingAgendaWorkItemState[]> {
  const payload = input.agenda.buildings.flatMap((building) => {
    const primary = input.assignments
      .filter((assignment) => assignment.property_group_id === building.id)
      .sort((a, b) => a.priority - b.priority)[0];
    return building.items.map((item) => ({
      generation_key: item.key,
      property_group_id: item.buildingId,
      property_id: item.propertyId,
      task_id: item.taskId || null,
      assigned_supervisor_user_id: primary?.supervisor_user_id || input.userId,
      work_type: workTypeByAgendaType[item.type],
      scheduled_date: input.date,
      priority: item.priority,
      reasons: item.reasons,
      status: item.status === 'completed' ? 'completed' : 'pending',
    }));
  });
  if (payload.length === 0) return [];
  const { data, error } = await db.rpc('upsert_supervision_work_items', { _items: payload });
  if (error) throw error;
  return (data || []).map((item: Record<string, unknown>) => ({
    id: String(item.id), generationKey: String(item.generation_key), propertyGroupId: String(item.property_group_id),
    propertyId: item.property_id ? String(item.property_id) : null, taskId: item.task_id ? String(item.task_id) : null,
    workType: String(item.work_type).replace('apartment_', '') as BuildingAgendaWorkItemState['workType'],
    status: String(item.status) as BuildingAgendaWorkItemState['status'],
    deferReason: item.defer_reason ? String(item.defer_reason) : null, blockedReason: item.blocked_reason ? String(item.blocked_reason) : null,
  }));
}

export async function updateSupervisionWorkItemStatus(workItemId: string, status: BuildingAgendaWorkItemState['status'], reason?: string | null): Promise<BuildingAgendaWorkItemState> {
  const { data, error } = await db.rpc('update_supervision_work_item_status', { _work_item_id: workItemId, _status: status, _reason: reason || null });
  if (error) throw error;
  const item = data as Record<string, unknown>;
  return {
    id: String(item.id), generationKey: String(item.generation_key), propertyGroupId: String(item.property_group_id),
    propertyId: item.property_id ? String(item.property_id) : null, taskId: item.task_id ? String(item.task_id) : null,
    workType: String(item.work_type).replace('apartment_', '') as BuildingAgendaWorkItemState['workType'],
    status: String(item.status) as BuildingAgendaWorkItemState['status'],
    deferReason: item.defer_reason ? String(item.defer_reason) : null, blockedReason: item.blocked_reason ? String(item.blocked_reason) : null,
  };
}

export interface SupervisionBuildingPolicy {
  id?: string;
  property_group_id: string;
  quick_review_every_days: number;
  full_review_every_days: number;
  full_review_requires_cleaning: boolean;
  review_open_incidents: boolean;
  review_returned_work: boolean;
  is_active: boolean;
}

export async function getSupervisionBuildingPolicy(propertyGroupId: string): Promise<SupervisionBuildingPolicy> {
  const { data, error } = await db.from('supervision_building_policies').select('*').eq('property_group_id', propertyGroupId).maybeSingle();
  if (error) throw error;
  return (data || { property_group_id: propertyGroupId, quick_review_every_days: 1, full_review_every_days: 7, full_review_requires_cleaning: false, review_open_incidents: true, review_returned_work: true, is_active: true }) as SupervisionBuildingPolicy;
}

export async function upsertSupervisionBuildingPolicy(input: SupervisionBuildingPolicy): Promise<SupervisionBuildingPolicy> {
  const { data, error } = await db.from('supervision_building_policies').upsert({
    property_group_id: input.property_group_id,
    quick_review_every_days: input.quick_review_every_days,
    full_review_every_days: input.full_review_every_days,
    full_review_requires_cleaning: input.full_review_requires_cleaning,
    review_open_incidents: input.review_open_incidents,
    review_returned_work: input.review_returned_work,
    is_active: input.is_active,
  }, { onConflict: 'property_group_id' }).select('*').single();
  if (error) throw error;
  return data as SupervisionBuildingPolicy;
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
    return { agenda: { date, buildings: [], pendingCount: 0, completedCount: 0, blockedCount: 0 }, assignments: activeAssignments, tasks: [], reviews: [], incidents: [], reservations: [], policies: {}, workItems: [], stockLevels: {}, storageMode: 'remote' };
  }

  const [groupsResult, propertyAssignmentsResult] = await Promise.all([
    db.from('property_groups').select('id,name,display_name,check_in_time,check_out_time').in('id', buildingIds).eq('is_active', true).order('name'),
    db.from('property_group_assignments').select('property_group_id,property_id').in('property_group_id', buildingIds),
  ]);
  if (groupsResult.error) throw groupsResult.error;
  if (propertyAssignmentsResult.error) throw propertyAssignmentsResult.error;

  const propertyAssignments = (propertyAssignmentsResult.data || []) as Array<{ property_group_id: string; property_id: string }>;
  const propertyIds = [...new Set(propertyAssignments.map((assignment) => assignment.property_id))];
  const propertiesResult = propertyIds.length > 0
    ? await db.from('properties').select('id,codigo,nombre,is_active,check_out_predeterminado').in('id', propertyIds)
    : { data: [], error: null };
  if (propertiesResult.error) throw propertiesResult.error;

  const [policiesResult, workItemsResult, reservationsResult] = await Promise.all([
    db.from('supervision_building_policies').select('property_group_id,quick_review_every_days,full_review_every_days,full_review_requires_cleaning,review_open_incidents,review_returned_work').in('property_group_id', buildingIds).eq('is_active', true),
    db.from('supervision_work_items').select('id,generation_key,property_group_id,property_id,task_id,work_type,status,defer_reason,blocked_reason').in('property_group_id', buildingIds).eq('scheduled_date', date),
    propertyIds.length > 0 ? db.from('client_reservations').select('id,property_id,check_in_date,check_out_date,status').in('property_id', propertyIds).neq('status', 'cancelled').order('check_in_date', { ascending: true }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (policiesResult.error) throw policiesResult.error;
  if (workItemsResult.error) throw workItemsResult.error;
  if (reservationsResult.error) throw reservationsResult.error;

  const policies = Object.fromEntries(((policiesResult.data || []) as Array<Record<string, unknown>>).map((policy) => [String(policy.property_group_id), {
    propertyGroupId: String(policy.property_group_id),
    quickReviewEveryDays: Number(policy.quick_review_every_days || 1),
    fullReviewEveryDays: Number(policy.full_review_every_days || 7),
    fullReviewRequiresCleaning: Boolean(policy.full_review_requires_cleaning),
    reviewOpenIncidents: policy.review_open_incidents !== false,
    reviewReturnedWork: policy.review_returned_work !== false,
  }]));
  const workItems = (workItemsResult.data || []).map((item: Record<string, unknown>) => ({
    id: String(item.id), generationKey: String(item.generation_key), propertyGroupId: String(item.property_group_id),
    propertyId: item.property_id ? String(item.property_id) : null, taskId: item.task_id ? String(item.task_id) : null,
    workType: String(item.work_type) as BuildingAgendaWorkItemState['workType'], status: String(item.status) as BuildingAgendaWorkItemState['status'],
    deferReason: item.defer_reason ? String(item.defer_reason) : null, blockedReason: item.blocked_reason ? String(item.blocked_reason) : null,
  }));

  const tasks = await taskStorageService.getTasksForSupervision({ dateFrom: date, dateTo: date, sedeId });
  const [reviewsResult, incidentsResult] = await Promise.all([
    propertyIds.length > 0 ? db.from('supervision_reviews').select('id,property_id,route_stop_id,state,review_type,created_at').in('property_id', propertyIds).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    propertyIds.length > 0 ? db.from('supervision_incidents').select('id,property_id,status,priority,created_at').in('property_id', propertyIds).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (reviewsResult.error) throw reviewsResult.error;
  if (incidentsResult.error) throw incidentsResult.error;

  const propertiesById = new Map<string, { id: string; codigo?: string | null; nombre?: string | null; is_active?: boolean | null; check_out_predeterminado?: string | null }>((propertiesResult.data || []).map((property: { id: string; codigo?: string | null; nombre?: string | null; is_active?: boolean | null; check_out_predeterminado?: string | null }) => [property.id, property]));
  const buildings = (groupsResult.data || []) as Array<{ id: string; name: string; display_name?: string | null; check_in_time?: string | null; check_out_time?: string | null }>;
  const buildingsById = new Map(buildings.map((building) => [building.id, building]));
  const agendaProperties: BuildingAgendaProperty[] = propertyAssignments.flatMap((assignment) => {
    const property = propertiesById.get(assignment.property_id);
    const building = buildingsById.get(assignment.property_group_id);
    return property ? [{
      ...mapProperty(property, assignment.property_group_id),
      checkOutTime: property.check_out_predeterminado || building?.check_out_time || '11:00',
    }] : [];
  });
  const reservations: BuildingAgendaReservation[] = ((reservationsResult.data || []) as Array<{ id: string; property_id: string; check_in_date: string; check_out_date: string; status?: string | null }>).map((reservation) => ({
    id: reservation.id,
    propertyId: reservation.property_id,
    checkInDate: reservation.check_in_date,
    checkOutDate: reservation.check_out_date,
    status: reservation.status,
  }));

  const agenda = buildBuildingSupervisionAgenda({
    date,
    now: formatMadridDateTime(new Date()),
    buildings: buildings.map((building) => ({ id: building.id, name: building.name, displayName: building.display_name, checkInTime: building.check_in_time, checkOutTime: building.check_out_time })),
    properties: agendaProperties,
    tasks: tasks.map((task) => ({ id: task.id, propertyId: task.propertyId, date: task.date, status: task.status, propertyName: task.propertyName, checkIn: task.checkIn })),
    reviews: (reviewsResult.data || []) as SupervisionReview[],
    incidents: (incidentsResult.data || []) as SupervisionIncident[],
    reservations,
    policies,
  });
  const generatedWorkItems = await ensureSupervisionWorkItems({ date, agenda, assignments: activeAssignments, userId });
  const allWorkItems = [...workItems.filter((item) => !generatedWorkItems.some((generated) => generated.id === item.id)), ...generatedWorkItems];
  const finalAgenda = buildBuildingSupervisionAgenda({
    date,
    now: formatMadridDateTime(new Date()),
    buildings: buildings.map((building) => ({ id: building.id, name: building.name, displayName: building.display_name, checkInTime: building.check_in_time, checkOutTime: building.check_out_time })),
    properties: agendaProperties,
    tasks: tasks.map((task) => ({ id: task.id, propertyId: task.propertyId, date: task.date, status: task.status, propertyName: task.propertyName, checkIn: task.checkIn })),
    reviews: (reviewsResult.data || []) as SupervisionReview[],
    incidents: (incidentsResult.data || []) as SupervisionIncident[],
    reservations,
    policies,
    workItems: allWorkItems,
  });

  return {
    agenda: finalAgenda,
    assignments: activeAssignments,
    tasks,
    reviews: (reviewsResult.data || []) as SupervisionReview[],
    incidents: (incidentsResult.data || []) as SupervisionIncident[],
    reservations,
    policies,
    workItems: allWorkItems,
    stockLevels: Object.fromEntries(await Promise.all(buildingIds.map(async (buildingId) => [buildingId, await getBuildingStockLevels(buildingId)]))),
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

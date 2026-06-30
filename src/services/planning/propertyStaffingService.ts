/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/integrations/supabase/client';
import { mapPropertyFromDB } from '@/services/storage/mappers/propertyMappers';
import { mapCleanerFromDB } from '@/services/storage/mappers/cleanerMappers';
import { Property } from '@/types/property';
import { PropertyGroup } from '@/types/propertyGroups';
import {
  PlanningPropertyBuildingAssignment,
  PlanningPropertyContext,
  PlanningStaffingConfig,
  PlanningStaffingEntry,
  PlanningStaffingReplaceInput,
  PlanningStaffingRole,
  PlanningStaffingScope,
  PlanningStaffingUpsertInput,
} from '@/types/planningV2';
import { Cleaner, CleanerAvailability, Task, WorkerContract } from '@/types/calendar';

const ROLE_PRIORITY: Record<PlanningStaffingRole, number> = {
  primary: 10,
  secondary: 20,
  backup: 30,
  excluded: 90,
};

const ROLE_FROM_PRIORITY = (priority: number, isActive = true): PlanningStaffingRole => {
  if (!isActive || priority >= ROLE_PRIORITY.excluded) return 'excluded';
  if (priority < ROLE_PRIORITY.secondary) return 'primary';
  if (priority < ROLE_PRIORITY.backup) return 'secondary';
  return 'backup';
};

const normalizePriority = (role: PlanningStaffingRole, index = 0) => ROLE_PRIORITY[role] + index;

const mapPropertyGroup = (row: any): PropertyGroup => ({
  id: row.id,
  name: row.name,
  description: row.description || undefined,
  checkOutTime: row.check_out_time,
  checkInTime: row.check_in_time,
  isActive: row.is_active,
  autoAssignEnabled: row.auto_assign_enabled,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapAvailability = (row: any): CleanerAvailability => ({
  cleanerId: row.cleaner_id,
  dayOfWeek: row.day_of_week,
  isAvailable: row.is_available,
  startTime: row.start_time || undefined,
  endTime: row.end_time || undefined,
});

const mapWorkerContract = (row: any): WorkerContract => ({
  id: row.id,
  cleanerId: row.cleaner_id,
  contractType: row.contract_type,
  startDate: row.start_date,
  endDate: row.end_date || undefined,
  baseSalary: row.base_salary,
  hourlyRate: row.hourly_rate || undefined,
  overtimeRate: row.overtime_rate,
  vacationDaysPerYear: row.vacation_days_per_year,
  sickDaysPerYear: row.sick_days_per_year,
  contractHoursPerWeek: row.contract_hours_per_week,
  paymentFrequency: row.payment_frequency,
  benefits: row.benefits || {},
  notes: row.notes || undefined,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapTask = (row: any): Task => ({
  id: row.id,
  property: row.property || row.properties?.nombre || '',
  propertyCode: row.properties?.codigo,
  propertyDurationMinutes: row.properties?.duracion_servicio,
  propertyName: row.properties?.nombre,
  propertyAddress: row.properties?.direccion,
  address: row.address || row.properties?.direccion || '',
  date: row.date,
  startTime: row.start_time || '',
  endTime: row.end_time || '',
  checkIn: row.check_in || '',
  checkOut: row.check_out || '',
  type: row.type,
  status: row.status,
  cleaner: row.cleaner || undefined,
  cleanerId: row.cleaner_id || undefined,
  propertyId: row.propiedad_id || undefined,
  clienteId: row.cliente_id || undefined,
  notes: row.notes || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getActiveSedeId = (): string | null => {
  try {
    const activeSede = localStorage.getItem('activeSede');
    return activeSede ? JSON.parse(activeSede).id || null : null;
  } catch (error) {
    console.warn('Error reading active sede for planning staffing:', error);
    return null;
  }
};

export const deriveBuildingPrefix = (propertyCode?: string | null): string => {
  const code = (propertyCode || '').trim().toUpperCase();
  if (!code) return 'SIN-CODIGO';
  const [firstToken] = code.split(/[\s._/-]+/).filter(Boolean);
  const match = firstToken?.match(/^[A-Z]+\d*/);
  return match?.[0] || firstToken || code;
};

const ensureSameSede = async (input: Pick<PlanningStaffingUpsertInput, 'scope' | 'scopeId' | 'cleanerId'>) => {
  const { data: cleaner, error: cleanerError } = await supabase
    .from('cleaners')
    .select('id, sede_id')
    .eq('id', input.cleanerId)
    .single();

  if (cleanerError) throw cleanerError;
  const cleanerSedeId = (cleaner as any)?.sede_id;
  if (!cleanerSedeId) return;

  if (input.scope === 'property') {
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, sede_id')
      .eq('id', input.scopeId)
      .single();

    if (propertyError) throw propertyError;
    const propertySedeId = (property as any)?.sede_id;
    if (propertySedeId && propertySedeId !== cleanerSedeId) {
      throw new Error('No se pueden mezclar limpiadoras entre sedes en la configuración de una propiedad.');
    }
    return;
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from('property_group_assignments')
    .select('properties(sede_id)')
    .eq('property_group_id', input.scopeId);

  if (assignmentsError) throw assignmentsError;
  const sedeIds = new Set((assignments || []).map((row: any) => row.properties?.sede_id).filter(Boolean));
  if (sedeIds.size > 0 && !sedeIds.has(cleanerSedeId)) {
    throw new Error('No se pueden mezclar limpiadoras entre sedes en la configuración de un edificio/grupo.');
  }
};

class PropertyStaffingService {
  async getStaffingConfig(scope: PlanningStaffingScope, scopeId: string): Promise<PlanningStaffingConfig> {
    const entries = scope === 'property'
      ? await this.getPropertyStaffing(scopeId)
      : await this.getGroupStaffing(scopeId);

    return { scope, scopeId, entries };
  }

  async getPropertyStaffing(propertyId: string): Promise<PlanningStaffingEntry[]> {
    const { data, error } = await supabase
      .from('property_preferred_cleaners' as any)
      .select('id, property_id, cleaner_id, priority, notes, created_at, cleaners(name)')
      .eq('property_id', propertyId)
      .order('priority', { ascending: true });

    if (error) throw error;

    return ((data as any[]) || []).map((row) => ({
      id: row.id,
      scope: 'property',
      scopeId: row.property_id,
      cleanerId: row.cleaner_id,
      role: ROLE_FROM_PRIORITY(row.priority, row.priority < ROLE_PRIORITY.excluded),
      priority: row.priority,
      notes: row.notes,
      isActive: row.priority < ROLE_PRIORITY.excluded,
      createdAt: row.created_at,
      cleanerName: row.cleaners?.name,
    }));
  }

  async getGroupStaffing(groupId: string): Promise<PlanningStaffingEntry[]> {
    const { data, error } = await supabase
      .from('cleaner_group_assignments')
      .select('id, property_group_id, cleaner_id, priority, max_tasks_per_day, estimated_travel_time_minutes, is_active, created_at, updated_at, cleaners(name)')
      .eq('property_group_id', groupId)
      .order('priority', { ascending: true });

    if (error) throw error;

    return ((data as any[]) || []).map((row) => ({
      id: row.id,
      scope: 'group',
      scopeId: row.property_group_id,
      cleanerId: row.cleaner_id,
      role: ROLE_FROM_PRIORITY(row.priority, row.is_active),
      priority: row.priority,
      maxTasksPerDay: row.max_tasks_per_day,
      estimatedTravelTimeMinutes: row.estimated_travel_time_minutes,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      cleanerName: row.cleaners?.name,
    }));
  }

  async upsertStaffingEntry(input: PlanningStaffingUpsertInput): Promise<PlanningStaffingEntry> {
    await ensureSameSede(input);
    const existing = await this.getStaffingConfig(input.scope, input.scopeId);
    const sameRoleCount = existing.entries.filter((entry) => entry.role === input.role && entry.cleanerId !== input.cleanerId).length;
    const priority = normalizePriority(input.role, sameRoleCount);
    const isActive = input.role !== 'excluded';

    if (input.scope === 'property') {
      const notes = input.notes ?? (input.role === 'excluded' ? 'planning_v2:excluded' : null);
      const { data, error } = await supabase
        .from('property_preferred_cleaners' as any)
        .upsert({
          property_id: input.scopeId,
          cleaner_id: input.cleanerId,
          priority,
          notes,
        } as any, { onConflict: 'property_id,cleaner_id' })
        .select('id, property_id, cleaner_id, priority, notes, created_at, cleaners(name)')
        .single();

      if (error) throw error;
      const row = data as any;
      return {
        id: row.id,
        scope: 'property',
        scopeId: row.property_id,
        cleanerId: row.cleaner_id,
        role: ROLE_FROM_PRIORITY(row.priority, row.priority < ROLE_PRIORITY.excluded),
        priority: row.priority,
        notes: row.notes,
        isActive: row.priority < ROLE_PRIORITY.excluded,
        createdAt: row.created_at,
        cleanerName: row.cleaners?.name,
      };
    }

    const { data, error } = await supabase
      .from('cleaner_group_assignments')
      .upsert({
        property_group_id: input.scopeId,
        cleaner_id: input.cleanerId,
        priority,
        max_tasks_per_day: input.maxTasksPerDay ?? 8,
        estimated_travel_time_minutes: input.estimatedTravelTimeMinutes ?? 30,
        is_active: isActive,
      }, { onConflict: 'property_group_id,cleaner_id' })
      .select('id, property_group_id, cleaner_id, priority, max_tasks_per_day, estimated_travel_time_minutes, is_active, created_at, updated_at, cleaners(name)')
      .single();

    if (error) throw error;
    const row = data as any;
    return {
      id: row.id,
      scope: 'group',
      scopeId: row.property_group_id,
      cleanerId: row.cleaner_id,
      role: ROLE_FROM_PRIORITY(row.priority, row.is_active),
      priority: row.priority,
      maxTasksPerDay: row.max_tasks_per_day,
      estimatedTravelTimeMinutes: row.estimated_travel_time_minutes,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      cleanerName: row.cleaners?.name,
    };
  }

  async replaceStaffingEntries(input: PlanningStaffingReplaceInput): Promise<PlanningStaffingConfig> {
    if (input.scope === 'property') {
      const { error } = await supabase
        .from('property_preferred_cleaners' as any)
        .delete()
        .eq('property_id', input.scopeId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('cleaner_group_assignments')
        .delete()
        .eq('property_group_id', input.scopeId);
      if (error) throw error;
    }

    for (const entry of input.entries) {
      await this.upsertStaffingEntry({ ...entry, scope: input.scope, scopeId: input.scopeId });
    }

    return this.getStaffingConfig(input.scope, input.scopeId);
  }

  async removeStaffingEntry(scope: PlanningStaffingScope, id: string): Promise<void> {
    const table = scope === 'property' ? 'property_preferred_cleaners' : 'cleaner_group_assignments';
    const { error } = await supabase.from(table as any).delete().eq('id', id);
    if (error) throw error;
  }

  async listPropertyBuildingAssignments(properties?: Property[]): Promise<PlanningPropertyBuildingAssignment[]> {
    const propertyRows = properties || await this.getPropertiesForPlanning();
    const { data: assignments, error } = await supabase
      .from('property_group_assignments')
      .select('property_id, property_groups(id, name)');

    if (error) throw error;
    const groupsByProperty = new Map<string, { groupId: string; groupName: string }>();
    ((assignments as any[]) || []).forEach((row) => {
      if (row.property_groups) {
        groupsByProperty.set(row.property_id, {
          groupId: row.property_groups.id,
          groupName: row.property_groups.name,
        });
      }
    });

    return propertyRows.map((property) => ({
      propertyId: property.id,
      propertyCode: property.codigo,
      propertyName: property.nombre,
      buildingPrefix: deriveBuildingPrefix(property.codigo),
      ...groupsByProperty.get(property.id),
    }));
  }

  async getPropertyContext(propertyId: string, startDate?: string, endDate?: string): Promise<PlanningPropertyContext> {
    const { data: propertyRow, error: propertyError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (propertyError) throw propertyError;
    const property = mapPropertyFromDB(propertyRow as any);

    const { data: groupAssignment, error: groupError } = await supabase
      .from('property_group_assignments')
      .select('property_groups(*)')
      .eq('property_id', propertyId)
      .maybeSingle();

    if (groupError) throw groupError;
    const propertyGroup = (groupAssignment as any)?.property_groups
      ? mapPropertyGroup((groupAssignment as any).property_groups)
      : undefined;

    const [propertyStaffing, groupStaffing, availability, workerContracts, existingTasks] = await Promise.all([
      this.getPropertyStaffing(propertyId),
      propertyGroup ? this.getGroupStaffing(propertyGroup.id) : Promise.resolve([]),
      this.getAvailabilityForProperty(propertyId, propertyGroup?.id),
      this.getWorkerContractsForProperty(propertyId, propertyGroup?.id),
      this.getExistingTasks(propertyId, startDate, endDate),
    ]);

    return {
      property,
      propertyGroup,
      propertyStaffing,
      groupStaffing,
      effectiveStaffing: this.mergeEffectiveStaffing(propertyStaffing, groupStaffing),
      availability,
      workerContracts,
      existingTasks,
    };
  }

  async getCleanersForActiveSede(): Promise<Cleaner[]> {
    let query = supabase.from('cleaners').select('*').eq('is_active', true).order('sort_order', { nullsFirst: false }).order('name');
    const activeSedeId = getActiveSedeId();
    if (activeSedeId) query = query.eq('sede_id', activeSedeId);
    const { data, error } = await query;
    if (error) throw error;
    return ((data as any[]) || []).map(mapCleanerFromDB);
  }

  private mergeEffectiveStaffing(propertyStaffing: PlanningStaffingEntry[], groupStaffing: PlanningStaffingEntry[]) {
    const entriesByCleaner = new Map<string, PlanningStaffingEntry>();
    groupStaffing.forEach((entry) => entriesByCleaner.set(entry.cleanerId, entry));
    propertyStaffing.forEach((entry) => entriesByCleaner.set(entry.cleanerId, entry));

    return Array.from(entriesByCleaner.values())
      .filter((entry) => entry.role !== 'excluded' && entry.isActive)
      .sort((a, b) => a.priority - b.priority);
  }

  private async getPropertiesForPlanning(): Promise<Property[]> {
    let query = supabase.from('properties').select('*').order('codigo', { ascending: true });
    const activeSedeId = getActiveSedeId();
    if (activeSedeId) query = query.eq('sede_id', activeSedeId);
    const { data, error } = await query;
    if (error) throw error;
    return ((data as any[]) || []).map(mapPropertyFromDB);
  }

  private async getCleanerIdsForProperty(propertyId: string, groupId?: string): Promise<string[]> {
    const [propertyStaffing, groupStaffing] = await Promise.all([
      this.getPropertyStaffing(propertyId),
      groupId ? this.getGroupStaffing(groupId) : Promise.resolve([]),
    ]);
    return Array.from(new Set([...propertyStaffing, ...groupStaffing].map((entry) => entry.cleanerId)));
  }

  private async getAvailabilityForProperty(propertyId: string, groupId?: string): Promise<CleanerAvailability[]> {
    const cleanerIds = await this.getCleanerIdsForProperty(propertyId, groupId);
    if (cleanerIds.length === 0) return [];
    const { data, error } = await supabase
      .from('cleaner_availability')
      .select('*')
      .in('cleaner_id', cleanerIds)
      .order('day_of_week');

    if (error) throw error;
    return ((data as any[]) || []).map(mapAvailability);
  }

  private async getWorkerContractsForProperty(propertyId: string, groupId?: string): Promise<WorkerContract[]> {
    const cleanerIds = await this.getCleanerIdsForProperty(propertyId, groupId);
    if (cleanerIds.length === 0) return [];
    const { data, error } = await supabase
      .from('worker_contracts')
      .select('*')
      .in('cleaner_id', cleanerIds)
      .eq('is_active', true);

    if (error) throw error;
    return ((data as any[]) || []).map(mapWorkerContract);
  }

  private async getExistingTasks(propertyId: string, startDate?: string, endDate?: string): Promise<Task[]> {
    let query = supabase
      .from('tasks')
      .select('*, properties(codigo, nombre, direccion, duracion_servicio)')
      .eq('propiedad_id', propertyId)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data, error } = await query;
    if (error) throw error;
    return ((data as any[]) || []).map(mapTask);
  }
}

export const propertyStaffingService = new PropertyStaffingService();


import { supabase } from '@/integrations/supabase/client';
import { PropertyGroup, PropertyGroupAssignment, CleanerGroupAssignment, AutoAssignmentRule } from '@/types/propertyGroups';

type PropertyGroupRow = {
  id: string;
  name: string;
  internal_code?: string | null;
  display_name?: string | null;
  zone?: string | null;
  client_name?: string | null;
  supervisor_name?: string | null;
  general_instructions?: string | null;
  difficulty_level?: number | null;
  recommended_capacity?: number | null;
  planning_notes?: string | null;
  description?: string | null;
  check_out_time: string;
  check_in_time: string;
  is_active: boolean;
  auto_assign_enabled: boolean;
  created_at: string;
  updated_at: string;
};

class PropertyGroupStorageService {
  async getPropertyGroups(): Promise<PropertyGroup[]> {
    const { data, error } = await supabase
      .from('property_groups')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching property groups:', error);
      throw error;
    }

    return data?.map(this.mapFromDB) || [];
  }

  async createPropertyGroup(group: Omit<PropertyGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<PropertyGroup> {
    const { data, error } = await supabase
      .from('property_groups')
      .insert({
        name: group.name,
        internal_code: group.internalCode,
        display_name: group.displayName,
        zone: group.zone,
        client_name: group.clientName,
        supervisor_name: group.supervisorName,
        general_instructions: group.generalInstructions,
        difficulty_level: group.difficultyLevel ?? 1,
        recommended_capacity: group.recommendedCapacity ?? 1,
        planning_notes: group.planningNotes,
        description: group.description,
        check_out_time: group.checkOutTime,
        check_in_time: group.checkInTime,
        is_active: group.isActive,
        auto_assign_enabled: group.autoAssignEnabled
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating property group:', error);
      throw error;
    }

    return this.mapFromDB(data);
  }

  async updatePropertyGroup(id: string, updates: Partial<PropertyGroup>): Promise<PropertyGroup> {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.internalCode !== undefined) dbUpdates.internal_code = updates.internalCode;
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
    if (updates.zone !== undefined) dbUpdates.zone = updates.zone;
    if (updates.clientName !== undefined) dbUpdates.client_name = updates.clientName;
    if (updates.supervisorName !== undefined) dbUpdates.supervisor_name = updates.supervisorName;
    if (updates.generalInstructions !== undefined) dbUpdates.general_instructions = updates.generalInstructions;
    if (updates.difficultyLevel !== undefined) dbUpdates.difficulty_level = updates.difficultyLevel;
    if (updates.recommendedCapacity !== undefined) dbUpdates.recommended_capacity = updates.recommendedCapacity;
    if (updates.planningNotes !== undefined) dbUpdates.planning_notes = updates.planningNotes;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.checkOutTime !== undefined) dbUpdates.check_out_time = updates.checkOutTime;
    if (updates.checkInTime !== undefined) dbUpdates.check_in_time = updates.checkInTime;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    if (updates.autoAssignEnabled !== undefined) dbUpdates.auto_assign_enabled = updates.autoAssignEnabled;

    const { data, error } = await supabase
      .from('property_groups')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating property group:', error);
      throw error;
    }

    return this.mapFromDB(data);
  }

  async deletePropertyGroup(id: string): Promise<void> {
    const { error } = await supabase
      .from('property_groups')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting property group:', error);
      throw error;
    }
  }

  // Property assignments
  async getAllPropertyAssignments(): Promise<PropertyGroupAssignment[]> {
    const { data, error } = await supabase
      .from('property_group_assignments')
      .select('*');

    if (error) {
      console.error('Error fetching all property assignments:', error);
      throw error;
    }

    return data?.map(row => ({
      id: row.id,
      propertyGroupId: row.property_group_id,
      propertyId: row.property_id,
      createdAt: row.created_at
    })) || [];
  }

  async getPropertyAssignments(groupId: string): Promise<PropertyGroupAssignment[]> {
    const { data, error } = await supabase
      .from('property_group_assignments')
      .select('*')
      .eq('property_group_id', groupId);

    if (error) {
      console.error('Error fetching property assignments:', error);
      throw error;
    }

    return data?.map(row => ({
      id: row.id,
      propertyGroupId: row.property_group_id,
      propertyId: row.property_id,
      createdAt: row.created_at
    })) || [];
  }

  async assignPropertyToGroup(groupId: string, propertyId: string): Promise<PropertyGroupAssignment> {
    const { data: existingAssignment, error: existingError } = await supabase
      .from('property_group_assignments')
      .select('id, property_group_id')
      .eq('property_id', propertyId)
      .maybeSingle();

    if (existingError) {
      console.error('Error checking existing property assignment:', existingError);
      throw existingError;
    }

    if (existingAssignment) {
      throw new Error('Esta propiedad ya está asignada a otro edificio operativo.');
    }

    const { data, error } = await supabase
      .from('property_group_assignments')
      .insert({
        property_group_id: groupId,
        property_id: propertyId
      })
      .select()
      .single();

    if (error) {
      console.error('Error assigning property to group:', error);
      throw error;
    }

    return {
      id: data.id,
      propertyGroupId: data.property_group_id,
      propertyId: data.property_id,
      createdAt: data.created_at
    };
  }

  async removePropertyFromGroup(assignmentId: string): Promise<void> {
    const { error } = await supabase
      .from('property_group_assignments')
      .delete()
      .eq('id', assignmentId);

    if (error) {
      console.error('Error removing property from group:', error);
      throw error;
    }
  }

  // Cleaner assignments
  async getCleanerAssignments(groupId: string): Promise<CleanerGroupAssignment[]> {
    const { data, error } = await supabase
      .from('cleaner_group_assignments')
      .select('*')
      .eq('property_group_id', groupId)
      .order('priority');

    if (error) {
      console.error('Error fetching cleaner assignments:', error);
      throw error;
    }

    return data?.map(row => ({
      id: row.id,
      propertyGroupId: row.property_group_id,
      cleanerId: row.cleaner_id,
      priority: row.priority,
      roleType: row.role_type,
      knowledgeLevel: row.knowledge_level,
      maxTasksPerDay: row.max_tasks_per_day,
      maxDailyMinutesOverride: row.max_daily_minutes_override,
      estimatedTravelTimeMinutes: row.estimated_travel_time_minutes,
      notes: row.notes,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) || [];
  }

  async assignCleanerToGroup(assignment: Omit<CleanerGroupAssignment, 'id' | 'createdAt' | 'updatedAt'>): Promise<CleanerGroupAssignment> {
    const { data, error } = await supabase
      .from('cleaner_group_assignments')
      .insert({
        property_group_id: assignment.propertyGroupId,
        cleaner_id: assignment.cleanerId,
        priority: assignment.priority,
        role_type: assignment.roleType ?? 'primary',
        knowledge_level: assignment.knowledgeLevel ?? 3,
        max_tasks_per_day: assignment.maxTasksPerDay,
        max_daily_minutes_override: assignment.maxDailyMinutesOverride ?? null,
        estimated_travel_time_minutes: assignment.estimatedTravelTimeMinutes,
        notes: assignment.notes ?? null,
        is_active: assignment.isActive
      })
      .select()
      .single();

    if (error) {
      console.error('Error assigning cleaner to group:', error);
      throw error;
    }

    return {
      id: data.id,
      propertyGroupId: data.property_group_id,
      cleanerId: data.cleaner_id,
      priority: data.priority,
      roleType: data.role_type,
      knowledgeLevel: data.knowledge_level,
      maxTasksPerDay: data.max_tasks_per_day,
      maxDailyMinutesOverride: data.max_daily_minutes_override,
      estimatedTravelTimeMinutes: data.estimated_travel_time_minutes,
      notes: data.notes,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async updateCleanerAssignment(id: string, updates: Partial<CleanerGroupAssignment>): Promise<CleanerGroupAssignment> {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.roleType !== undefined) dbUpdates.role_type = updates.roleType;
    if (updates.knowledgeLevel !== undefined) dbUpdates.knowledge_level = updates.knowledgeLevel;
    if (updates.maxTasksPerDay !== undefined) dbUpdates.max_tasks_per_day = updates.maxTasksPerDay;
    if (updates.maxDailyMinutesOverride !== undefined) dbUpdates.max_daily_minutes_override = updates.maxDailyMinutesOverride;
    if (updates.estimatedTravelTimeMinutes !== undefined) dbUpdates.estimated_travel_time_minutes = updates.estimatedTravelTimeMinutes;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

    const { data, error } = await supabase
      .from('cleaner_group_assignments')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating cleaner assignment:', error);
      throw error;
    }

    return {
      id: data.id,
      propertyGroupId: data.property_group_id,
      cleanerId: data.cleaner_id,
      priority: data.priority,
      roleType: data.role_type,
      knowledgeLevel: data.knowledge_level,
      maxTasksPerDay: data.max_tasks_per_day,
      maxDailyMinutesOverride: data.max_daily_minutes_override,
      estimatedTravelTimeMinutes: data.estimated_travel_time_minutes,
      notes: data.notes,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async removeCleanerFromGroup(assignmentId: string): Promise<void> {
    const { error } = await supabase
      .from('cleaner_group_assignments')
      .delete()
      .eq('id', assignmentId);

    if (error) {
      console.error('Error removing cleaner from group:', error);
      throw error;
    }
  }

  private mapFromDB(row: PropertyGroupRow): PropertyGroup {
    return {
      id: row.id,
      name: row.name,
      internalCode: row.internal_code,
      displayName: row.display_name,
      zone: row.zone,
      clientName: row.client_name,
      supervisorName: row.supervisor_name,
      generalInstructions: row.general_instructions,
      difficultyLevel: row.difficulty_level,
      recommendedCapacity: row.recommended_capacity,
      planningNotes: row.planning_notes,
      description: row.description,
      checkOutTime: row.check_out_time,
      checkInTime: row.check_in_time,
      isActive: row.is_active,
      autoAssignEnabled: row.auto_assign_enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const propertyGroupStorage = new PropertyGroupStorageService();


import { supabase } from '@/integrations/supabase/client';
import { PropertyGroup, PropertyGroupAssignment, CleanerGroupAssignment, AutoAssignmentRule } from '@/types/propertyGroups';

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
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
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
      maxTasksPerDay: row.max_tasks_per_day,
      estimatedTravelTimeMinutes: row.estimated_travel_time_minutes,
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
        max_tasks_per_day: assignment.maxTasksPerDay,
        estimated_travel_time_minutes: assignment.estimatedTravelTimeMinutes,
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
      maxTasksPerDay: data.max_tasks_per_day,
      estimatedTravelTimeMinutes: data.estimated_travel_time_minutes,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async updateCleanerAssignment(id: string, updates: Partial<CleanerGroupAssignment>): Promise<CleanerGroupAssignment> {
    const dbUpdates: any = {};
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.maxTasksPerDay !== undefined) dbUpdates.max_tasks_per_day = updates.maxTasksPerDay;
    if (updates.estimatedTravelTimeMinutes !== undefined) dbUpdates.estimated_travel_time_minutes = updates.estimatedTravelTimeMinutes;
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
      maxTasksPerDay: data.max_tasks_per_day,
      estimatedTravelTimeMinutes: data.estimated_travel_time_minutes,
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

  private mapFromDB(row: any): PropertyGroup {
    return {
      id: row.id,
      name: row.name,
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

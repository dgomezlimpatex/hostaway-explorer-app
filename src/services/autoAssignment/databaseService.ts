
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/calendar';
import { PropertyGroup, AssignmentPattern } from '@/types/propertyGroups';
import { AssignmentResult, CleanerInfo } from './types';

export class DatabaseService {
  async getTask(taskId: string): Promise<Task | null> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      property: data.property,
      address: data.address,
      startTime: data.start_time,
      endTime: data.end_time,
      type: data.type,
      status: data.status as 'pending' | 'in-progress' | 'completed',
      checkOut: data.check_out,
      checkIn: data.check_in,
      cleaner: data.cleaner,
      backgroundColor: data.background_color,
      date: data.date,
      clienteId: data.cliente_id,
      propertyId: data.propiedad_id,
      duration: data.duracion,
      cost: data.coste,
      paymentMethod: data.metodo_pago,
      supervisor: data.supervisor,
      cleanerId: data.cleaner_id,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  async getPropertyGroup(propertyId: string | null): Promise<PropertyGroup | null> {
    if (!propertyId) return null;

    const { data, error } = await supabase
      .from('property_group_assignments')
      .select(`
        property_groups (*)
      `)
      .eq('property_id', propertyId)
      .single();

    if (error || !data) return null;

    const group = data.property_groups as any;
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      checkOutTime: group.check_out_time,
      checkInTime: group.check_in_time,
      isActive: group.is_active,
      autoAssignEnabled: group.auto_assign_enabled,
      createdAt: group.created_at,
      updatedAt: group.updated_at
    };
  }

  async getExistingTasksForDate(date: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('date', date);

    if (error || !data) return [];

    return data.map(row => ({
      id: row.id,
      property: row.property,
      address: row.address,
      startTime: row.start_time,
      endTime: row.end_time,
      type: row.type,
      status: row.status as 'pending' | 'in-progress' | 'completed',
      checkOut: row.check_out,
      checkIn: row.check_in,
      cleaner: row.cleaner,
      backgroundColor: row.background_color,
      date: row.date,
      clienteId: row.cliente_id,
      propertyId: row.propiedad_id,
      duration: row.duracion,
      cost: row.coste,
      paymentMethod: row.metodo_pago,
      supervisor: row.supervisor,
      cleanerId: row.cleaner_id,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  }

  async getAssignmentPatterns(groupId: string): Promise<AssignmentPattern[]> {
    const { data, error } = await supabase
      .from('assignment_patterns')
      .select('*')
      .eq('property_group_id', groupId);

    if (error || !data) return [];

    return data.map(row => ({
      id: row.id,
      propertyGroupId: row.property_group_id,
      cleanerId: row.cleaner_id,
      dayOfWeek: row.day_of_week,
      hourOfDay: row.hour_of_day,
      avgCompletionTimeMinutes: row.avg_completion_time_minutes,
      successRate: row.success_rate,
      preferenceScore: row.preference_score,
      lastUpdated: row.last_updated,
      sampleSize: row.sample_size
    }));
  }

  async getCleanerInfo(cleanerId: string): Promise<CleanerInfo | null> {
    const { data, error } = await supabase
      .from('cleaners')
      .select('name')
      .eq('id', cleanerId)
      .single();

    return data;
  }

  async logAssignment(taskId: string, propertyGroupId: string, result: AssignmentResult): Promise<void> {
    await supabase
      .from('auto_assignment_logs')
      .insert({
        task_id: taskId,
        property_group_id: propertyGroupId,
        assigned_cleaner_id: result.cleanerId,
        algorithm_used: result.algorithm,
        assignment_reason: result.reason,
        confidence_score: result.confidence,
        was_manual_override: false
      });
  }

  async updateTaskAssignment(taskId: string, cleanerId: string, cleanerName: string | null, confidence: number): Promise<void> {
    await supabase
      .from('tasks')
      .update({
        cleaner_id: cleanerId,
        cleaner: cleanerName,
        auto_assigned: true,
        assignment_confidence: confidence
      })
      .eq('id', taskId);
  }
}

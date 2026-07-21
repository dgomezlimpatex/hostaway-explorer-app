
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/calendar';
import { PropertyGroup, AssignmentPattern } from '@/types/propertyGroups';
import { AssignmentResult, CleanerInfo } from './types';

export class DatabaseService {
  async getTask(taskId: string): Promise<Task | null> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, task_assignments(*)')
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
      cleanerId: data.task_assignments?.[0]?.cleaner_id || data.cleaner_id,
      assignments: data.task_assignments || [],
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

    const group = data.property_groups as unknown as {
      id: string;
      name: string;
      description?: string;
      check_out_time: string;
      check_in_time: string;
      is_active: boolean;
      auto_assign_enabled: boolean;
      created_at: string;
      updated_at: string;
    };
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
      .select('*, task_assignments(*)')
      .eq('date', date);

    if (error || !data) return [];

    return data.flatMap(row => {
      const assignments = row.task_assignments || [];
      const baseTask = {
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
        assignments,
        created_at: row.created_at,
        updated_at: row.updated_at
      };

      if (assignments.length === 0) {
        return [{ ...baseTask, cleanerId: row.cleaner_id }];
      }

      return assignments.map(assignment => ({
        ...baseTask,
        cleaner: assignment.cleaner_name,
        cleanerId: assignment.cleaner_id
      }));
    });
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

  async autoAssignTask(taskId: string): Promise<AssignmentResult> {
    const { data, error } = await supabase.rpc('auto_assign_task_transactional', {
      _task_id: taskId,
      _actor_id: (await supabase.auth.getUser()).data.user?.id ?? null,
    });
    if (error) throw error;

    const result = data as unknown as {
      success: boolean;
      cleanerId?: string;
      cleanerName?: string;
      confidence?: number;
      reason?: string;
      algorithm?: string;
    };
    if (!result || typeof result.success !== 'boolean') {
      throw new Error('Resultado semántico inválido de auto_assign_task_transactional');
    }
    return {
      cleanerId: result.success ? result.cleanerId ?? null : null,
      cleanerName: result.success ? result.cleanerName ?? null : null,
      confidence: result.success ? Number(result.confidence ?? 0) : 0,
      reason: result.reason ?? (result.success ? 'Assigned' : 'No available cleaners'),
      algorithm: result.algorithm ?? 'priority-saturation-transactional-v5',
    };
  }
}

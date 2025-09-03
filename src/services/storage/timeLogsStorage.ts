import { supabase } from '@/integrations/supabase/client';
import { TimeLog } from '@/types/calendar';
import { BaseEntity } from '@/types/common';

export interface CreateTimeLogData {
  cleanerId: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  breakDurationMinutes?: number;
  notes?: string;
  // New fields from Phase 1
  taskId?: string;
  baseSalary?: number;
  overtimeMultiplier?: number;
  vacationHoursAccrued?: number;
  vacationHoursUsed?: number;
}

export interface UpdateTimeLogData {
  clockIn?: string;
  clockOut?: string;
  breakDurationMinutes?: number;
  notes?: string;
  status?: 'pending' | 'approved' | 'rejected';
  taskId?: string;
  baseSalary?: number;
  overtimeMultiplier?: number;
  vacationHoursAccrued?: number;
  vacationHoursUsed?: number;
}

const mapTimeLogFromDB = (row: any): TimeLog => ({
  id: row.id,
  created_at: row.created_at,
  updated_at: row.updated_at,
  cleanerId: row.cleaner_id,
  date: row.date,
  clockIn: row.clock_in,
  clockOut: row.clock_out,
  breakDurationMinutes: row.break_duration_minutes || 0,
  totalHours: row.total_hours || 0,
  overtimeHours: row.overtime_hours || 0,
  notes: row.notes,
  workedHours: row.worked_hours || row.total_hours || 0,
  status: row.status,
  approvedBy: row.approved_by,
  approvedAt: row.approved_at,
  // New fields from Phase 1
  taskId: row.task_id,
  baseSalary: row.base_salary,
  overtimeMultiplier: row.overtime_multiplier,
  vacationHoursAccrued: row.vacation_hours_accrued,
  vacationHoursUsed: row.vacation_hours_used
});

class TimeLogsStorageService {
  async getByCleanerAndDateRange(cleanerId: string, startDate: string, endDate: string): Promise<TimeLog[]> {
    const { data, error } = await supabase
      .from('time_logs')
      .select('*')
      .eq('cleaner_id', cleanerId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching time logs:', error);
      throw error;
    }

    return data?.map(mapTimeLogFromDB) || [];
  }

  async getByDateRange(startDate: string, endDate: string): Promise<TimeLog[]> {
    const { data, error } = await supabase
      .from('time_logs')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching time logs:', error);
      throw error;
    }

    return data?.map(mapTimeLogFromDB) || [];
  }

  async create(timeLogData: CreateTimeLogData): Promise<TimeLog> {
    const insertData: any = {
      cleaner_id: timeLogData.cleanerId,
      date: timeLogData.date,
      clock_in: timeLogData.clockIn,
      clock_out: timeLogData.clockOut,
      break_duration_minutes: timeLogData.breakDurationMinutes || 0,
      notes: timeLogData.notes
    };

    // Add new fields from Phase 1
    if (timeLogData.taskId !== undefined) insertData.task_id = timeLogData.taskId;
    if (timeLogData.baseSalary !== undefined) insertData.base_salary = timeLogData.baseSalary;
    if (timeLogData.overtimeMultiplier !== undefined) insertData.overtime_multiplier = timeLogData.overtimeMultiplier;
    if (timeLogData.vacationHoursAccrued !== undefined) insertData.vacation_hours_accrued = timeLogData.vacationHoursAccrued;
    if (timeLogData.vacationHoursUsed !== undefined) insertData.vacation_hours_used = timeLogData.vacationHoursUsed;

    const { data, error } = await supabase
      .from('time_logs')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating time log:', error);
      throw error;
    }

    return mapTimeLogFromDB(data);
  }

  async update(id: string, updates: UpdateTimeLogData): Promise<TimeLog> {
    const updateData: any = {};
    
    if (updates.clockIn !== undefined) updateData.clock_in = updates.clockIn;
    if (updates.clockOut !== undefined) updateData.clock_out = updates.clockOut;
    if (updates.breakDurationMinutes !== undefined) updateData.break_duration_minutes = updates.breakDurationMinutes;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.status !== undefined) updateData.status = updates.status;
    
    // Add new fields from Phase 1
    if (updates.taskId !== undefined) updateData.task_id = updates.taskId;
    if (updates.baseSalary !== undefined) updateData.base_salary = updates.baseSalary;
    if (updates.overtimeMultiplier !== undefined) updateData.overtime_multiplier = updates.overtimeMultiplier;
    if (updates.vacationHoursAccrued !== undefined) updateData.vacation_hours_accrued = updates.vacationHoursAccrued;
    if (updates.vacationHoursUsed !== undefined) updateData.vacation_hours_used = updates.vacationHoursUsed;

    const { data, error } = await supabase
      .from('time_logs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating time log:', error);
      throw error;
    }

    return mapTimeLogFromDB(data);
  }

  async approve(id: string, approvedBy: string): Promise<TimeLog> {
    const { data, error } = await supabase
      .from('time_logs')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error approving time log:', error);
      throw error;
    }

    return mapTimeLogFromDB(data);
  }

  async reject(id: string, approvedBy: string): Promise<TimeLog> {
    const { data, error } = await supabase
      .from('time_logs')
      .update({
        status: 'rejected',
        approved_by: approvedBy,
        approved_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error rejecting time log:', error);
      throw error;
    }

    return mapTimeLogFromDB(data);
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('time_logs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting time log:', error);
      throw error;
    }

    return true;
  }

  // Helper method to calculate weekly hours for a cleaner
  async getWeeklyHours(cleanerId: string, weekStart: string): Promise<{ regular: number; overtime: number; total: number }> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const timeLogs = await this.getByCleanerAndDateRange(
      cleanerId, 
      weekStart, 
      weekEnd.toISOString().split('T')[0]
    );

    const totalHours = timeLogs.reduce((sum, log) => sum + log.totalHours, 0);
    const overtimeHours = timeLogs.reduce((sum, log) => sum + log.overtimeHours, 0);
    const regularHours = totalHours - overtimeHours;

    return {
      regular: regularHours,
      overtime: overtimeHours,
      total: totalHours
    };
  }

  // Phase 3 methods: Task-Time integration
  async getByTaskId(taskId: string): Promise<TimeLog[]> {
    const { data, error } = await supabase
      .from('time_logs')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching time logs by task:', error);
      throw error;
    }

    return data?.map(mapTimeLogFromDB) || [];
  }

  async createFromTask(taskId: string, cleanerId: string, actualHours: number, notes?: string): Promise<TimeLog> {
    // Get task details to extract date and other info
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('date, start_time, end_time')
      .eq('id', taskId)
      .single();

    if (taskError) {
      console.error('Error fetching task for time log creation:', taskError);
      throw taskError;
    }

    const timeLogData: CreateTimeLogData = {
      cleanerId,
      date: taskData.date,
      taskId,
      breakDurationMinutes: 0, // Default, can be updated later
      notes: notes || `Tiempo registrado automáticamente desde tarea`
    };

    // Calculate clock in/out times based on actual hours
    if (taskData.start_time) {
      timeLogData.clockIn = `${taskData.date}T${taskData.start_time}`;
      
      // Calculate end time based on actual hours worked
      const startTime = new Date(`${taskData.date}T${taskData.start_time}`);
      const endTime = new Date(startTime.getTime() + (actualHours * 60 * 60 * 1000));
      timeLogData.clockOut = endTime.toISOString();
    }

    return this.create(timeLogData);
  }

  async syncWithCompletedTasks(cleanerId: string, startDate: string, endDate: string): Promise<void> {
    // Get completed tasks for cleaner in date range that don't have time logs
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, cleaner_id, date, start_time, end_time, status')
      .eq('cleaner_id', cleanerId)
      .eq('status', 'completed')
      .gte('date', startDate)
      .lte('date', endDate);

    if (tasksError) {
      console.error('Error fetching completed tasks for sync:', tasksError);
      throw tasksError;
    }

    if (!tasks || tasks.length === 0) return;

    // Check which tasks already have time logs
    const taskIds = tasks.map(t => t.id);
    const { data: existingLogs, error: logsError } = await supabase
      .from('time_logs')
      .select('task_id')
      .in('task_id', taskIds);

    if (logsError) {
      console.error('Error checking existing time logs:', logsError);
      throw logsError;
    }

    const existingTaskIds = new Set(existingLogs?.map(log => log.task_id) || []);
    const tasksWithoutLogs = tasks.filter(task => !existingTaskIds.has(task.id));

    // Create time logs for tasks without them
    for (const task of tasksWithoutLogs) {
      try {
        // Calculate hours from start/end time or default to 2 hours
        let actualHours = 2; // Default value
        if (task.start_time && task.end_time) {
          const start = new Date(`${task.date}T${task.start_time}`);
          const end = new Date(`${task.date}T${task.end_time}`);
          actualHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
        
        await this.createFromTask(
          task.id, 
          cleanerId, 
          actualHours, 
          'Sincronizado automáticamente desde tarea completada'
        );
      } catch (error) {
        console.error(`Error creating time log for task ${task.id}:`, error);
        // Continue with other tasks even if one fails
      }
    }
  }
}

export const timeLogsStorage = new TimeLogsStorageService();
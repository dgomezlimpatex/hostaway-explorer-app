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
}

export interface UpdateTimeLogData {
  clockIn?: string;
  clockOut?: string;
  breakDurationMinutes?: number;
  notes?: string;
  status?: 'pending' | 'approved' | 'rejected';
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
  status: row.status,
  approvedBy: row.approved_by,
  approvedAt: row.approved_at
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
    const { data, error } = await supabase
      .from('time_logs')
      .insert({
        cleaner_id: timeLogData.cleanerId,
        date: timeLogData.date,
        clock_in: timeLogData.clockIn,
        clock_out: timeLogData.clockOut,
        break_duration_minutes: timeLogData.breakDurationMinutes || 0,
        notes: timeLogData.notes
      })
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
}

export const timeLogsStorage = new TimeLogsStorageService();
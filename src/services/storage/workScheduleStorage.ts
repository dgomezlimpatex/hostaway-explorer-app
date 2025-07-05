import { supabase } from '@/integrations/supabase/client';
import { WorkSchedule } from '@/types/calendar';

export interface CreateWorkScheduleData {
  cleanerId: string;
  date: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  isWorkingDay?: boolean;
  scheduleType?: 'regular' | 'overtime' | 'holiday';
  notes?: string;
}

export interface UpdateWorkScheduleData {
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  isWorkingDay?: boolean;
  scheduleType?: 'regular' | 'overtime' | 'holiday';
  notes?: string;
}

const mapWorkScheduleFromDB = (row: any): WorkSchedule => ({
  id: row.id,
  created_at: row.created_at,
  updated_at: row.updated_at,
  cleanerId: row.cleaner_id,
  date: row.date,
  scheduledStartTime: row.scheduled_start_time,
  scheduledEndTime: row.scheduled_end_time,
  isWorkingDay: row.is_working_day,
  scheduleType: row.schedule_type,
  notes: row.notes
});

class WorkScheduleStorageService {
  async getByCleanerAndDateRange(cleanerId: string, startDate: string, endDate: string): Promise<WorkSchedule[]> {
    const { data, error } = await supabase
      .from('cleaner_work_schedule')
      .select('*')
      .eq('cleaner_id', cleanerId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching work schedule:', error);
      throw error;
    }

    return data?.map(mapWorkScheduleFromDB) || [];
  }

  async getByDateRange(startDate: string, endDate: string): Promise<WorkSchedule[]> {
    const { data, error } = await supabase
      .from('cleaner_work_schedule')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching work schedule:', error);
      throw error;
    }

    return data?.map(mapWorkScheduleFromDB) || [];
  }

  async create(scheduleData: CreateWorkScheduleData): Promise<WorkSchedule> {
    const { data, error } = await supabase
      .from('cleaner_work_schedule')
      .insert({
        cleaner_id: scheduleData.cleanerId,
        date: scheduleData.date,
        scheduled_start_time: scheduleData.scheduledStartTime,
        scheduled_end_time: scheduleData.scheduledEndTime,
        is_working_day: scheduleData.isWorkingDay ?? true,
        schedule_type: scheduleData.scheduleType || 'regular',
        notes: scheduleData.notes
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating work schedule:', error);
      throw error;
    }

    return mapWorkScheduleFromDB(data);
  }

  async update(id: string, updates: UpdateWorkScheduleData): Promise<WorkSchedule> {
    const updateData: any = {};
    
    if (updates.scheduledStartTime !== undefined) updateData.scheduled_start_time = updates.scheduledStartTime;
    if (updates.scheduledEndTime !== undefined) updateData.scheduled_end_time = updates.scheduledEndTime;
    if (updates.isWorkingDay !== undefined) updateData.is_working_day = updates.isWorkingDay;
    if (updates.scheduleType !== undefined) updateData.schedule_type = updates.scheduleType;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    const { data, error } = await supabase
      .from('cleaner_work_schedule')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating work schedule:', error);
      throw error;
    }

    return mapWorkScheduleFromDB(data);
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('cleaner_work_schedule')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting work schedule:', error);
      throw error;
    }

    return true;
  }

  // Bulk create schedule for multiple dates
  async createBulkSchedule(
    cleanerId: string, 
    dates: string[], 
    scheduleTemplate: Omit<CreateWorkScheduleData, 'cleanerId' | 'date'>
  ): Promise<WorkSchedule[]> {
    const schedules = dates.map(date => ({
      cleaner_id: cleanerId,
      date,
      scheduled_start_time: scheduleTemplate.scheduledStartTime,
      scheduled_end_time: scheduleTemplate.scheduledEndTime,
      is_working_day: scheduleTemplate.isWorkingDay ?? true,
      schedule_type: scheduleTemplate.scheduleType || 'regular',
      notes: scheduleTemplate.notes
    }));

    const { data, error } = await supabase
      .from('cleaner_work_schedule')
      .upsert(schedules, { onConflict: 'cleaner_id,date' })
      .select();

    if (error) {
      console.error('Error creating bulk work schedule:', error);
      throw error;
    }

    return data?.map(mapWorkScheduleFromDB) || [];
  }
}

export const workScheduleStorage = new WorkScheduleStorageService();
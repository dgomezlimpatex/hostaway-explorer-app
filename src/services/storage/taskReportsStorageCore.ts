
import { supabase } from '@/integrations/supabase/client';
import { TaskReport, CreateTaskReportData } from '@/types/taskReports';

export class TaskReportsStorageService {
  private async getActiveSedeId(): Promise<string | null> {
    try {
      const activeSede = localStorage.getItem('activeSede');
      if (activeSede) {
        const sede = JSON.parse(activeSede);
        return sede.id;
      }
      return null;
    } catch (error) {
      console.warn('Error getting active sede:', error);
      return null;
    }
  }

  async getTaskReports(): Promise<TaskReport[]> {
    console.log('📋 Fetching task reports from database...');
    console.log('📋 Current user ID:', (await supabase.auth.getUser()).data.user?.id);
    
    // Filtrar por sede a través de la relación con tasks
    const activeSedeId = await this.getActiveSedeId();
    let query = supabase
      .from('task_reports')
      .select(`
        *,
        tasks!inner(sede_id)
      `);

    if (activeSedeId) {
      query = query.eq('tasks.sede_id', activeSedeId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching task reports:', error);
      console.error('❌ Error details:', error.message, error.details, error.hint);
      throw error;
    }

    console.log('✅ Raw task reports data received:', data?.length || 0, 'reports');
    console.log('📊 First report sample:', data?.[0]);

    // Transform JSON data to proper types
    const transformedData = (data || []).map(item => ({
      ...item,
      checklist_completed: item.checklist_completed as Record<string, any>,
      issues_found: item.issues_found as any[]
    }));

    console.log('🔄 Transformed task reports count:', transformedData.length);
    return transformedData;
  }

  async getTaskReportByTaskId(taskId: string): Promise<TaskReport | null> {
    console.log('🔍 Getting task report by task ID:', taskId);
    
    // CRITICAL FIX: Apply same sede filtering as getTaskReports() to ensure consistency
    const activeSedeId = await this.getActiveSedeId();
    console.log('🏢 Active sede ID for task report lookup:', activeSedeId);
    
    let query = supabase
      .from('task_reports')
      .select(`
        *,
        tasks!inner(sede_id)
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(1);

    // Apply sede filter if active sede exists (same logic as getTaskReports)
    if (activeSedeId) {
      console.log('🔍 Filtering task report by sede:', activeSedeId);
      query = query.eq('tasks.sede_id', activeSedeId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('Error fetching task report:', error);
      throw error;
    }

    if (!data) return null;

    return {
      ...data,
      checklist_completed: data.checklist_completed as Record<string, any>,
      issues_found: data.issues_found as any[]
    };
  }

  async createTaskReport(reportData: CreateTaskReportData): Promise<TaskReport> {
    const { data, error } = await supabase
      .from('task_reports')
      .insert(reportData)
      .select()
      .single();

    if (error) {
      console.error('Error creating task report:', error);
      throw error;
    }

    return {
      ...data,
      checklist_completed: data.checklist_completed as Record<string, any>,
      issues_found: data.issues_found as any[]
    };
  }

  async updateTaskReport(reportId: string, updates: Partial<TaskReport>): Promise<TaskReport> {
    const { data, error } = await supabase
      .from('task_reports')
      .update(updates)
      .eq('id', reportId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error updating task report:', error);
      throw error;
    }

    if (!data) {
      throw new Error(`Task report with ID ${reportId} not found`);
    }

    return {
      ...data,
      checklist_completed: data.checklist_completed as Record<string, any>,
      issues_found: data.issues_found as any[]
    };
  }
}

export const taskReportsStorageService = new TaskReportsStorageService();

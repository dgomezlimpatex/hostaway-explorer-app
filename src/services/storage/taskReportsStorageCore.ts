
import { supabase } from '@/integrations/supabase/client';
import { TaskReport, CreateTaskReportData } from '@/types/taskReports';

export class TaskReportsStorageService {
  async getTaskReports(): Promise<TaskReport[]> {
    const { data, error } = await supabase
      .from('task_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching task reports:', error);
      throw error;
    }

    // Transform JSON data to proper types
    return (data || []).map(item => ({
      ...item,
      checklist_completed: item.checklist_completed as Record<string, any>,
      issues_found: item.issues_found as any[]
    }));
  }

  async getTaskReportByTaskId(taskId: string): Promise<TaskReport | null> {
    const { data, error } = await supabase
      .from('task_reports')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

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
      .single();

    if (error) {
      console.error('Error updating task report:', error);
      throw error;
    }

    return {
      ...data,
      checklist_completed: data.checklist_completed as Record<string, any>,
      issues_found: data.issues_found as any[]
    };
  }
}

export const taskReportsStorageService = new TaskReportsStorageService();

import { supabase } from '@/integrations/supabase/client';
import { TaskReport, TaskChecklistTemplate, TaskMedia, CreateTaskReportData } from '@/types/taskReports';

export class TaskReportsStorageService {
  // Plantillas de Checklist
  async getChecklistTemplates(): Promise<TaskChecklistTemplate[]> {
    const { data, error } = await supabase
      .from('task_checklists_templates')
      .select('*')
      .eq('is_active', true)
      .order('template_name');

    if (error) {
      console.error('Error fetching checklist templates:', error);
      throw error;
    }

    // Transform JSON data to proper types
    return (data || []).map(item => ({
      ...item,
      checklist_items: item.checklist_items as any
    }));
  }

  async getChecklistTemplateByPropertyType(propertyType: string): Promise<TaskChecklistTemplate | null> {
    const { data, error } = await supabase
      .from('task_checklists_templates')
      .select('*')
      .eq('property_type', propertyType)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No template found
      }
      console.error('Error fetching checklist template:', error);
      throw error;
    }

    return {
      ...data,
      checklist_items: data.checklist_items as any
    };
  }

  // Reportes de Tareas
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
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No report found
      }
      console.error('Error fetching task report:', error);
      throw error;
    }

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

  // Media de Reportes
  async getTaskMedia(reportId: string): Promise<TaskMedia[]> {
    const { data, error } = await supabase
      .from('task_media')
      .select('*')
      .eq('task_report_id', reportId)
      .order('timestamp');

    if (error) {
      console.error('Error fetching task media:', error);
      throw error;
    }

    return data || [];
  }

  async uploadMedia(file: File, reportId: string, checklistItemId?: string): Promise<TaskMedia> {
    // Generar nombre único para el archivo
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${reportId}/${fileName}`;

    // Subir archivo a storage
    const { error: uploadError } = await supabase.storage
      .from('task-reports-media')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      throw uploadError;
    }

    // Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('task-reports-media')
      .getPublicUrl(filePath);

    // Crear registro en task_media
    const mediaData = {
      task_report_id: reportId,
      media_type: file.type.startsWith('video/') ? 'video' : 'photo' as 'photo' | 'video',
      file_url: publicUrl,
      checklist_item_id: checklistItemId,
      file_size: file.size,
    };

    const { data, error } = await supabase
      .from('task_media')
      .insert(mediaData)
      .select()
      .single();

    if (error) {
      console.error('Error creating media record:', error);
      throw error;
    }

    return data;
  }

  async deleteMedia(mediaId: string): Promise<boolean> {
    // Primero obtener la información del archivo
    const { data: media, error: fetchError } = await supabase
      .from('task_media')
      .select('file_url')
      .eq('id', mediaId)
      .single();

    if (fetchError) {
      console.error('Error fetching media for deletion:', fetchError);
      throw fetchError;
    }

    // Extraer el path del archivo de la URL
    const url = new URL(media.file_url);
    const filePath = url.pathname.split('/task-reports-media/')[1];

    // Eliminar archivo de storage
    const { error: deleteFileError } = await supabase.storage
      .from('task-reports-media')
      .remove([filePath]);

    if (deleteFileError) {
      console.error('Error deleting file from storage:', deleteFileError);
      throw deleteFileError;
    }

    // Eliminar registro de la base de datos
    const { error: deleteRecordError } = await supabase
      .from('task_media')
      .delete()
      .eq('id', mediaId);

    if (deleteRecordError) {
      console.error('Error deleting media record:', deleteRecordError);
      throw deleteRecordError;
    }

    return true;
  }
}

export const taskReportsStorageService = new TaskReportsStorageService();

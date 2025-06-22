
import { supabase } from '@/integrations/supabase/client';
import { TaskMedia } from '@/types/taskReports';

export class TaskMediaStorageService {
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

export const taskMediaStorageService = new TaskMediaStorageService();

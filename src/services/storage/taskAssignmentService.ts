
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/calendar';
import { taskStorageService } from './taskStorage';

export class TaskAssignmentService {
  async assignTask(taskId: string, cleanerName: string, cleanerId?: string): Promise<Task> {
    console.log('assignTask called with:', { taskId, cleanerName, cleanerId });
    
    const updateData: any = { 
      cleaner: cleanerName
    };
    
    if (cleanerId) {
      updateData.cleanerId = cleanerId;
    }

    return taskStorageService.updateTask(taskId, updateData);
  }

  async unassignTask(taskId: string): Promise<Task> {
    return taskStorageService.updateTask(taskId, { 
      cleaner: undefined, 
      cleanerId: undefined 
    });
  }
}

export const taskAssignmentService = new TaskAssignmentService();


import { supabase } from '@/integrations/supabase/client';

export class TaskCleanupService {
  async deleteAllTasks(): Promise<boolean> {
    console.log('deleteAllTasks - starting cleanup process');
    
    // First, remove all task references from hostaway_reservations
    const { error: updateError } = await supabase
      .from('hostaway_reservations')
      .update({ task_id: null })
      .not('task_id', 'is', null);

    if (updateError) {
      console.error('Error updating hostaway_reservations:', updateError);
      throw updateError;
    }

    console.log('deleteAllTasks - cleared all task references from hostaway_reservations');

    // Then delete all tasks
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // This will delete all tasks

    if (deleteError) {
      console.error('Error deleting all tasks:', deleteError);
      throw deleteError;
    }

    console.log('deleteAllTasks - successfully deleted all tasks');
    return true;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    // First delete any hostaway_reservations that reference this task
    const { error: reservationsError } = await supabase
      .from('hostaway_reservations')
      .update({ task_id: null })
      .eq('task_id', taskId);

    if (reservationsError) {
      console.error('Error updating hostaway_reservations:', reservationsError);
      throw reservationsError;
    }

    // Then delete the task
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.error('Error deleting task:', error);
      throw error;
    }

    return true;
  }
}

export const taskCleanupService = new TaskCleanupService();

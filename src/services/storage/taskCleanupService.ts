
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
    // First check if task has assigned cleaner and send notification
    await this.sendTaskCancellationNotification(taskId);
    
    // Then delete any hostaway_reservations that reference this task
    const { error: reservationsError } = await supabase
      .from('hostaway_reservations')
      .update({ task_id: null })
      .eq('task_id', taskId);

    if (reservationsError) {
      console.error('Error updating hostaway_reservations:', reservationsError);
      throw reservationsError;
    }

    // Finally delete the task
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

  private async sendTaskCancellationNotification(taskId: string): Promise<void> {
    try {
      // Get task details including assigned cleaner
      const { data: task, error } = await supabase
        .from('tasks')
        .select(`
          *,
          cleaners!tasks_cleaner_id_fkey(
            id,
            name,
            email,
            user_id
          ),
          properties!tasks_propiedad_id_fkey(
            nombre,
            direccion
          )
        `)
        .eq('id', taskId)
        .single();

      if (error) {
        console.error('Error fetching task for notification:', error);
        return;
      }

      if (!task) {
        console.log('Task not found for notification');
        return;
      }

      // Only send email if there's an assigned cleaner
      if (!task.cleaner_id || !task.cleaners) {
        console.log('Task has no assigned cleaner, skipping notification');
        return;
      }

      console.log(`Sending cancellation notification to cleaner: ${task.cleaners.name}`);

      // Send cancellation email
      const { error: emailError } = await supabase.functions.invoke('send-task-unassignment-email', {
        body: {
          taskId: task.id,
          taskDate: task.date,
          taskStartTime: task.start_time,
          taskEndTime: task.end_time,
          propertyName: task.properties?.nombre || task.property,
          propertyAddress: task.properties?.direccion || task.address,
          cleanerName: task.cleaners.name,
          cleanerEmail: task.cleaners.email,
          reason: 'cancelled'
        }
      });

      if (emailError) {
        console.error(`Error sending cancellation email to ${task.cleaners.name}:`, emailError);
      } else {
        console.log(`Cancellation email sent successfully to ${task.cleaners.name}`);
      }

    } catch (error) {
      console.error('Error sending task cancellation notification:', error);
    }
  }
}

export const taskCleanupService = new TaskCleanupService();

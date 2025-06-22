
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

    // Update the task first
    const updatedTask = await taskStorageService.updateTask(taskId, updateData);

    // If we have cleaner ID, send email notification
    if (cleanerId) {
      try {
        await this.sendTaskAssignmentEmail(updatedTask, cleanerId);
        console.log('Task assignment email sent successfully');
      } catch (error) {
        console.error('Failed to send assignment email:', error);
        // Don't fail the assignment if email fails, but log the error
        // In production, you might want to add this to a retry queue
      }
    } else {
      console.log('No cleanerId provided, skipping email notification');
    }

    return updatedTask;
  }

  async unassignTask(taskId: string): Promise<Task> {
    return taskStorageService.updateTask(taskId, { 
      cleaner: undefined, 
      cleanerId: undefined 
    });
  }

  private async sendTaskAssignmentEmail(task: Task, cleanerId: string): Promise<void> {
    try {
      // Get cleaner details from the cleaners table
      const { data: cleaner, error: cleanerError } = await supabase
        .from('cleaners')
        .select('email, name')
        .eq('id', cleanerId)
        .single();

      if (cleanerError) {
        console.error('Error fetching cleaner details:', cleanerError);
        throw new Error(`Could not fetch cleaner details: ${cleanerError.message}`);
      }

      if (!cleaner?.email) {
        console.log('Cleaner has no email address, skipping email notification');
        return;
      }

      console.log('Sending assignment email to cleaner:', cleaner.email);

      // Prepare task data for email
      const taskData = {
        property: task.property,
        address: task.address,
        date: task.date,
        startTime: task.startTime,
        endTime: task.endTime,
        type: task.type || 'Limpieza general',
        notes: task.supervisor ? `Supervisor: ${task.supervisor}` : undefined
      };

      // Call the edge function to send the email
      const { data, error: emailError } = await supabase.functions.invoke('send-task-assignment-email', {
        body: {
          taskId: task.id,
          cleanerEmail: cleaner.email,
          cleanerName: cleaner.name,
          taskData
        }
      });

      if (emailError) {
        console.error('Error calling email function:', emailError);
        throw new Error(`Email function error: ${emailError.message}`);
      }

      console.log('Task assignment email sent successfully:', data);
    } catch (error) {
      console.error('Error sending task assignment email:', error);
      throw error;
    }
  }
}

export const taskAssignmentService = new TaskAssignmentService();

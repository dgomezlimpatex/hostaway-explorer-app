
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
    // Get the current task from database directly to send email before unassigning
    const { data: currentTask, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    
    if (error) {
      console.error('Error fetching task for unassignment:', error);
      throw new Error(`Could not fetch task: ${error.message}`);
    }
    
    // Send unassignment email if cleaner was assigned
    if (currentTask?.cleaner_id) {
      try {
        // Map the database row to Task interface for email
        const taskForEmail: Task = {
          id: currentTask.id,
          created_at: currentTask.created_at,
          updated_at: currentTask.updated_at,
          property: currentTask.property,
          address: currentTask.address,
          startTime: currentTask.start_time,
          endTime: currentTask.end_time,
          type: currentTask.type,
          status: currentTask.status as 'pending' | 'in-progress' | 'completed',
          checkOut: currentTask.check_out,
          checkIn: currentTask.check_in,
          cleaner: currentTask.cleaner,
          backgroundColor: currentTask.background_color,
          date: currentTask.date,
          clienteId: currentTask.cliente_id,
          propertyId: currentTask.propiedad_id,
          duration: currentTask.duracion,
          cost: currentTask.coste,
          paymentMethod: currentTask.metodo_pago,
          supervisor: currentTask.supervisor,
          cleanerId: currentTask.cleaner_id
        };
        
        await this.sendTaskUnassignmentEmail(taskForEmail, currentTask.cleaner_id, 'unassigned');
        console.log('Task unassignment email sent successfully');
      } catch (error) {
        console.error('Failed to send unassignment email:', error);
      }
    }

    return taskStorageService.updateTask(taskId, { 
      cleaner: undefined, 
      cleanerId: undefined 
    });
  }

  async updateTaskSchedule(taskId: string, updates: Partial<Task>, originalTask?: Task): Promise<Task> {
    // If we don't have the original task, fetch it
    if (!originalTask) {
      originalTask = await taskStorageService.getTasks().then(tasks => 
        tasks.find(t => t.id === taskId)
      );
    }

    // Update the task first
    const updatedTask = await taskStorageService.updateTask(taskId, updates);

    // Check if schedule changed and cleaner is assigned
    if (originalTask?.cleanerId && this.hasScheduleChanged(originalTask, updatedTask)) {
      try {
        await this.sendTaskScheduleChangeEmail(updatedTask, originalTask.cleanerId, originalTask);
        console.log('Task schedule change email sent successfully');
      } catch (error) {
        console.error('Failed to send schedule change email:', error);
      }
    }

    return updatedTask;
  }

  async cancelTask(taskId: string): Promise<Task> {
    // Get the current task to send email before cancelling
    const currentTask = await taskStorageService.getTasks().then(tasks => 
      tasks.find(t => t.id === taskId)
    );
    
    // Send cancellation email if cleaner was assigned
    if (currentTask?.cleanerId) {
      try {
        await this.sendTaskUnassignmentEmail(currentTask, currentTask.cleanerId, 'cancelled');
        console.log('Task cancellation email sent successfully');
      } catch (error) {
        console.error('Failed to send cancellation email:', error);
      }
    }

    // Update task to remove assignment (we'll use delete instead of status change)
    return taskStorageService.updateTask(taskId, { 
      cleaner: undefined, 
      cleanerId: undefined 
    });
  }

  private hasScheduleChanged(originalTask: Task, updatedTask: Task): boolean {
    return (
      originalTask.date !== updatedTask.date ||
      originalTask.startTime !== updatedTask.startTime ||
      originalTask.endTime !== updatedTask.endTime
    );
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

  private async sendTaskScheduleChangeEmail(task: Task, cleanerId: string, originalTask: Task): Promise<void> {
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

      console.log('Sending schedule change email to cleaner:', cleaner.email);

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

      const changes = {
        oldDate: originalTask.date !== task.date ? originalTask.date : undefined,
        oldStartTime: originalTask.startTime !== task.startTime ? originalTask.startTime : undefined,
        oldEndTime: originalTask.endTime !== task.endTime ? originalTask.endTime : undefined,
      };

      // Call the edge function to send the email
      const { data, error: emailError } = await supabase.functions.invoke('send-task-schedule-change-email', {
        body: {
          taskId: task.id,
          cleanerEmail: cleaner.email,
          cleanerName: cleaner.name,
          taskData,
          changes
        }
      });

      if (emailError) {
        console.error('Error calling schedule change email function:', emailError);
        throw new Error(`Email function error: ${emailError.message}`);
      }

      console.log('Task schedule change email sent successfully:', data);
    } catch (error) {
      console.error('Error sending task schedule change email:', error);
      throw error;
    }
  }

  private async sendTaskUnassignmentEmail(task: Task, cleanerId: string, reason: 'unassigned' | 'cancelled'): Promise<void> {
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

      console.log('Sending unassignment email to cleaner:', cleaner.email, 'reason:', reason);

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
      const { data, error: emailError } = await supabase.functions.invoke('send-task-unassignment-email', {
        body: {
          taskId: task.id,
          cleanerEmail: cleaner.email,
          cleanerName: cleaner.name,
          taskData,
          reason
        }
      });

      if (emailError) {
        console.error('Error calling unassignment email function:', emailError);
        throw new Error(`Email function error: ${emailError.message}`);
      }

      console.log('Task unassignment email sent successfully:', data);
    } catch (error) {
      console.error('Error sending task unassignment email:', error);
      throw error;
    }
  }
}

export const taskAssignmentService = new TaskAssignmentService();

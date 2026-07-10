
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/calendar';
import { taskStorageService } from './taskStorage';
import { recordAiObservedEvent } from '@/services/aiObservedEvents';
import { multipleTaskAssignmentService } from './multipleTaskAssignmentService';
import { executeCanonicalTaskAssignmentChange } from '@/utils/taskAssignmentExecution';

export class TaskAssignmentService {
  private async getCurrentCleanerIds(taskId: string, task?: Task | null): Promise<string[]> {
    const assignments = await multipleTaskAssignmentService.getTaskAssignments(taskId);
    const cleanerIds = Array.from(new Set(assignments.map((assignment) => assignment.cleaner_id).filter(Boolean)));
    if (cleanerIds.length === 0 && task?.cleanerId) cleanerIds.push(task.cleanerId);
    return cleanerIds;
  }

  async assignTask(taskId: string, cleanerName: string, cleanerId?: string): Promise<Task> {
    console.log('assignTask called with:', { taskId, cleanerName, cleanerId });

    if (cleanerId) {
      const currentTask = await taskStorageService.getById(taskId);
      const previousCleanerIds = await this.getCurrentCleanerIds(taskId, currentTask);

      await executeCanonicalTaskAssignmentChange({
        taskId,
        nextCleanerIds: [cleanerId],
        previousCleanerIds,
      }, {
        setAssignments: (id, cleanerIds) => multipleTaskAssignmentService.setTaskAssignments(id, cleanerIds),
        updateSchedule: (id, startTime, endTime) => taskStorageService.updateTask(id, { startTime, endTime }),
      });

      const updatedTask = await taskStorageService.getById(taskId);
      if (!updatedTask) throw new Error('No se pudo recargar la tarea después de asignarla.');

      void recordAiObservedEvent({
        eventType: 'task_assigned',
        entityType: 'tasks',
        entityId: taskId,
        summary: `Asignada tarea ${updatedTask.property} a ${cleanerName}`,
        afterData: {
          taskId,
          property: updatedTask.property,
          date: updatedTask.date,
          startTime: updatedTask.startTime,
          endTime: updatedTask.endTime,
          cleaner: cleanerName,
          cleanerId,
        },
        metadata: { source: 'taskAssignmentService.assignTask.canonical' },
      });
      return updatedTask;
    }

    const updatedTask = await taskStorageService.updateTask(taskId, { cleaner: cleanerName });
    console.log('No cleanerId provided; used legacy name-only assignment fallback');
    return updatedTask;
  }

  /**
   * Reasigna y, cuando procede, reprograma usando `task_assignments` como fuente
   * autoritativa. Si falla uno de los pasos, restaura responsables y horario.
   */
  async assignTaskWithSchedule(
    taskId: string,
    cleanerName: string,
    cleanerId: string,
    startTime?: string,
    endTime?: string
  ): Promise<Task> {
    console.log('assignTaskWithSchedule called:', { taskId, cleanerName, cleanerId, startTime, endTime });

    const currentTask = await taskStorageService.getById(taskId);
    if (!currentTask) throw new Error('No se encontró la tarea para reasignarla.');

    const previousCleanerIds = await this.getCurrentCleanerIds(taskId, currentTask);
    const hasScheduleChange = Boolean(startTime && endTime);

    await executeCanonicalTaskAssignmentChange({
      taskId,
      nextCleanerIds: [cleanerId],
      previousCleanerIds,
      nextSchedule: hasScheduleChange ? { startTime: startTime!, endTime: endTime! } : undefined,
      previousSchedule: hasScheduleChange
        ? { startTime: currentTask.startTime, endTime: currentTask.endTime }
        : undefined,
    }, {
      setAssignments: (id, cleanerIds) => multipleTaskAssignmentService.setTaskAssignments(id, cleanerIds),
      updateSchedule: (id, nextStartTime, nextEndTime) => taskStorageService.updateTask(id, {
        startTime: nextStartTime,
        endTime: nextEndTime,
      }),
    });

    const updatedTask = await taskStorageService.getById(taskId);
    if (!updatedTask) throw new Error('No se pudo recargar la tarea después de reasignarla.');

    void recordAiObservedEvent({
      eventType: 'task_assigned_with_schedule',
      entityType: 'tasks',
      entityId: taskId,
      summary: `Asignada tarea ${updatedTask.property} a ${cleanerName} con horario`,
      afterData: {
        taskId,
        property: updatedTask.property,
        date: updatedTask.date,
        startTime: updatedTask.startTime,
        endTime: updatedTask.endTime,
        cleaner: cleanerName,
        cleanerId,
      },
      metadata: { source: 'taskAssignmentService.assignTaskWithSchedule.canonical' },
    });

    return updatedTask;
  }

  async unassignTask(taskId: string): Promise<Task> {
    const currentTask = await taskStorageService.getById(taskId);
    if (!currentTask) throw new Error('No se encontró la tarea para desasignarla.');

    const previousCleanerIds = await this.getCurrentCleanerIds(taskId, currentTask);

    await executeCanonicalTaskAssignmentChange({
      taskId,
      nextCleanerIds: [],
      previousCleanerIds,
    }, {
      setAssignments: (id, cleanerIds) => multipleTaskAssignmentService.setTaskAssignments(id, cleanerIds),
      updateSchedule: (id, startTime, endTime) => taskStorageService.updateTask(id, { startTime, endTime }),
    });

    const updatedTask = await taskStorageService.getById(taskId);
    if (!updatedTask) throw new Error('No se pudo recargar la tarea después de desasignarla.');

    void recordAiObservedEvent({
      eventType: 'task_unassigned',
      entityType: 'tasks',
      entityId: taskId,
      summary: `Desasignada tarea ${updatedTask.property}`,
      beforeData: currentTask,
      afterData: {
        id: updatedTask.id,
        property: updatedTask.property,
        date: updatedTask.date,
        startTime: updatedTask.startTime,
        endTime: updatedTask.endTime,
        cleaner: updatedTask.cleaner,
        cleanerId: updatedTask.cleanerId,
      },
      metadata: { source: 'taskAssignmentService.unassignTask.canonical' },
    });

    return updatedTask;
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
    void recordAiObservedEvent({
      eventType: 'task_schedule_updated',
      entityType: 'tasks',
      entityId: taskId,
      summary: `Actualizado horario de tarea ${updatedTask.property}`,
      beforeData: originalTask ? {
        id: originalTask.id,
        date: originalTask.date,
        startTime: originalTask.startTime,
        endTime: originalTask.endTime,
        cleaner: originalTask.cleaner,
        cleanerId: originalTask.cleanerId,
      } : null,
      afterData: {
        id: updatedTask.id,
        date: updatedTask.date,
        startTime: updatedTask.startTime,
        endTime: updatedTask.endTime,
        cleaner: updatedTask.cleaner,
        cleanerId: updatedTask.cleanerId,
      },
      metadata: { source: 'taskAssignmentService.updateTaskSchedule', changedFields: Object.keys(updates) },
    });

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
      // IMPORTANT: Fetch fresh task data from database to ensure we have the latest times
      // This fixes the issue where emails were sent with outdated start/end times
      const { data: freshTaskData, error: taskError } = await supabase
        .from('tasks')
        .select('*, properties!tasks_propiedad_id_fkey(nombre, direccion)')
        .eq('id', task.id)
        .single();

      if (taskError) {
        console.error('Error fetching fresh task data:', taskError);
        // Fall back to the task object we have if fresh fetch fails
      }

      // Use fresh data from DB if available, otherwise fall back to passed task object
      const taskForEmail = freshTaskData ? {
        property: freshTaskData.property,
        address: freshTaskData.address || freshTaskData.properties?.direccion,
        date: freshTaskData.date,
        startTime: freshTaskData.start_time,
        endTime: freshTaskData.end_time,
        type: freshTaskData.type,
        supervisor: freshTaskData.supervisor
      } : {
        property: task.property,
        address: task.address,
        date: task.date,
        startTime: task.startTime,
        endTime: task.endTime,
        type: task.type,
        supervisor: task.supervisor
      };

      console.log('📧 Task data for email (fresh from DB):', taskForEmail);

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

      // Prepare task data for email using fresh data
      const taskData = {
        property: taskForEmail.property,
        address: taskForEmail.address,
        date: taskForEmail.date,
        startTime: taskForEmail.startTime,
        endTime: taskForEmail.endTime,
        type: taskForEmail.type || 'Limpieza general',
        notes: taskForEmail.supervisor ? `Supervisor: ${taskForEmail.supervisor}` : undefined
      };

      console.log('📧 Final email taskData:', taskData);

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
      // IMPORTANT: Fetch fresh task data from database to ensure we have the latest times
      const { data: freshTaskData, error: taskError } = await supabase
        .from('tasks')
        .select('*, properties!tasks_propiedad_id_fkey(nombre, direccion)')
        .eq('id', task.id)
        .single();

      if (taskError) {
        console.error('Error fetching fresh task data:', taskError);
      }

      // Use fresh data from DB if available
      const taskForEmail = freshTaskData ? {
        property: freshTaskData.property,
        address: freshTaskData.address || freshTaskData.properties?.direccion,
        date: freshTaskData.date,
        startTime: freshTaskData.start_time,
        endTime: freshTaskData.end_time,
        type: freshTaskData.type,
        supervisor: freshTaskData.supervisor
      } : {
        property: task.property,
        address: task.address,
        date: task.date,
        startTime: task.startTime,
        endTime: task.endTime,
        type: task.type,
        supervisor: task.supervisor
      };

      console.log('📧 Schedule change email - Task data (fresh from DB):', taskForEmail);

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

      // Prepare task data for email using fresh data
      const taskData = {
        property: taskForEmail.property,
        address: taskForEmail.address,
        date: taskForEmail.date,
        startTime: taskForEmail.startTime,
        endTime: taskForEmail.endTime,
        type: taskForEmail.type || 'Limpieza general',
        notes: taskForEmail.supervisor ? `Supervisor: ${taskForEmail.supervisor}` : undefined
      };

      const changes = {
        oldDate: originalTask.date,
        oldStartTime: originalTask.startTime !== taskForEmail.startTime ? originalTask.startTime : undefined,
        oldEndTime: originalTask.endTime !== taskForEmail.endTime ? originalTask.endTime : undefined,
      };

      console.log('📧 Final schedule change email taskData:', taskData, 'changes:', changes);

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
      // IMPORTANT: Fetch fresh task data from database to ensure we have the latest times
      const { data: freshTaskData, error: taskError } = await supabase
        .from('tasks')
        .select('*, properties!tasks_propiedad_id_fkey(nombre, direccion)')
        .eq('id', task.id)
        .single();

      if (taskError) {
        console.error('Error fetching fresh task data:', taskError);
      }

      // Use fresh data from DB if available
      const taskForEmail = freshTaskData ? {
        property: freshTaskData.property,
        address: freshTaskData.address || freshTaskData.properties?.direccion,
        date: freshTaskData.date,
        startTime: freshTaskData.start_time,
        endTime: freshTaskData.end_time,
        type: freshTaskData.type,
        supervisor: freshTaskData.supervisor
      } : {
        property: task.property,
        address: task.address,
        date: task.date,
        startTime: task.startTime,
        endTime: task.endTime,
        type: task.type,
        supervisor: task.supervisor
      };

      console.log('📧 Unassignment email - Task data (fresh from DB):', taskForEmail);

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

      // Prepare task data for email using fresh data
      const taskData = {
        property: taskForEmail.property,
        address: taskForEmail.address,
        date: taskForEmail.date,
        startTime: taskForEmail.startTime,
        endTime: taskForEmail.endTime,
        type: taskForEmail.type || 'Limpieza general',
        notes: taskForEmail.supervisor ? `Supervisor: ${taskForEmail.supervisor}` : undefined
      };

      console.log('📧 Final unassignment email taskData:', taskData);

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
